# Audit 03: Secrets, Keys & Variables — Categorization & Control

> Recorded: 2026-07-01
> Branch: feat/e2e
> Context: Full audit of every environment variable, secret, binding, and per-agent configuration — classify for a three-silo model: Cloudflare Secrets, D1+Dashboard, wrangler.toml. **Doppler eliminated.**

---

## 1. The Three-Silo Model

```
┌──────────────────────────────────────────────────────────────────┐
│  SILO 1: CLOUDFLARE SECRETS (wrangler secret put)               │
│  Runtime secrets injected into Workers. Never in code,           │
│  never in dashboard. Set per environment during deploy/CI.       │
│                                                                  │
│  JWT_SECRET | MPESA_* | OPENROUTER_API_KEY | DB_ENCRYPTION_KEY  │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  SILO 2: D1 + DASHBOARD (agents table)                          │
│  Per-agent configuration. Encrypted at rest via DB_ENCRYPTION_KEY│
│  for sensitive fields (apiKeys, channelConfig). Read by Workers  │
│  at runtime via D1 queries.                                      │
│                                                                  │
│  systemPrompt | modelId | whatsappAccessToken | phoneNumberId    │
│  apiKeys.{whatsappAccessToken, whatsappAppSecret, ...}           │
│  channelConfig.{whatsappPhoneNumberId, africastalkingSenderId}   │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  SILO 3: WRANGLER.TOML [vars] + BINDINGS                        │
│  Non-sensitive environment vars baked at build time.             │
│  Bindings (D1, KV, R2, DO, services) fixed in wrangler.toml.    │
│                                                                  │
│  ENVIRONMENT | LOG_LEVEL | D1/KV/R2/DO/service bindings         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete Classification

### 2.1 Silo 1: Cloudflare Secrets

Set via `wrangler secret put <NAME>`. One value per environment (dev/staging/prod). Never committed, never in dashboard UI. These are the only "secrets" in the traditional sense.

| Secret | Worker(s) | Purpose |
|---|---|---|
| `JWT_SECRET` | gateway, agent | Sign & verify admin dashboard JWT tokens |
| `OPENROUTER_API_KEY` | agent, docgen | Access OpenRouter LLM API |
| `DB_ENCRYPTION_KEY` | agent | AES-256-GCM key for encrypting `agents.api_keys` and `agents.channel_config` at rest |
| `MPESA_CONSUMER_KEY` | payments | Daraja OAuth consumer key |
| `MPESA_CONSUMER_SECRET` | payments | Daraja OAuth consumer secret |
| `MPESA_PASSKEY` | payments | Daraja STK push password/Lipa Na M-Pesa passkey |
| `MPESA_SHORTCODE` | payments | Business shortcode (e.g. 174379) |
| `MPESA_CALLBACK_URL` | payments | Where Safaricom sends STK callbacks |
| `MPESA_ENVIRONMENT` | payments | `sandbox` or `production` |

**All 9 are Cloudflare Secrets** — none in wrangler.toml `[vars]`.

### 2.2 Silo 2: D1 + Dashboard (agents table)

Per-agent config stored in the `agents` D1 table. The `apiKeys` and `channelConfig` columns are encrypted with `DB_ENCRYPTION_KEY` (AES-256-GCM). All other columns are plaintext.

#### Agent Credentials (stored in `agents.api_keys`, encrypted)

| Key in `apiKeys` JSON | Purpose | Consumers |
|---|---|---|
| `whatsappAccessToken` | Meta WhatsApp permanent access token for this agent's phone | aaf-whatsapp |
| `whatsappAppSecret` | Meta app secret — verify webhook `X-Hub-Signature-256` per agent | aaf-whatsapp |
| `whatsappVerifyToken` | Webhook verification token — Meta challenge handshake per agent | aaf-whatsapp |
| `telegramBotToken` | Telegram bot token for this agent | aaf-telegram |
| `telegramWebhookSecret` | Telegram webhook secret | aaf-telegram |
| `africastalkingApiKey` | Africa's Talking API key for SMS channel | aaf-sms |
| `africastalkingUsername` | Africa's Talking username | aaf-sms |

#### Agent Channel Config (stored in `agents.channel_config`, encrypted)

| Key in `channelConfig` JSON | Purpose | Consumers |
|---|---|---|
| `whatsappPhoneNumberId` | Meta phone number ID — identifies the sender | aaf-whatsapp |
| `whatsappBusinessAccountId` | Meta WABA ID | aaf-whatsapp |
| `africastalkingSenderId` | AT sender ID for SMS | aaf-sms |

#### Agent Workflow Config (plaintext columns)

| Column | Purpose |
|---|---|
| `system_prompt` | LLM system prompt — agent personality + instructions |
| `model_provider` | `openrouter` or `workers-ai` |
| `model_id` | Specific model name (e.g. `meta-llama/llama-3.1-8b-instruct:free`) |
| `tools_enabled` | JSON array of tool names the agent can use |
| `channel` | `whatsapp` / `telegram` / `sms` |
| `description` | Human-readable agent description for dashboard |
| `is_active` | Enable/disable agent without deleting |
| `slug` | Unique identifier used in routing (e.g. `taji`, `elim`) |

### 2.3 Silo 3: wrangler.toml (vars + bindings)

These are part of the worker build — defined in `wrangler.toml`, changeable only via code deploy.

#### wrangler.toml `[vars]`

| Var | Default | Workers | Purpose |
|---|---|---|---|
| `ENVIRONMENT` | `development` | all | `development` or `production` — controls logging, dev fallbacks |
| `LOG_LEVEL` | `info` | all | `debug`, `info`, `warn`, `error` |

**No other vars should be in wrangler.toml.** All M-Pesa vars move to Cloudflare Secrets.

#### Cloudflare Bindings (wrangler.toml, per worker)

| Binding Type | Names | Workers | Set Once? |
|---|---|---|---|
| `[[d1_databases]]` | `DB` (platform-db) | gateway, agent, docgen, payments | ✅ Yes — database name fixed |
| `[[kv_namespaces]]` | `SESSIONS_KV`, `AGENT_KV`, `PAYMENTS_KV`, `AAF_KV` | respective | ✅ Yes — KV namespace IDs fixed |
| `[[r2_buckets]]` | `DOCS_BUCKET` (platform-docs) | agent, docgen | ✅ Yes — bucket name fixed |
| `[ai]` | `AI` | agent, docgen | ✅ Yes — Workers AI binding |
| `[[durable_objects.bindings]]` | `AGENT_DO` (AgentWorker) | agent | ✅ Yes — class name fixed |
| `[[services]]` | `AGENT_WORKER`, `DOCGEN_WORKER`, `PAYMENTS_WORKER`, `API_GATEWAY` | respective | ✅ Yes — service names fixed |

### 2.4 Dev-Only (not deployed)

| Variable | Where | Purpose |
|---|---|---|
| `VITE_API_URL` | `.env.local` (dashboard) | Points to local gateway: `http://localhost:8787` |
| `.dev.vars` files | per-worker directory | Local env vars for `wrangler dev` (gitignored) |

