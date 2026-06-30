// ─── ConversationMachine — pure executor ──────────────────────────────────────
//
// This class does NOT own any flow logic.
// All stages, transitions, guards, and messages come from the Blueprint.
// To change the conversation flow, edit the blueprint in:
//   steps/business-logic/version_1.ts

import { type MachineContext, type LiveSKU, type LiveFieldSchema, initialContext } from './states'
import { BlueprintV1, type Blueprint, TRANSITIONS } from './steps/business-logic/version_1'

// ─── External services (injected by the gateway route) ───────────────────────

export interface MachineServices {
  lookupUser:      (userId: string)               => Promise<{ found: boolean; name?: string; registered?: boolean }>
  registerUser:    (userId: string, name: string) => Promise<void>
  listSKUs:        (agentSlug: string)            => Promise<LiveSKU[]>
  loadSKU:         (skuId: string)                => Promise<LiveSKU | null>
  initiatePayment: (ctx: MachineContext, sku: LiveSKU) => Promise<{ txId: string; checkoutRequestId: string; customerMessage: string } | null>
  checkPayment:    (checkoutRequestId: string)    => Promise<'pending' | 'completed' | 'failed'>
  renderDoc:       (ctx: MachineContext, sku: LiveSKU) => Promise<{ fileUrl: string; title: string } | null>
}

export interface AdvanceResult {
  reply:   string
  context: MachineContext
  done:    boolean
}

// ─── Machine ──────────────────────────────────────────────────────────────────

export class ConversationMachine {
  private bp: Blueprint

  constructor(private svc: MachineServices, blueprint: Blueprint = BlueprintV1) {
    this.bp = blueprint
  }

  // ── Public entry point ────────────────────────────────────────────────────

  async advance(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    ctx = { ...ctx, updatedAt: new Date().toISOString() }

    switch (ctx.stage) {
      case 'identify': return this.runIdentify(ctx, input)
      case 'auth':     return this.runAuth(ctx, input)
      case 'collect':  return this.runCollect(ctx, input)
      case 'farewell': return this.runFarewell(ctx)
      case 'closed':   return this.runReopen(ctx)
      default:
        return {
          reply:   this.bp.messages.genericError,
          context: initialContext(ctx.userId, ctx.agentSlug, ctx.channel),
          done:    false,
        }
    }
  }

  // ── Stage: identify ───────────────────────────────────────────────────────

  private async runIdentify(ctx: MachineContext, _input: string): Promise<AdvanceResult> {
    const { messages: M, guards: G, transitions: T } = this.bp
    const user = await this.svc.lookupUser(ctx.userId)

    if (user.found && user.registered) {
      const t = T['identify:CUSTOMER_REGISTERED']!
      const next: MachineContext = { ...ctx, stage: t.nextStage, collectSub: t.nextSub ?? null, customerClass: 'registered', isRegistered: true, profileName: user.name }
      return { reply: await this.skuMenu(ctx.agentSlug, M.greetRegistered(user.name ?? '', ctx.agentSlug)), context: next, done: false }
    }

    if (user.found && !user.registered) {
      const t = T['identify:CUSTOMER_RETURNING_UNREGISTERED']!
      return { reply: M.greetReturningUnregistered(ctx.agentSlug), context: { ...ctx, stage: t.nextStage, customerClass: 'return_unregistered' }, done: false }
    }

    const t = T['identify:CUSTOMER_NEW']!
    return { reply: M.greetNew(ctx.agentSlug), context: { ...ctx, stage: t.nextStage, customerClass: 'new_unregistered' }, done: false }
  }

  // ── Stage: auth ───────────────────────────────────────────────────────────

  private async runAuth(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    const { messages: M, guards: G, transitions: T } = this.bp

    if (!G.isNameValid(input)) {
      return { reply: M.nameInvalid, context: ctx, done: false }
    }

    const name = input.trim()
    await this.svc.registerUser(ctx.userId, name)
    const t = T['auth:NAME_VALID']!
    const next: MachineContext = { ...ctx, stage: t.nextStage, collectSub: t.nextSub ?? null, isRegistered: true, profileName: name }
    return { reply: await this.skuMenu(ctx.agentSlug, M.registrationSuccess(name, ctx.agentSlug)), context: next, done: false }
  }

  // ── Stage: collect ────────────────────────────────────────────────────────

  private async runCollect(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    switch (ctx.collectSub) {
      case 'sku_select':             return this.subSKUSelect(ctx, input)
      case 'collection':             return this.subCollection(ctx, input)
      case 'validation':             return this.subValidation(ctx, input)
      case 'transaction':            return this.subTransaction(ctx)
      case 'transaction_validation': return this.subTransactionValidation(ctx, input)
      case 'generation':             return this.subGeneration(ctx)
      case 'repetition_or_close':    return this.subRepetitionOrClose(ctx, input)
      default:                       return this.subSKUSelect(ctx, input)
    }
  }

