// ─── ConversationMachine ──────────────────────────────────────────────────────
//
// Drives the 4-stage flow from the whiteboard sketch:
//   Identify → Auth → Collect/Fill/Deliver → Farewell
//
// Usage:
//   const machine = new ConversationMachine(kv, db)
//   const { reply, context } = await machine.advance(userId, agentSlug, channel, userInput)

import {
  type MachineContext, type MachineStage, type CollectSubState,
  initialContext,
} from './states'
import { generateId } from '@repo/utils'

// Injected at runtime — keeps machine pure (no direct Fetcher deps)
export interface MachineServices {
  lookupUser:     (userId: string) => Promise<{ found: boolean; name?: string; registered?: boolean }>
  registerUser:   (userId: string, name: string) => Promise<void>
  getAgentReply:  (context: MachineContext, message: string) => Promise<string>
  initiatePayment:(context: MachineContext, amount: number) => Promise<{ txId: string; checkoutRequestId: string; customerMessage: string } | null>
  checkPayment:   (checkoutRequestId: string) => Promise<'pending' | 'completed' | 'failed'>
  renderDoc:      (context: MachineContext) => Promise<{ fileUrl: string; title: string } | null>
}

export interface AdvanceResult {
  reply:   string
  context: MachineContext
  done:    boolean   // true when stage === 'closed'
}

export class ConversationMachine {
  constructor(private svc: MachineServices) {}

  // ── Main entry point ───────────────────────────────────────────────────────

  async advance(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    const ts = new Date().toISOString()
    ctx = { ...ctx, updatedAt: ts }

    switch (ctx.stage) {
      case 'identify':  return this.handleIdentify(ctx, input)
      case 'auth':      return this.handleAuth(ctx, input)
      case 'collect':   return this.handleCollect(ctx, input)
      case 'farewell':  return this.handleFarewell(ctx, input)
      case 'closed':    return this.reopen(ctx, input)
      default:          return { reply: 'Something went wrong. Send anything to restart.', context: initialContext(ctx.userId, ctx.agentSlug, ctx.channel), done: false }
    }
  }

  // ── Stage 1: Identify ─────────────────────────────────────────────────────
  // Check if user exists in DB → classify → route to Auth or directly to Collect

  private async handleIdentify(ctx: MachineContext, _input: string): Promise<AdvanceResult> {
    const result = await this.svc.lookupUser(ctx.userId)

    if (result.found && result.registered) {
      // Returning registered user — skip auth, go straight to collect
      const next: MachineContext = { ...ctx, stage: 'collect', collectSub: 'collection', userClass: 'registered', isRegistered: true, profileName: result.name }
      const reply = this.welcomeBack(result.name ?? 'there')
      return { reply, context: next, done: false }
    }

    if (result.found && !result.registered) {
      // Return visitor — needs to complete registration
      const next: MachineContext = { ...ctx, stage: 'auth', userClass: 'return_unregistered' }
      return { reply: `👋 Welcome back! You haven't finished setting up your account yet.\n\nWhat's your name?`, context: next, done: false }
    }

    // Brand new user
    const next: MachineContext = { ...ctx, stage: 'auth', userClass: 'new_unregistered' }
    return {
      reply: `👋 *Welcome to Taji!*\n\nI help you create professional documents — CVs, letters, NDAs and more — in minutes via WhatsApp.\n\nWhat's your name to get started?`,
      context: next,
      done: false,
    }
  }

  // ── Stage 2: Auth ─────────────────────────────────────────────────────────
  // Collect name → register → move to Collect

  private async handleAuth(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    const name = input.trim()
    if (name.length < 2) {
      return { reply: `Please enter your name (at least 2 characters).`, context: ctx, done: false }
    }

    // Register user
    await this.svc.registerUser(ctx.userId, name)

    const next: MachineContext = { ...ctx, stage: 'collect', collectSub: 'collection', isRegistered: true, profileName: name, userClass: ctx.userClass }
    return {
      reply: `✅ *Welcome, ${name}!*\n\nYou're all set. Here's what I can create for you:\n\n1. CV / Resume\n2. Application Letter\n3. Resignation Letter\n4. Cover Letter\n5. NDA\n6. Invoice\n\nWhich document do you need today?`,
      context: next,
      done: false,
    }
  }

