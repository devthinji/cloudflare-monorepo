import type { FieldSchema, SKUSchema } from './field-schema'
import { call } from '@repo/llm-service'
import type { DocgenWorkerEnv } from '@repo/types'

// ── Step 1: Extract raw {placeholders} from docx XML ─────────────────────────

export async function extractPlaceholders(docxBuffer: ArrayBuffer): Promise<string[]> {
  const text    = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false }).decode(docxBuffer)
  const matches = [...text.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)]
  const keys    = [...new Set(matches.map(m => m[1]).filter((k): k is string => !!k))]
  return keys
}

// ── Step 2: AI — infer field schema from placeholder keys + document type ─────

export async function inferFieldSchema(
  env:          DocgenWorkerEnv,
  placeholders:  string[],
  documentType:  string,
  visualDesc:    string,
  templateName:  string,
): Promise<FieldSchema[]> {
  const prompt = `You are a document template analyst. Given a list of placeholder keys found in a "${documentType}" template called "${templateName}", infer the best field schema for collecting data from a user via WhatsApp chat.

Template visual description:
${visualDesc}

Placeholder keys found:
${placeholders.map(p => `- {${p}}`).join('\n')}

For each placeholder, return a JSON array of FieldSchema objects. Each object must have:
- key: string (exact placeholder key)
- label: string (friendly question to ask the user, max 80 chars)
- hint: string (short example answer, optional)
- type: one of "text"|"textarea"|"number"|"phone"|"email"|"date"|"choice"|"repeatable"|"image_url"
- required: boolean
- order: number (logical interview sequence, starting from 1)
- maxLength: number (only for text/textarea)
- choices: array of {label, value} (only for type "choice")
- subFields: FieldSchema[] (only for type "repeatable", e.g. work experience entries)
- condition: {field, operator, value} (optional, only if this field depends on another)

Rules:
- Put name/identity fields first (order 1-3)
- Contact fields second (order 4-6)
- Content fields last (order 7+)
- Use "repeatable" for experience, education, references
- Use "choice" for fields with a known fixed set of options
- Use "textarea" for long text like summaries, messages, objectives
- Keep labels conversational — this is WhatsApp, not a form
- For gift cards, cards, printables: keep it short (3-5 fields max)
- For CVs: full schema with repeatable experience + education
- For legal docs (NDA, minutes): include party names, dates, company details

Return ONLY the JSON array. No explanation.`

  try {
    const response = await call({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
      temperature: 0.2,
    }, env)

    const raw = response.content
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : (parsed.fields ?? parsed.schema ?? [])
    } catch {
      return []
    }
  } catch {
    return []
  }
}

// ── Step 3: AI — generate visual description from docx text content ───────────

export async function generateVisualDescription(
  env:          DocgenWorkerEnv,
  docxBuffer:   ArrayBuffer,
  templateName: string,
  documentType: string,
): Promise<string> {
  const rawText = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false }).decode(docxBuffer)

  const readable = rawText
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 3000)
    .trim()

  const prompt = `You are a document designer. Based on the raw extracted content below from a "${documentType}" template called "${templateName}", write a short description (2-3 sentences) of what this document looks like, its purpose, and what it would be used for. Focus on the document's professional value.

Raw content:
${readable}

Return only the description, no explanation.`

  try {
    const response = await call({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 256,
      temperature: 0.3,
    }, env)
    return response.content.trim()
  } catch {
    return `A professional ${documentType} template.`
  }
}

// ── Step 4: Generate confirm prompt for this SKU ──────────────────────────────

export function buildConfirmPrompt(templateName: string, documentType: string): string {
  return `I have everything I need for your *${templateName}*! Here is a summary of what you provided. Shall I generate it now?\n\nReply *Yes* to confirm or *No* to change something.`
}

// ── Full pipeline — called after upload ──────────────────────────────────────

export interface ExtractionResult {
  description:   string
  fieldSchema:   FieldSchema[]
  confirmPrompt: string
  skuSchema:     SKUSchema
}

export async function runExtractionPipeline(
  env:          DocgenWorkerEnv,
  docxBuffer:   ArrayBuffer,
  templateId:   string,
  templateName: string,
  documentType: string,
  tier?:        string,
): Promise<ExtractionResult> {
  const [placeholders, description] = await Promise.all([
    extractPlaceholders(docxBuffer),
    generateVisualDescription(env, docxBuffer, templateName, documentType),
  ])

  const fieldSchema    = await inferFieldSchema(env, placeholders, documentType, description, templateName)
  const confirmPrompt  = buildConfirmPrompt(templateName, documentType)

  const skuSchema: SKUSchema = {
    templateId,
    documentType,
    tier,
    fields:        fieldSchema,
    confirmPrompt,
  }

  return { description, fieldSchema, confirmPrompt, skuSchema }
}
