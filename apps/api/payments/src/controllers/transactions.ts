import type { Context } from 'hono'
import { eq, desc } from 'drizzle-orm'
import type { PaymentsWorkerEnv } from '@repo/types'
import { ok, err } from '@repo/utils'
import { createLogger } from '@repo/middleware'
import { transactions } from '../models'
import { createDb } from '../models'

export async function listUserTransactions(c: Context<{ Bindings: PaymentsWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const rows = await db.select().from(transactions).where(eq(transactions.userId, c.req.param('userId')!)).orderBy(desc(transactions.createdAt))
  return c.json(ok(rows))
}

export async function notifyAgent(c: Context<{ Bindings: PaymentsWorkerEnv }>) {
  const log = createLogger('payments', c.env)
  const body = await c.req.json() as { txId: string; userId: string; agentSlug: string; status: string; amount: number }
  log.info({ txId: body.txId, status: body.status }, 'agent:notify')
  return c.json(ok({ received: true }))
}