  // ── Stage 3: Collect / Fill / Deliver ────────────────────────────────────
  // Sub-states: collection → validation → transaction → transaction_validation → generation → repetition_or_close

  private async handleCollect(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    switch (ctx.collectSub) {
      case 'collection':          return this.subCollection(ctx, input)
      case 'validation':          return this.subValidation(ctx, input)
      case 'transaction':         return this.subTransaction(ctx, input)
      case 'transaction_validation': return this.subTransactionValidation(ctx, input)
      case 'generation':          return this.subGeneration(ctx, input)
      case 'repetition_or_close': return this.subRepetitionOrClose(ctx, input)
      default:
        return this.subCollection(ctx, input)
    }
  }

  // Collection — delegate to agent (InterviewEngine handles field-by-field)
  private async subCollection(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    const reply = await this.svc.getAgentReply(ctx, input)
    // Agent signals interview complete via a special marker in the reply
    if (reply.startsWith('__COLLECTION_DONE__')) {
      const rawData = reply.replace('__COLLECTION_DONE__', '').trim()
      let sessionData: Record<string, unknown> = {}
      try { sessionData = JSON.parse(rawData) } catch {}
      const next: MachineContext = { ...ctx, collectSub: 'validation', sessionData }
      return this.subValidation(next, '')
    }
    return { reply, context: ctx, done: false }
  }

  // Validation — confirm collected data with user
  private async subValidation(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    if (!input) {
      // Build summary and ask for confirmation
      const summary = this.buildSummary(ctx.sessionData ?? {})
      const next: MachineContext = { ...ctx, collectSub: 'validation' }
      return { reply: `${summary}\n\nIs everything correct? Reply *Yes* to proceed to payment or *No* to edit.`, context: next, done: false }
    }
    if (/^(yes|ndio|sawa|ok|confirm)/i.test(input.trim())) {
      const next: MachineContext = { ...ctx, collectSub: 'transaction' }
      return this.subTransaction(next, '')
    }
    if (/^(no|hapana|edit|change)/i.test(input.trim())) {
      const next: MachineContext = { ...ctx, collectSub: 'collection', sessionData: undefined }
      return { reply: `No problem! Let's redo it.\n\n${this.welcomeBack(ctx.profileName ?? 'there')}`, context: next, done: false }
    }
    return { reply: `Reply *Yes* to proceed or *No* to edit your details.`, context: ctx, done: false }
  }

  // Transaction — initiate M-Pesa STK push
  private async subTransaction(ctx: MachineContext, _input: string): Promise<AdvanceResult> {
    const amount = this.getPrice(ctx.templateId ?? 'cv')
    const result = await this.svc.initiatePayment(ctx, amount)
    if (!result) {
      return { reply: `⚠️ Payment initiation failed. Please try again or type /reset.`, context: ctx, done: false }
    }
    const next: MachineContext = { ...ctx, collectSub: 'transaction_validation', sessionData: { ...ctx.sessionData, _checkoutRequestId: result.checkoutRequestId, _txId: result.txId } }
    return {
      reply: `💳 *Payment: KES ${amount}*\n\n${result.customerMessage}\n\nEnter your M-Pesa PIN on your phone. I'll generate your document automatically once payment is confirmed. ✅`,
      context: next,
      done: false,
    }
  }

