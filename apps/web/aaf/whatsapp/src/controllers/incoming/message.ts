import type { Context } from 'hono'
import { ok } from '@repo/utils'
import { getServiceStyle } from '@repo/middleware'
import { parseIncomingMessage, parseStatusUpdate, verifySignature, type WaWebhookPayload } from '../../lib/whatsapp'
import { SessionModel } from '../../models/session'
import { MachineModel } from '../../models/machine'
import { sendHelp, sendReset, sendError, sendReply } from '../outgoing/reply'
import { deliverDocument } from '../../pipelines'
import type { Env } from '../../types/env'
import { DEFAULT_AGENT } from '../../types/env'
import { PHONE_NUMBER_ID_TO_AGENT } from '../../config/phone-agent-map'

const TAG_WIDTH = 7

function log(label: string, value: string) {
  const s = getServiceStyle('whatsapp')
  const tag = s.tag.padEnd(TAG_WIDTH)
  console.log(`${s.icon} [${tag}] ${label}  ${value}`)
}

export const handleWebhook = async (c: Context<{ Bindings: Env }>) => {
  try {
    const rawBody = await c.req.text()
    const signature = c.req.header('X-Hub-Signature-256') ?? null

    const validSig = await verifySignature(rawBody, signature, c.env.WHATSAPP_APP_SECRET)
    if (!validSig) {
      log('suspicious', 'X-Hub-Signature-256 mismatch or missing')
    }

    let payload: WaWebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      log('suspicious', 'invalid JSON body')
      return c.json(ok(null))
    }

    if (payload.object !== 'whatsapp_business_account') {
      log('suspicious', `unexpected object: ${payload.object}`)
      return c.json(ok(null))
    }

    const change = payload.entry[0]?.changes[0]
    if (!change) {
      log('suspicious', 'empty entry or changes')
      return c.json(ok(null))
    }

    const statusUpdate = parseStatusUpdate(payload)
    if (statusUpdate) {
      log('status', statusUpdate.status)
      log('number', `+${statusUpdate.recipientId}`)
      return c.json(ok(null))
    }

    const incoming = parseIncomingMessage(payload)
    if (!incoming) {
      log('skipped', 'non-text message type')
      return c.json(ok(null))
    }

      const { from, text, phoneNumberId, name, messageId, type: msgType } = incoming

    log('name', name)
    log('number', `+${from}`)
    log('type', msgType)
    log('text', text.slice(0, 200))

    const sessionModel = new SessionModel(c.env)
    const machineModel = new MachineModel(c.env)

    const mappedAgent = PHONE_NUMBER_ID_TO_AGENT[phoneNumberId]
    const session = await sessionModel.getSession(from)
    const agentSlug = mappedAgent ?? session.agentSlug ?? DEFAULT_AGENT

    if (mappedAgent && session.agentSlug !== mappedAgent) {
      session.agentSlug = mappedAgent
    }

    log('agent', `${agentSlug} (phoneNumberId: ${phoneNumberId})`)

    try {
      const cmd = text.trim().toLowerCase().split(' ')[0]

      if (cmd === '/help') {
        await sendHelp(phoneNumberId, from, c.env.WHATSAPP_ACCESS_TOKEN)
        return c.json(ok(null))
      }

      if (['/reset', 'exit', 'quit'].includes(cmd)) {
        await machineModel.reset(from, agentSlug)
        await sendReset(phoneNumberId, from, c.env.WHATSAPP_ACCESS_TOKEN)
        return c.json(ok(null))
      }

      const data = await machineModel.advance(agentSlug, from, text)
      const reply = data?.data?.reply ?? ''
      const doc = data?.data?.document

      await sessionModel.saveSession(from, session)

      if (doc) {
        log('deliver', `delivering ${doc.filename} (key: ${doc.key})`)
        const result = await deliverDocument({
          phoneNumberId,
          to: from,
          document: { key: doc.key, filename: doc.filename },
          accessToken: c.env.WHATSAPP_ACCESS_TOKEN,
          apiGateway: c.env.API_GATEWAY,
        })
        if (!result.delivered) {
          log('deliver', `failed: ${result.error}`)
        }
      }

      if (reply) {
        await sendReply(phoneNumberId, from, reply, c.env.WHATSAPP_ACCESS_TOKEN, messageId)
        log('reply', reply.slice(0, 200))
        log('stage', data?.data?.stage ?? '')
      }
    } catch (e) {
      log('error', e instanceof Error ? e.message : 'Unknown')
      await sendError(phoneNumberId, from, c.env.WHATSAPP_ACCESS_TOKEN)
    }

    return c.json(ok(null))
  } catch (e) {
    log('unhandled', e instanceof Error ? e.message : String(e))
    return c.json(ok(null))
  }
}
