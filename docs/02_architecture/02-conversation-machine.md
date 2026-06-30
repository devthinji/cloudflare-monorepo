# ConversationMachine (api/gateway)

The gateway hosts the ConversationMachine — a 4-stage state machine that drives
every user session.

## The 4-stage machine

```
identify → auth → collect → farewell → closed
                      │
                sku_select
                collection
                validation
                transaction
                transaction_validation
                generation
                repetition_or_close
```

## Architecture

State is persisted in **SESSIONS_KV** (Cloudflare KV) between requests.
Business logic lives entirely in `src/machine/steps/business-logic/version_1.ts`.
The machine (`machine.ts`) is a pure executor — it reads the blueprint and runs it.

## Data flow

```
WhatsApp user sends message
        │
        ▼
aaf/whatsapp (Cloudflare Worker)
  Verifies Meta signature
  Normalises phone: +254XXXXXXXXX
  POSTs to → gateway /api/v1/machine/advance
        │
        ▼
api/gateway ConversationMachine
  Loads session from SESSIONS_KV
  Runs 4-stage state machine
  Calls AGENT_WORKER, DOCGEN_WORKER, PAYMENTS_WORKER via service bindings
  Persists session back to KV
  Returns { reply: string }
        │
        ▼
aaf/whatsapp sends reply via Meta Graph API
```

## SKU-driven document pipeline

Templates are uploaded once to R2 and registered as SKU records in D1.
The PipelineFactory (api/docgen) extracts {placeholders} from .docx files,
infers field schemas via AI, and generates conversationSteps automatically.

New sellable document = new SKU record. No code change.

```
Upload .docx
    │
    ▼
PipelineFactory.run('docx', 'schema')
    │
    ├── Unzips word/document.xml
    ├── Extracts {placeholder} names via regex
    ├── AI infers label, type, hint per field
    └── Stores field_schema + conversation_steps in skus table
            │
            ▼
    ConversationMachine loads SKU at runtime
    Runs conversationSteps to collect field values
    Calls docgen worker to fill template
    Delivers .docx to user
```

## Blueprint ownership

- **Blueprint** (`version_1.ts`): owns all transitions, guards, messages, business logic
- **Machine** (`machine.ts`): pure executor — do not add business logic here
- **States** (`states/index.ts`): state and type definitions
