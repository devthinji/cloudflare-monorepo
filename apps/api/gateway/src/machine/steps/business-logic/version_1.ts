// ─── Business Logic Blueprint v1 ─────────────────────────────────────────────
//
// This file OWNS the full conversation flow for Taji v1.
//
// ConversationMachine is a dumb executor — it reads this blueprint and runs it.
// To change the flow, edit this file only. No changes to machine.ts needed.
//
// Blueprint shape:
//   stages[]        — ordered list of top-level stages
//   transitions{}   — what stage/sub to go to on which event
//   guards{}        — boolean conditions used in transitions
//   messages{}      — all reply strings (internationalizable later)
//   validators{}    — field-level validation functions

import type { MachineContext, LiveFieldSchema } from '../../states'

// ─── Stage & event types ──────────────────────────────────────────────────────

export type BlueprintStage =
  | 'identify'
  | 'auth'
  | 'collect'
  | 'farewell'
  | 'closed'

export type BlueprintEvent =
  | 'CUSTOMER_NEW'
  | 'CUSTOMER_RETURNING_UNREGISTERED'
  | 'CUSTOMER_REGISTERED'
  | 'NAME_VALID'
  | 'NAME_INVALID'
  | 'SKU_CHOSEN'
  | 'SKU_NOT_CHOSEN'
  | 'FIELD_VALID'
  | 'FIELD_INVALID'
  | 'ALL_FIELDS_DONE'
  | 'SUMMARY_CONFIRMED'
  | 'SUMMARY_REJECTED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_SKIPPED'
  | 'DOC_READY'
  | 'DOC_FAILED'
  | 'WANTS_ANOTHER'
  | 'WANTS_TO_CLOSE'

export type CollectSub =
  | 'sku_select'
  | 'collection'
  | 'validation'
  | 'transaction'
  | 'transaction_validation'
  | 'generation'
  | 'repetition_or_close'

// ─── Transition table ─────────────────────────────────────────────────────────
//
// Maps (stage, event) → { nextStage, nextSub? }
// The machine fires the matching event after evaluating guards,
// then transitions to the target.

export interface Transition {
  nextStage: BlueprintStage
  nextSub?:  CollectSub
}

export const TRANSITIONS: Record<string, Transition> = {
  // identify
  'identify:CUSTOMER_NEW':                         { nextStage: 'auth' },
  'identify:CUSTOMER_RETURNING_UNREGISTERED':      { nextStage: 'auth' },
  'identify:CUSTOMER_REGISTERED':                  { nextStage: 'collect', nextSub: 'sku_select' },

  // auth
  'auth:NAME_VALID':                           { nextStage: 'collect', nextSub: 'sku_select' },
  'auth:NAME_INVALID':                         { nextStage: 'auth' },          // stay

  // collect > sku_select
  'collect:sku_select:SKU_CHOSEN':             { nextStage: 'collect', nextSub: 'collection' },
  'collect:sku_select:SKU_NOT_CHOSEN':         { nextStage: 'collect', nextSub: 'sku_select' }, // stay + re-show menu

  // collect > collection
  'collect:collection:FIELD_VALID':            { nextStage: 'collect', nextSub: 'collection' }, // advance field
  'collect:collection:FIELD_INVALID':          { nextStage: 'collect', nextSub: 'collection' }, // stay on field
  'collect:collection:ALL_FIELDS_DONE':        { nextStage: 'collect', nextSub: 'validation' },

  // collect > validation
  'collect:validation:SUMMARY_CONFIRMED':      { nextStage: 'collect', nextSub: 'transaction' },
  'collect:validation:PAYMENT_SKIPPED':        { nextStage: 'collect', nextSub: 'generation' },
  'collect:validation:SUMMARY_REJECTED':       { nextStage: 'collect', nextSub: 'collection' }, // restart collection

  // collect > transaction
  'collect:transaction:PAYMENT_INITIATED':     { nextStage: 'collect', nextSub: 'transaction_validation' },
  'collect:transaction:PAYMENT_FAILED':        { nextStage: 'collect', nextSub: 'transaction' }, // retry

  // collect > transaction_validation
  'collect:transaction_validation:PAYMENT_COMPLETED': { nextStage: 'collect', nextSub: 'generation' },
  'collect:transaction_validation:PAYMENT_PENDING':   { nextStage: 'collect', nextSub: 'transaction_validation' }, // wait
  'collect:transaction_validation:PAYMENT_FAILED':    { nextStage: 'collect', nextSub: 'transaction' },
  'collect:transaction_validation:PAYMENT_CANCELLED': { nextStage: 'collect', nextSub: 'sku_select' },

  // collect > generation
  'collect:generation:DOC_READY':              { nextStage: 'collect', nextSub: 'repetition_or_close' },
  'collect:generation:DOC_FAILED':             { nextStage: 'collect', nextSub: 'generation' }, // retry once

  // collect > repetition_or_close
  'collect:repetition_or_close:WANTS_ANOTHER': { nextStage: 'collect', nextSub: 'sku_select' },
  'collect:repetition_or_close:WANTS_TO_CLOSE':{ nextStage: 'farewell' },

  // farewell / closed → reopen
  'closed:CUSTOMER_REGISTERED':                   { nextStage: 'collect', nextSub: 'sku_select' },
}

// ─── Guards ───────────────────────────────────────────────────────────────────
//
// Pure functions. The machine calls these to determine which event to fire.

