# Collaboration State — 2026-06-30

## Context

Continuation from `feat/e2e` branch. The last collaborator commit (`92d322f`) set up
the delivery pipeline and interactive type definitions. Local dev (Opencode) picked up
from there to implement interactive message rendering in the live flow, fix guard/button-ID
mismatches, and add a pre-generation confirmation step.

---

## What was done

### 1. Interactive hints in ConversationMachine

- `InteractionHint` type defined in `apps/api/gateway/src/machine/states/index.ts`
  — channel-agnostic payload for buttons or list messages.
- Every decision-point sub-state in `machine.ts` now returns an `interactive` hint:
  - `sku_select` → list with SKU rows (plus `runIdentify`, `runAuth`, `runReopen`)
  - `validation` (first entry + ambiguous) → Yes/Edit buttons
  - `transaction_validation` → Check again/Cancel buttons
  - `transaction_validation` (failed) → Try again/Cancel buttons
  - `generation` (docReady) → Create another/I'm done buttons
- `routes/machine.ts` passes `interactive` through in the JSON response.

### 2. WhatsApp-side interactive rendering

- `parseIncomingMessage` (`lib/whatsapp.ts`) now handles `type: 'interactive'`
  with `button_reply` / `list_reply` sub-types. Extracts button/list item `id`
  as the text forwarded to the gateway.
- `sendInteractiveMessage` (`outgoing/reply.ts`) posts buttons or list messages
  to the Meta Graph API using the builders from `types/interactive.ts`.
- `sendReply` accepts an optional `interactive` hint and routes to interactive
  vs plain text accordingly.
- `message.ts` passes `interactive` from the gateway response through to
  `sendReply`.

### 3. Button ID ↔ guard alignment

**Bug:** Button IDs like `confirm_yes` didn't match guard regexes (`isConfirmation`,
`isRejection`, etc.) because `\b` word boundaries don't match before `_`.

**Fix:** All button IDs are now simple words matching the existing guards:
- `yes` → `isConfirmation`, `wantsAnother`
- `no` → `isRejection`
- `cancel` → `isCancelCommand`

### 4. Exit/quit/reset confirmation flow

- `Session` type extended with `pendingReset` flag (`env.ts`).
- When user types `/reset`, `exit`, or `quit`, instead of immediately resetting,
  the worker sets `pendingReset = true` and sends Are-you-sure? buttons
  (Yes reset / Cancel).
- On confirmation → machine reset + "reset" reply. On cancel → clears flag and
  continues.

### 5. Pre-generation confirmation step (`confirm_generation`)

**Problem:** Previously, after payment was confirmed or skipped, the machine went
directly to `subGeneration` — user lost control. The log showed:
```
Generating your document now...
```

**Fix:** New `confirm_generation` sub-state inserted between payment/validation
and actual generation:
- `CollectSubState` extended: `confirm_generation`
- `BlueprintEvent` extended: `CONFIRM_GENERATION`, `CANCEL_GENERATION`
- Transitions: `PAYMENT_SKIPPED` and `PAYMENT_COMPLETED` now route to
  `confirm_generation` (not `generation`).
- User sees: document name, price, and **Send document** / **Cancel** buttons.
- On Send → `subGeneration`. On Cancel → back to SKU select.

---

## Files changed (12 files, +408 / -44)

| File | Change |
|------|--------|
| `apps/api/gateway/src/machine/states/index.ts` | `InteractionHint` type, `confirm_generation` in `CollectSubState` |
| `apps/api/gateway/src/machine/steps/business-logic/version_1.ts` | `confirm_generation` sub-state, events, transitions, `confirmGeneration` message |
| `apps/api/gateway/src/machine/machine.ts` | Interactive hints in all sub-states, `subConfirmGeneration` handler |
| `apps/api/gateway/src/routes/machine.ts` | `interactive` in API response |
| `apps/api/gateway/AGENTS.md` | Interactive hints documentation |
| `apps/web/aaf/whatsapp/src/lib/whatsapp.ts` | `parseIncomingMessage` handles interactive replies |
| `apps/web/aaf/whatsapp/src/controllers/outgoing/reply.ts` | `sendInteractiveMessage` |
| `apps/web/aaf/whatsapp/src/controllers/incoming/message.ts` | Interactive passthrough, exit/quit/reset confirmation |
| `apps/web/aaf/whatsapp/src/models/machine.ts` | Type includes `interactive` |
| `apps/web/aaf/whatsapp/src/types/env.ts` | `Session.pendingReset` |
| `apps/web/aaf/whatsapp/src/types/interactive.ts` | `InteractionHint` type |
| `apps/web/aaf/whatsapp/AGENTS.md` | Interactive flow documentation |

