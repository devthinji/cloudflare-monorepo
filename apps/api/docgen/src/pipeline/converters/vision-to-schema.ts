// ─── vision → placeholder_schema ─────────────────────────────────────────────
//
// For Canva exports, screenshots, or image-based templates.
// Uses Cloudflare Workers AI vision model to:
//   1. Identify the document type and visible text regions
//   2. Suggest placeholder fields based on what it sees
// NOTE: Always requires human review before publishing — AI is probabilistic.

import type { ConvertResult }   from '../factory'
import type { DocgenWorkerEnv } from '@repo/types'
import { inferFieldSchema }     from '../extractor'

export async function visionToSchema(
  file:    ArrayBuffer,
  env:     DocgenWorkerEnv,
  options?: Record<string, unknown>,
): Promise<ConvertResult> {
  const templateName = (options?.templateName as string) ?? 'Document'
  const documentType = (options?.documentType as string) ?? 'document'

  try {
    // Run vision model — Cloudflare Workers AI (in-process, free tier)
    const result = await (env.AI as any).run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: [...new Uint8Array(file)],
      prompt: `This is a "${documentType}" template called "${templateName}". List every text field or placeholder you can see that a user would need to fill in. For each field, give: the field name (snake_case), what it represents, and whether it is required. Return as JSON array: [{key, description, required}]`,
      max_tokens: 1024,
    })

    let fields: { key: string; description: string; required: boolean }[] = []
    try {
      const raw = typeof result === 'string' ? result : result?.description ?? ''
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) fields = JSON.parse(match[0])
    } catch {}

    if (fields.length === 0) {
      return { error: 'Vision model could not identify fields. Please review manually or try a docx template instead.' }
    }

    const keys   = fields.map(f => f.key)
    const schema = await inferFieldSchema(env.GROQ_API_KEY, keys, documentType, fields.map(f => f.description).join(', '), templateName)
    return { placeholder_schema: schema, description: `AI-extracted from image. Human review required before publishing.` }
  } catch (e) {
    return { error: `Vision extraction failed: ${e instanceof Error ? e.message : String(e)}` }
  }
}
