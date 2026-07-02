// ─── docx → pdf ───────────────────────────────────────────────────────────────
//
// Cloudflare Workers has no native docx/pdf rendering, so this delegates to
// an external conversion API (CloudConvert). Requires the CLOUDCONVERT_API_KEY
// secret — until it's set, this converter returns a clear "not configured"
// error instead of silently failing.
//
// Swap the implementation freely (Gotenberg, Adobe API, etc.) — the
// PipelineFactory contract (file in, fileKey out) stays the same.

import type { ConvertResult } from '../factory'
import type { DocgenWorkerEnv } from '@repo/types'
import { generateId } from '@repo/utils'

interface DocgenWorkerEnvWithConverter extends DocgenWorkerEnv {
  CLOUDCONVERT_API_KEY?: string
}

export async function docxToPdf(
  file:    ArrayBuffer,
  env:     DocgenWorkerEnv,
  options?: Record<string, unknown>,
): Promise<ConvertResult> {
  const apiKey = (env as DocgenWorkerEnvWithConverter).CLOUDCONVERT_API_KEY
  if (!apiKey) {
    return { error: 'docx→pdf is not configured yet — set the CLOUDCONVERT_API_KEY secret (wrangler secret put / Doppler) to enable it.' }
  }

  const filename = (options?.filename as string) ?? 'document.docx'

  try {
    // CloudConvert's "import/upload → convert → export/url" job flow, condensed to one call
    // via their sync job endpoint. See https://cloudconvert.com/api/v2#jobs
    const jobRes = await fetch('https://api.cloudconvert.com/v2/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks: {
          'import-file': { operation: 'import/base64', file: arrayBufferToBase64(file), filename },
          'convert-file': { operation: 'convert', input: 'import-file', output_format: 'pdf' },
          'export-file': { operation: 'export/url', input: 'convert-file' },
        },
      }),
    })

    if (!jobRes.ok) return { error: `CloudConvert job creation failed: ${jobRes.status} ${await jobRes.text()}` }
    const job = await jobRes.json() as { data: { id: string } }

    // Poll until the export task has a result URL (CloudConvert jobs are async)
    const pdfUrl = await pollForExportUrl(job.data.id, apiKey)
    if (!pdfUrl) return { error: 'CloudConvert conversion timed out.' }

    const pdfRes = await fetch(pdfUrl)
    if (!pdfRes.ok) return { error: `Failed to download converted PDF: ${pdfRes.status}` }
    const pdfBuffer = await pdfRes.arrayBuffer()

    const fileKey = `converted/${generateId()}.pdf`
    await env.DOCS_BUCKET.put(fileKey, pdfBuffer, { httpMetadata: { contentType: 'application/pdf' } })

    return { fileKey }
  } catch (e) {
    return { error: `docx→pdf conversion failed: ${e instanceof Error ? e.message : String(e)}` }
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

async function pollForExportUrl(jobId: string, apiKey: string, maxAttempts = 10): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 1500))
    const res = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) continue
    const body = await res.json() as { data: { status: string; tasks: { operation: string; status: string; result?: { files?: { url: string }[] } }[] } }
    if (body.data.status === 'error') return null
    const exportTask = body.data.tasks.find(t => t.operation === 'export/url')
    const url = exportTask?.result?.files?.[0]?.url
    if (url) return url
  }
  return null
}
