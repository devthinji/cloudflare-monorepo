const TG_API = 'https://api.telegram.org/bot'

export interface TgUpdate {
  update_id: number
  message?: {
    message_id: number
    from:    { id: number; first_name: string; username?: string }
    chat:    { id: number; type: string }
    date:    number
    text?:   string
  }
}

export function parseIncomingMessage(update: TgUpdate): {
  chatId: number; userId: string; text: string; messageId: number
} | null {
  const msg = update.message
  if (!msg || !msg.text) return null
  return {
    chatId:    msg.chat.id,
    userId:    String(msg.from.id),
    text:      msg.text.trim(),
    messageId: msg.message_id,
  }
}

export async function sendTextMessage(
  chatId: number, text: string, botToken: string
): Promise<void> {
  const res = await fetch(`${TG_API}${botToken}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
  if (!res.ok) throw new Error(`TG send failed: ${res.status} ${await res.text()}`)
}

export async function sendDocument(
  chatId: number, fileUrl: string, caption: string, botToken: string
): Promise<void> {
  const res = await fetch(`${TG_API}${botToken}/sendDocument`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, document: fileUrl, caption }),
  })
  if (!res.ok) throw new Error(`TG send doc failed: ${res.status} ${await res.text()}`)
}

export async function setWebhook(webhookUrl: string, botToken: string, secret: string): Promise<void> {
  const res = await fetch(`${TG_API}${botToken}/setWebhook`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, secret_token: secret, allowed_updates: ['message'] }),
  })
  if (!res.ok) throw new Error(`TG setWebhook failed: ${res.status} ${await res.text()}`)
}
