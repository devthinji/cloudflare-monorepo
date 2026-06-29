import type { Context } from 'hono'
import { eq } from 'drizzle-orm'
import type { PaymentsWorkerEnv } from '@repo/types'
import { now } from '@repo/utils'
import { createLogger } from '../lib/logger'
import { transactions } from '../models'
import { createDb } from '../models'
import { parseStkCallback } from '../lib/daraja'

export async function handleMpesaCallback(c: Context<{ Bindings: PaymentsWorkerEnv }>) {
  const log = createLogger(c.env)
  const db = createDb(c.env.DB)
  const raw = await c.req.json() as Record<string, unknown>

  try {
    const parsed = parseStkCallback(raw)
    log.info({ checkoutId: parsed.checkoutRequestId, code: parsed.resultCode }, 'mpesa callback')

    const txId = await c.env.PAYMENTS_KV.get(`checkout:${parsed.checkoutRequestId}`)
    if (!txId) {
      log.warn({ checkoutId: parsed.checkoutRequestId }, 'no matching transaction')
      return c.json({ ResultCode: 0, ResultDesc: 'Accepted' })
    }

    const status = parsed.resultCode === 0 ? 'completed' : 'failed'

    await db.update(transactions).set({ status, mpesaReceiptNumber: parsed.mpesaReceiptNumber, updatedAt: now() }).where(eq(transactions.id, txId))
    log.info({ txId, status, receipt: parsed.mpesaReceiptNumber }, 'transaction updated')

    if (status === 'completed') {
      try {
        const meta = await c.env.PAYMENTS_KV.get(`checkout:meta:${parsed.checkoutRequestId}`)
        if (meta) {
          const { userId, agentSlug } = JSON.parse(meta) as { userId: string; agentSlug: string }
          await c.env.AGENT_WORKER.fetch(new Request('https://internal/api/v1/agent/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal': 'payments' },
            body: JSON.stringify({ agentSlug, userId, channel: 'whatsapp', type: 'check_payment' }),
          }))
          log.info({ txId, userId, agentSlug }, 'agent:notified')
        }
      } catch (notifyErr) { log.warn({ err: notifyErr }, 'agent notify failed') }
    }
  } catch (e) { log.error({ err: e }, 'callback processing error') }

  return c.json({ ResultCode: 0, ResultDesc: 'Accepted' })
}
