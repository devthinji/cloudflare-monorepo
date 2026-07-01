# Tasklist 101 — OpenRouter + Workers AI Provider Migration


> *Status: COMPLETE as of 2026-06-30* — All phases implemented. `@repo/llm-service` ships OpenRouter primary → Workers AI fallback. Groq fully removed.

**Audit:** `docs/04_design/audit-101.md`
**Target:** OpenRouter (primary) → Cloudflare Workers AI (fallback). Remove Groq.
**Sequence:** Tasks must run in order within each phase. Phases 1→2→3 are sequential.

## Phase 1 — Foundation (no code changes to agents yet)

### 1.1 Update provider types
**Files:** `packages/types/src/index.ts`, `apps/api/agent/src/db/schema.ts`
Replace `'groq' | 'cloudflare-ai' | 'openai'` → `'openrouter' | 'workers-ai'`. Remove `GROQ_API_KEY` from env interfaces. Add `OPENROUTER_API_KEY`. Update DB schema default to `'openrouter'`.

### 1.2 Create `LLMService` — OpenRouter client
**New file:** `packages/llm-service/src/index.ts`
Single `call()` method. OpenRouter endpoint: `https://openrouter.ai/api/v1/chat/completions`. Support OpenAI-compatible format. Expose as `@repo/llm-service`.

### 1.3 Create `LLMService` — Workers AI client
**File:** `packages/llm-service/src/index.ts` (same package)
Workers AI binding wrapper: typed `run()` calls. Model registry for text (`@cf/meta/llama-3.1-8b-instruct`) and vision (`@cf/llava-hf/llava-1.5-7b-hf`). Remove all `as any` casts.

### 1.4 Implement provider failover chain
**File:** `packages/llm-service/src/index.ts`
`callWithFallback(messages, opts)` → tries OpenRouter first, retries once with backoff, falls through to Workers AI.

### 1.5 Update env vars and config
Replace `GROQ_API_KEY` → `OPENROUTER_API_KEY` in all `.dev.vars.example` files. Add `OPENROUTER_BASE_URL`. Remove `GROQ_API_KEY` from wrangler.toml.

## Phase 2 — Agent Rewrites

### 2.1 Rewrite TajiAgent LLM calls
Replace Groq fetch with `LLMService.callWithFallback()`. Update `agentConfig`: `groqApiKey` → `openrouterApiKey`.

### 2.2 Rewrite ElimAgent LLM calls
Replace Groq fetch with `LLMService.callWithFallback()`. Match TajiAgent's config pattern. Remove hardcoded `ELIM_PROMPT` — source from DB.

### 2.3 Remove `lib/groq.ts`
Delete file entirely. Remove all imports.

### 2.4 Rewrite docgen pipeline AI calls
Replace all Groq `fetch()` calls in extractor.ts and all converters with `LLMService.call()`.

### 2.5 Wire LLMService into ConversationMachine
Add `LLMService` to `MachineServices`. Use for lightweight AI tasks: intent classification, entity extraction.

## Phase 3 — Cleanup & Verification

### 3.1 Remove Groq from all docs
Replace provider priority in all docs. Update string values: `cloudflare_ai` → `workers-ai`.

### 3.2 Update Agent SDK config
Pin `agents` and `hono-agents` to compatible versions. Remove dead imports.

### 3.3 Update .dev.vars files
`GROQ_API_KEY` → `OPENROUTER_API_KEY` in all files.

### 3.4 Run full type-check and build
`pnpm install`, `pnpm run type-check`, `pnpm run build`. Ensure no remaining Groq references.

## Dependency Graph

```
1.1 Provider types ───┐
1.2 OpenRouter client ─┤
1.3 Workers AI client ─┤──→ 2.1 TajiAgent ──→ 2.3 Remove groq.ts ──→ 3.1 Docs
1.4 Failover chain  ──┘    2.2 ElimAgent                             3.2 SDK config
1.5 Env vars ─────────     2.4 Docgen pipeline                       3.3 .dev.vars
                            2.5 ConversationMachine                   3.4 Verify
```
