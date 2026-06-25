import { type CollectionState, type FieldSchema, type SKUSchema, getCurrentField, getActiveFields, isComplete, validateField, toDocxData } from './field-schema'
export interface EngineResult { reply: string; state: CollectionState; readyToRender: boolean; docxData?: Record<string, unknown> }
export class InterviewEngine {
  static start(schema: SKUSchema, userId: string, agentSlug: string, conversationId: string): CollectionState {
    const ts = new Date().toISOString()
    return { templateId: schema.templateId, agentSlug, userId, conversationId, schema, collected: [], currentFieldIdx: 0, status: 'collecting', startedAt: ts, updatedAt: ts }
  }
  static openingMessage(state: CollectionState): string {
    const field = getCurrentField(state)
    return field ? InterviewEngine.buildQuestion(field) : state.schema.confirmPrompt
  }
  static advance(state: CollectionState, userReply: string): EngineResult {
    const ts = new Date().toISOString()
    if (state.status === 'confirming') {
      const yes = /^(yes|yeah|yep|sawa|ndio|ok|okay|confirm|generate|proceed)/i.test(userReply.trim())
      const no  = /^(no|nope|hapana|cancel|back|change)/i.test(userReply.trim())
      if (yes) { const u: CollectionState = { ...state, status: 'done', updatedAt: ts }; return { reply: '✅ Generating your document now...', state: u, readyToRender: true, docxData: toDocxData(u) } }
      if (no)  { const u: CollectionState = { ...state, status: 'collecting', currentFieldIdx: Math.max(0, state.currentFieldIdx - 1), updatedAt: ts }; const f = getCurrentField(u); return { reply: `No problem! ${f ? InterviewEngine.buildQuestion(f) : ''}`, state: u, readyToRender: false } }
      return { reply: `Reply *Yes* to generate or *No* to go back.`, state, readyToRender: false }
    }
    const field = getCurrentField(state)
    if (!field) return { reply: state.schema.confirmPrompt, state: { ...state, status: 'confirming', updatedAt: ts }, readyToRender: false }
    const skip = /^(skip|later|none|n\/a|-)/i.test(userReply.trim())
    if (skip && !field.required) return InterviewEngine.nextField(state, field, null, ts)
    const error = validateField(field, userReply.trim())
    if (error) { const hint = field.hint ? `\n_e.g. ${field.hint}_` : ''; return { reply: `${error}${hint}`, state, readyToRender: false } }
    return InterviewEngine.nextField(state, field, userReply.trim(), ts)
  }
  private static nextField(state: CollectionState, field: FieldSchema, value: string | null, ts: string): EngineResult {
    const collected = [...state.collected.filter(c => c.key !== field.key), ...(value !== null ? [{ key: field.key, value }] : [])]
    const nextIdx = state.currentFieldIdx + 1
    const active  = getActiveFields(state.schema, collected)
    const allDone = isComplete({ ...state, collected })
    if (allDone || !active[nextIdx]) {
      const summary = InterviewEngine.buildSummary(active, collected)
      return { reply: `${summary}\n\n${state.schema.confirmPrompt}`, state: { ...state, collected, currentFieldIdx: nextIdx, status: 'confirming', updatedAt: ts }, readyToRender: false }
    }
    return { reply: InterviewEngine.buildQuestion(active[nextIdx]), state: { ...state, collected, currentFieldIdx: nextIdx, updatedAt: ts }, readyToRender: false }
  }
  static buildQuestion(field: FieldSchema): string {
    let q = field.label
    if (field.choices?.length) q += '\n\n' + field.choices.map((c, i) => `${i + 1}. ${c.label}`).join('\n')
    if (field.hint) q += `\n_e.g. ${field.hint}_`
    if (!field.required) q += '\n_(Optional — reply "skip")_'
    return q
  }
  static buildSummary(fields: FieldSchema[], collected: { key: string; value: unknown }[]): string {
    const lines = fields.filter(f => collected.some(c => c.key === f.key)).map(f => `*${f.label}:* ${collected.find(x => x.key === f.key)?.value ?? '—'}`)
    return `Here is what I have:\n\n${lines.join('\n')}`
  }
}
