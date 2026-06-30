const GRAPH_URL = 'https://graph.facebook.com/v20.0'

export interface WaTextMessage {
  from:      string
  id:        string
  timestamp: string
  text:      { body: string }
  type:      string
}

export interface WaContact {
  profile: { name: string }
  wa_id:   string
}

export interface WaStatus {
  id:           string
  status:       string
  timestamp:    string
  recipient_id: string
}

export interface WaWebhookPayload {
  object: string
  entry: {
    id: string
    changes: {
      value: {
        messaging_product: string
        metadata: { phone_number_id: string; display_phone_number?: string }
        contacts?:  WaContact[]
        messages?:  WaTextMessage[]
        statuses?:  WaStatus[]
      }
      field: string
    }[]
  }[]
}

function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

export async function verifySignature(rawBody: string, signature: string | null, token: string): Promise<boolean> {
  if (!signature) return false
  try {
    const expected = signature.startsWith('sha256=') ? signature.slice(7) : signature
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(token), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
    const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
    return timingSafeEqual(computed, expected)
  } catch {
    return false
  }
}

export function parseStatusUpdate(payload: WaWebhookPayload): {
  status: string; recipientId: string
} | null {
  const change = payload.entry[0]?.changes[0]
  if (!change) return null
  const st = change.value.statuses?.[0]
  if (!st) return null
  return { status: st.status, recipientId: normalisePhone(st.recipient_id) }
}

export function parseIncomingMessage(payload: WaWebhookPayload): {
  from: string; text: string; messageId: string; phoneNumberId: string; name: string; type: string
} | null {
  const change = payload.entry[0]?.changes[0]
  if (!change) return null
  const msg = change.value.messages?.[0]
  if (!msg || msg.type !== 'text') return null
  const name = change.value.contacts?.[0]?.profile?.name ?? 'Unknown'
  return {
    from:          normalisePhone(msg.from),
    text:          msg.text.body.trim(),
    messageId:     msg.id,
    phoneNumberId: change.value.metadata.phone_number_id,
    name,
    type:          msg.type,
  }
}

export async function sendTextMessage(
  phoneNumberId: string, to: string, text: string, accessToken: string
): Promise<void> {
  const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    }),
  })
  if (!res.ok) throw new Error(`WA send failed: ${res.status} ${await res.text()}`)
}

export async function sendDocument(
  phoneNumberId: string, to: string,
  fileUrl: string, filename: string, caption: string,
  accessToken: string
): Promise<void> {
  const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type: 'document',
      document: { link: fileUrl, caption, filename },
    }),
  })
  if (!res.ok) throw new Error(`WA send doc failed: ${res.status} ${await res.text()}`)
}

export async function markAsRead(
  phoneNumberId: string, messageId: string, accessToken: string
): Promise<void> {
  const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  })
  if (!res.ok) throw new Error(`WA markRead failed: ${res.status} ${await res.text()}`)
}
