# Flow Interactivity — WhatsApp Interactive Messages

## Problem

The current flow is text-only. Users type "1", "yes", "no", "exit" as free text.
This causes:
- Typo friction ("yse" instead of "yes" fails guard matching)
- SKU menu numbering errors (user types "3" meaning option 3, but SKUs are reordered)
- No visual hierarchy for decisions
- Exit must be typed explicitly, no confirmation

## Solution

Replace every bounded-choice interaction with WhatsApp interactive components.
Free-form input (names, document fields, custom naming) stays as text.

### Component mapping

| Machine state | Interaction type | Visual |
|--------------|------------------|--------|
| `sku_select` | **List** | Expandable menu with SKU name + price per row |
| `validation` | **Buttons** (2) | "✅ Yes" \| "✏️ Edit" |
| `naming` | **Text** | Free text or "skip" |
| `transaction_validation` (waiting) | **Buttons** (2) | "🔄 Check Status" \| "❌ Cancel" |
| `transaction_validation` (failed) | **Buttons** (2) | "🔄 Retry" \| "❌ Cancel" |
| `generation` → `repetition_or_close` | **Buttons** (2) | "✅ Yes" \| "❌ No" |
| `exit` / `quit` / `/reset` (any state) | **Buttons** (2) | "✅ Confirm" \| "↩️ Stay" |
| Field collection | **Text** | Free input, validated per field type |
| Choice-type fields | **List** (4+) or **Buttons** (2-3) | Dynamic based on `field.choices.length` |

## Architecture

### Principle: channel-agnostic machine, channel-specific rendering

The gateway machine stays pure — it returns `reply: string` and a new
`interactive` hint object. The WhatsApp worker decides how to render.

### Gateway response shape (extended)

```typescript
interface AdvanceResponse {
  reply:      string
  stage:      string
  collectSub: string | null
  skuName?:   string
  document?:  DocDelivery
  done:       boolean
  // NEW — interactive hint for the channel worker
  interactive?: {
    type:    'text' | 'buttons' | 'list'
    // buttons
    buttons?:     { id: string; title: string }[]
    // list (for SKU select and choice fields)
    header?:      string
    body?:        string
    footer?:      string
    buttonLabel?: string       // text on the CTA button that opens the list
    sections?:    {
      title?: string
      rows:   { id: string; title: string; description?: string }[]
    }[]
  }
}
```

### WhatsApp worker logic

```
message.ts handleWebhook()
  → machineModel.advance() → gets { reply, interactive, document }
  → if interactive:
      if interactive.type === 'buttons':
        sendButtonMessage(interactive.buttons)
      else if interactive.type === 'list':
        sendListMessage(interactive.sections)
      else:
        sendTextMessage(reply)
  → else if reply:
      sendTextMessage(reply)     // fallback for non-interactive states
  → if document:
      deliverDocument()          // media upload + send
```

### Gateway machine populates interactive hints

The blueprint (`version_1.ts`) gains a new export: `INTERACTIVE_MAP`.

```typescript
export const INTERACTIVE_HINTS: Record<string, (ctx: MachineContext, skus?: LiveSKU[]) => InteractionHint | null> = {
  'collect:sku_select': (ctx, skus) => ({
    type: 'list',
    header: '📋 Select a Document',
    body: 'Choose what you want to create.',
    footer: `Taji — ${skus?.length ?? 0} documents available`,
    buttonLabel: 'View Options',
    sections: [{
      rows: (skus ?? []).map((s, i) => ({
        id:     String(i + 1),
        title:  s.name,
        description: `${s.currency} ${s.price}${s.price === 0 ? ' (Free)' : ''}`,
      })),
    }],
  }),
  'collect:validation': () => ({
    type: 'buttons',
    buttons: [
      { id: 'yes',  title: '✅ Yes' },
      { id: 'edit', title: '✏️ Edit' },
    ],
  }),
  'collect:repetition_or_close': () => ({
    type: 'buttons',
    buttons: [
      { id: 'yes', title: '✅ Yes' },
      { id: 'no',  title: '❌ No' },
    ],
  }),
  // ... etc
}
```

## Session Lifecycle — all exit paths

