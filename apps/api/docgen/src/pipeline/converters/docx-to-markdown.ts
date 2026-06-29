import type { ConvertResult }   from '../factory'
import type { DocgenWorkerEnv } from '@repo/types'
import { call } from '@repo/llm-service'

export async function docxToMarkdown(
  file:    ArrayBuffer,
  env:     DocgenWorkerEnv,
  options?: Record<string, unknown>,
): Promise<ConvertResult> {
  const templateName = (options?.templateName as string) ?? 'Document'

  const raw      = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false }).decode(file)
  const stripped = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 4000).trim()

  try {
    const response = await call({
      model: 'openai/gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Convert the following raw text extracted from a "${templateName}" docx template into clean, readable markdown. Preserve headings, lists, and structure. Replace {placeholder} values with [PLACEHOLDER_NAME] in brackets.\n\nRaw text:\n${stripped}\n\nReturn only the markdown.`,
      }],
      maxTokens: 1024,
      temperature: 0.1,
    }, env)
    return { markdown: response.content.trim() ?? stripped }
  } catch {
    return { markdown: stripped }
  }
}
