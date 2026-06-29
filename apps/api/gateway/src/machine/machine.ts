import { type MachineContext, type LiveSKU, type LiveFieldSchema, initialContext } from './states'

export interface MachineServices {
  lookupUser:   (userId: string)              => Promise<{ found: boolean; name?: string; registered?: boolean }>
  registerUser: (userId: string, name: string)=> Promise<void>
  listSKUs:     (agentSlug: string)           => Promise<LiveSKU[]>
  loadSKU:      (skuId: string)               => Promise<LiveSKU | null>
  initiatePayment: (ctx: MachineContext, sku: LiveSKU) => Promise<{ txId: string; checkoutRequestId: string; customerMessage: string } | null>
  checkPayment:    (checkoutRequestId: string)          => Promise<'pending' | 'completed' | 'failed'>
  renderDoc: (ctx: MachineContext, sku: LiveSKU) => Promise<{ fileUrl: string; title: string } | null>
}

export interface AdvanceResult {
  reply: string; context: MachineContext; done: boolean
}

export class ConversationMachine {
  constructor(private svc: MachineServices) {}

  async advance(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    ctx = { ...ctx, updatedAt: new Date().toISOString() }

    switch (ctx.stage) {
      case 'identify': return this.stageIdentify(ctx, input)
      case 'auth':     return this.stageAuth(ctx, input)
      case 'collect':  return this.stageCollect(ctx, input)
      case 'farewell': return this.stageFarewell(ctx)
      case 'closed':   return this.stageReopen(ctx)
      default: return { reply: 'Something went wrong. Send anything to restart.', context: initialContext(ctx.userId, ctx.agentSlug, ctx.channel), done: false }
    }
  }

  private async stageIdentify(ctx: MachineContext, _input: string): Promise<AdvanceResult> {
    const user = await this.svc.lookupUser(ctx.userId)
    if (user.found && user.registered) {
      const next: MachineContext = { ...ctx, stage: 'collect', collectSub: 'sku_select', userClass: 'registered', isRegistered: true, profileName: user.name }
      return { reply: await this.buildSKUMenu(ctx.agentSlug, `Welcome back, *${user.name}*! 👋`), context: next, done: false }
    }
    if (user.found && !user.registered) {
      return { reply: `👋 Welcome back! You haven't finished setting up your account.\n\nWhat's your name?`, context: { ...ctx, stage: 'auth', userClass: 'return_unregistered' }, done: false }
    }
    return {
      reply: `👋 Welcome! I help you create professional documents — CVs, letters, NDAs and more — delivered right here on WhatsApp.\n\nWhat's your name to get started?`,
      context: { ...ctx, stage: 'auth', userClass: 'new_unregistered' }, done: false,
    }
  }

  private async stageAuth(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    const name = input.trim()
    if (name.length < 2) return { reply: `Please enter your name (at least 2 characters).`, context: ctx, done: false }
    await this.svc.registerUser(ctx.userId, name)
    const next: MachineContext = { ...ctx, stage: 'collect', collectSub: 'sku_select', isRegistered: true, profileName: name }
    return { reply: await this.buildSKUMenu(ctx.agentSlug, `✅ *Welcome, ${name}!* You're all set.`), context: next, done: false }
  }

  private async stageCollect(ctx: MachineContext, input: string): Promise<AdvanceResult> {
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
    const skus = await this.svc.listSKUs(ctx.agentSlug)
    if (skus.length === 0) {
      return { reply: `No documents are available right now. Please check back soon.`, context: ctx, done: false }
    }
    const trimmed = input.trim()
    let chosen: LiveSKU | undefined
    const num = parseInt(trimmed, 10)
    if (!isNaN(num) && num >= 1 && num <= skus.length) chosen = skus[num - 1]
    if (!chosen) {
      const lower = trimmed.toLowerCase()
      chosen = skus.find(s => s.name.toLowerCase().includes(lower) || lower.includes(s.name.toLowerCase().split(' ')[0]!))
    }
    if (!chosen) return { reply: await this.buildSKUMenu(ctx.agentSlug, `Please pick a number from the list:`), context: ctx, done: false }
    const sku = await this.svc.loadSKU(chosen.id)
    if (!sku) return { reply: `Could not load that template. Please try again.`, context: ctx, done: false }
    const next: MachineContext = { ...ctx, collectSub: 'collection', liveSKU: sku, currentFieldIdx: 0, collectedFields: {} }
    return { reply: this.askField(sku, 0), context: next, done: false }
  }

