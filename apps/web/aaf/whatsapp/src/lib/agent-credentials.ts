import { decryptRecord, decrypt } from '@repo/crypto'

export interface AgentCredentials {
  slug: string
  accessToken: string
  appSecret: string
  verifyToken: string
  phoneNumberId: string
}

export async function resolveAgentCredentials(
  db: D1Database,
  encKey: string,
  phoneNumberId: string
): Promise<AgentCredentials | null> {
  const { results } = await db.prepare(
    'SELECT slug, api_keys, channel_config FROM agents WHERE is_active = 1'
  ).all() as { results: { slug: string; api_keys: string | null; channel_config: string | null }[] }

  for (const row of results) {
    if (!row.channel_config) continue
    try {
      const parsed = JSON.parse(row.channel_config) as Record<string, string>
      const decrypted = await decryptRecord(parsed, encKey)
      if (decrypted.whatsappPhoneNumberId === phoneNumberId) {
        let apiKeys: Record<string, string> = {}
        if (row.api_keys) {
          const parsedKeys = JSON.parse(row.api_keys) as Record<string, string>
          apiKeys = await decryptRecord(parsedKeys, encKey)
        }
        return {
          slug: row.slug,
          accessToken: apiKeys.whatsappAccessToken ?? '',
          appSecret: apiKeys.whatsappAppSecret ?? '',
          verifyToken: apiKeys.whatsappVerifyToken ?? '',
          phoneNumberId,
        }
      }
    } catch {
      continue
    }
  }
  return null
}

export async function getAllAgentCredentials(
  db: D1Database,
  encKey: string,
): Promise<AgentCredentials[]> {
  const { results } = await db.prepare(
    'SELECT slug, api_keys, channel_config FROM agents WHERE is_active = 1'
  ).all() as { results: { slug: string; api_keys: string | null; channel_config: string | null }[] }

  const all: AgentCredentials[] = []
  for (const row of results) {
    if (!row.channel_config) continue
    try {
      const parsed = JSON.parse(row.channel_config) as Record<string, string>
      const decrypted = await decryptRecord(parsed, encKey)
      let apiKeys: Record<string, string> = {}
      if (row.api_keys) {
        const parsedKeys = JSON.parse(row.api_keys) as Record<string, string>
        apiKeys = await decryptRecord(parsedKeys, encKey)
      }
      all.push({
        slug: row.slug,
        accessToken: apiKeys.whatsappAccessToken ?? '',
        appSecret: apiKeys.whatsappAppSecret ?? '',
        verifyToken: apiKeys.whatsappVerifyToken ?? '',
        phoneNumberId: decrypted.whatsappPhoneNumberId ?? '',
      })
    } catch {
      continue
    }
  }
  return all
}