---

## 3. All 34 Variables — Classified

| # | Variable | Current Source | New Source | Silo |
|---|---|---|---|---|
| 1 | `JWT_SECRET` | Doppler | Cloudflare Secret | **Silo 1** |
| 2 | `OPENROUTER_API_KEY` | Doppler | Cloudflare Secret | **Silo 1** |
| 3 | `DB_ENCRYPTION_KEY` | Doppler | Cloudflare Secret | **Silo 1** |
| 4 | `MPESA_CONSUMER_KEY` | Doppler | Cloudflare Secret | **Silo 1** |
| 5 | `MPESA_CONSUMER_SECRET` | Doppler | Cloudflare Secret | **Silo 1** |
| 6 | `MPESA_PASSKEY` | Doppler | Cloudflare Secret | **Silo 1** |
| 7 | `MPESA_SHORTCODE` | Cloudflare Secret ✅ | Cloudflare Secret only | **Silo 1** |
| 8 | `MPESA_CALLBACK_URL` | Cloudflare Secret ✅ | Cloudflare Secret only | **Silo 1** |
| 9 | `MPESA_ENVIRONMENT` | Cloudflare Secret ✅ | Cloudflare Secret only | **Silo 1** |
| 10 | `WHATSAPP_ACCESS_TOKEN` | Doppler | D1 `agents.api_keys.whatsappAccessToken` | **Silo 2** |
| 11 | `WHATSAPP_APP_SECRET` | Doppler | D1 `agents.api_keys.whatsappAppSecret` | **Silo 2** |
| 12 | `WHATSAPP_VERIFY_TOKEN` | Doppler | D1 `agents.api_keys.whatsappVerifyToken` | **Silo 2** |
| 13 | `WHATSAPP_PHONE_NUMBER_ID` | Doppler | D1 `agents.channelConfig.whatsappPhoneNumberId` | **Silo 2** |
| 14 | `TELEGRAM_BOT_TOKEN` | Doppler (not injected) | D1 `agents.apiKeys.telegramBotToken` | **Silo 2** |
| 15 | `TELEGRAM_WEBHOOK_SECRET` | Manual .dev.vars | D1 `agents.apiKeys.telegramWebhookSecret` | **Silo 2** |
| 16 | `AFRICASTALKING_API_KEY` | Manual .dev.vars | D1 `agents.apiKeys.africastalkingApiKey` | **Silo 2** |
| 17 | `AFRICASTALKING_USERNAME` | Manual .dev.vars | D1 `agents.apiKeys.africastalkingUsername` | **Silo 2** |
| 18 | `AFRICASTALKING_SENDER_ID` | Manual .dev.vars | D1 `agents.channelConfig.africastalkingSenderId` | **Silo 2** |
| 19 | `DOCS_BUCKET_PUBLIC_URL` | Undocumented | wrangler.toml `[vars]` | **Silo 3** |
| 20 | `ENVIRONMENT` | wrangler.toml `[vars]` | wrangler.toml `[vars]` | **Silo 3** |
| 21 | `LOG_LEVEL` | wrangler.toml `[vars]` | wrangler.toml `[vars]` | **Silo 3** |
| 22–34 | Bindings (D1, KV, R2, DO, services, AI) | wrangler.toml | wrangler.toml | **Silo 3** |

