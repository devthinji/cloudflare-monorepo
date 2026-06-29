# Tasklist 101 — OpenRouter + Workers AI Provider Migration

**Audit:** `docs/00_plan/00_audit-101.md`
**Target:** OpenRouter (primary) → Cloudflare Workers AI (fallback). Remove Groq.
**Sequence:** Tasks must run in order within each phase. Phases 1→2→3 are sequential.

---

## Phase 1 — Foundation (no code changes to agents yet)

### 1.1 Update provider types
**Files:** `packages/types/src/index.ts`, `apps/api/agent/src/db/schema.ts`
**Action:**
- Replace `'groq' | 'cloudflare-ai' | 'openai'` → `'openrouter' | 'workers-ai'`
- Remove `GROQ_API_KEY` from `AgentWorkerEnv` and `DocgenWorkerEnv`
- Add `OPENROUTER_API_KEY: string` to both env interfaces
- Update DB schema default from `'groq'` to `'openrouter'`

### 1.2 Create `LLMService` — OpenRouter client
**New file:** `packages/llm-service/src/index.ts`
**Action:**
- Single `call()` method accepting: `{ provider, model, messages, maxTokens, temperature, systemPrompt }`
- OpenRouter endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Support OpenAI-compatible format (OpenRouter speaks this natively)
- Typed request/response with `AiTextGenerationOutput` from `@cloudflare/workers-types`
- Provider enum: `'openrouter' | 'workers-ai'`
- Default model for OpenRouter: configurable via env/model param
- Expose as a workspace package `@repo/llm-service`

### 1.3 Create `LLMService` — Workers AI client
**File:** `packages/llm-service/src/index.ts` (same package)
**Action:**
- Workers AI binding wrapper: typed `run()` calls instead of `as any`
- Model registry with available models:
  - Text: `@cf/meta/llama-3.1-8b-instruct`
  - Vision: `@cf/llava-hf/llava-1.5-7b-hf`
- Remove all `as any` casts

### 1.4 Implement provider failover chain
**File:** `packages/llm-service/src/index.ts`
**Action:**
- `callWithFallback(messages, opts)` → tries OpenRouter first
- On failure (timeout, 4xx, 5xx): retry OpenRouter once with backoff
- On second failure: fall through to Workers AI
- On Workers AI failure: return error, don't retry further
- Configurable timeout per provider

### 1.5 Update env vars and config
**Files:** All `.dev.vars.example` files, `packages/types/src/index.ts`
**Action:**
- Replace `GROQ_API_KEY` → `OPENROUTER_API_KEY` in all `.dev.vars.example` files
- Add `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`) to examples
- Remove `GROQ_API_KEY` from wrangler.toml comment sections
- Update type interfaces for all workers

---

## Phase 2 — Agent Rewrites (replace Groq calls with LLMService)

### 2.1 Rewrite TajiAgent LLM calls
**File:** `apps/api/agent/src/agents/TajiAgent.ts`
**Action:**
- Replace `chat()` method: remove Groq fetch, use `LLMService.callWithFallback()`
- Replace `cfAI()` method: integrate into `LLMService` Workers AI client
- Update `agentConfig` interface:
  - `groqApiKey` → `openrouterApiKey` (optional, falls back to `env.OPENROUTER_API_KEY`)
  - `modelId` kept but now targets OpenRouter model selection
  - Remove hardcoded `GROQ_API` constant
- Update `initiatePayment()` — no Groq changes needed (pure logic)

### 2.2 Rewrite ElimAgent LLM calls
**File:** `apps/api/agent/src/agents/ElimAgent.ts`
**Action:**
- Replace hardcoded Groq fetch with `LLMService.callWithFallback()`
- Match TajiAgent's per-agent config pattern (use `agentConfig`)
- Remove hardcoded `GROQ_API` constant
- Remove hardcoded `ELIM_PROMPT` — source from DB agent config

### 2.3 Remove `lib/groq.ts`
**File:** `apps/api/agent/src/lib/groq.ts`
**Action:**
- Delete file entirely
- Check for any remaining imports and remove them

### 2.4 Rewrite docgen pipeline AI calls
**Files:**
- `apps/api/docgen/src/pipeline/extractor.ts`
- `apps/api/docgen/src/pipeline/converters/docx-to-markdown.ts`
- `apps/api/docgen/src/pipeline/converters/docx-to-schema.ts`
- `apps/api/docgen/src/pipeline/converters/pdf-to-schema.ts`
- `apps/api/docgen/src/pipeline/converters/vision-to-schema.ts`
**Action:**
- Replace all Groq `fetch()` calls with `LLMService.call()`
- Vision converter: keep Workers AI vision call, route schema inference through `LLMService`
- Remove `GROQ_API_KEY` parameter passing — use `OPENROUTER_API_KEY` from env
- Each function accepts `env` and uses `LLMService.callWithFallback()` internally

### 2.5 Wire LLMService into ConversationMachine
**File:** `apps/api/gateway/src/machine/machine.ts`
**Action:**
- Add `LLMService` to `MachineServices` interface
- Use for lightweight AI tasks: intent classification, entity extraction
- Leave heavy document processing in Agent DOs
- Add `ai` field to machine context for per-request provider config

---

## Phase 3 — Cleanup & Verification

### 3.1 Remove Groq from all docs
**Files:** `docs/agents/agent-model.md`, `docs/architecture/platform.md`, `docs/database/schema.md`, `docs/architecture/overview.md`
**Action:**
- Replace provider priority: Groq → OpenRouter
- Update string values: `cloudflare_ai` → `workers-ai` (hyphen consistency)
- Update all model ID references

### 3.2 Update Agent SDK config
**Files:** `apps/api/agent/package.json`, `apps/api/agent/src/index.ts`
**Action:**
- Pin `agents` and `hono-agents` to compatible versions
- Confirm `routeAgentRequest` pattern is correct for v0.0.97
- Remove dead `hono-agents` import if unused

### 3.3 Update .dev.vars and .dev.vars.example files
**Files:** All `.dev.vars` and `.dev.vars.example` across all workers
**Action:**
- `GROQ_API_KEY` → `OPENROUTER_API_KEY` in all files
- Remove stale Groq comments
- Add `OPENROUTER_BASE_URL` if applicable

### 3.4 Run full type-check and build
**Action:**
- `pnpm install` (verify no stale Groq deps)
- `pnpm run type-check` (all 11 packages pass)
- `pnpm run build` (all 6 build tasks pass)
- Ensure no remaining Groq references in compiled output

---

## Dependency Graph

```
1.1 Provider types ───┐
1.2 OpenRouter client ─┤
1.3 Workers AI client ─┤──→ 2.1 TajiAgent ──→ 2.3 Remove groq.ts ──→ 3.1 Docs
1.4 Failover chain  ──┘    2.2 ElimAgent                             3.2 SDK config
1.5 Env vars ─────────     2.4 Docgen pipeline                       3.3 .dev.vars
                            2.5 ConversationMachine                   3.4 Verify
```
