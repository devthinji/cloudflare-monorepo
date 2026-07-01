// ─── /api/v1/machine — Conversation state machine endpoint ───────────────────
//
// POST /api/v1/machine/advance  — process one user message
// GET  /api/v1/machine/context/:userId/:agentSlug — inspect state (dashboard)
// DELETE /api/v1/machine/context/:userId/:agentSlug — reset
// GET  /api/v1/machine/blueprint/:agentSlug/:version — load blueprint
// POST /api/v1/machine/blueprint/:agentSlug/:version — save blueprint

import { Hono }              from 'hono'
import type { GatewayEnv }   from '@repo/types'
import { ok, err }           from '@repo/utils'
import { ConversationMachine, type MachineServices } from '../machine/machine'
import { initialContext }    from '../machine/states'
import type { MachineContext, LiveSKU } from '../machine/states'
import type { Blueprint } from '../machine/steps/business-logic/version_1'
import { BlueprintV1 } from '../machine/steps/business-logic/version_1'

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
          `https://internal/api/v1/agent/customers/${encodeURIComponent(userId)}`,
          { headers: { 'X-Internal': 'gateway' } }
        ))
        const data = await res.json() as { success: boolean; data?: { name?: string; registered?: boolean } }
        if (data.success && data.data) return { found: true, name: data.data.name, registered: data.data.registered }
        return { found: false }
      } catch { return { found: false } }
    },

    registerUser: async (userId, name) => {
      await c.env.AGENT_WORKER.fetch(new Request('https://internal/api/v1/agent/customers', {
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
        const data = await res.json() as { success: boolean; data?: { id: string; name: string; price: number; currency: string; fieldSchema: unknown[] }[] }
        if (!data.success || !data.data) return []
        return data.data.map(r => ({
          id:        r.id,
          name:      r.name,
          price:     r.price,
          currency:  r.currency,
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
        const body: Record<string, unknown> = {
          userId:      context.userId,
          agentSlug:   context.agentSlug,
          skuId:       sku.id,
          fieldValues: context.collectedFields,
        }
        if (context.docFileName) body.fileName = context.docFileName
        const res  = await c.env.DOCGEN_WORKER.fetch(new Request('https://internal/api/v1/docgen/render', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal': 'gateway' },
          body: JSON.stringify(body),
        }))
        const data = await res.json() as { success: boolean; data?: { docId: string; title: string; fileUrl: string; key: string; filename: string } }
        return data.success && data.data ? data.data : null
      } catch { return null }
    },
  }

  // ── Load blueprint (default to BlueprintV1 if not found) ────────────────────
  let blueprint: Blueprint = BlueprintV1
  try {
    const bpKey = `blueprint:${body.agentSlug}:1`
    const stored = await c.env.SESSIONS_KV.get(bpKey)
    if (stored) {
      blueprint = JSON.parse(stored) as Blueprint
    }
  } catch {
    // Fall back to default blueprint
  }

  // ── Run machine ────────────────────────────────────────────────────────────
  const machine = new ConversationMachine(svc, blueprint)
  const result  = await machine.advance(ctx, body.message)

  // Persist updated context (30 days)
  await c.env.SESSIONS_KV.put(ctxKey, JSON.stringify(result.context), { expirationTtl: 86400 * 30 })

  return c.json(ok({
    reply:      result.reply,
    stage:      result.context.stage,
    collectSub: result.context.collectSub,
    skuName:    result.context.liveSKU?.name,
    document:   result.document ?? null,
    interactive: result.interactive ?? null,
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

// ─── GET /blueprint/:agentSlug/:version ─────────────────────────────────────

machineRoutes.get('/blueprint/:agentSlug/:version', async (c) => {
  const agentSlug = c.req.param('agentSlug')
  const version = parseInt(c.req.param('version'), 10)
  
  try {
    const bpKey = `blueprint:${agentSlug}:${version}`
    const stored = await c.env.SESSIONS_KV.get(bpKey)
    if (stored) return c.json(ok(JSON.parse(stored)))
    return c.json(ok(null)) // Fall back to default
  } catch {
    return c.json(ok(null))
  }
})

// ─── POST /blueprint/:agentSlug/:version ────────────────────────────────────

machineRoutes.post('/blueprint/:agentSlug/:version', async (c) => {
  const agentSlug = c.req.param('agentSlug')
  const version = parseInt(c.req.param('version'), 10)
  
  try {
    const body = await c.req.json() as unknown
    if (!body || typeof body !== 'object') return c.json(err('Invalid blueprint'), 400)
    
    const bpKey = `blueprint:${agentSlug}:${version}`
    await c.env.SESSIONS_KV.put(bpKey, JSON.stringify(body), { expirationTtl: 86400 * 365 })
    
    return c.json(ok({ saved: true, agentSlug, version }))
  } catch (e) {
    return c.json(err(`Failed to save blueprint: ${e instanceof Error ? e.message : 'unknown error'}`), 500)
  }
})
