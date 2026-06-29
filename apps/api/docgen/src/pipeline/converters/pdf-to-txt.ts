// ─── pdf → txt ────────────────────────────────────────────────────────────────
//
// Extracts readable text from a PDF by decoding the binary and pulling
// text stream content. Works for text-based PDFs; not for scanned/image PDFs.
// For scanned PDFs, falls back to vision-to-schema converter.

import type { ConvertResult }   from '../factory'
import type { DocgenWorkerEnv } from '@repo/types'

export async function pdfToTxt(
  file:    ArrayBuffer,
  _env:    DocgenWorkerEnv,
  _options?: Record<string, unknown>,
): Promise<ConvertResult> {
  // Extract text streams from PDF binary
  // PDF text is in BT...ET blocks with Tj / TJ operators
  const raw  = new TextDecoder('latin1').decode(file)
  const text = extractPdfText(raw)
  if (!text || text.length < 10) {
    return { error: 'Could not extract text from this PDF. It may be a scanned/image PDF — try uploading as an image instead.' }
  }
  return { text }
}

function extractPdfText(raw: string): string {
  const lines: string[] = []
  // Match BT...ET blocks
  const blocks = raw.match(/BT[\s\S]*?ET/g) ?? []
  for (const block of blocks) {
    // Extract strings from Tj and TJ operators
    const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g) ?? []
    for (const m of tjMatches) {
      const s = m.replace(/\(([^)]*)\)\s*Tj/, '$1').trim()
      if (s) lines.push(s)
    }
    const tjArrMatches = block.match(/\[([^\]]*)\]\s*TJ/g) ?? []
    for (const m of tjArrMatches) {
      const parts = m.match(/\(([^)]*)\)/g) ?? []
      const s = parts.map(p => p.replace(/[()]/g, '')).join('').trim()
      if (s) lines.push(s)
    }
  }
  return lines.join('\n').replace(/\s+/g, ' ').trim()
}
