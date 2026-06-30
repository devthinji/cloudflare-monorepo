import { uploadMedia, sendDocumentMedia } from './whatsapp-media'
import { getServiceStyle } from '@repo/middleware'

const TAG_WIDTH = 7

function log(label: string, value: string) {
  const s = getServiceStyle('whatsapp')
  const tag = s.tag.padEnd(TAG_WIDTH)
  console.log(`${s.icon} [${tag}] ${label}  ${value}`)
}

export interface DeliveryResult {
  delivered: boolean
  error?: string
}

export interface DeliverInput {
  phoneNumberId: string
  to: string
  document: { key: string; filename: string }
  accessToken: string
  apiGateway: Fetcher
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function deliverDocument(input: DeliverInput): Promise<DeliveryResult> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      log('deliver', `attempt ${attempt}/${MAX_RETRIES} — ${input.document.filename}`)

      const buffer = await fetchDocBuffer(input.document.key, input.apiGateway)
      if (!buffer) {
        log('deliver', `file not found in storage`)
        return { delivered: false, error: 'Document file not found in storage' }
      }

      const { mediaId } = await uploadMedia(input.phoneNumberId, buffer, input.document.filename, input.accessToken)
      log('deliver', `uploaded media id=${mediaId}`)

      await sendDocumentMedia(input.phoneNumberId, input.to, mediaId, input.document.filename, 'Your document is ready!', input.accessToken)
      log('deliver', `sent successfully`)

      return { delivered: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      log('deliver', `attempt ${attempt} failed: ${msg}`)

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt)
      } else {
        return { delivered: false, error: msg }
      }
    }
  }

  return { delivered: false, error: 'Max retries exceeded' }
}

async function fetchDocBuffer(key: string, apiGateway: Fetcher): Promise<ArrayBuffer | null> {
  try {
    const res = await apiGateway.fetch(
      new Request(`https://internal/api/v1/docgen/download?key=${encodeURIComponent(key)}`, {
        headers: { 'X-Internal': 'aaf-whatsapp' },
      })
    )
    if (!res.ok) return null
    return res.arrayBuffer()
  } catch {
    return null
  }
}
