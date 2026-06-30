import { sendHelp, sendReset, sendError, sendReply } from '../controllers/outgoing/reply'
import type { Env } from '../types/env'

export class WhatsappView {
  constructor(private env: Env) {}

  async sendHelp(phoneNumberId: string, to: string) {
    await sendHelp(phoneNumberId, to, this.env.WHATSAPP_ACCESS_TOKEN)
  }

  async sendReset(phoneNumberId: string, to: string) {
    await sendReset(phoneNumberId, to, this.env.WHATSAPP_ACCESS_TOKEN)
  }

  async sendError(phoneNumberId: string, to: string) {
    await sendError(phoneNumberId, to, this.env.WHATSAPP_ACCESS_TOKEN)
  }

  async sendReply(phoneNumberId: string, to: string, reply: string) {
    await sendReply(phoneNumberId, to, reply, this.env.WHATSAPP_ACCESS_TOKEN)
  }
}
