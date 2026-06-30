import type { Context } from 'hono'
import { eq } from 'drizzle-orm'
import type { PaymentsWorkerEnv } from '@repo/types'
import { ok, err, generateId, now } from '@repo/utils'
import { createLogger } from '@repo/middleware'
import { transactions } from '../models'
import { createDb } from '../models'
import { getDarajaToken, stkPush, stkQuery, type DarajaEnv } from '../lib/daraja'

export async function initiateStkPush(c: Context<{ Bindings: PaymentsWorkerEnv }>) {
  const log = createLogger('payments', c.env)
  const db = createDb(c.env.DB)

  const body = await c.req.json() as {
    userId: string; agentSlug: string; amount: number
    phoneNumber: string; description?: string; accountReference?: string
  }

  if (!body.userId || !body.phoneNumber || !body.amount) return c.json(err('userId, phoneNumber, amount required'), 400)
  if (body.amount < 1) return c.json(err('Minimum amount is KES 1'), 400)

  try {
    const tokenKey = 'daraja:access_token'
    let token = await c.env.PAYMENTS_KV.get(tokenKey)
    if (!token) {
      token = await getDarajaToken(c.env.MPESA_CONSUMER_KEY, c.env.MPESA_CONSUMER_SECRET, c.env.MPESA_ENVIRONMENT as DarajaEnv)
      await c.env.PAYMENTS_KV.put(tokenKey, token, { expirationTtl: 3300 })
    }

    const txId = generateId()
    const ts = now()

    await db.insert(transactions).values({
      id: txId, userId: body.userId, agentSlug: body.agentSlug ?? 'default',
      provider: 'mpesa', amount: body.amount, currency: 'KES',
      status: 'pending', phoneNumber: body.phoneNumber,
      description: body.description ?? 'Platform payment',
      createdAt: ts, updatedAt: ts,
    })

    const result = await stkPush(token, {
      businessShortCode: c.env.MPESA_SHORTCODE, passkey: c.env.MPESA_PASSKEY,
      amount: body.amount, phoneNumber: body.phoneNumber,
      callbackUrl: c.env.MPESA_CALLBACK_URL,
      accountReference: body.accountReference ?? txId,
      transactionDesc: body.description ?? 'Platform payment',
      environment: c.env.MPESA_ENVIRONMENT as DarajaEnv,
    })

    await db.update(transactions).set({
      merchantRequestId: result.MerchantRequestID,
      checkoutRequestId: result.CheckoutRequestID,
      updatedAt: now(),
    }).where(eq(transactions.id, txId))

    await c.env.PAYMENTS_KV.put(`checkout:${result.CheckoutRequestID}`, txId, { expirationTtl: 3600 })
    await c.env.PAYMENTS_KV.put(`checkout:meta:${result.CheckoutRequestID}`, JSON.stringify({ userId: body.userId, agentSlug: body.agentSlug }), { expirationTtl: 3600 })

    log.info({ txId, amount: body.amount, phone: body.phoneNumber }, 'STK push initiated')
    return c.json(ok({ transactionId: txId, checkoutRequestId: result.CheckoutRequestID, message: result.CustomerMessage }), 201)
  } catch (e) {
    log.error({ err: e }, 'STK push failed')
    return c.json(err('Payment initiation failed'), 500)
  }
}

export async function queryStkPush(c: Context<{ Bindings: PaymentsWorkerEnv }>) {
  const log = createLogger('payments', c.env)
  const checkoutRequestId = c.req.param('checkoutRequestId')!

  try {
    const tokenKey = 'daraja:access_token'
    let token = await c.env.PAYMENTS_KV.get(tokenKey)
    if (!token) {
      token = await getDarajaToken(c.env.MPESA_CONSUMER_KEY, c.env.MPESA_CONSUMER_SECRET, c.env.MPESA_ENVIRONMENT as DarajaEnv)
      await c.env.PAYMENTS_KV.put(tokenKey, token, { expirationTtl: 3300 })
    }

    const result = await stkQuery(token, c.env.MPESA_SHORTCODE, c.env.MPESA_PASSKEY, checkoutRequestId, c.env.MPESA_ENVIRONMENT as DarajaEnv)
    return c.json(ok(result))
  } catch (e) {
    log.error({ err: e }, 'STK query failed')
    return c.json(err('Status query failed'), 500)
  }
}
