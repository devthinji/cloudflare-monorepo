import type { Context } from 'hono'
import { ok } from '@repo/utils'
import { getServiceStyle } from '@repo/middleware'
import { parseIncomingMessage, parseStatusUpdate, verifySignature, type WaWebhookPayload } from '../../lib/whatsapp'
import { SessionModel } from '../../models/session'
import { MachineModel } from '../../models/machine'
import { sendHelp, sendReset, sendError, sendReply, sendInteractiveMessage } from '../outgoing/reply'
import { sendTextMessage } from '../../lib/whatsapp'
import { deliverDocument } from '../../pipelines'
import type { Env } from '../../types/env'
import { DEFAULT_AGENT } from '../../types/env'
import { resolveAgentCredentials } from '../../lib/agent-credentials'

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

    const phoneNumberId = change.value.metadata.phone_number_id

    const agentCreds = await resolveAgentCredentials(c.env.DB, c.env.DB_ENCRYPTION_KEY, phoneNumberId)
    if (!agentCreds) {
      log('suspicious', `no agent found for phoneNumberId: ${phoneNumberId}`)
      return c.json(ok(null))
    }

    const validSig = await verifySignature(rawBody, signature, agentCreds.appSecret)
    if (!validSig) {
      log('suspicious', 'X-Hub-Signature-256 mismatch or missing')
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

      const { from, text, name, messageId, type: msgType } = incoming

    log('name', name)
    log('number', `+${from}`)
    log('type', msgType)
    log('text', text.slice(0, 200))

    const sessionModel = new SessionModel(c.env)
    const machineModel = new MachineModel(c.env)

    const session = await sessionModel.getSession(from)
    const agentSlug = session.agentSlug ?? agentCreds.slug

    if (agentSlug !== agentCreds.slug) {
      session.agentSlug = agentCreds.slug
    }

    log('agent', `${agentSlug} (phoneNumberId: ${phoneNumberId})`)

    try {
      const cmd = text.trim().toLowerCase().split(' ')[0]

      if (cmd === '/help') {
        await sendHelp(phoneNumberId, from, agentCreds.accessToken)
        return c.json(ok(null))
      }

      // ── Exit/quit/reset confirmation flow ────────────────────────────────
      if (session.pendingReset) {
        if (['confirm_reset', 'yes', 'y', 'ndio', 'sawa'].includes(cmd)) {
          session.pendingReset = false
          await sessionModel.saveSession(from, session)
          await machineModel.reset(from, agentSlug)
          await sendReset(phoneNumberId, from, agentCreds.accessToken)
          return c.json(ok(null))
        }
        if (['cancel_reset', 'no', 'n', 'cancel', 'back'].includes(cmd)) {
          session.pendingReset = false
          await sessionModel.saveSession(from, session)
          await sendTextMessage(phoneNumberId, from, 'OK, continuing where we left off.', agentCreds.accessToken)
          return c.json(ok(null))
        }
        // Re-show confirmation
        await sendInteractiveMessage(phoneNumberId, from, {
          type: 'buttons',
          body: 'Are you sure you want to reset the conversation?',
          buttons: [
            { id: 'confirm_reset', title: 'Yes, reset' },
            { id: 'cancel_reset',  title: 'Cancel' },
          ],
        }, agentCreds.accessToken)
        return c.json(ok(null))
      }

      if (['/reset', 'exit', 'quit'].includes(cmd)) {
        session.pendingReset = true
        await sessionModel.saveSession(from, session)
        await sendInteractiveMessage(phoneNumberId, from, {
          type: 'buttons',
          body: 'Are you sure you want to reset the conversation?',
          buttons: [
            { id: 'confirm_reset', title: 'Yes, reset' },
            { id: 'cancel_reset',  title: 'Cancel' },
          ],
        }, agentCreds.accessToken)
        log('confirm', 'exit/quit/reset — awaiting confirmation')
        return c.json(ok(null))
      }

      const data = await machineModel.advance(agentSlug, from, text)
      const reply = data?.data?.reply ?? ''
      const doc = data?.data?.document
      const interactive = data?.data?.interactive

      await sessionModel.saveSession(from, session)

      if (doc) {
        log('deliver', `delivering ${doc.filename} (key: ${doc.key})`)
        const result = await deliverDocument({
          phoneNumberId,
          to: from,
          document: { key: doc.key, filename: doc.filename },
          accessToken: agentCreds.accessToken,
          apiGateway: c.env.API_GATEWAY,
        })
        if (!result.delivered) {
          log('deliver', `failed: ${result.error}`)
        }
      }

      if (reply) {
        await sendReply(phoneNumberId, from, reply, agentCreds.accessToken, messageId, interactive)
        log('reply', reply.slice(0, 200))
        log('stage', data?.data?.stage ?? '')
      }
    } catch (e) {
      log('error', e instanceof Error ? e.message : 'Unknown')
      await sendError(phoneNumberId, from, agentCreds.accessToken)
    }

    return c.json(ok(null))
  } catch (e) {
    log('unhandled', e instanceof Error ? e.message : String(e))
    return c.json(ok(null))
  }
}