export const GUARDS = {
  isNameValid:      (input: string): boolean => input.trim().length >= 2,
  isCancelCommand:  (input: string): boolean => /^(cancel|hapana|stop)\b/i.test(input.trim()),
  isConfirmation:   (input: string): boolean => /^(yes|ndio|sawa|ok|confirm|y)\b/i.test(input.trim()),
  isRejection:      (input: string): boolean => /^(no|hapana|edit|change|n)\b/i.test(input.trim()),
  wantsAnother:     (input: string): boolean => /^(yes|ndio|another|more|sawa|y)\b/i.test(input.trim()),

  isValidPhone: (v: string): boolean => /^[\d\s+\-()\u00A0]{7,15}$/.test(v),
  isValidEmail: (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  isValidChoice: (v: string, field: LiveFieldSchema): boolean => {
    if (!field.choices) return true
    return !!field.choices.find(
      (c, i) => c.value === v || c.label.toLowerCase() === v.toLowerCase() || String(i + 1) === v
    )
  },
}

// ─── Messages ─────────────────────────────────────────────────────────────────
//
// All user-facing strings live here.
// Supports simple template interpolation via {{key}}.

function agentDisplayName(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

export const MESSAGES = {
  // identify
  greetNew: (agentSlug: string) => {
    const name = agentDisplayName(agentSlug)
    return `👋 Hi! I'm *${name}*. I help you create professional documents — CVs, letters, NDAs and more — delivered right here on WhatsApp.\n\nWhat's your name to get started?`
  },
  greetReturningUnregistered: (agentSlug: string) => {
    const name = agentDisplayName(agentSlug)
    return `👋 Welcome back! I'm *${name}*. You haven't finished setting up your account.\n\nWhat's your name?`
  },
  greetRegistered: (name: string, agentSlug: string) =>
    `Welcome back, *${name}*! I'm *${agentDisplayName(agentSlug)}*. 👋`,

  // auth
  nameInvalid:
    `Please enter your name (at least 2 characters).`,
  registrationSuccess: (name: string, agentSlug: string) =>
    `✅ *Welcome, ${name}!* I'm *${agentDisplayName(agentSlug)}*. You're all set.`,

  // sku select
  skuMenuHeading: (heading: string, skus: { name: string; price: number; currency: string }[]) =>
    `${heading}\n\nWhat would you like to create?\n\n${skus.map((s, i) => `${i + 1}. *${s.name}* — ${s.currency} ${s.price}`).join('\n')}`,
  skuNotChosen:
    `Please pick a number from the list:`,
  skuNoneAvailable:
    `No documents are available right now. Please check back soon.`,
  skuLoadFailed:
    `Could not load that template. Please try again.`,

  // collection
  fieldRequired: (prompt: string) =>
    `This field is required.\n\n${prompt}`,
  fieldInvalidChoice: (choices: { label: string }[]) =>
    `Please choose a valid option:\n\n${choices.map((c, i) => `${i + 1}. ${c.label}`).join('\n')}`,
  fieldInvalidPhone:
    `Please enter a valid phone number.`,
  fieldInvalidEmail:
    `Please enter a valid email address.`,
  fieldPrompt: (label: string, hint: string | undefined, idx: number, total: number, choices?: { label: string }[], required?: boolean) => {
    let msg = `_(${idx + 1}/${total})_ *${label}*`
    if (hint) msg += `\n_${hint.startsWith('e.g.') ? hint : `e.g. ${hint}`}_`
    if (choices?.length) msg += `\n\n${choices.map((c, i) => `${i + 1}. ${c.label}`).join('\n')}`
    if (!required) msg += `\n_(optional — send a dash to skip)_`
    return msg
  },

  // validation
  summaryPrompt: (lines: string[], skuName: string) =>
    `Here's what you gave me for your *${skuName}*:\n\n${lines.join('\n')}\n\n✅ Is everything correct?\n\nReply *Yes* to pay and generate, or *No* to edit.`,
  summaryAmbiguous:
    `Reply *Yes* to proceed or *No* to edit.`,

  // transaction
  paymentPrompt: (currency: string, price: number, customerMessage: string) =>
    `💳 *Payment: ${currency} ${price}*\n\n${customerMessage}\n\nEnter your M-Pesa PIN when prompted. I'll send your document automatically once confirmed. ✅`,
  paymentFree: (skuName: string) =>
    `🎉 *${skuName}* is free! Generating your document now...`,
  paymentFailed:
    `⚠️ Payment initiation failed. Please try again or type /reset.`,
  paymentWaiting:
    `⏳ Still waiting for M-Pesa confirmation...\n\nCheck your phone and enter your PIN if prompted.\n\nType *cancel* to stop.`,
  paymentFailedRetry:
    `❌ Payment failed or was cancelled on your phone.\n\nType *retry* to try again or *cancel* to start over.`,
  paymentCancelled:
    `❌ Payment cancelled. Send anything to try a new document.`,
  paymentTrackingLost:
    `Payment tracking lost. Type /reset to start over.`,

  // generation
  docReady: (title: string, fileUrl: string) =>
    `✅ *${title}* is ready!\n\n📄 ${fileUrl}\n\nWould you like to create another document?\n\nReply *Yes* or *No*.`,
  docFailed:
    `⚠️ Document generation failed. Please contact support or type /reset.`,

  // farewell
  farewell: (name: string) =>
    `Thank you, *${name}*! 🎉\n\nYour documents are saved. Come back anytime — just send a message to start.`,

  // errors
  genericError:
    `Something went wrong. Send anything to restart.`,
  paymentInitFailed:
    `⚠️ Could not initiate payment. Please try again.`,
}

// ─── Blueprint export ─────────────────────────────────────────────────────────

export const BlueprintV1 = {
  id:          'taji-v1',
  version:     1,
  agentSlug:   'taji',           // which agent this blueprint applies to
  transitions: TRANSITIONS,
  guards:      GUARDS,
  messages:    MESSAGES,
}

export type Blueprint = typeof BlueprintV1