  private async subCollection(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    const sku = ctx.liveSKU
    if (!sku) return this.subSKUSelect(ctx, input)
    const activeFields = this.getActiveFields(sku, ctx.collectedFields)
    const idx = ctx.currentFieldIdx
    const field = activeFields[idx]
    if (!field) return this.subValidation({ ...ctx, collectSub: 'validation' }, '')

    const answer = input.trim()
    if (field.required && !answer) return { reply: `This field is required.\n\n${this.askField(sku, idx)}`, context: ctx, done: false }
    if (field.type === 'choice' && field.choices) {
      const valid = field.choices.find(c => c.value === answer || c.label.toLowerCase() === answer.toLowerCase() || String(field.choices!.indexOf(c) + 1) === answer)
      if (!valid) return { reply: `Please choose a valid option:\n\n${field.choices.map((c, i) => `${i + 1}. ${c.label}`).join('\n')}`, context: ctx, done: false }
    }
    if (field.type === 'phone' && answer && !/^[\d\s\+\-\(\)]{7,15}$/.test(answer)) return { reply: `Please enter a valid phone number.`, context: ctx, done: false }
    if (field.type === 'email' && answer && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) return { reply: `Please enter a valid email address.`, context: ctx, done: false }

    const collected = { ...ctx.collectedFields, [field.key]: answer || null }
    const nextIdx = idx + 1
    const nextActiveFields = this.getActiveFields(sku, collected)
    if (nextIdx >= nextActiveFields.length) {
      return this.subValidation({ ...ctx, collectedFields: collected, currentFieldIdx: nextIdx, collectSub: 'validation' }, '')
    }
    return { reply: this.askField(sku, nextIdx, collected), context: { ...ctx, collectedFields: collected, currentFieldIdx: nextIdx }, done: false }
  }

  private async subValidation(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    const sku = ctx.liveSKU!
    if (!input) {
      return { reply: `${this.buildSummary(ctx.collectedFields, sku)}\n\n✅ Is everything correct?\n\nReply *Yes* to pay and generate, or *No* to edit.`, context: { ...ctx, collectSub: 'validation' }, done: false }
    }
    if (/^(yes|ndio|sawa|ok|confirm|y)\b/i.test(input)) return this.subTransaction({ ...ctx, collectSub: 'transaction' })
    if (/^(no|hapana|edit|change|n)\b/i.test(input)) return { reply: `No problem! Let's start over.\n\n${this.askField(sku, 0)}`, context: { ...ctx, collectSub: 'collection', currentFieldIdx: 0, collectedFields: {} }, done: false }
    return { reply: `Reply *Yes* to proceed or *No* to edit.`, context: ctx, done: false }
  }

  private async subTransaction(ctx: MachineContext): Promise<AdvanceResult> {
    const sku = ctx.liveSKU!
    const result = await this.svc.initiatePayment(ctx, sku)
    if (!result) return { reply: `⚠️ Payment initiation failed. Please try again or type /reset.`, context: ctx, done: false }
    return {
      reply: `💳 *Payment: ${sku.currency} ${sku.price}*\n\n${result.customerMessage}\n\nEnter your M-Pesa PIN when prompted. I'll send your document automatically once confirmed. ✅`,
      context: { ...ctx, collectSub: 'transaction_validation', checkoutRequestId: result.checkoutRequestId, txId: result.txId }, done: false,
    }
  }

  private async subTransactionValidation(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    if (!ctx.checkoutRequestId) return { reply: `Payment tracking lost. Type /reset to start over.`, context: ctx, done: false }
    if (/^(cancel|hapana|stop)\b/i.test(input.trim())) return { reply: `❌ Payment cancelled. Send anything to try a new document.`, context: { ...ctx, collectSub: 'collection', currentFieldIdx: 0, collectedFields: {}, checkoutRequestId: undefined, txId: undefined }, done: false }
    const status = await this.svc.checkPayment(ctx.checkoutRequestId)
    if (status === 'completed') return this.subGeneration({ ...ctx, collectSub: 'generation' })
    if (status === 'failed') return { reply: `❌ Payment failed or was cancelled on your phone.\n\nType *retry* to try again or *cancel* to start over.`, context: { ...ctx, collectSub: 'transaction' }, done: false }
    return { reply: `⏳ Still waiting for M-Pesa confirmation...\n\nCheck your phone and enter your PIN if prompted.\n\nType *cancel* to stop.`, context: ctx, done: false }
  }

