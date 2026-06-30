import { sendTextMessage } from '../../lib/whatsapp'

export async function sendHelp(phoneNumberId: string, to: string, token: string) {
  const text = `*Help*\n\n/reset — Clear conversation\n/help — This menu`
  await sendTextMessage(phoneNumberId, to, text, token)
}

export async function sendReset(phoneNumberId: string, to: string, token: string) {
  await sendTextMessage(phoneNumberId, to, `🔄 Conversation reset. Send anything to start fresh.`, token)
}

export async function sendError(phoneNumberId: string, to: string, token: string) {
  await sendTextMessage(phoneNumberId, to, 'Something went wrong. Please try again shortly.', token).catch(() => {})
}

export async function sendReply(phoneNumberId: string, to: string, reply: string, token: string) {
  for (const chunk of splitMessage(reply)) {
    await sendTextMessage(phoneNumberId, to, chunk, token)
  }
}

function splitMessage(text: string, max = 4000): string[] {
  if (text.length <= max) return [text]
  const chunks: string[] = []
  let current = ''
  for (const line of text.split('\n')) {
    if ((current + '\n' + line).length > max) { if (current) chunks.push(current.trim()); current = line }
    else { current = current ? current + '\n' + line : line }
  }
  if (current) chunks.push(current.trim())
  return chunks
}
