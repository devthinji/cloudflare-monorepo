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
