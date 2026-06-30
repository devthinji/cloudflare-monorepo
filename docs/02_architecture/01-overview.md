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

All workers communicate via Cloudflare Service Bindings — direct in-memory calls, no HTTP, no cold starts between workers.

| Caller        | Binding name    | Target         |
|---------------|-----------------|----------------|
| aaf/whatsapp  | API_GATEWAY     | api/gateway    |
| api/gateway   | AGENT_WORKER    | api/agent      |
| api/gateway   | DOCGEN_WORKER   | api/docgen     |
| api/gateway   | PAYMENTS_WORKER | api/payments   |

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