  private async subGeneration(ctx: MachineContext): Promise<AdvanceResult> {
    const sku = ctx.liveSKU!
    const result = await this.svc.renderDoc(ctx, sku)
    if (!result) return { reply: `⚠️ Document generation failed. Please contact support or type /reset.`, context: ctx, done: false }
    return { reply: `✅ *${result.title}* is ready!\n\n📄 ${result.fileUrl}\n\nWould you like to create another document?\n\nReply *Yes* or *No*.`, context: { ...ctx, collectSub: 'repetition_or_close', sessionCount: ctx.sessionCount + 1 }, done: false }
  }

  private async subRepetitionOrClose(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    if (/^(yes|ndio|another|more|sawa|y)\b/i.test(input.trim())) {
      return { reply: await this.buildSKUMenu(ctx.agentSlug, `Great! What document do you need next?`), context: { ...ctx, collectSub: 'sku_select', liveSKU: undefined, currentFieldIdx: 0, collectedFields: {} }, done: false }
    }
    return this.stageFarewell({ ...ctx, stage: 'farewell' })
  }

  private async stageFarewell(ctx: MachineContext): Promise<AdvanceResult> {
    return { reply: `Thank you, ${ctx.profileName ?? 'friend'}! 🎉\n\nYour documents are saved. Come back anytime — just send a message to start.`, context: { ...ctx, stage: 'closed' }, done: true }
  }

  private async stageReopen(ctx: MachineContext): Promise<AdvanceResult> {
    return { reply: await this.buildSKUMenu(ctx.agentSlug, `Welcome back, *${ctx.profileName ?? 'there'}*! 👋`), context: { ...ctx, stage: 'collect', collectSub: 'sku_select', liveSKU: undefined, currentFieldIdx: 0, collectedFields: {} }, done: false }
  }

  private askField(sku: LiveSKU, idx: number, collected: Record<string, unknown> = {}): string {
    const active = this.getActiveFields(sku, collected)
    const field = active[idx]
    if (!field) return ''
    let msg = `_(${idx + 1}/${active.length})_ *${field.label}*`
    if (field.hint) msg += `\n_e.g. ${field.hint}_`
    if (field.type === 'choice' && field.choices) msg += `\n\n${field.choices.map((c, i) => `${i + 1}. ${c.label}`).join('\n')}`
    if (!field.required) msg += `\n_(optional — send a dash to skip)_`
    return msg
  }

  private getActiveFields(sku: LiveSKU, collected: Record<string, unknown>): LiveFieldSchema[] {
    return sku.fields.filter(f => {
      if (!f.condition) return true
      const dep = collected[f.condition.field]
      if (f.condition.operator === 'exists')     return dep !== undefined && dep !== null
      if (f.condition.operator === 'equals')     return dep === f.condition.value
      if (f.condition.operator === 'not_equals') return dep !== f.condition.value
      return true
    }).sort((a, b) => a.order - b.order)
  }

  private buildSummary(collected: Record<string, unknown>, sku: LiveSKU): string {
    const lines = sku.fields
      .filter(f => collected[f.key] !== undefined && collected[f.key] !== null)
      .sort((a, b) => a.order - b.order)
      .map(f => `*${f.label}:* ${collected[f.key]}`)
    return lines.length ? `Here's what you gave me for your *${sku.name}*:\n\n${lines.join('\n')}` : 'Your details are collected.'
  }

  private async buildSKUMenu(agentSlug: string, heading: string): Promise<string> {
    try {
      const skus = await this.svc.listSKUs(agentSlug)
      if (!skus.length) return `${heading}\n\nNo documents available right now.`
      return `${heading}\n\nWhat would you like to create?\n\n${skus.map((s, i) => `${i + 1}. *${s.name}* — ${s.currency} ${s.price}`).join('\n')}`
    } catch {
      return `${heading}\n\nSend me what document you need.`
    }
  }
}
