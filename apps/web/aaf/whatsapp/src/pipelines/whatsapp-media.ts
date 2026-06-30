const GRAPH_URL = 'https://graph.facebook.com/v20.0'

export interface MediaUploadResult {
  mediaId: string
}

export async function uploadMedia(
  phoneNumberId: string,
  buffer: ArrayBuffer,
  filename: string,
  accessToken: string,
): Promise<MediaUploadResult> {
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('file', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), filename)
  form.append('type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

  const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  })

  if (!res.ok) throw new Error(`WA media upload failed: ${res.status} ${await res.text()}`)

  const data = await res.json() as { id: string }
  return { mediaId: data.id }
}

export async function sendDocumentMedia(
  phoneNumberId: string,
  to: string,
  mediaId: string,
  filename: string,
  caption: string,
  accessToken: string,
): Promise<void> {
  const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'document',
      document: { id: mediaId, caption, filename },
    }),
  })

  if (!res.ok) throw new Error(`WA send doc media failed: ${res.status} ${await res.text()}`)
}
