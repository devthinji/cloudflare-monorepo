// ─── docx → placeholder_schema ───────────────────────────────────────────────
//
// 1. Decodes docx binary as text (docx = ZIP, but we regex the raw bytes)
// 2. Extracts every {placeholder} using docxtemplater single-brace syntax
// 3. Calls Groq to infer field types, labels, order from the placeholder keys
// 4. Returns FieldSchema[]

import type { ConvertResult }   from '../factory'
import type { DocgenWorkerEnv } from '@repo/types'
import { inferFieldSchema, generateVisualDescription } from '../extractor'

export async function docxToSchema(
  file:    ArrayBuffer,
  env:     DocgenWorkerEnv,
  options?: Record<string, unknown>,
): Promise<ConvertResult> {
  const templateName  = (options?.templateName  as string) ?? 'Document'
  const documentType  = (options?.documentType  as string) ?? 'document'

  // Extract {placeholder} keys from raw docx bytes
  // docx is a ZIP — word/document.xml contains the text with placeholders
  const text  = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false }).decode(file)
  const matches = [...text.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)]
  const keys    = [...new Set(matches.map(m => m[1]!))]

  if (keys.length === 0) {
    return { error: 'No {placeholders} found in this template. Make sure your template uses {field_name} syntax.' }
  }

  // AI inference — labels, types, order
  const [description, fields] = await Promise.all([
    generateVisualDescription(env, file, templateName, documentType),
    inferFieldSchema(env, keys, documentType, '', templateName),
  ])

  return { placeholder_schema: fields, description }
}
