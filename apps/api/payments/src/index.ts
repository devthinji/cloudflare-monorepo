import { Hono } from 'hono'
import { rateLimiter } from 'hono-rate-limiter'
import { drizzle } from 'drizzle-orm/d1'
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { eq, desc } from 'drizzle-orm'
import type { PaymentsWorkerEnv } from '@repo/types'
import { ok, err, generateId, now } from '@repo/utils'
import { createLogger } from './lib/logger'
import {
  getDarajaToken, stkPush, stkQuery, parseStkCallback,
  type DarajaEnv,
} from './lib/daraja'

const app = new Hono<{ Bindings: PaymentsWorkerEnv }>()

// ─── Transactions schema ─────────────────────────────────────────────────────

const transactions = sqliteTable('transactions', {
  id:                 text('id').primaryKey(),
  userId:             text('user_id').notNull(),
  agentSlug:          text('agent_slug').notNull(),
  provider:           text('provider').notNull().default('mpesa'),
  amount:             real('amount').notNull(),
  currency:           text('currency').notNull().default('KES'),
  status:             text('status').notNull().default('pending'),
  merchantRequestId:  text('merchant_request_id'),
  checkoutRequestId:  text('checkout_request_id'),
  mpesaReceiptNumber: text('mpesa_receipt_number'),
  phoneNumber:        text('phone_number'),
  description:        text('description'),
  metadata:           text('metadata'),
  createdAt:          text('created_at').notNull(),
  updatedAt:          text('updated_at').notNull(),
})

// ─── Rate limiting ────────────────────────────────────────────────────────────

app.use('*', rateLimiter({
  windowMs: 60_000, limit: 60,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('CF-Connecting-IP') ?? 'unknown',
}))

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (c) =>
  c.json(ok({ status: 'ok', service: 'api-payments', timestamp: now() }))
)

// ─── Initiate STK Push ───────────────────────────────────────────────────────
// POST /api/v1/payments/mpesa/stk
// Body: { userId, agentSlug, amount, phoneNumber, description?, accountReference? }

app.post('/api/v1/payments/mpesa/stk', async (c) => {
  const log = createLogger(c.env)
  const db  = drizzle(c.env.DB)

  const body = await c.req.json() as {
    userId:           string
    agentSlug:        string
    amount:           number
    phoneNumber:      string
    description?:     string
    accountReference?: string
  }

  if (!body.userId || !body.phoneNumber || !body.amount)
    return c.json(err('userId, phoneNumber, amount required'), 400)

  if (body.amount < 1)
    return c.json(err('Minimum amount is KES 1'), 400)

  try {
    // 1. Get Daraja token (cache in KV for 55min)
    const tokenKey = 'daraja:access_token'
    let token = await c.env.PAYMENTS_KV.get(tokenKey)

    if (!token) {
      token = await getDarajaToken(
        c.env.MPESA_CONSUMER_KEY,
        c.env.MPESA_CONSUMER_SECRET,
        c.env.MPESA_ENVIRONMENT as DarajaEnv
      )
      await c.env.PAYMENTS_KV.put(tokenKey, token, { expirationTtl: 3300 })
    }

    // 2. Create pending transaction
    const txId = generateId()
    const ts   = now()

    await db.insert(transactions).values({
      id: txId, userId: body.userId, agentSlug: body.agentSlug ?? 'taji',
      provider: 'mpesa', amount: body.amount, currency: 'KES',
      status: 'pending', phoneNumber: body.phoneNumber,
      description: body.description ?? 'Platform payment',
      createdAt: ts, updatedAt: ts,
    })

    // 3. Initiate STK push
    const result = await stkPush(token, {
      businessShortCode: c.env.MPESA_SHORTCODE,
      passkey:           c.env.MPESA_PASSKEY,
      amount:            body.amount,
      phoneNumber:       body.phoneNumber,
      callbackUrl:       c.env.MPESA_CALLBACK_URL,
      accountReference:  body.accountReference ?? txId,
      transactionDesc:   body.description ?? 'Platform payment',
      environment:       c.env.MPESA_ENVIRONMENT as DarajaEnv,
    })

    // 4. Update transaction with Daraja IDs
    await db.update(transactions)
      .set({
        merchantRequestId: result.MerchantRequestID,
        checkoutRequestId: result.CheckoutRequestID,
        updatedAt: now(),
      })
      .where(eq(transactions.id, txId))

    // 5. Cache checkoutRequestId → txId mapping for callback lookup
    await c.env.PAYMENTS_KV.put(
      `checkout:${result.CheckoutRequestID}`,
      txId,
      { expirationTtl: 3600 }
    )

    // Cache userId + agentSlug for agent notification after callback
    await c.env.PAYMENTS_KV.put(
      `checkout:meta:${result.CheckoutRequestID}`,
      JSON.stringify({ userId: body.userId, agentSlug: body.agentSlug }),
      { expirationTtl: 3600 }
    )

    log.info({ txId, amount: body.amount, phone: body.phoneNumber }, 'STK push initiated')
    return c.json(ok({
      transactionId:    txId,
      checkoutRequestId: result.CheckoutRequestID,
      message:          result.CustomerMessage,
    }), 201)

  } catch (e) {
    log.error({ err: e }, 'STK push failed')
    return c.json(err('Payment initiation failed'), 500)
  }
})

