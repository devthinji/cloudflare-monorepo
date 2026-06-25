// ─── InterviewEngine — drives the field collection conversation ───────────────
//
// This class is stateless. It takes a CollectionState + user reply,
// validates, advances the state, and returns the next message to send.
// State is persisted externally (KV or DB conversation context field).

import {
  type CollectionState,
  type FieldSchema,
  type SKUSchema,
  getCurrentField,
  getActiveFields,
  isComplete,
  validateField,
  toDocxData,
} from './field-schema'

export interface EngineResult {
  reply:         string
  state:         CollectionState
  readyToRender: boolean           // true when all required fields collected + confirmed
  docxData?:     Record<string, unknown>
}

export class InterviewEngine {

  // ── Start a new collection session ────────────────────────────────────────

  static start(schema: SKUSchema, userId: string, agentSlug: string, conversationId: string): CollectionState {
    const now = new Date().toISOString()
    return {
      templateId:      schema.templateId,
      agentSlug,
      userId,
      conversationId,
      schema,
      collected:       [],
      currentFieldIdx: 0,
      status:          'collecting',
      startedAt:       now,
      updatedAt:       now,
    }
  }

  // ── Get the opening question ───────────────────────────────────────────────

  static openingMessage(state: CollectionState): string {
    const field = getCurrentField(state)
    if (!field) return state.schema.confirmPrompt
    return InterviewEngine.buildQuestion(field)
  }

  // ── Process a user reply and advance state ────────────────────────────────

  static advance(state: CollectionState, userReply: string): EngineResult {
    const now = new Date().toISOString()

    // ── Confirming stage ───────────────────────────────────────────────────
    if (state.status === 'confirming') {
      const yes = /^(yes|yeah|yep|sawa|ndio|ok|okay|confirm|generate|proceed)/i.test(userReply.trim())
      const no  = /^(no|nope|hapana|cancel|back|change)/i.test(userReply.trim())

      if (yes) {
        const updated: CollectionState = { ...state, status: 'done', updatedAt: now }
        return { reply: '✅ Generating your document now, please wait a moment...', state: updated, readyToRender: true, docxData: toDocxData(updated) }
      }
      if (no) {
        // Go back to last field
        const updated: CollectionState = { ...state, status: 'collecting', currentFieldIdx: Math.max(0, state.currentFieldIdx - 1), updatedAt: now }
        const field = getCurrentField(updated)
        return { reply: `No problem! Let me ask again.\n\n${field ? InterviewEngine.buildQuestion(field) : ''}`, state: updated, readyToRender: false }
      }
      // Unclear — re-ask confirmation
      return { reply: `Reply *Yes* to generate or *No* to go back.`, state, readyToRender: false }
    }

    // ── Collecting stage ───────────────────────────────────────────────────
    const field = getCurrentField(state)
    if (!field) {
      // Shouldn't happen but guard
      return { reply: state.schema.confirmPrompt, state: { ...state, status: 'confirming', updatedAt: now }, readyToRender: false }
    }

    // Handle "skip" for optional fields
    const skip = /^(skip|later|none|n\/a|-)/i.test(userReply.trim())
    if (skip && !field.required) {
      return InterviewEngine.nextField(state, field, null, now)
    }

    // Validate
    const error = validateField(field, userReply.trim())
    if (error) {
      const hint = field.hint ? `\n_Example: ${field.hint}_` : ''
      return { reply: `${error}${hint}`, state, readyToRender: false }
    }

    // Store value
    return InterviewEngine.nextField(state, field, userReply.trim(), now)
  }

  // ── Internal: store value and advance to next field ───────────────────────

  private static nextField(
    state:  CollectionState,
    field:  FieldSchema,
    value:  string | null,
    now:    string,
  ): EngineResult {
    const collected = [
      ...state.collected.filter(c => c.key !== field.key),
      ...(value !== null ? [{ key: field.key, value }] : []),
    ]

    const nextIdx  = state.currentFieldIdx + 1
    const active   = getActiveFields({ ...state.schema }, collected)
    const nextField = active[nextIdx]

    // Check if all required fields are now collected
    const allDone  = isComplete({ ...state, collected })

    if (allDone || !nextField) {
      // Move to confirmation
      const summary  = InterviewEngine.buildSummary(active, collected)
      const updated: CollectionState = { ...state, collected, currentFieldIdx: nextIdx, status: 'confirming', updatedAt: now }
      return {
        reply: `${summary}\n\n${state.schema.confirmPrompt}`,
        state: updated,
        readyToRender: false,
      }
    }

    // Next question
    const updated: CollectionState = { ...state, collected, currentFieldIdx: nextIdx, updatedAt: now }
    return {
      reply: InterviewEngine.buildQuestion(nextField),
      state: updated,
      readyToRender: false,
    }
  }

  // ── Build a natural question from a FieldSchema ────────────────────────────

  static buildQuestion(field: FieldSchema): string {
    let q = field.label
    if (field.choices?.length) {
      q += '\n\n' + field.choices.map((c, i) => `${i + 1}. ${c.label}`).join('\n')
    }
    if (field.hint) {
      q += `\n_e.g. ${field.hint}_`
    }
    if (!field.required) {
      q += '\n_(Optional — reply "skip" to leave blank)_'
    }
    return q
  }

  // ── Build a confirmation summary ───────────────────────────────────────────

  static buildSummary(fields: FieldSchema[], collected: { key: string; value: unknown }[]): string {
    const lines = fields
      .filter(f => collected.some(c => c.key === f.key))
      .map(f => {
        const c = collected.find(x => x.key === f.key)
        return `*${f.label}:* ${c?.value ?? '—'}`
      })
    return `Here is what I have:\n\n${lines.join('\n')}`
  }
}
