// ─── R2 Storage Helpers ───────────────────────────────────────────────────────
//
// Central place for all R2 reads/writes.
// The DOCS_BUCKET binding is injected from DocgenWorkerEnv.

import type { DocgenWorkerEnv } from '@repo/types'

// ── Read a template file from R2 ────────────────────────────────────────────
export async function getTemplateBuffer(
  env:     DocgenWorkerEnv,
  fileKey: string,
): Promise<ArrayBuffer | null> {
  const obj = await env.DOCS_BUCKET.get(fileKey)
  if (!obj) return null
  return obj.arrayBuffer()
}

// ── Store a rendered document and return its CDN URL ────────────────────────
export async function storeRenderedDoc(
  env:      DocgenWorkerEnv,
  key:      string,
  buffer:   Uint8Array,
  filename: string,
): Promise<string> {
  await env.DOCS_BUCKET.put(key, buffer, {
    httpMetadata: {
      contentType:        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      contentDisposition: `attachment; filename="${filename}"`,
    },
  })

  // Return a public CDN URL — bucket must have public access enabled
  // If not public, use a pre-signed URL (handled by caller)
  const bucketPublicUrl = env.DOCS_BUCKET_PUBLIC_URL ?? ''
  return bucketPublicUrl ? `${bucketPublicUrl.replace(/\/$/, '')}/${key}` : key
}

// ── Generate a time-limited signed URL for private buckets ──────────────────
// Cloudflare R2 presigned URLs require the S3-compat API — done via the gateway.
// For now we return the R2 key; gateway can generate the signed URL on request.
export function docDownloadKey(userId: string, skuId: string, docId: string): string {
  return `rendered/${userId}/${skuId}/${docId}.docx`
}