---

## Current state of version_1.ts business logic

### Sub-states in collect (in order)

```
sku_select → collection → naming → validation → transaction
→ transaction_validation → confirm_generation → generation → repetition_or_close
```

### Interactive hint map

| Sub-state | Interactive | Buttons/List | Guard match |
|-----------|-------------|-------------|-------------|
| `sku_select` | list | SKU rows | n/a (tap selects SKU) |
| `validation` (first) | buttons | Yes / Edit | `yes`→`isConfirmation`, `no`→`isRejection` |
| `validation` (ambiguous) | buttons | Yes / Edit | same |
| `transaction_validation` (pending) | buttons | Check again / Cancel | `cancel`→`isCancelCommand` |
| `transaction_validation` (failed) | buttons | Try again / Cancel | `yes`→retry, `cancel`→`isCancelCommand` |
| `confirm_generation` | buttons | Send document / Cancel | `yes`→`isConfirmation`, `no`→`isRejection`/`isCancelCommand` |
| `generation` (docReady) | buttons | Create another / I'm done | `yes`→`wantsAnother`, `no`→close |
| exit/quit/reset (in WA worker) | buttons | Confirm reset / Cancel | handled in message.ts by string match |

### Transitions

```
validation:SUMMARY_CONFIRMED       → transaction       (paid)
validation:PAYMENT_SKIPPED         → confirm_generation (free)
validation:SUMMARY_REJECTED        → collection         (restart fields)
transaction_validation:PAYMENT_COMPLETED → confirm_generation
transaction_validation:PAYMENT_FAILED    → transaction (retry)
transaction_validation:PAYMENT_CANCELLED → sku_select
confirm_generation:CONFIRM_GENERATION → generation
confirm_generation:CANCEL_GENERATION  → sku_select
generation:DOC_READY                 → repetition_or_close
repetition_or_close:WANTS_ANOTHER    → sku_select
repetition_or_close:WANTS_TO_CLOSE   → farewell
```

### Guards (unchanged)

| Guard | Regex |
|-------|-------|
| `isConfirmation` | `/^(yes\|ndio\|sawa\|ok\|confirm\|y)\b/i` |
| `isRejection` | `/^(no\|hapana\|edit\|change\|n)\b/i` |
| `wantsAnother` | `/^(yes\|ndio\|another\|more\|sawa\|y)\b/i` |
| `isCancelCommand` | `/^(cancel\|hapana\|stop)\b/i` |
| `isSkipCommand` | `/^(skip\|dash\|-\|pass\|default\|none)\b/i` |

All button IDs (`yes`, `no`, `cancel`) match these guards. Tapping a button is
equivalent to typing that word.

---

## What the collaborator should do next

1. **Verify e2e flow** — run `pnpm dev`, send a message via WhatsApp, confirm:
   - SKU select shows a list (interactive) not plain text
   - Field collection works (plain text, no interactive)
   - Summary shows Yes/Edit buttons
   - Free SKU shows delivery confirm with doc name + Send/Cancel buttons
   - Paid SKU goes through M-Pesa → delivery confirm → generation → doc delivery
   - Exit/quit/reset shows confirmation buttons
2. **Check type-check** — `pnpm run type-check` should pass 13/13.
3. **Review button ID compatibility** — if new guards are added in `version_1.ts`,
   ensure corresponding button IDs match exactly or update `isConfirmation` etc.
