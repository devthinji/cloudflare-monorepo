import { sendTextMessage } from '../lib/whatsapp'
import type { Env } from '../types/env'

export class WhatsappView {
  constructor(private env: Env) {}

  async sendHelp(phoneNumberId: string, to: string) {
    const text = `*Help*\n\n/reset — Clear conversation\n/help — This menu`
    await sendTextMessage(phoneNumberId, to, text, this.env.WHATSAPP_TOKEN)
  }

  async sendReset(phoneNumberId: string, to: string) {
    await sendTextMessage(phoneNumberId, to, `🔄 Conversation reset. Send anything to start fresh.`, this.env.WHATSAPP_TOKEN)
  }

  async sendError(phoneNumberId: string, to: string) {
    await sendTextMessage(phoneNumberId, to, 'Something went wrong. Please try again shortly.', this.env.WHATSAPP_TOKEN).catch(() => {})
  }

  async sendReply(phoneNumberId: string, to: string, reply: string) {
    for (const chunk of this.splitMessage(reply)) {
      await sendTextMessage(phoneNumberId, to, chunk, this.env.WHATSAPP_TOKEN)
    }
  }

  private splitMessage(text: string, max = 4000): string[] {
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
}
