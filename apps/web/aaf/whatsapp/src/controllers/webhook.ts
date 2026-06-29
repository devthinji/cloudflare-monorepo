import type { Context } from 'hono'
import { ok } from '@repo/utils'
import { createLogger } from '../lib/logger'
import { parseIncomingMessage, type WaWebhookPayload } from '../lib/whatsapp'
import { SessionModel } from '../models/session'
import { MachineModel } from '../models/machine'
import { WhatsappView } from '../views/whatsapp'
import type { Env } from '../types/env'
import { DEFAULT_AGENT } from '../types/env'

export const verifyWebhook = (c: Context<{ Bindings: Env }>) => {
  const mode = c.req.query('hub.mode')
  const token = c.req.query('hub.verify_token')
  const challenge = c.req.query('hub.challenge')
  if (mode === 'subscribe' && token === c.env.WHATSAPP_VERIFY_TOKEN) return new Response(challenge ?? '', { status: 200 })
  return c.text('Forbidden', 403)
}

export const handleWebhook = async (c: Context<{ Bindings: Env }>) => {
  const log = createLogger(c.env)
  const payload = await c.req.json() as WaWebhookPayload
  if (payload.object !== 'whatsapp_business_account') return c.json(ok(null))

  const incoming = parseIncomingMessage(payload)
  if (!incoming) return c.json(ok(null))

  const { from, text, phoneNumberId } = incoming
  log.info({ from, preview: text.slice(0, 80) }, 'wa:in')

  const sessionModel = new SessionModel(c.env)
  const machineModel = new MachineModel(c.env)
  const view = new WhatsappView(c.env)

  const session = await sessionModel.getSession(from)
  const agentSlug = session.agentSlug ?? DEFAULT_AGENT

  try {
    const cmd = text.trim().toLowerCase().split(' ')[0]

    if (cmd === '/help') {
      await view.sendHelp(phoneNumberId, from)
      return c.json(ok(null))
    }

    if (cmd === '/reset') {
      await machineModel.reset(from, agentSlug)
      await view.sendReset(phoneNumberId, from)
      return c.json(ok(null))
    }

    const data = await machineModel.advance(agentSlug, from, text)
    const reply = data?.data?.reply ?? ''

    await sessionModel.saveSession(from, session)

    if (reply) {
      await view.sendReply(phoneNumberId, from, reply)
      log.info({ from, agentSlug, stage: data?.data?.stage }, 'wa:out')
    }
  } catch (e) {
    log.error({ err: e, from }, 'wa:error')
    await view.sendError(phoneNumberId, from)
  }

  return c.json(ok(null))
}
