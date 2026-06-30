# Architecture Overview

## The five workers

```
WhatsApp / Telegram / SMS / USSD
        │
        ▼
┌───────────────────┐
│   aaf/whatsapp    │  Validates Meta signature
│   aaf/telegram    │  Normalises phone: +254XXXXXXXXX
│   aaf/sms         │  POSTs to gateway
└────────┬──────────┘
         │ service binding
         ▼
┌───────────────────┐
│   api/gateway     │  ConversationMachine (4-stage)
│   (entry point)   │  JWT auth, CORS, rate limiting
└────────┬──────────┘
         │ service bindings
    ┌────┴────┬──────────┐
    ▼         ▼          ▼
┌────────┐ ┌────────┐ ┌──────────┐
│ agent  │ │ docgen │ │ payments │
│ worker │ │ worker │ │ worker   │
│ DO     │ │ R2+D1  │ │ Daraja   │
└────────┘ └────────┘ └──────────┘
         │
         ▼
┌────────────────────┐
│   platform-db (D1) │  Shared by all workers
└────────────────────┘

┌────────────────────┐
│   dashboard        │  Cloudflare Pages
│   site             │  React + Vite + Tailwind
└────────────────────┘
```

## Service bindings (zero latency)

All workers communicate via Cloudflare Service Bindings — direct in-memory calls,
no HTTP, no cold starts between workers.

| Caller        | Binding name    | Target         |
|---------------|-----------------|----------------|
| aaf/whatsapp  | API_GATEWAY     | api/gateway    |
| api/gateway   | AGENT_WORKER    | api/agent      |
| api/gateway   | DOCGEN_WORKER   | api/docgen     |
| api/gateway   | PAYMENTS_WORKER | api/payments   |

## ConversationMachine (api/gateway)

The gateway hosts the ConversationMachine — a 4-stage state machine that drives
every user session.

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

State is persisted in SESSIONS_KV (Cloudflare KV) between requests.
Business logic lives entirely in `src/machine/steps/business-logic/version_1.ts`.
The machine (`machine.ts`) is a pure executor — it reads the blueprint and runs it.

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

## AI providers

```
Primary:  OpenRouter  → openai/gpt-4o-mini   (all LLM tasks)
Fallback: Workers AI  → @cf/meta/llama-3.1-8b-instruct
```

Configured per agent in the `agents` table. Switched without code change via dashboard.

## Storage

| Store          | What                            | Free tier limit |
|----------------|---------------------------------|-----------------|
| D1 SQLite      | All structured data (8 tables)  | 5M rows/day     |
| KV             | Sessions, agent config cache    | 100k reads/day  |
| R2             | Generated docs, uploaded templates | 10GB storage |
| Durable Objects| Active conversation state (DO)  | 1M req/month    |
