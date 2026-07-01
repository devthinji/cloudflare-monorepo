# AGENTS.md — api/agent

> Read the repo-root AGENTS.md first for full project context.
> This file covers only what is specific to this worker.

## Purpose

Hosts the AgentWorker Durable Object. Manages conversation history, LLM calls,
and document generation coordination. One DO instance per phone number.
Also owns all customer and agent CRUD APIs.

## Worker name / local port

`api-agent` — port 8790

## Bindings

| Binding          | Type           | What it is                                  |
|------------------|----------------|----------------------------------------------|
| DB               | D1             | platform-db                                  |
| AGENT_KV         | KV             | Agent config cache                           |
| DOCS_BUCKET      | R2             | Generated document storage                   |
| AI               | Workers AI     | @cf/meta/llama-3.1-8b-instruct               |
| AGENT_DO         | Durable Object | AgentWorker class (stateful sessions)        |
| DOCGEN_WORKER    | Service        | api-docgen                                   |
| PAYMENTS_WORKER  | Service        | api-payments                                 |

## Routes

```
GET  /health

-- Agents --
GET    /api/v1/agent/agents
GET    /api/v1/agent/agents/:slug
POST   /api/v1/agent/agents
PUT    /api/v1/agent/agents/:slug
DELETE /api/v1/agent/agents/:slug

-- Chat --
POST   /api/v1/agent/chat

-- Customers (was: users) --
GET    /api/v1/agent/customers
GET    /api/v1/agent/customers/:customerId
POST   /api/v1/agent/customers
PATCH  /api/v1/agent/customers/:customerId

-- Conversations --
GET    /api/v1/agent/conversations/:userId
GET    /api/v1/agent/conversations/:id/messages
```

## Important: users → customers rename

The `users` table has been renamed to `customers` in the schema.
The controller file was renamed: `controllers/users.ts` → `controllers/customers.ts`.
All internal references should use `customers` not `users`.

## AgentWorker Durable Object

File: `src/services/AgentWorker.ts`

One DO instance per phone number, keyed by userId.
Holds conversation history in memory for the session lifetime.
Persists messages to D1.

DO flow on /chat:
1. Route to DO via AGENT_DO.get(id)
2. DO loads agent config from DB (or AGENT_KV cache)
3. Appends user message to in-memory history
4. Calls LLM: OpenRouter primary → Workers AI fallback
5. Appends assistant reply to history
6. Persists both messages to D1
7. Returns reply string to gateway

## LLM providers

Primary:  OpenRouter → `openai/gpt-4o-mini`
Fallback: Workers AI → `@cf/meta/llama-3.1-8b-instruct`

Configured per agent in the `agents` DB row. Changed via dashboard — no code deploy needed.

## InterviewEngine

File: `src/pipeline/interview-engine.ts`

Steps through SKU `conversation_steps` during field collection.
Tracks current step index in DO in-memory state.
Validates each answer and advances to the next step.

## Required secrets (Doppler)

```
OPENROUTER_API_KEY
```

## Key files

```
src/
  index.ts
  routes/index.ts
  services/AgentWorker.ts          — Durable Object
  controllers/
    agents.ts
    chat.ts
    config.ts                      — AgentIntelligence (model config loader)
    conversations.ts
    customers.ts                   — customer CRUD (was users.ts)
    providers.ts
    index.ts
  pipeline/
    interview-engine.ts
    field-schema.ts
  models/
    schema.ts
    index.ts
  lib/logger.ts
  lib/prompts.ts
```

## Rules

- No new DB migrations here — all migrations live in api/gateway
- No hardcoded model names — read from agent DB row
- No conversation flow logic — that lives in gateway version_1.ts
- No direct external API calls without going through env bindings