  private async subSKUSelect(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    const { messages: M, transitions: T } = this.bp
    const skus = await this.svc.listSKUs(ctx.agentSlug)

    if (!skus.length) return { reply: M.skuNoneAvailable, context: ctx, done: false }

    const trimmed = input.trim()
    let chosen: LiveSKU | undefined
    const num = parseInt(trimmed, 10)
    if (!isNaN(num) && num >= 1 && num <= skus.length) chosen = skus[num - 1]
    if (!chosen) {
      const lower = trimmed.toLowerCase()
      chosen = skus.find(s => s.name.toLowerCase().includes(lower) || lower.includes(s.name.toLowerCase().split(' ')[0]!))
    }

    if (!chosen) {
      return { reply: await this.skuMenu(ctx.agentSlug, M.skuNotChosen), context: ctx, done: false }
    }

    const sku = await this.svc.loadSKU(chosen.id)
    if (!sku) return { reply: M.skuLoadFailed, context: ctx, done: false }

    const t = T['collect:sku_select:SKU_CHOSEN']!
    const next: MachineContext = { ...ctx, stage: t.nextStage, collectSub: t.nextSub!, liveSKU: sku, currentFieldIdx: 0, collectedFields: {} }
    return { reply: this.fieldPrompt(sku, 0), context: next, done: false }
  }

  private async subCollection(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    const { messages: M, guards: G, transitions: T } = this.bp
    const sku = ctx.liveSKU
    if (!sku) return this.subSKUSelect(ctx, input)

    const activeFields = this.activeFields(sku, ctx.collectedFields)
    const idx    = ctx.currentFieldIdx
    const field  = activeFields[idx]
    if (!field) return this.subValidation({ ...ctx, collectSub: 'validation' }, '')

    const answer = input.trim()

    // Required check
    if (field.required && !answer) {
      return { reply: M.fieldRequired(this.fieldPrompt(sku, idx)), context: ctx, done: false }
    }

    // Type validation
    if (field.type === 'choice' && field.choices && answer) {
      if (!G.isValidChoice(answer, field)) {
        return { reply: M.fieldInvalidChoice(field.choices), context: ctx, done: false }
      }
    }
    if (field.type === 'phone' && answer && !G.isValidPhone(answer)) {
      return { reply: M.fieldInvalidPhone, context: ctx, done: false }
    }
    if (field.type === 'email' && answer && !G.isValidEmail(answer)) {
      return { reply: M.fieldInvalidEmail, context: ctx, done: false }
    }

    const collected    = { ...ctx.collectedFields, [field.key]: answer || null }
    const nextIdx      = idx + 1
    const nextFields   = this.activeFields(sku, collected)

    if (nextIdx >= nextFields.length) {
      const t = T['collect:collection:ALL_FIELDS_DONE']!
      return this.subValidation({ ...ctx, stage: t.nextStage, collectSub: t.nextSub!, collectedFields: collected, currentFieldIdx: nextIdx }, '')
    }

    return { reply: this.fieldPrompt(sku, nextIdx, collected), context: { ...ctx, collectedFields: collected, currentFieldIdx: nextIdx }, done: false }
  }

  private async subValidation(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    const { messages: M, guards: G, transitions: T } = this.bp
    const sku = ctx.liveSKU!

    if (!input) {
      const lines = sku.fields
        .filter(f => ctx.collectedFields[f.key] != null)
        .sort((a, b) => a.order - b.order)
        .map(f => `*${f.label}:* ${ctx.collectedFields[f.key]}`)
      return { reply: M.summaryPrompt(lines, sku.name), context: { ...ctx, collectSub: 'validation' }, done: false }
    }

    if (G.isConfirmation(input)) {
      const sku = ctx.liveSKU!
      if (sku.price === 0) {
        const t = T['collect:validation:PAYMENT_SKIPPED']!
        return {
          reply: M.paymentFree(sku.name),
          context: { ...ctx, stage: t.nextStage, collectSub: t.nextSub! },
          done: false,
        }
      }
      const t = T['collect:validation:SUMMARY_CONFIRMED']!
      return this.subTransaction({ ...ctx, stage: t.nextStage, collectSub: t.nextSub! })
    }
    if (G.isRejection(input)) {
      const t = T['collect:validation:SUMMARY_REJECTED']!
      return { reply: this.fieldPrompt(sku, 0), context: { ...ctx, stage: t.nextStage, collectSub: t.nextSub!, currentFieldIdx: 0, collectedFields: {} }, done: false }
    }

    return { reply: M.summaryAmbiguous, context: ctx, done: false }
  }

