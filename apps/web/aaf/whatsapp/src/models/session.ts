import type { Env, Session } from '../types/env'
import { DEFAULT_AGENT } from '../types/env'

export class SessionModel {
  constructor(private env: Env) {}

  private getKey(userId: string) { return `wa:session:${userId}` }

  async getSession(userId: string): Promise<Session> {
    const raw = await this.env.AAF_KV.get(this.getKey(userId))
    return raw ? (JSON.parse(raw) ?? { agentSlug: DEFAULT_AGENT }) : { agentSlug: DEFAULT_AGENT }
  }

  async saveSession(userId: string, session: Session): Promise<void> {
    await this.env.AAF_KV.put(this.getKey(userId), JSON.stringify(session), { expirationTtl: 86400 * 30 })
  }
}
