const GRAPH_URL = 'https://graph.facebook.com/v20.0'

export interface WaTextMessage {
  from:      string
  id:        string
  timestamp: string
  text:      { body: string }
  type:      'text'
}

export interface WaWebhookPayload {
  object: string
  entry: {
    id: string
    changes: {
      value: {
        messaging_product: string
        metadata: { phone_number_id: string }
        messages?:  WaTextMessage[]
        statuses?:  unknown[]
      }
      field: string
    }[]
  }[]
}

export function parseIncomingMessage(payload: WaWebhookPayload): {
  from: string; text: string; messageId: string; phoneNumberId: string
} | null {
  const change = payload.entry[0]?.changes[0]
  if (!change) return null
  const msg = change.value.messages?.[0]
  if (!msg || msg.type !== 'text') return null
  return {
    from:          msg.from,
    text:          msg.text.body.trim(),
    messageId:     msg.id,
    phoneNumberId: change.value.metadata.phone_number_id,
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