  private async subTransaction(ctx: MachineContext): Promise<AdvanceResult> {
    const { messages: M, transitions: T } = this.bp
    const sku = ctx.liveSKU!
    const result = await this.svc.initiatePayment(ctx, sku)

    if (!result) {
      return { reply: M.paymentFailed, context: ctx, done: false }
    }

    const t = T['collect:transaction:PAYMENT_INITIATED']!
    return {
      reply:   M.paymentPrompt(sku.currency, sku.price, result.customerMessage),
      context: { ...ctx, stage: t.nextStage, collectSub: t.nextSub!, checkoutRequestId: result.checkoutRequestId, txId: result.txId },
      done:    false,
    }
  }

  private async subTransactionValidation(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    const { messages: M, guards: G, transitions: T } = this.bp

    if (!ctx.checkoutRequestId) return { reply: M.paymentTrackingLost, context: ctx, done: false }

    if (G.isCancelCommand(input)) {
      const t = T['collect:transaction_validation:PAYMENT_CANCELLED']!
      return { reply: M.paymentCancelled, context: { ...ctx, stage: t.nextStage, collectSub: t.nextSub!, checkoutRequestId: undefined, txId: undefined }, done: false }
    }

    const status = await this.svc.checkPayment(ctx.checkoutRequestId)

    if (status === 'completed') {
      const t = T['collect:transaction_validation:PAYMENT_COMPLETED']!
      return this.subGeneration({ ...ctx, stage: t.nextStage, collectSub: t.nextSub! })
    }
    if (status === 'failed') {
      const t = T['collect:transaction_validation:PAYMENT_FAILED']!
      return { reply: M.paymentFailedRetry, context: { ...ctx, stage: t.nextStage, collectSub: t.nextSub! }, done: false }
    }

    return { reply: M.paymentWaiting, context: ctx, done: false }
  }

  private async subGeneration(ctx: MachineContext): Promise<AdvanceResult> {
    const { messages: M, transitions: T } = this.bp
    const sku = ctx.liveSKU!
    const result = await this.svc.renderDoc(ctx, sku)

    if (!result) return { reply: M.docFailed, context: ctx, done: false }

    const t = T['collect:generation:DOC_READY']!
    return {
      reply:   M.docReady(result.title, result.fileUrl),
      context: { ...ctx, stage: t.nextStage, collectSub: t.nextSub!, sessionCount: ctx.sessionCount + 1 },
      done:    false,
    }
  }

  private async subRepetitionOrClose(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    const { guards: G, transitions: T } = this.bp

    if (G.wantsAnother(input)) {
      const t = T['collect:repetition_or_close:WANTS_ANOTHER']!
      return { reply: await this.skuMenu(ctx.agentSlug, `Great! What document do you need next?`), context: { ...ctx, stage: t.nextStage, collectSub: t.nextSub!, liveSKU: undefined, currentFieldIdx: 0, collectedFields: {} }, done: false }
    }

    const t = T['collect:repetition_or_close:WANTS_TO_CLOSE']!
    return this.runFarewell({ ...ctx, stage: t.nextStage })
  }

  // ── Stage: farewell ───────────────────────────────────────────────────────

  private async runFarewell(ctx: MachineContext): Promise<AdvanceResult> {
    return {
      reply:   this.bp.messages.farewell(ctx.profileName ?? 'friend'),
      context: { ...ctx, stage: 'closed' },
      done:    true,
    }
  }

  // ── Stage: reopen (closed → back to collect) ──────────────────────────────

  private async runReopen(ctx: MachineContext): Promise<AdvanceResult> {
    const name = ctx.profileName ?? 'there'
    return {
      reply:   await this.skuMenu(ctx.agentSlug, `Welcome back, *${name}*! 👋`),
      context: { ...ctx, stage: 'collect', collectSub: 'sku_select', liveSKU: undefined, currentFieldIdx: 0, collectedFields: {} },
      done:    false,
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async skuMenu(agentSlug: string, heading: string): Promise<string> {
    try {
      const skus = await this.svc.listSKUs(agentSlug)
      if (!skus.length) return `${heading}\n\nNo documents available right now.`
      return this.bp.messages.skuMenuHeading(heading, skus)
    } catch {
      return `${heading}\n\nSend me what document you need.`
    }
  }

  private fieldPrompt(sku: LiveSKU, idx: number, collected: Record<string, unknown> = {}): string {
    const active = this.activeFields(sku, collected)
    const field  = active[idx]
    if (!field) return ''
    return this.bp.messages.fieldPrompt(field.label, field.hint, idx, active.length, field.choices, field.required)
  }

  private activeFields(sku: LiveSKU, collected: Record<string, unknown>): LiveFieldSchema[] {
    return sku.fields
      .filter(f => {
        if (!f.condition) return true
        const dep = collected[f.condition.field]
        if (f.condition.operator === 'exists')     return dep !== undefined && dep !== null
        if (f.condition.operator === 'equals')     return dep === f.condition.value
        if (f.condition.operator === 'not_equals') return dep !== f.condition.value
        return true
      })
      .sort((a, b) => a.order - b.order)
  }
}
