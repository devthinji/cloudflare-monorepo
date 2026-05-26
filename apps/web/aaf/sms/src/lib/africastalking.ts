// Africa's Talking SMS API
const AT_API = 'https://api.africastalking.com/version1'

export interface AtIncomingSms {
  from:   string   // e.g. "+254712345678"
  to:     string   // shortcode / sender ID
  text:   string
  date:   string
  id:     string
}

export function parseIncomingSms(body: Record<string, string>): AtIncomingSms | null {
  if (!body.from || !body.text) return null
  return {
    from: body.from.trim(),
    to:   body.to?.trim()   ?? '',
    text: body.text.trim(),
    date: body.date?.trim() ?? '',
    id:   body.id?.trim()   ?? '',
  }
}

export async function sendSms(
  to: string, message: string,
  apiKey: string, username: string, senderId?: string
): Promise<void> {
  const params = new URLSearchParams({
    username,
    to,
    message,
    ...(senderId ? { from: senderId } : {}),
  })

  const res = await fetch(`${AT_API}/messaging`, {
    method:  'POST',
    headers: {
      Accept:         'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      apiKey,
    },
    body: params.toString(),
  })

  if (!res.ok) throw new Error(`AT SMS send failed: ${res.status} ${await res.text()}`)

  const data = await res.json() as { SMSMessageData: { Recipients: { status: string }[] } }
  const recipient = data.SMSMessageData.Recipients[0]
  if (recipient?.status !== 'Success') {
    throw new Error(`AT SMS delivery failed: ${recipient?.status}`)
  }
}