---

## 4. Current Problems

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

### Problem 4: AAF worker env vars should be agent-sourced from D1

Currently WhatsApp tokens are Cloudflare Secrets shared across all agents. For multi-agent support, each agent's channel config should come from D1 at runtime:
- `phoneNumberId` → already exists in `channelConfig`
- `accessToken` → needs to be added to `apiKeys`
- `appSecret` → needed per-agent for webhook signature verification
- `verifyToken` → needed per-agent for webhook setup

### ~~Problem 5: M-Pesa variables are split across wrangler.toml and secrets~~ ✅ Resolved

`MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, and `MPESA_ENVIRONMENT` were defined as both `wrangler.toml [vars]` (with placeholder defaults) AND expected as secrets in `.dev.vars.example`. This dual-source pattern was confusing — the wrangler.toml defaults would be baked into the build, while secrets override at runtime. **Fixed:** removed from `wrangler.toml [vars]`, now all six M-Pesa config values are Cloudflare Secrets only.

### Problem 6: Doppler is an unnecessary middleman

Doppler adds a third source of truth for secrets without benefit — Cloudflare Workers already have `wrangler secret put`, and D1 stores per-agent config. Removing Doppler:
- Eliminates a CLI dependency (`doppler run`)
- Removes a sync point (secrets can change in Doppler without being deployed)
- Simplifies local dev (`.dev.vars` is the single file per worker)
- Makes CI/CD directly `wrangler secret put` — no Doppler API calls

---

## 5. Current Gaps vs. Target

| What | Current State | Target State | Severity |
|---|---|---|---|
| WhatsApp access token | Single Cloudflare Secret shared by all agents | Per-agent in `apiKeys`, encrypted in D1 | **HIGH** — blocks multi-agent |
| WhatsApp app secret | Single Cloudflare Secret | Per-agent in `apiKeys`, encrypted in D1 | **HIGH** — each phone needs its own |
| WhatsApp verify token | Single Cloudflare Secret | Per-agent in `apiKeys`, encrypted in D1 | **HIGH** — each webhook needs its own |
| WhatsApp phone number ID | Single Cloudflare Secret + hard-coded map | Per-agent in `channelConfig`, auto-mapped from DB | **HIGH** — blocks multi-agent |
| Phone-agent mapping | Hard-coded TypeScript file | Queried from `agents` table `channelConfig` | **MEDIUM** — deploy needed per agent |
| Dashboard `apiKeys` UI | Does not exist | Form inputs for all per-agent credentials | **HIGH** — users can't configure |
| Dashboard `channelConfig` UI | Does not exist | Form inputs for channel settings | **MEDIUM** |
| Dashboard `Agent` type | Missing `apiKeys` and `channelConfig` | Include both fields | **HIGH** — blocks API calls |
| GET /agents/:slug | Returns `apiKeys` masked, drops `channelConfig` | Return both (keys masked) | **MEDIUM** — inconsistent |
| ~~M-Pesa vars in wrangler.toml~~ | ~~Dual-source (`[vars]` + secrets)~~ | All M-Pesa via Cloudflare Secrets only ✅ | **LOW** — resolved |
| Telegram/SMS | Manual .dev.vars only | Seeded via dashboard D1 + `.dev.vars.example` | **LOW** — not actively used |
| OpenRouter key per agent | Single shared Cloudflare Secret | Per-agent key optional (env as fallback) | **LOW** — nice to have |
| Doppler | Active dependency | **Eliminated** — no longer used | **MEDIUM** — complexity |

---

## 6. Migration Path — 3 Phases + CI/CD

### Phase 0: Eliminate Doppler & Unify Secreat Flow (do first)

This must happen before CI/CD because it consolidates the secrets source of truth.

1. **Remove Doppler CLI from dev workflow**
   - Delete Doppler setup instruction from AGENTS.md ("prerequisites" section)
   - Remove `doppler secrets download` from `scripts/dev-local.sh`
   - Add `.dev.vars.example` files per worker with placeholder values
   - Create `scripts/setup-dev.sh` that copies `.dev.vars.example` → `.dev.vars` for each worker
   - Add `.dev.vars` to each worker's `.gitignore` (already done for most)

2. **Remove Doppler from package.json / CI references**
   - Check for `doppler` in any `turbo.json`, `package.json`, or GitHub workflow file
   - Replace with `wrangler secret put` in CI scripts

### Phase 1 (no breaking changes, can deploy now)
3. Add `apiKeys` and `channelConfig` to dashboard `Agent` type in `client.ts`
4. Fix `GET /agents/:slug` to return `channelConfig` (parsed)
5. Add WhatsApp token fields to `AgentsPage.tsx` form (channel config section)
6. Add phone number ID field to `AgentsPage.tsx` form
7. Update `phone-agent-map.ts` to read from DB instead of hard-coded map
8. Add `db:seed-templates` and other missing scripts to root package.json

### Phase 2 (requires AAF worker deploy)
9. Update `aaf-whatsapp` to read `accessToken`, `appSecret`, `verifyToken` from `apiKeys` per agent instead of env vars
10. Update webhook handler to resolve `phoneNumberId → agentSlug` from DB/agents table
11. Remove `WHATSAPP_*` env vars from aaf-whatsapp wrangler.toml
12. Remove hard-coded `phone-agent-map.ts`
### Phase 3 (cleanup, no functional change) ✅ Complete

13. ✅ Move `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, `MPESA_ENVIRONMENT` from `wrangler.toml [vars]` to Cloudflare Secrets only
14. ✅ Remove `OPENROUTER_BASE_URL` from `.dev.vars.example` (code never reads it)
15. ✅ Clean up `scripts/dev-local.sh` — no more Doppler injection, use `.dev.vars` files

