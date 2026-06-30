import type { Env } from '../types/env'

export class MachineModel {
  constructor(private env: Env) {}

  async advance(agentSlug: string, userId: string, text: string) {
    const res = await this.env.API_GATEWAY.fetch(
      new Request('https://internal/api/v1/machine/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal': 'aaf-whatsapp', 'X-Channel': 'whatsapp' },
        body: JSON.stringify({ agentSlug, userId, channel: 'whatsapp', message: text }),
      })
    )
    return res.json() as Promise<{ success: boolean; data?: { reply: string; stage: string; collectSub?: string; skuName?: string; document?: { docId: string; key: string; filename: string }; done: boolean } }>
  }

  async reset(userId: string, agentSlug: string): Promise<void> {
    await this.env.API_GATEWAY.fetch(
      new Request(`https://internal/api/v1/machine/context/${encodeURIComponent(userId)}/${agentSlug}`, {
        method: 'DELETE', headers: { 'X-Internal': 'aaf-whatsapp' },
      })
    )
  }
}
