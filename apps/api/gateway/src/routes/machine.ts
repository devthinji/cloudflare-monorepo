// ─── /api/v1/machine — Conversation state machine endpoint ───────────────────
//
// POST /api/v1/machine/advance
// Body: { agentSlug, userId, channel, message }
//
// Loads MachineContext from KV, runs machine.advance(), saves updated context.
// Returns { reply, stage, done }

import { Hono }              from 'hono'
import type { GatewayEnv }   from '@repo/types'
import { ok, err }           from '@repo/utils'
import { ConversationMachine, type MachineServices } from '../machine/machine'
import { initialContext }    from '../machine/states'
import type { MachineContext } from '../machine/states'

export const machineRoutes = new Hono<{ Bindings: GatewayEnv }>()

machineRoutes.post('/advance', async (c) => {
  const body = await c.req.json() as { agentSlug: string; userId: string; channel: string; message: string }
  if (!body.userId || !body.agentSlug || !body.message) return c.json(err('userId, agentSlug, message required'), 400)

  // Load context from KV
  const ctxKey = `machine:${body.agentSlug}:${body.userId}`
  const stored = await c.env.SESSIONS_KV.get(ctxKey)
  let ctx: MachineContext = stored ? JSON.parse(stored) : initialContext(body.userId, body.agentSlug, body.channel)

  // Wire services
  const svc: MachineServices = {

    lookupUser: async (userId) => {
      try {
        const res  = await c.env.AGENT_WORKER.fetch(new Request(`https://internal/api/v1/agent/users/${encodeURIComponent(userId)}`, { headers: { 'X-Internal': 'gateway' } }))
        const data = await res.json() as { success: boolean; data?: { name?: string; registered?: boolean } }
        if (data.success && data.data) return { found: true, name: data.data.name, registered: data.data.registered }
        return { found: false }
      } catch { return { found: false } }
    },

    registerUser: async (userId, name) => {
      await c.env.AGENT_WORKER.fetch(new Request('https://internal/api/v1/agent/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal': 'gateway' },
        body: JSON.stringify({ userId, name, channel: body.channel }),
      }))
    },

    getAgentReply: async (context, message) => {
      const res  = await c.env.AGENT_WORKER.fetch(new Request('https://internal/api/v1/agent/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal': 'gateway', 'X-Channel': context.channel },
        body: JSON.stringify({ agentSlug: context.agentSlug, userId: context.userId, message, channel: context.channel, type: 'chat' }),
      }))
      const data = await res.json() as { success: boolean; data?: { reply: string } }
      return data?.data?.reply ?? ''
    },

    initiatePayment: async (context, amount) => {
      try {
        const res  = await c.env.PAYMENTS_WORKER.fetch(new Request('https://internal/api/v1/payments/mpesa/stk', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal': 'gateway' },
          body: JSON.stringify({ userId: context.userId, agentSlug: context.agentSlug, amount, phoneNumber: context.userId, description: `Taji: ${context.templateId ?? 'document'}`, accountReference: `TAJI-${Date.now()}` }),
        }))
        const data = await res.json() as { success: boolean; data?: { transactionId: string; checkoutRequestId: string; message: string } }
        if (!data.success || !data.data) return null
        return { txId: data.data.transactionId, checkoutRequestId: data.data.checkoutRequestId, customerMessage: data.data.message }
      } catch { return null }
    },

    checkPayment: async (checkoutRequestId) => {
      try {
        const res  = await c.env.PAYMENTS_WORKER.fetch(new Request(`https://internal/api/v1/payments/mpesa/stk/${encodeURIComponent(checkoutRequestId)}`, { headers: { 'X-Internal': 'gateway' } }))
        const data = await res.json() as { success: boolean; data?: { ResultCode: string } }
        if (!data.success) return 'pending'
        const code = data.data?.ResultCode
        if (code === '0')    return 'completed'
        if (code === '1032' || code === '1037') return 'failed'
        return 'pending'
      } catch { return 'pending' }
    },

    renderDoc: async (context) => {
      try {
        const res  = await c.env.DOCGEN_WORKER.fetch(new Request('https://internal/api/v1/docgen/render', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal': 'gateway' },
          body: JSON.stringify({ userId: context.userId, agentSlug: context.agentSlug, templateId: context.templateId, fieldValues: context.sessionData }),
        }))
        const data = await res.json() as { success: boolean; data?: { fileUrl: string; title: string } }
        return data.success && data.data ? data.data : null
      } catch { return null }
    },
  }

  const machine = new ConversationMachine(svc)
  const result  = await machine.advance(ctx, body.message)

  // Persist updated context (30 days)
  await c.env.SESSIONS_KV.put(ctxKey, JSON.stringify(result.context), { expirationTtl: 86400 * 30 })

  return c.json(ok({ reply: result.reply, stage: result.context.stage, collectSub: result.context.collectSub, done: result.done }))
})

// GET /api/v1/machine/context/:userId/:agentSlug — for dashboard inspection
machineRoutes.get('/context/:userId/:agentSlug', async (c) => {
  const ctxKey = `machine:${c.req.param('agentSlug')}:${c.req.param('userId')}`
  const stored = await c.env.SESSIONS_KV.get(ctxKey)
  if (!stored) return c.json(err('No context found'), 404)
  return c.json(ok(JSON.parse(stored)))
})

// DELETE /api/v1/machine/context/:userId/:agentSlug — reset
machineRoutes.delete('/context/:userId/:agentSlug', async (c) => {
  const ctxKey = `machine:${c.req.param('agentSlug')}:${c.req.param('userId')}`
  await c.env.SESSIONS_KV.delete(ctxKey)
  return c.json(ok({ reset: true }))
})