---

## 7. CI/CD Secrets Flow

Each environment gets its own set of Cloudflare Secrets. The worker code is identical across environments — only secrets differ.

### Per-Environment Cloudflare Secrets

| Secret | Dev (wrangler dev) | Staging | Production |
|---|---|---|---|
| `JWT_SECRET` | `.dev.vars` | `wrangler secret put` | `wrangler secret put` |
| `OPENROUTER_API_KEY` | `.dev.vars` | `wrangler secret put` | `wrangler secret put` |
| `DB_ENCRYPTION_KEY` | `.dev.vars` | `wrangler secret put` | `wrangler secret put` |
| `MPESA_CONSUMER_KEY` | `.dev.vars` | `wrangler secret put` (sandbox) | `wrangler secret put` (prod) |
| `MPESA_CONSUMER_SECRET` | `.dev.vars` | `wrangler secret put` (sandbox) | `wrangler secret put` (prod) |
| `MPESA_PASSKEY` | `.dev.vars` | `wrangler secret put` (sandbox) | `wrangler secret put` (prod) |
| `MPESA_SHORTCODE` | `.dev.vars` | `wrangler secret put` (sandbox) | `wrangler secret put` (prod) |
| `MPESA_CALLBACK_URL` | `.dev.vars` (ngrok) | `wrangler secret put` (staging URL) | `wrangler secret put` (prod URL) |
| `MPESA_ENVIRONMENT` | `.dev.vars` | `wrangler secret put` sandbox | `wrangler secret put` production |

