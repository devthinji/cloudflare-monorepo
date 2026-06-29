// ─── docx → markdown ─────────────────────────────────────────────────────────
//
// Strips XML tags from word/document.xml to produce readable plain text,
// then asks Groq to format it as clean markdown.
// No external library needed — works within Workers constraints.

import type { ConvertResult }   from '../factory'
import type { DocgenWorkerEnv } from '@repo/types'

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions'

export async function docxToMarkdown(
  file:    ArrayBuffer,
  env:     DocgenWorkerEnv,
  options?: Record<string, unknown>,
): Promise<ConvertResult> {
  const templateName = (options?.templateName as string) ?? 'Document'

  // Strip XML tags → readable text
  const raw      = new TextDecoder('utf-8', { fatal: false }).decode(file)
  const stripped = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 4000).trim()

  try {
    const res = await fetch(GROQ_API, {
      method:  'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages: [{
          role:    'user',
          content: `Convert the following raw text extracted from a "${templateName}" docx template into clean, readable markdown. Preserve headings, lists, and structure. Replace {placeholder} values with [PLACEHOLDER_NAME] in brackets.\n\nRaw text:\n${stripped}\n\nReturn only the markdown.`,
        }],
        max_tokens:  1024,
        temperature: 0.1,
      }),
    })
    if (!res.ok) throw new Error(`Groq error ${res.status}`)
    const data = await res.json() as { choices: { message: { content: string } }[] }
    return { markdown: data.choices[0]?.message.content?.trim() ?? stripped }
  } catch {
    // Fallback — return stripped text as-is
    return { markdown: stripped }
  }
}
