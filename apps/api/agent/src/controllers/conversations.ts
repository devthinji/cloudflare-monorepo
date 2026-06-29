import type { Context } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { createDb, conversations, messages } from '../models'
import type { AgentWorkerEnv } from '@repo/types'
import { ok } from '@repo/utils'

export async function listConversations(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db = createDb(c.env.DB)
  return c.json(ok(await db.select().from(conversations).where(eq(conversations.userId, c.req.param('userId')!)).orderBy(desc(conversations.updatedAt))))
}

export async function listMessages(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db = createDb(c.env.DB)
  return c.json(ok(await db.select().from(messages).where(eq(messages.conversationId, c.req.param('id')!)).orderBy(messages.createdAt)))
}
