# Audit 03: Secrets, Keys & Variables — Categorization & Control

> Recorded: 2026-07-01
> Branch: feat/e2e
> Context: Full audit of every environment variable, secret, binding, and per-agent configuration — identify what belongs to infrastructure (Doppler/Cloudflare Secrets) vs what should be managed in the dashboard (agent-level config).

---

## 1. Reference Architecture: WACRM

The sample project ([ArnasDon/wacrm](https://github.com/ArnasDon/wacrm)) — a self-hosted WhatsApp CRM — follows this pattern:

```
Environment vars (hPanel / .env.local):
  SUPABASE_URL, SUPABASE_ANON_KEY    → infra (database connection)
  WHATSAPP_*                          → infra (Meta app-level, one set)
  ENCRYPTION_KEY                      → infra (token encryption)

Dashboard (app-managed):
  WhatsApp phone number connections   → per-account
  API keys for external integrations  → per-account
  Team member roles                   → per-account
  Broadcast templates                 → per-account
```

Key insight: **one Meta app serves one instance**. WhatsApp tokens are per-instance infra. In our multi-agent architecture, each agent has its own phone number, so WhatsApp tokens become **per-agent config** managed via the dashboard.

---

## 2. Complete Inventory

### 2.1 All Environment Variables, Secrets & Bindings

| # | Variable / Binding | Worker(s) | Type | Current Source | Category |
|---|---|---|---|---|---|
| 1 | `JWT_SECRET` | gateway, agent | Secret | Doppler / Cloudflare Secret | **Infra** |
| 2 | `OPENROUTER_API_KEY` | agent, docgen | Secret | Doppler / Cloudflare Secret | **Infra** |
| 3 | `DB_ENCRYPTION_KEY` | agent | Secret | Doppler / Cloudflare Secret | **Infra** |
| 4 | `MPESA_CONSUMER_KEY` | payments | Secret | Doppler / Cloudflare Secret | **Infra** |
| 5 | `MPESA_CONSUMER_SECRET` | payments | Secret | Doppler / Cloudflare Secret | **Infra** |
| 6 | `MPESA_PASSKEY` | payments | Secret | Doppler / Cloudflare Secret | **Infra** |
| 7 | `MPESA_SHORTCODE` | payments | Var (wrangler.toml) + Secret | **Split** — needs cleanup | **Infra** |
| 8 | `MPESA_CALLBACK_URL` | payments | Var (wrangler.toml) | wrangler.toml, overridable | **Infra** |
| 9 | `MPESA_ENVIRONMENT` | payments | Var (wrangler.toml) | wrangler.toml, overridable | **Infra** |
| 10 | `WHATSAPP_ACCESS_TOKEN` | whatsapp | Secret | Doppler | **→ Agent Config** |
| 11 | `WHATSAPP_APP_SECRET` | whatsapp | Secret | Doppler | **→ Agent Config** |
| 12 | `WHATSAPP_VERIFY_TOKEN` | whatsapp | Secret | Doppler | **→ Agent Config** |
| 13 | `WHATSAPP_PHONE_NUMBER_ID` | whatsapp | Secret | Doppler | **→ Agent Config** |
| 14 | `TELEGRAM_BOT_TOKEN` | telegram | Secret | Manual .dev.vars (not in Doppler) | **→ Agent Config** |
| 15 | `TELEGRAM_WEBHOOK_SECRET` | telegram | Secret | Manual .dev.vars (not in Doppler) | **→ Agent Config** |
| 16 | `AFRICASTALKING_API_KEY` | sms | Secret | Manual .dev.vars (not in Doppler) | **→ Agent Config** |
| 17 | `AFRICASTALKING_USERNAME` | sms | Secret | Manual .dev.vars (not in Doppler) | **→ Agent Config** |
| 18 | `AFRICASTALKING_SENDER_ID` | sms | Secret | Manual .dev.vars (not in Doppler) | **→ Agent Config** |
| 19 | `DOCS_BUCKET_PUBLIC_URL` | docgen | Var | Undocumented | **Infra** |
| 20 | `ENVIRONMENT` | all | Var | wrangler.toml `[vars]` | **Infra** |
| 21 | `LOG_LEVEL` | all | Var | wrangler.toml `[vars]` | **Infra** |
| 22 | `DB` (D1 binding) | gateway, agent, docgen, payments | Binding | wrangler.toml | **Infra** |
| 23 | `SESSIONS_KV` | gateway | Binding | wrangler.toml | **Infra** |
| 24 | `AGENT_KV` | agent | Binding | wrangler.toml | **Infra** |
| 25 | `PAYMENTS_KV` | payments | Binding | wrangler.toml | **Infra** |
| 26 | `AAF_KV` | whatsapp, telegram, sms | Binding | wrangler.toml | **Infra** |
| 27 | `DOCS_BUCKET` (R2) | agent, docgen | Binding | wrangler.toml | **Infra** |
| 28 | `AI` (Workers AI) | agent, docgen | Binding | wrangler.toml | **Infra** |
| 29 | `AGENT_DO` (DO) | agent | Binding | wrangler.toml | **Infra** |
| 30 | `AGENT_WORKER` (svc) | gateway, payments | Binding | wrangler.toml | **Infra** |
| 31 | `DOCGEN_WORKER` (svc) | gateway, agent | Binding | wrangler.toml | **Infra** |
| 32 | `PAYMENTS_WORKER` (svc) | gateway, agent | Binding | wrangler.toml | **Infra** |
| 33 | `API_GATEWAY` (svc) | whatsapp, telegram, sms | Binding | wrangler.toml | **Infra** |
| 34 | `VITE_API_URL` | dashboard | Var | `.env.local` (Vite) | **Infra** |

### 2.2 Per-Agent Configuration (DB-stored, not env vars)

| Field | Table Column | Currently Encrypted? | Currently Editable via Dashboard? | Category |
|---|---|---|---|---|
| `systemPrompt` | `agents.system_prompt` | No | ✅ Yes | **Workflow logic** |
| `modelProvider` | `agents.model_provider` | No | ✅ Yes | **Workflow logic** |
| `modelId` | `agents.model_id` | No | ✅ Yes | **Workflow logic** |
| `channel` | `agents.channel` | No | ✅ Yes | **Channel config** |
| `channelConfig.whatsappPhoneNumberId` | `agents.channel_config` | ✅ Yes (AES-256-GCM) | ❌ **No** (type missing in client.ts) | **Channel config** |
| `apiKeys` (per-provider, e.g. OpenRouter) | `agents.api_keys` | ✅ Yes (AES-256-GCM) | ❌ **No** (type missing in client.ts) | **Agent credentials** |
| WhatsApp access token | (should be in `apiKeys` or `channelConfig`) | — | ❌ **Not stored** (env var only) | **Agent credentials** |
| WhatsApp app secret | (should be in `apiKeys` or `channelConfig`) | — | ❌ **Not stored** (env var only) | **Agent credentials** |
| WhatsApp verify token | (should be in `apiKeys` or `channelConfig`) | — | ❌ **Not stored** (env var only) | **Agent credentials** |
| Telegram bot token | (should be in `apiKeys` or `channelConfig`) | — | ❌ **Not stored** (env var only) | **Agent credentials** |
| Africa's Talking API key | (should be in `apiKeys` or `channelConfig`) | — | ❌ **Not stored** (env var only) | **Agent credentials** |

---

## 3. Current Architecture Problems

### Problem 1: WhatsApp tokens are env vars, but they're per-agent

Currently `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, and `WHATSAPP_PHONE_NUMBER_ID` are all Cloudflare Worker secrets injected at deploy time.

With multiple agents (Taji, Elim, Test, future agents), each with their own phone number, a single token is insufficient. The WhatsApp worker currently uses a **hard-coded** `phone-agent-map.ts`:

```typescript
// apps/web/aaf/whatsapp/src/config/phone-agent-map.ts
export const PHONE_NUMBER_ID_TO_AGENT: Record<string, string> = {
  '1038436689362682': 'taji',
  '729899760214979': 'elim',
  '122108114672001278': 'test',
}
```

Each phone number ID corresponds to a different Meta WhatsApp Business Account (or phone number), which needs its own access token and app secret. These can't be single env vars — they must be per-agent.

### Problem 2: `channelConfig` and `apiKeys` encrypted but dashboard can't touch them

The `agents` table has `channel_config` and `api_keys` columns that are encrypted with AES-256-GCM. But:

- **Dashboard client `Agent` type is missing these fields** — `client.ts:23-35` doesn't include `apiKeys` or `channelConfig`, so the typed API can't send them
- **GET /agents/:slug doesn't return `channelConfig`** — `agents.ts:56-57` processes `apiKeys` (masked) but drops `channelConfig`
- **No dashboard UI for editing these** — no form inputs for WhatsApp tokens, API keys, or channel config exist

### Problem 3: Phone-agent mapping is hard-coded, not DB-driven

The `phone-agent-map.ts` file is a static TypeScript constant. Adding a new agent requires:
1. A code change (new entry in the map)
2. A deploy of the WhatsApp worker
3. The WhatsApp token stored as a new env var

This violates the "no code deploy for new products" principle in AGENTS.md.

### Problem 4: AAF worker env vars come from Doppler but should be agent-sourced

The `dev-local.sh` injects all WhatsApp secrets via Doppler. But these are:
- `WHATSAPP_ACCESS_TOKEN` — Meta app-level access token
- `WHATSAPP_APP_SECRET` — Meta app secret (needed to verify webhook signatures)
- `WHATSAPP_VERIFY_TOKEN` — webhook verification token
- `WHATSAPP_PHONE_NUMBER_ID` — which phone number to use

For multi-agent support, each agent's channel config should include:
- `phoneNumberId` → already exists in `channelConfig`
- `accessToken` → needs to be added to `apiKeys` or `channelConfig`
- `appSecret` → needed per-agent for webhook signature verification
- `verifyToken` → needed per-agent for webhook setup

### Problem 5: M-Pesa variables are split across wrangler.toml and secrets

`MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, and `MPESA_ENVIRONMENT` are defined as both `wrangler.toml [vars]` (with placeholder defaults) AND expected as secrets in `.dev.vars.example`. This dual-source pattern is confusing — the wrangler.toml defaults will be baked into the build, while secrets override at runtime. Cleanest approach: all M-Pesa config as Cloudflare Secrets, remove from `wrangler.toml [vars]`.

---

## 4. Proposed Categorization

### Category A: Infrastructure Secrets (Doppler / Cloudflare Secrets)

**Never exposed to dashboard UI. Never hardcoded. Never committed. Set once per environment, changed via Doppler.**

| Secret | Purpose | Workers |
|---|---|---|
| `JWT_SECRET` | Sign & verify admin dashboard JWT tokens | gateway, agent |
| `OPENROUTER_API_KEY` | Access OpenRouter LLM API | agent, docgen |
| `DB_ENCRYPTION_KEY` | AES-256-GCM key for encrypting stored agent credentials | agent |
| `MPESA_CONSUMER_KEY` | Daraja OAuth consumer key | payments |
| `MPESA_CONSUMER_SECRET` | Daraja OAuth consumer secret | payments |
| `MPESA_PASSKEY` | Daraja STK push password generation | payments |
| `MPESA_SHORTCODE` | Business shortcode for STK push | payments |
| `MPESA_CALLBACK_URL` | Where Safaricom sends payment callbacks | payments |
| `MPESA_ENVIRONMENT` | `sandbox` or `production` | payments |
| `DOCS_BUCKET_PUBLIC_URL` | Optional public URL prefix for R2 documents | docgen |
| `ENVIRONMENT` | `development` or `production` | all |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` | all |

### Category B: Agent Credentials (Dashboard-managed, stored in D1)

**Per-agent secrets that the user inputs in the dashboard, encrypted at rest in `agents.api_keys`.**

| Key in `apiKeys` object | Purpose | Workers that consume it |
|---|---|---|
| `whatsappAccessToken` | Meta WhatsApp permanent access token | aaf-whatsapp |
| `whatsappAppSecret` | Meta app secret for webhook signature verification | aaf-whatsapp |
| `whatsappVerifyToken` | Webhook verification token for Meta setup | aaf-whatsapp |
| `telegramBotToken` | Telegram bot token for the agent | aaf-telegram |
| `telegramWebhookSecret` | Telegram webhook secret | aaf-telegram |
| `africastalkingApiKey` | Africa's Talking API key for SMS | aaf-sms |
| `africastalkingUsername` | Africa's Talking username | aaf-sms |
| `openrouterApiKey` | Per-agent OpenRouter key (overrides env default) | agent-worker |

### Category C: Agent Channel Config (Dashboard-managed, stored in D1)

**Per-agent channel configuration, encrypted at rest in `agents.channel_config`.**

| Key in `channelConfig` object | Purpose | Workers that consume it |
|---|---|---|
| `whatsappPhoneNumberId` | Meta WhatsApp phone number ID | aaf-whatsapp, gateway |
| `whatsappBusinessAccountId` | Meta WABA ID (for token management) | aaf-whatsapp |
| `africastalkingSenderId` | AT sender ID for SMS | aaf-sms |
| `channel` | Primary channel (`whatsapp`, `telegram`, `sms`) | all AAF workers |

### Category D: Agent Workflow / Business Logic (Dashboard-managed, stored in D1)

**Per-agent behaviour configuration, NOT encrypted (not sensitive).**

| Field in `agents` table | Purpose |
|---|---|
| `systemPrompt` | LLM system prompt |
| `modelProvider` | `openrouter` or `workers-ai` |
| `modelId` | Specific model name |
| `toolsEnabled` | Which tools the agent can use |
| `isActive` | Enable/disable agent |
| `channel` | Default channel |

### Category E: Cloudflare Infra (wrangler.toml bindings, not env vars)

**Not secrets. Defined in wrangler.toml per worker. Changeable only via code deploy.**

- D1 database bindings
- KV namespace bindings
- R2 bucket bindings
- Service bindings
- Durable Object bindings
- Workers AI binding

---

## 5. Current Gaps vs. Target

| What | Current State | Target State | Severity |
|---|---|---|---|
| WhatsApp access token | Single env var shared by all agents | Per-agent in `apiKeys`, encrypted in D1 | **HIGH** — blocks multi-agent |
| WhatsApp app secret | Single env var | Per-agent in `apiKeys`, encrypted in D1 | **HIGH** — each phone needs its own |
| WhatsApp verify token | Single env var | Per-agent in `apiKeys`, encrypted in D1 | **HIGH** — each webhook needs its own |
| WhatsApp phone number ID | Single env var + hard-coded map | Per-agent in `channelConfig`, auto-mapped from DB | **HIGH** — blocks multi-agent |
| Phone-agent mapping | Hard-coded TypeScript file | Queried from `agents` table `channelConfig` | **MEDIUM** — deploy needed per agent |
| Dashboard `apiKeys` UI | Does not exist | Form inputs for all per-agent credentials | **HIGH** — users can't configure |
| Dashboard `channelConfig` UI | Does not exist | Form inputs for channel settings | **MEDIUM** |
| Dashboard `Agent` type | Missing `apiKeys` and `channelConfig` | Include both fields | **HIGH** — blocks API calls |
| GET /agents/:slug | Returns `apiKeys` masked, drops `channelConfig` | Return both (keys masked) | **MEDIUM** — inconsistent |
| M-Pesa vars in wrangler.toml | Dual-source (`[vars]` + secrets) | All M-Pesa via Cloudflare Secrets only | **LOW** — works but confusing |
| Telegram/SMS in dev-local.sh | Not injected from Doppler | Add to Doppler + dev-local.sh injection | **LOW** — not actively used |
| OpenRouter key per agent | Single shared env var | Per-agent key optional (env as fallback) | **LOW** — nice to have |

---

## 6. Recommended Migration Path

### Phase 1 (no breaking changes, can deploy now)
1. Add `apiKeys` and `channelConfig` to dashboard `Agent` type in `client.ts`
2. Fix `GET /agents/:slug` to return `channelConfig` (parsed)
3. Add WhatsApp token fields to `AgentsPage.tsx` form (channel config section)
4. Add phone number ID field to `AgentsPage.tsx` form
5. Update `phone-agent-map.ts` to read from DB instead of hard-coded map
6. Add `db:seed-templates` and other missing scripts to root package.json

### Phase 2 (requires AAF worker deploy)
7. Update `aaf-whatsapp` to read `accessToken`, `appSecret`, `verifyToken` from `apiKeys` per agent instead of env vars
8. Update webhook handler to resolve `phoneNumberId → agentSlug` from DB/agents table
9. Remove `WHATSAPP_*` env vars from aaf-whatsapp wrangler.toml
10. Remove hard-coded `phone-agent-map.ts`

### Phase 3 (cleanup, no functional change)
11. Move `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, `MPESA_ENVIRONMENT` from `wrangler.toml [vars]` to Cloudflare Secrets only
12. Add Telegram and SMS workers to Doppler + dev-local.sh injection
13. Remove `OPENROUTER_BASE_URL` from `.dev.vars.example` (code never reads it)

---

## 7. Architecture Diagram (Target)

```
┌────────────────────────────────────────────────────────────────┐
│                    DOPPLER / CLOUDFLARE SECRETS                 │
│  (per-environment, never exposed, never hardcoded)              │
│                                                                  │
│  JWT_SECRET         MPESA_CONSUMER_KEY      MPESA_PASSKEY      │
│  OPENROUTER_API_KEY MPESA_CONSUMER_SECRET   MPESA_SHORTCODE     │
│  DB_ENCRYPTION_KEY  MPESA_CALLBACK_URL      MPESA_ENVIRONMENT   │
│  DOCS_BUCKET_PUBLIC_URL (optional)                              │
└────────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
    ┌─────────────────┐    ┌─────────────────────┐
    │   api-payments   │    │  llm-service         │
    │   (M-Pesa SDK)   │    │  (shared package)    │
    │   NEVER reads    │    │  NEVER reads from    │
    │   dashboard API  │    │  dashboard           │
    └─────────────────┘    └─────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│              DASHBOARD (agent-level config)                     │
│  Stored in D1 `agents` table, encrypted via DB_ENCRYPTION_KEY  │
│                                                                  │
│  ┌─────────────────────────────────────────────┐                │
│  │  Agent: Taji                                │                │
│  │                                             │                │
│  │  Workflow: systemPrompt, modelId, tools     │ ← plaintext   │
│  │  Channel: whatsappPhoneNumberId, channel    │ ← encrypted   │
│  │  Credentials: accessToken, appSecret        │ ← encrypted   │
│  └─────────────────────────────────────────────┘                │
│                                                                  │
│  AgentsPage.tsx: full form                                     │
│    - System prompt (textarea)                                   │
│    - Model (dropdown)                                           │
│    - WhatsApp access token (password input)                     │
│    - WhatsApp app secret (password input)                       │
│    - WhatsApp verify token (password input)                     │
│    - Phone number ID (text input)                               │
│    - Channel (select)                                           │
└────────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
    ┌─────────────────┐    ┌─────────────────────┐
    │   aaf-whatsapp   │    │  agent DO           │
    │   Reads per-agent │    │  Reads per-agent    │
    │   apiKeys from   │    │  apiKeys for LLM    │
    │   DB via lookup  │    │  calls              │
    └─────────────────┘    └─────────────────────┘
```

---

## 8. Key Files Involved

| File | Change Needed |
|---|---|
| `apps/web/pages/dashboard/src/api/client.ts` | Add `apiKeys` and `channelConfig` to `Agent` and `AgentCreateInput` types |
| `apps/web/pages/dashboard/src/pages/dash/AgentsPage.tsx` | Add form sections for credentials and channel config |
| `apps/api/agent/src/controllers/agents.ts` | Fix GET /:slug to return `channelConfig`; ensure masking works |
| `apps/web/aaf/whatsapp/src/config/phone-agent-map.ts` | Replace with DB-driven lookup from `agents.channelConfig` |
| `apps/web/aaf/whatsapp/src/controllers/incoming/message.ts` | Read per-agent `accessToken`, `appSecret` from DB instead of env |
| `apps/web/aaf/whatsapp/src/controllers/outgoing/send.ts` | Read per-agent `accessToken` and `phoneNumberId` from DB |
| `apps/web/aaf/whatsapp/src/types/env.ts` | Remove `WHATSAPP_*` from env type |
| `apps/web/aaf/whatsapp/wrangler.toml` | Remove `WHATSAPP_*` secrets |
| `apps/api/payments/wrangler.toml` | Move `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, `MPESA_ENVIRONMENT` to secrets only |
| `scripts/dev-local.sh` | Add Telegram and SMS worker injection |
