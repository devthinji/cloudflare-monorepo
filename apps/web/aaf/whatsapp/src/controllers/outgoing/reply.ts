import { sendTextMessage, markAsRead } from '../../lib/whatsapp'
import type { InteractionHint } from '../../types/interactive'

const GRAPH_URL = 'https://graph.facebook.com/v20.0'

export async function sendHelp(phoneNumberId: string, to: string, token: string) {
  const text = `*Help*\n\n/reset, exit, quit — Clear conversation\n/help — This menu`
  await sendTextMessage(phoneNumberId, to, text, token)
}

export async function sendReset(phoneNumberId: string, to: string, token: string) {
  await sendTextMessage(phoneNumberId, to, `🔄 Conversation reset. Send anything to start fresh.`, token)
}

export async function sendError(phoneNumberId: string, to: string, token: string) {
  await sendTextMessage(phoneNumberId, to, 'Something went wrong. Please try again shortly.', token).catch(() => {})
}

export async function sendReply(phoneNumberId: string, to: string, reply: string, token: string, messageId?: string, interactive?: InteractionHint | null) {
  if (messageId) {
    markAsRead(phoneNumberId, messageId, token).catch(() => {})
  }

  if (interactive) {
    await sendInteractiveMessage(phoneNumberId, to, interactive, token)
    return
  }

  for (const chunk of splitMessage(reply)) {
    await sendTextMessage(phoneNumberId, to, chunk, token)
  }
}

// ─── Interactive message sender ──────────────────────────────────────────────

interface HintButton { id: string; title: string }
interface HintSection { title?: string; rows: { id: string; title: string; description?: string }[] }

export async function sendInteractiveMessage(
  phoneNumberId: string, to: string, hint: InteractionHint, token: string
): Promise<void> {
  if (hint.type === 'buttons' && hint.buttons?.length) {
    await postInteractive(phoneNumberId, to, {
      type: 'button',
      body: { text: hint.body ?? '' },
      ...(hint.header ? { header: { type: 'text' as const, text: hint.header } } : {}),
      ...(hint.footer ? { footer: { text: hint.footer } } : {}),
      action: {
        buttons: hint.buttons.slice(0, 3).map((b: HintButton) => ({
          type: 'reply' as const,
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    }, token)
    return
  }

  if (hint.type === 'list' && hint.sections?.length && hint.buttonLabel) {
    const sections = hint.sections.map((s: HintSection) => ({
      ...(s.title ? { title: s.title.slice(0, 24) } : {}),
      rows: s.rows.slice(0, 10).map((r: HintSection['rows'][0]) => ({
        id: r.id,
        title: r.title.slice(0, 24),
        ...(r.description ? { description: r.description.slice(0, 72) } : {}),
      })),
    }))

    await postInteractive(phoneNumberId, to, {
      type: 'list',
      body: { text: hint.body ?? '' },
      ...(hint.header ? { header: { type: 'text' as const, text: hint.header } } : {}),
      ...(hint.footer ? { footer: { text: hint.footer } } : {}),
      action: { button: hint.buttonLabel.slice(0, 20), sections },
    }, token)
    return
  }

  // fallback: send as text
  await sendTextMessage(phoneNumberId, to, hint.body ?? '', token)
}

async function postInteractive(
  phoneNumberId: string, to: string,
  interactive: Record<string, unknown>, token: string
): Promise<void> {
  const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    }),
  })
  if (!res.ok) throw new Error(`WA interactive send failed: ${res.status} ${await res.text()}`)
}

function splitMessage(text: string, max = 4000): string[] {
  if (text.length <= max) return [text]
  const chunks: string[] = []
  let current = ''
  for (const line of text.split('\n')) {
    if ((current + '\n' + line).length > max) { if (current) chunks.push(current.trim()); current = line }
    else { current = current ? current + '\n' + line : line }
  }
  if (current) chunks.push(current.trim())
  return chunks
}