  // Transaction validation — poll payment status
  private async subTransactionValidation(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    const checkoutId = ctx.sessionData?._checkoutRequestId as string | undefined
    if (!checkoutId) return { reply: `Something went wrong with payment tracking. Type /reset to start over.`, context: ctx, done: false }

    // User explicitly cancelling
    if (/cancel|hapana/i.test(input)) {
      const next: MachineContext = { ...ctx, collectSub: 'collection', sessionData: undefined }
      return { reply: `❌ Payment cancelled. Send anything to try a new document.`, context: next, done: false }
    }

    const status = await this.svc.checkPayment(checkoutId)
    if (status === 'completed') {
      const next: MachineContext = { ...ctx, collectSub: 'generation' }
      return this.subGeneration(next, '')
    }
    if (status === 'failed') {
      const next: MachineContext = { ...ctx, collectSub: 'transaction' }
      return { reply: `❌ Payment failed or was cancelled.\n\nType *retry* to try payment again or *cancel* to start over.`, context: next, done: false }
    }
    // Still pending
    return { reply: `⏳ Waiting for M-Pesa confirmation...\n\nCheck your phone and enter your PIN if prompted.\n\nType *cancel* to stop.`, context: ctx, done: false }
  }

  // Generation — call docgen render
  private async subGeneration(ctx: MachineContext, _input: string): Promise<AdvanceResult> {
    const result = await this.svc.renderDoc(ctx)
    if (!result) {
      return { reply: `⚠️ Document generation failed. Please contact support or type /reset.`, context: ctx, done: false }
    }
    const next: MachineContext = { ...ctx, collectSub: 'repetition_or_close', sessionCount: ctx.sessionCount + 1 }
    return {
      reply: `✅ *${result.title}* is ready!\n\n📄 ${result.fileUrl}\n\nWould you like to create another document? Reply *Yes* or *No*.`,
      context: next,
      done: false,
    }
  }

  // Repetition or close
  private async subRepetitionOrClose(ctx: MachineContext, input: string): Promise<AdvanceResult> {
    if (/^(yes|ndio|another|more|sawa)/i.test(input.trim())) {
      const next: MachineContext = { ...ctx, collectSub: 'collection', sessionData: undefined, templateId: undefined }
      return {
        reply: `Great! Here's what I can create:\n\n1. CV / Resume\n2. Application Letter\n3. Resignation Letter\n4. Cover Letter\n5. NDA\n6. Invoice\n\nWhich document do you need?`,
        context: next,
        done: false,
      }
    }
    const next: MachineContext = { ...ctx, stage: 'farewell' }
    return this.handleFarewell(next, input)
  }

  // ── Stage 4: Farewell ─────────────────────────────────────────────────────

  private async handleFarewell(ctx: MachineContext, _input: string): Promise<AdvanceResult> {
    const next: MachineContext = { ...ctx, stage: 'closed' }
    return {
      reply: `Thank you for using *Taji*, ${ctx.profileName ?? 'friend'}! 🎉\n\nYour documents have been saved. Come back anytime.\n\nType anything to start a new session.`,
      context: next,
      done: true,
    }
  }

  // ── Closed → reopen ───────────────────────────────────────────────────────

  private async reopen(ctx: MachineContext, _input: string): Promise<AdvanceResult> {
    const next: MachineContext = { ...ctx, stage: 'collect', collectSub: 'collection', sessionData: undefined, templateId: undefined }
    return {
      reply: this.welcomeBack(ctx.profileName ?? 'there'),
      context: next,
      done: false,
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private welcomeBack(name: string): string {
    return `Welcome back, *${name}*! 👋\n\nWhat document can I help you with today?\n\n1. CV / Resume\n2. Application Letter\n3. Resignation Letter\n4. Cover Letter\n5. NDA\n6. Invoice`
  }

  private buildSummary(data: Record<string, unknown>): string {
    const lines = Object.entries(data)
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, v]) => `*${k.replace(/_/g, ' ')}:* ${v}`)
    return lines.length ? `Here's what I have:\n\n${lines.join('\n')}` : 'Your details are collected.'
  }

  private getPrice(templateId: string): number {
    const prices: Record<string, number> = { cv: 200, application_letter: 150, resignation_letter: 150, cover_letter: 150, nda: 500, invoice: 100 }
    return prices[templateId] ?? 200
  }
}
