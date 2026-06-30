import type { Context } from 'hono'
import { ok, err } from '@repo/utils'
import { sendTextMessage, sendDocument } from '../../lib/whatsapp'
import type { Env } from '../../types/env'

export async function handleSend(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json() as {
    to: string
    type: 'text' | 'document'
    text?: string
    phoneNumberId?: string
    document?: { fileUrl: string; filename: string; caption?: string }
  }

  if (!body.to) return c.json(err('to (phone number) is required'), 400)
  if (!body.type) return c.json(err('type is required: text or document'), 400)

  const phoneNumberId = body.phoneNumberId ?? c.env.WHATSAPP_PHONE_NUMBER_ID
  const token = c.env.WHATSAPP_ACCESS_TOKEN
  const to = body.to.startsWith('+') ? body.to : `+${body.to}`

  try {
    if (body.type === 'text') {
      if (!body.text) return c.json(err('text is required for type=text'), 400)
      await sendTextMessage(phoneNumberId, to, body.text, token)
      return c.json(ok({ sent: true, to, type: 'text' }))
    }

    if (body.type === 'document') {
      if (!body.document?.fileUrl || !body.document?.filename) {
        return c.json(err('document.fileUrl and document.filename required for type=document'), 400)
      }
      await sendDocument(
        phoneNumberId, to,
        body.document.fileUrl,
        body.document.filename,
        body.document.caption ?? '',
        token,
      )
      return c.json(ok({ sent: true, to, type: 'document', filename: body.document.filename }))
    }

    return c.json(err(`unsupported type: ${body.type}`), 400)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json(err(msg), 500)
  }
}
