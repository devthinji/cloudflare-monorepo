// ─── /api/v1/machine — Conversation state machine endpoint ───────────────────
//
// POST /api/v1/machine/advance  — process one user message
// GET  /api/v1/machine/context/:userId/:agentSlug — inspect state (dashboard)
// DELETE /api/v1/machine/context/:userId/:agentSlug — reset

import { Hono }              from 'hono'
import type { GatewayEnv }   from '@repo/types'
import { ok, err }           from '@repo/utils'
import { ConversationMachine, type MachineServices } from '../machine/machine'
import { initialContext }    from '../machine/states'
import type { MachineContext, LiveSKU } from '../machine/states'

export const machineRoutes = new Hono<{ Bindings: GatewayEnv }>()

// ─── POST /advance ────────────────────────────────────────────────────────────

machineRoutes.post('/advance', async (c) => {
  const body = await c.req.json() as { agentSlug: string; userId: string; channel: string; message: string }
  if (!body.userId || !body.agentSlug || !body.message) {
    return c.json(err('userId, agentSlug, message required'), 400)
  }

  // Load context from KV
  const ctxKey = `machine:${body.agentSlug}:${body.userId}`
  const stored = await c.env.SESSIONS_KV.get(ctxKey)
  let ctx: MachineContext = stored
    ? JSON.parse(stored)
    : initialContext(body.userId, body.agentSlug, body.channel)

  // ── Wire services ──────────────────────────────────────────────────────────
  const svc: MachineServices = {

    lookupUser: async (userId) => {
      try {
        const res  = await c.env.AGENT_WORKER.fetch(new Request(
          `https://internal/api/v1/agent/users/${encodeURIComponent(userId)}`,
          { headers: { 'X-Internal': 'gateway' } }
        ))
        const data = await res.json() as { success: boolean; data?: { name?: string; registered?: boolean } }
        if (data.success && data.data) return { found: true, name: data.data.name, registered: data.data.registered }
        return { found: false }
      } catch { return { found: false } }
    },

    registerUser: async (userId, name) => {
      await c.env.AGENT_WORKER.fetch(new Request('https://internal/api/v1/agent/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal': 'gateway' },
        body: JSON.stringify({ userId, name, channel: body.channel }),
      }))
    },

    // ── SKU services — fetched from docgen worker ──────────────────────────

    listSKUs: async (agentSlug) => {
      try {
        const res  = await c.env.DOCGEN_WORKER.fetch(new Request(
          `https://internal/api/v1/docgen/skus?agentSlug=${agentSlug}&active=true`,
          { headers: { 'X-Internal': 'gateway' } }
        ))
        const data = await res.json() as { success: boolean; data?: { id: string; name: string; price: number; currency: string; agentSlug: string; fieldSchema: unknown[] }[] }
        if (!data.success || !data.data) return []
        return data.data.map(r => ({
          id:        r.id,
          name:      r.name,
          price:     r.price,
          currency:  r.currency,
          agentSlug: r.agentSlug,
          fields:    r.fieldSchema as LiveSKU['fields'],
        }))
      } catch { return [] }
    },

    loadSKU: async (skuId) => {
      try {
        const res  = await c.env.DOCGEN_WORKER.fetch(new Request(
          `https://internal/api/v1/docgen/skus/${skuId}`,
          { headers: { 'X-Internal': 'gateway' } }
        ))
        const data = await res.json() as { success: boolean; data?: { id: string; name: string; price: number; currency: string; agentSlug: string; fieldSchema: unknown[] } }
        if (!data.success || !data.data) return null
        return {
          id:        data.data.id,
          name:      data.data.name,
          price:     data.data.price,
          currency:  data.data.currency,
          agentSlug: data.data.agentSlug,
          fields:    data.data.fieldSchema as LiveSKU['fields'],
        }
      } catch { return null }
    },

    // ── Payment ────────────────────────────────────────────────────────────

    initiatePayment: async (context, sku) => {
      try {
        const res  = await c.env.PAYMENTS_WORKER.fetch(new Request('https://internal/api/v1/payments/mpesa/stk', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal': 'gateway' },
          body: JSON.stringify({
            userId:           context.userId,
            agentSlug:        context.agentSlug,
            amount:           sku.price,
            phoneNumber:      context.userId,
            description:      `${context.agentSlug}: ${sku.name}`,
            accountReference: `DOC-${Date.now()}`,
          }),
        }))
        const data = await res.json() as { success: boolean; data?: { transactionId: string; checkoutRequestId: string; message: string } }
        if (!data.success || !data.data) return null
        return { txId: data.data.transactionId, checkoutRequestId: data.data.checkoutRequestId, customerMessage: data.data.message }
      } catch { return null }
    },

    checkPayment: async (checkoutRequestId) => {
      try {
        const res  = await c.env.PAYMENTS_WORKER.fetch(new Request(
          `https://internal/api/v1/payments/mpesa/stk/${encodeURIComponent(checkoutRequestId)}`,
          { headers: { 'X-Internal': 'gateway' } }
        ))
        const data = await res.json() as { success: boolean; data?: { ResultCode: string } }
        if (!data.success) return 'pending'
        const code = data.data?.ResultCode
        if (code === '0')             return 'completed'
        if (code === '1032' || code === '1037') return 'failed'
        return 'pending'
      } catch { return 'pending' }
    },

    // ── Render ─────────────────────────────────────────────────────────────

    renderDoc: async (context, sku) => {
      try {
        const res  = await c.env.DOCGEN_WORKER.fetch(new Request('https://internal/api/v1/docgen/render', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal': 'gateway' },
          body: JSON.stringify({
            userId:      context.userId,
            skuId:       sku.id,
            fieldValues: context.collectedFields,
          }),
        }))
        const data = await res.json() as { success: boolean; data?: { fileUrl: string; title: string } }
        return data.success && data.data ? data.data : null
      } catch { return null }
    },
  }

  // ── Run machine ────────────────────────────────────────────────────────────
  const machine = new ConversationMachine(svc)
  const result  = await machine.advance(ctx, body.message)

  // Persist updated context (30 days)
  await c.env.SESSIONS_KV.put(ctxKey, JSON.stringify(result.context), { expirationTtl: 86400 * 30 })

  return c.json(ok({
    reply:      result.reply,
    stage:      result.context.stage,
    collectSub: result.context.collectSub,
    skuName:    result.context.liveSKU?.name,
    done:       result.done,
  }))
})

// ─── GET /context/:userId/:agentSlug ─────────────────────────────────────────

machineRoutes.get('/context/:userId/:agentSlug', async (c) => {
  const ctxKey = `machine:${c.req.param('agentSlug')}:${c.req.param('userId')}`
  const stored = await c.env.SESSIONS_KV.get(ctxKey)
  if (!stored) return c.json(err('No context found'), 404)
  return c.json(ok(JSON.parse(stored)))
})

// ─── DELETE /context/:userId/:agentSlug ──────────────────────────────────────

machineRoutes.delete('/context/:userId/:agentSlug', async (c) => {
  const ctxKey = `machine:${c.req.param('agentSlug')}:${c.req.param('userId')}`
  await c.env.SESSIONS_KV.delete(ctxKey)
  return c.json(ok({ reset: true }))
})
