# AGENTS.md — api/agent

> Read the repo-root AGENTS.md first for the full project context.
> This file covers only what is specific to this worker.

## Purpose

Hosts the AgentWorker Durable Object. Manages conversation history, LLM calls,
and document generation coordination. One DO instance per phone number = one persistent
conversation context in memory.

## Cloudflare worker name

`api-agent`  — local port 8790

## Bindings

| Binding        | Type            | What it is                         |
|----------------|-----------------|------------------------------------|
| DB             | D1              | platform-db (read users, write messages/conversations) |
| AGENT_KV       | KV              | Agent config cache                 |
| DOCS_BUCKET    | R2              | Generated document storage         |
| AI             | Workers AI      | @cf/meta/llama-3.1-8b-instruct     |
| AGENT_DO       | Durable Object  | AgentWorker class (stateful sessions) |
| DOCGEN_WORKER  | Service         | api-docgen (trigger rendering)     |
| PAYMENTS_WORKER| Service         | api-payments (trigger STK push)    |

## Routes

```
GET  /health

GET  /api/v1/agent/agents             — list all agents
GET  /api/v1/agent/agents/:slug       — get one agent
POST /api/v1/agent/agents             — create agent
PUT  /api/v1/agent/agents/:slug       — update agent
DELETE /api/v1/agent/agents/:slug     — delete agent

POST /api/v1/agent/chat               — send message to AgentWorker DO

GET  /api/v1/agent/users              — list users
GET  /api/v1/agent/users/:userId      — get one user
POST /api/v1/agent/users              — create or update user
PATCH /api/v1/agent/users/:userId     — patch user fields

GET  /api/v1/agent/conversations/:userId         — list conversations for user
GET  /api/v1/agent/conversations/:id/messages    — list messages in conversation
```

## AgentWorker Durable Object

File: `src/services/AgentWorker.ts`

One DO instance per user session, identified by phone number.
Holds conversation history in memory for the session lifetime.
Persists messages to D1 via the messages table.

Flow when /chat is called:
1. Route request to DO instance via `AGENT_DO.get(id)`
2. DO loads agent config from DB (or AGENT_KV cache)
3. DO appends user message to in-memory history
4. DO calls LLM via OpenRouter (or Workers AI fallback)
5. DO appends assistant reply to history
6. DO persists both messages to D1
7. Returns reply string to gateway

## LLM providers

Primary: OpenRouter → `openai/gpt-4o-mini`
Fallback: Workers AI → `@cf/meta/llama-3.1-8b-instruct`

Provider and model are read from the agent's DB record. Switch without code change
via the dashboard or direct DB update.

## InterviewEngine

File: `src/pipeline/interview-engine.ts`

Used by the DO to step through SKU `conversation_steps` during field collection.
Loads steps from the SKU record, tracks current step index in DO state,
validates each answer, and advances to the next step.

## Required secrets (via Doppler)

```
OPENROUTER_API_KEY
```

## Key files

```
src/
  index.ts                       — entry point, routes AgentWorker DO requests
  routes/index.ts                — all HTTP route definitions
  services/
    AgentWorker.ts               — Durable Object class (conversation state)
  controllers/
    agents.ts                    — agent CRUD
    chat.ts                      — /chat handler, routes to DO
    config.ts                    — AgentIntelligence (model config loader)
    conversations.ts             — conversation + message queries
    users.ts                     — user CRUD
    providers.ts                 — LLM provider selection logic
  pipeline/
    interview-engine.ts          — step-by-step field collection
    field-schema.ts              — FieldSchema type + validation helpers
  models/
    schema.ts                    — local Drizzle schema reference (read-only)
    index.ts                     — db instance creator
  lib/
    logger.ts                    — Pino logger
    prompts.ts                   — system prompt builders
```

## What NOT to do

- Do not add new DB migrations here — all migrations live in api/gateway
- Do not hardcode model names or provider URLs — read from agent DB record
- Do not store secrets in code — use Doppler / env bindings
- Do not add conversation flow logic here — that lives in gateway/machine version_1.ts
