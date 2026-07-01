import type { Context } from 'hono'
import { eq, desc, sql } from 'drizzle-orm'
import { createDb, conversations, messages } from '../models'
import type { AgentWorkerEnv } from '@repo/types'
import { ok } from '@repo/utils'

export async function listConversations(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db = createDb(c.env.DB)
  const userId = c.req.param('userId')!
  const rows = await db.select({
    id: conversations.id,
    userId: conversations.userId,
    agentSlug: conversations.agentSlug,
    channel: conversations.channel,
    status: conversations.status,
    context: conversations.context,
    createdAt: conversations.createdAt,
    updatedAt: conversations.updatedAt,
    messageCount: sql<number>`(SELECT COUNT(*) FROM messages WHERE conversation_id = ${conversations.id})`,
    lastMessage: sql<string | null>`(SELECT content FROM messages WHERE conversation_id = ${conversations.id} ORDER BY created_at DESC LIMIT 1)`,
    lastMessageAt: sql<string | null>`(SELECT created_at FROM messages WHERE conversation_id = ${conversations.id} ORDER BY created_at DESC LIMIT 1)`,
  }).from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt))
  return c.json(ok(rows))
}

export async function listMessages(c: Context<{ Bindings: AgentWorkerEnv }>) {
  const db = createDb(c.env.DB)
  return c.json(ok(await db.select().from(messages).where(eq(messages.conversationId, c.req.param('id')!)).orderBy(messages.createdAt)))
}
