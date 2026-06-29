// ─── Template Renderer ────────────────────────────────────────────────────────
//
// Takes an R2-stored .docx template and a map of field values,
// fills every {placeholder} using docxtemplater, and returns the
// rendered file as a Uint8Array ready for R2 storage / CDN delivery.
//
// docxtemplater uses single-brace syntax: {field_name}
// PizZip handles the ZIP-level reading/writing of the .docx container.

import PizZip     from 'pizzip'
import Docxtemplater from 'docxtemplater'

export interface RenderInput {
  templateBuffer: ArrayBuffer               // raw .docx bytes from R2
  fieldValues:    Record<string, unknown>   // collected answers from conversation
}

export interface RenderOutput {
  buffer:   Uint8Array   // rendered .docx bytes — store in R2, serve via signed URL
  filename: string
}

export async function renderTemplate(
  input:    RenderInput,
  filename: string,
): Promise<RenderOutput> {
  // PizZip needs a Buffer or Uint8Array
  const zip = new PizZip(input.templateBuffer)

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks:    true,
    // Null / undefined values become empty string — never crashes
    nullGetter:    () => '',
  })

  // Fill placeholders
  doc.render(sanitiseValues(input.fieldValues))

  const buffer = doc.getZip().generate({
    type:        'uint8array',
    compression: 'DEFLATE',
  })

  return { buffer, filename }
}

// ─── Sanitise ─────────────────────────────────────────────────────────────────
// docxtemplater expects all values to be strings / primitives.
// Arrays (repeatable fields) stay as-is — docxtemplater handles {#list}{/list}.

function sanitiseValues(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(values)) {
    if (v === null || v === undefined)  out[k] = ''
    else if (Array.isArray(v))          out[k] = v.map(item =>
      typeof item === 'object' && item !== null ? sanitiseValues(item as Record<string, unknown>) : item
    )
    else if (typeof v === 'object')     out[k] = JSON.stringify(v)
    else                                out[k] = String(v)
  }
  return out
}