```
                    ┌──────────────────────────────────────────┐
                    │           Active Session                  │
                    │  (identify → auth → collect → ...)       │
                    └────────────┬─────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────────┐
              ▼                  ▼                      ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
     │  User types  │  │  User types  │  │   Idle timeout      │
     │  "exit"/quit"│  │  "No" at     │  │   (30 min no msg)   │
     │              │  │  create-     │  │                      │
     │  Confirm?    │  │  another?    │  │  Send: "Still there?"│
     │  [Yes] [No]  │  │              │  │  [Yes] [No]          │
     └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘
            │                 │                      │
            ▼                 ▼                      │ No / timeout
     ┌──────────────┐  ┌──────────────┐              │
     │  Farewell    │  │  Farewell    │              │
     │  message +   │  │  message +   │              │
     │  done: true  │  │  done: true  │              │
     └──────────────┘  └──────────────┘              │
            │                 │                       │
            ▼                 ▼                       ▼
     ┌──────────────────────────────────────────────────┐
     │              closed (done: true)                  │
     │  Session persisted for 30 days.                   │
     │  Next message → reopen → sku_select               │
     └──────────────────────────────────────────────────┘
```

### Exit confirmation flow

When user types `exit` / `quit` / `/reset` at ANY state:

```
User: "exit"
  → WhatsApp worker intercepts (before machine.advance)
  → Sends interactive confirmation:
      Header:    "🚪 Exit Session?"
      Body:      "Are you sure you want to end this session?\n\nYour progress will be saved."
      Footer:    "Taji — session manager"
      Buttons:   [✅ Confirm] [↩️ Stay]
  → If "Confirm":
      → DELETE machine context (reset)
      → Send: "🔄 Session reset. Send anything to start fresh."
  → If "Stay":
      → Send nothing (user stays in current state)
```

## Incoming interactive reply parsing

WhatsApp sends interactive replies as `type: 'interactive'` with:

```typescript
// Button tap
{ interactive: { type: 'button_reply', button_reply: { id: 'yes', title: '✅ Yes' } } }

// List selection  
{ interactive: { type: 'list_reply', list_reply: { id: '1', title: 'Professional CV', description: 'KES 1' } } }
```

The WhatsApp worker's `parseIncomingMessage()` must be extended:

```typescript
// In lib/whatsapp.ts
export function parseIncomingMessage(payload: WaWebhookPayload): IncomingMessage | null {
  const msg = change.value.messages?.[0]
  if (!msg) return null

  // Text message
  if (msg.type === 'text' && msg.text?.body) {
    return { type: 'text', text: msg.text.body, ... }
  }

  // Interactive reply (NEW)
  if (msg.type === 'interactive' && msg.interactive) {
    if (msg.interactive.type === 'button_reply') {
      return { type: 'interactive', text: msg.interactive.button_reply!.id, ... }
    }
    if (msg.interactive.type === 'list_reply') {
      return { type: 'interactive', text: msg.interactive.list_reply!.id, ... }
    }
  }

  return null
}
```

The interactive reply `id` is forwarded to the gateway as the `message` field.
The machine never knows whether the user tapped a button or typed text —
it receives the same string ("yes", "1", etc.).

## Implementation order

1. **Extend types** — add `InteractiveHint` to gateway response, add incoming
   interactive parsing to WhatsApp worker
2. **Build interactive renderer** — `renderInteractive()` in the WhatsApp worker
   that maps machine state to the correct component
3. **Add exit confirmation** — intercept `exit`/`quit`/`/reset` before machine
   advance, show confirmation buttons
4. **Wire SKU list** — machine populates list rows from loaded SKUs
5. **Wire validation buttons** — machine sends `{ type: 'buttons', buttons: [yes, edit] }`
   at validation sub-stage
6. **Wire payment buttons** — machine sends check/cancel during STK wait
7. **Wire repetition buttons** — machine sends yes/no after document generation
8. **Add idle timeout** — WhatsApp worker tracks last activity, sends "Still there?"
   with buttons after 30 min of silence

## Key files affected

| File | Change |
|------|--------|
| `apps/api/gateway/src/machine/machine.ts` | Populate `interactive` hint in AdvanceResult |
| `apps/api/gateway/src/routes/machine.ts` | Include `interactive` in response JSON |
| `apps/web/aaf/whatsapp/src/lib/whatsapp.ts` | Parse incoming `interactive` type (button_reply, list_reply) |
| `apps/web/aaf/whatsapp/src/controllers/incoming/message.ts` | Intercept exit/reset, call renderInteractive, suppress text when interactive sent |
| `apps/web/aaf/whatsapp/src/controllers/outgoing/reply.ts` | Add `sendInteractiveButtons()`, `sendInteractiveList()`, or use builders from `interactive.ts` |
| `apps/web/aaf/whatsapp/src/types/interactive.ts` | Already defined — use builders |