### What goes in `.dev.vars` (local dev only)

```env
# infra secrets (same shape as Cloudflare Secrets in prod)
JWT_SECRET=dev-secret-key-not-for-production
OPENROUTER_API_KEY=sk-or-v1-...
DB_ENCRYPTION_KEY=dev-encryption-key-32-bytes-long!!
MPESA_CONSUMER_KEY=dev-key
MPESA_CONSUMER_SECRET=dev-secret
MPESA_PASSKEY=dev-passkey
MPESA_SHORTCODE=174379
MPESA_CALLBACK_URL=https://abc123.ngrok-free.app/webhooks/mpesa
MPESA_ENVIRONMENT=sandbox
```

### How CI/CD sets secrets

```yaml
# GitHub Actions (conceptual)
deploy:
  steps:
    - run: pnpm install && pnpm run build
    - run: npx wrangler deploy --env staging
    - run: npx wrangler secret put JWT_SECRET         --env staging
    - run: npx wrangler secret put OPENROUTER_API_KEY --env staging
    - run: npx wrangler secret put DB_ENCRYPTION_KEY  --env staging
    # ... M-Pesa secrets ...
```

Secrets values come from GitHub Actions secrets, not Doppler. Set once in the GitHub repo settings for each environment.

### D1 + Dashboard (no CI needed for agent config)

Agent configuration is set via the dashboard UI and stored in D1. This means:
- **Adding a new agent** = dashboard form, no deploy
- **Changing WhatsApp token** = dashboard form, no deploy
- **No CI secret management needed** for agent-level config

The only exception: the `DB_ENCRYPTION_KEY` Cloudflare Secret must be set before any agent with encrypted `apiKeys`/`channelConfig` can operate.

---

## 8. Architecture Diagram (Target — No Doppler)

```
┌──────────────────────────────────────────────────────────────────┐
│  SILO 1: CLOUDFLARE SECRETS (wrangler secret put)                │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  Gateway   │  Agent    │  Docgen   │  Payments       │       │
│  │  JWT_SECRET│  DB_ENC   │  OPENR    │  MPESA_*        │       │
│  │            │  _KEY     │  _API_KEY │  (9 vars)       │       │
│  └──────────────────────────────────────────────────────┘       │
│         │           │            │           │                   │
└─────────┼───────────┼────────────┼───────────┼───────────────────┘
          │           │            │           │
          ▼           ▼            ▼           ▼
┌──────────────────────────────────────────────────────────────────┐
│  SILO 2: D1 + DASHBOARD (agents table)                          │
│                                                                   │
│  ┌─────────────────────────────────────────────┐                 │
│  │  Agent: Taji                                │                 │
│  │  ─────────────────────                      │                 │
│  │  Workflow (plaintext):                       │                 │
│  │    systemPrompt, modelId, tools, isActive    │                 │
│  │                                             │                 │
│  │  apiKeys (encrypted):                        │                 │
│  │    whatsappAccessToken, appSecret,           │                 │
│  │    verifyToken, telegramBotToken, ...        │                 │
│  │                                             │                 │
│  │  channelConfig (encrypted):                  │                 │
│  │    phoneNumberId, africaStalkingSenderId     │                 │
│  └─────────────────────────────────────────────┘                 │
│                                                                   │
│  Consumers read via D1 at runtime:                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │ whatsapp │  │ telegram │  │ agent DO │                       │
│  │ worker   │  │ worker   │  │ (LLM)    │                       │
│  └──────────┘  └──────────┘  └──────────┘                       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  SILO 3: WRANGLER.TOML [vars] + BINDINGS                        │
│  ENVIRONMENT=development | LOG_LEVEL=info | D1/KV/R2/DO/services │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9. Key Files Involved

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
| `apps/api/payments/wrangler.toml` | Move `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, `MPESA_ENVIRONMENT` to secrets only ✅ |
| `scripts/dev-local.sh` | Remove Doppler injection — workers read from `.dev.vars` |
| `scripts/setup-dev.sh` | **New** — copies `.dev.vars.example` → `.dev.vars` per worker |
| `.github/workflows/deploy.yml` | **New** — `wrangler secret put` for CI/CD (future) |
| `AGENTS.md` | Update prerequisites: remove Doppler, add `.dev.vars` setup |
