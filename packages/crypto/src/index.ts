/**
 * @repo/crypto
 *
 * AES-256-GCM encrypt/decrypt for Cloudflare Workers (Web Crypto API).
 *
 * Usage:
 *   const enc = await encrypt(JSON.stringify({ key: 'value' }), env.DB_ENCRYPTION_KEY)
 *   const plain = await decrypt(enc, env.DB_ENCRYPTION_KEY)
 *
 * Storage format (base64url, colon-separated):
 *   <iv_b64>:<ciphertext_b64>
 *
 * DB_ENCRYPTION_KEY must be a 32-byte hex string (64 chars).
 * Generate: openssl rand -hex 32
 */

const ALG = { name: 'AES-GCM', length: 256 } as const
const IV_BYTES = 12   // 96-bit IV — GCM standard
const MASK_VISIBLE = 6 // chars shown in masked output

// ── Key import ────────────────────────────────────────────────────────────────

async function importKey(hexKey: string): Promise<CryptoKey> {
  if (!hexKey || hexKey.length !== 64) {
    throw new Error('DB_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }
  const raw = new Uint8Array(hexKey.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  return crypto.subtle.importKey('raw', raw, ALG, false, ['encrypt', 'decrypt'])
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromB64(str: string): Uint8Array<ArrayBuffer> {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + (4 - str.length % 4) % 4, '=')
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string.
 * Returns "<iv_b64url>:<ciphertext_b64url>"
 */
export async function encrypt(plaintext: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey)
  const iv  = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const enc = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  )
  return `${toB64(iv.buffer)}:${toB64(enc)}`
}

/**
 * Decrypt a "<iv_b64url>:<ciphertext_b64url>" string.
 * Returns the original plaintext.
 */
export async function decrypt(ciphertext: string, hexKey: string): Promise<string> {
  const sep = ciphertext.indexOf(':')
  if (sep === -1) throw new Error('Invalid ciphertext format — expected iv:ciphertext')
  const iv   = fromB64(ciphertext.slice(0, sep))
  const data = fromB64(ciphertext.slice(sep + 1))
  const key  = await importKey(hexKey)
  const dec  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(dec)
}

/**
 * Returns true if the string looks like an encrypted blob.
 * Use before decrypting to skip already-plaintext legacy rows.
 */
export function isEncrypted(value: string): boolean {
  return /^[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]{20,}$/.test(value)
}

/**
 * Mask a secret value for safe display in the dashboard.
 * "EAABsomeLongToken..." → "EAABso••••••"
 */
export function maskSecret(value: string): string {
  if (!value || value.length <= MASK_VISIBLE) return '••••••'
  return value.slice(0, MASK_VISIBLE) + '••••••'
}

/**
 * Encrypt every value in a Record<string, string>.
 * Keys are preserved in plaintext (only values are encrypted).
 */
export async function encryptRecord(
  record: Record<string, string>,
  hexKey: string
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(record)) {
    out[k] = v ? await encrypt(v, hexKey) : v
  }
  return out
}

/**
 * Decrypt every value in a Record<string, string>.
 * Skips values that are not encrypted (safe for legacy plaintext rows).
 */
export async function decryptRecord(
  record: Record<string, string>,
  hexKey: string
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(record)) {
    out[k] = v && isEncrypted(v) ? await decrypt(v, hexKey) : v
  }
  return out
}

/**
 * Mask every value in a Record<string, string> for dashboard display.
 * Returns { key: "EAABso••••••" } — never exposes real values.
 */
export function maskRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, maskSecret(v)]))
}
