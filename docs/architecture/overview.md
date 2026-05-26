# Architecture Overview

## The Five Workers

```
┌─────────────────────────────────────────────────────────────────┐
│                        PUBLIC INTERNET                          │
│         WhatsApp │ SMS │ Telegram │ USSD │ Email │ Web          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                ┌────────▼────────┐
                │    GATEWAY      │  ← Single entry point
                │    Worker       │    JWT auth, routing, CORS
                └────────┬────────┘
         ┌───────────────┼───────────────┐
         │               │               │
┌────────▼──────┐ ┌──────▼──────┐ ┌─────▼────────┐
│  AUTH Worker  │ │ DATA Worker │ │CHANNEL Worker│
│  KV Sessions  │ │  D1 SQLite  │ │(API-as-Front)│
│  JWT + OTP    │ │  CRUD + Doc │ │ WhatsApp API │
└───────────────┘ │  Management │ │ SMS/Telegram │
                  └──────┬──────┘ └─────┬────────┘
                         │              │
                  ┌──────▼──────┐       │
                  │  DOCGEN     │◄──────┘
                  │  Worker     │
                  │  docx/DOCX  │
                  │  templater  │
                  │  Google APIs│
                  └─────────────┘

         ┌─────────────────────────────┐
         │        DASHBOARD            │  ← Cloudflare Pages
         │  React + shadcn/ui          │    Admin configures agents
         │  Agent config, stats, keys  │    One config = new agent
         └─────────────────────────────┘
```

## Service Bindings (Zero Latency, No HTTP)

All workers communicate via **Cloudflare Service Bindings** — direct in-memory calls, no network hop, no cold starts between workers.

```
Gateway  →  Auth Worker    (binding: AUTH)
Gateway  →  Data Worker    (binding: DATA)
Gateway  →  Channel Worker (binding: CHANNEL)
Channel  →  DocGen Worker  (binding: DOCGEN)
Channel  →  Data Worker    (binding: DATA)
DocGen   →  Data Worker    (binding: DATA)
```

## AI Layer

```
Channel Worker
    │
    ▼
Agent Brain (configured per agent in DB)
    ├── Provider: Groq (first) → Cloudflare Workers AI → others
    ├── Model: llama-3.3-70b-versatile / whisper / etc.
    ├── Instructions: system prompt from DB
    ├── Tools: enabled tool set per agent
    └── Memory: conversation history from D1
```

## Storage

| Store | What | Why |
|-------|------|-----|
| D1 SQLite | All structured data | Free tier, serverless, fast |
| KV | Sessions, agent configs cache | Sub-ms reads |
| R2 | Generated documents, uploads | Object storage |

## Key Design Decisions

1. **One wrangler.toml per worker** — each worker deployed independently but bound together
2. **Agent config lives in DB** — no code change needed to create a new agent
3. **Channel worker is the "frontend"** — it handles all messaging APIs, translates to internal format
4. **DocGen is a pure service** — called by any worker, never public-facing
5. **Dashboard is the control plane** — model, provider, API keys, tools, system prompt — all configurable
