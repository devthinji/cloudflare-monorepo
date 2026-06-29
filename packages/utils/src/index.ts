// ─── Shared Utilities — @repo/utils ──────────────────────────────────────────

import type { ApiResponse } from '@repo/types'

export function ok<T>(data: T, message?: string): ApiResponse<T> {
  return message ? { success: true, data, message } : { success: true, data }
}

export function err(error: string): ApiResponse<never> {
  return { success: false, error }
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function now(): string {
  return new Date().toISOString()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function truncate(text: string, max = 100): string {
  return text.length <= max ? text : text.slice(0, max - 3) + '...'
}

// ── JWT helpers (HMAC SHA-256) ──────────────────────────────────────────────

export interface JwtPayload {
  sub:   string
  email: string
  role:  string
  [key: string]: unknown
}

function base64url(input: Uint8Array | ArrayBuffer): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmacSha256(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return base64url(sig)
}

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header  = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body    = base64url(new TextEncoder().encode(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) })))
  const encoded = `${header}.${body}`
  const sig     = await hmacSha256(secret, encoded)
  return `${encoded}.${sig}`
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const header = parts[0]!
  const body   = parts[1]!
  const sig    = parts[2]!
  const expected = await hmacSha256(secret, `${header}.${body}`)
  if (sig !== expected) return null
  try {
    return JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload
  } catch {
    return null
  }
}
