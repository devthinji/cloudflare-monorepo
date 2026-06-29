export type DocIntent = 'cv' | 'application_letter' | 'cover_letter' | 'resignation_letter' | null

export function detectDocIntent(text: string): DocIntent {
  const t = text.toLowerCase()
  if (/\bcv\b|resume|curriculum/.test(t))                         return 'cv'
  if (/application.{0,10}letter|apply.{0,10}job/.test(t))         return 'application_letter'
  if (/cover.{0,10}letter/.test(t))                               return 'cover_letter'
  if (/resign|resignation/.test(t))                               return 'resignation_letter'
  return null
}

export interface GenerateDocumentAction {
  action: 'generate_document'
  type:   string
  data:   Record<string, unknown>
}

export function parseDocumentAction(reply: string): GenerateDocumentAction | null {
  const match = reply.match(/```json\s*([\s\S]*?)\s*```/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1]) as GenerateDocumentAction
    if (parsed.action === 'generate_document' && parsed.type && parsed.data) return parsed
    return null
  } catch { return null }
}
