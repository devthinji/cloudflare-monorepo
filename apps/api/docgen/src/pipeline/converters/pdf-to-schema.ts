// ─── pdf → placeholder_schema ────────────────────────────────────────────────
//
// 1. Extract text from PDF
// 2. Find {placeholders}
// 3. AI infers field schema

import type { ConvertResult }   from '../factory'
import type { DocgenWorkerEnv } from '@repo/types'
import { pdfToTxt }             from './pdf-to-txt'
import { inferFieldSchema }     from '../extractor'

export async function pdfToSchema(
  file:    ArrayBuffer,
  env:     DocgenWorkerEnv,
  options?: Record<string, unknown>,
): Promise<ConvertResult> {
  const templateName = (options?.templateName as string) ?? 'Document'
  const documentType = (options?.documentType as string) ?? 'document'

  const txtResult = await pdfToTxt(file, env, options)
  if (txtResult.error) return txtResult

  const text  = txtResult.text ?? ''
  const keys  = [...new Set([...text.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)].map(m => m[1]!))]

  if (keys.length === 0) {
    return { error: 'No {placeholders} found in this PDF.' }
  }

  const fields = await inferFieldSchema(env, keys, documentType, text.slice(0, 500), templateName)
  return { placeholder_schema: fields }
}