// ─── STK Query (check status) ────────────────────────────────────────────────
// GET /api/v1/payments/mpesa/stk/:checkoutRequestId

app.get('/api/v1/payments/mpesa/stk/:checkoutRequestId', async (c) => {
  const log = createLogger(c.env)
  const db  = drizzle(c.env.DB)
  const checkoutRequestId = c.req.param('checkoutRequestId')

  try {
    const tokenKey = 'daraja:access_token'
    let token = await c.env.PAYMENTS_KV.get(tokenKey)

    if (!token) {
      token = await getDarajaToken(
        c.env.MPESA_CONSUMER_KEY,
        c.env.MPESA_CONSUMER_SECRET,
        c.env.MPESA_ENVIRONMENT as DarajaEnv
      )
      await c.env.PAYMENTS_KV.put(tokenKey, token, { expirationTtl: 3300 })
    }

    const result = await stkQuery(
      token,
      c.env.MPESA_SHORTCODE,
      c.env.MPESA_PASSKEY,
      checkoutRequestId,
      c.env.MPESA_ENVIRONMENT as DarajaEnv
    )

    return c.json(ok(result))
  } catch (e) {
    log.error({ err: e }, 'STK query failed')
    return c.json(err('Status query failed'), 500)
  }
})

// ─── M-Pesa STK Callback (PUBLIC — Safaricom calls this) ─────────────────────
// POST /webhooks/mpesa

app.post('/webhooks/mpesa', async (c) => {
  const log = createLogger(c.env)
  const db  = drizzle(c.env.DB)

  const raw = await c.req.json() as Record<string, unknown>

  try {
    const parsed = parseStkCallback(raw)
    log.info({ checkoutId: parsed.checkoutRequestId, code: parsed.resultCode }, 'mpesa callback')

    // Look up transaction
    const txId = await c.env.PAYMENTS_KV.get(`checkout:${parsed.checkoutRequestId}`)
    if (!txId) {
      log.warn({ checkoutId: parsed.checkoutRequestId }, 'no matching transaction')
      return c.json({ ResultCode: 0, ResultDesc: 'Accepted' })
    }

    const status = parsed.resultCode === 0 ? 'completed' : 'failed'

    await db.update(transactions)
      .set({
        status,
        mpesaReceiptNumber: parsed.mpesaReceiptNumber,
        updatedAt: now(),
      })
      .where(eq(transactions.id, txId))

    log.info({ txId, status, receipt: parsed.mpesaReceiptNumber }, 'transaction updated')

    // Notify agent — triggers document render on payment success
    if (status === 'completed') {
      try {
        // Look up userId from KV (stored as checkout:{id} → userId:agentSlug)
        const meta = await c.env.PAYMENTS_KV.get(`checkout:meta:${parsed.checkoutRequestId}`)
        if (meta) {
          const { userId, agentSlug } = JSON.parse(meta) as { userId: string; agentSlug: string }
          await c.env.AGENT_WORKER.fetch(
            new Request('https://internal/api/v1/agent/chat', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json', 'X-Internal': 'payments' },
              body: JSON.stringify({ agentSlug, userId, channel: 'whatsapp', type: 'check_payment' }),
            })
          )
          log.info({ txId, userId, agentSlug }, 'agent:notified')
        }
      } catch (notifyErr) {
        log.warn({ err: notifyErr }, 'agent notify failed — agent will poll on next message')
      }
    }

  } catch (e) {
    log.error({ err: e }, 'callback processing error')
  }

  // Always return 200 to Safaricom
  return c.json({ ResultCode: 0, ResultDesc: 'Accepted' })
})

// ─── List user transactions ───────────────────────────────────────────────────

app.get('/api/v1/payments/transactions/:userId', async (c) => {
  const db   = drizzle(c.env.DB)
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, c.req.param('userId')))
    .orderBy(desc(transactions.createdAt))
  return c.json(ok(rows))
})

// ─── Error handler ────────────────────────────────────────────────────────────

app.onError((error, c) => {
  createLogger(c.env).error({ err: error }, 'unhandled payments error')
  return c.json(err('Internal server error'), 500)
})

export default app

// ─── Notify agent after payment confirmed (called by callback handler) ────────
// POST /api/v1/payments/notify-agent
// Body: { txId, userId, agentSlug, status, amount }

app.post('/api/v1/payments/notify-agent', async (c) => {
  const log  = createLogger(c.env)
  const body = await c.req.json() as { txId: string; userId: string; agentSlug: string; status: string; amount: number }
  log.info({ txId: body.txId, status: body.status }, 'agent:notify')
  // The agent worker polls KV for payment status — this endpoint is for future webhook push
  return c.json(ok({ received: true }))
})
