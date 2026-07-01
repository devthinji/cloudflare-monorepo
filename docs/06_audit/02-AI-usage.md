# Audit 02: AI/LLM Usage Across the Codebase

> Recorded: 2026-07-01
> Branch: feat/e2e
> Context: Comprehensive audit of every AI/LLM call — provider, model, instructions, error handling, testability, monitoring.

---

## 1. Core AI Service Layer

**File:** `packages/llm-service/src/index.ts`

This is the single shared abstraction used by all workers. All AI calls in the codebase go through this package — there are zero direct API calls to any LLM provider outside of it.

### 1a. `callOpenRouter()` (lines 42-76)

| Property | Value |
|---|---|
| **Provider** | OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) |
| **Auth** | `env.OPENROUTER_API_KEY` (required secret) |
| **Default model** | `openai/gpt-4o-mini` (line 32) |
| **Request format** | Standard OpenAI chat completions JSON |
| **Retries** | None internally; handled by `callWithFallback()` |
| **Error behavior** | Throws on non-OK response or parse failure |

### 1b. `callWorkersAi()` (lines 80-97)

| Property | Value |
|---|---|
| **Provider** | Cloudflare Workers AI (binding `env.AI`) |
| **Default model** | `@cf/meta/llama-3.1-8b-instruct` (line 34) |
| **Request format** | Workers AI SDK `env.AI.run(model, input)` |
| **Retries** | None |
| **Error behavior** | Throws on failure |
| **Note** | Uses `(env.AI as any).run()` — TypeScript cast bypass |

### 1c. `callWithFallback()` (lines 128-137)

**The primary entry point for user-facing AI.** Two-tier fallback:

```
Tier 1: OpenRouter (1 retry, exponential backoff, 1s base)
Tier 2: Workers AI (@cf/meta/llama-3.1-8b-instruct, no retries)
```

Used by: chat, route classification.

### 1d. `call()` (lines 116-126)

Direct call with NO fallback. Used by document pipeline (field inference, markdown conversion, descriptions) where deterministic output is preferred over fallback to a weaker model.

---

## 2. All AI Call Sites

### Site 1: Agent Chat — `apps/api/agent/src/services/AgentWorker.ts:263-272`

| | |
|---|---|
| **Function** | `chat()` |
| **Provider** | OpenRouter → Workers AI (fallback) via `callWithFallback()` |
| **Model** | `agent.modelId` from DB row, defaults to `openai/gpt-4o-mini` |
| **System prompt** | `agent.systemPrompt` from DB row (per-agent, stored in `agents` table) |
| **Seed prompts** | **Taji:** "You are Taji, a professional career document assistant. You help users create CVs, application letters, and resignation letters. Be warm, professional, and encouraging. Always collect all required fields before generating a document." **Elim:** "You are Elim, a friendly CBC education assistant for Kenyan students. You help with exam preparation, concept explanations, and practice questions. Always encourage students and explain things clearly in simple language." |
| **Max tokens** | 768 |
| **Temperature** | 0.7 |
| **Messages** | system prompt + last 20 history + current user message |
| **What AI does** | Conversational chat with end user via WhatsApp. Responds to questions, guides document creation flow. |
| **Error handling** | Generic "Sorry, I am unable to respond right now." |
| **Testability** | Hard to unit-test — requires env bindings. Can integration-test with recorded conversation flows. |

### Site 2: Route Classification — `apps/api/agent/src/controllers/config.ts:83-91`

| | |
|---|---|
| **Function** | `reasonAboutRoute()` |
| **Provider** | OpenRouter → Workers AI (fallback) via `callWithFallback()` |
| **Model** | `agent.modelId` from DB, defaults to `openai/gpt-4o-mini` |
| **System prompt** | `"You classify HTTP requests for a Cloudflare Agents API worker. Reply with JSON only: {'intent':'agent_do'|'chat'|'crud'|'health'|'unknown','target':'<handler>','confidence':0-1}"` |
| **Max tokens** | 128 |
| **Temperature** | 0 (deterministic) |
| **What AI does** | Classifies ambiguous API paths into route intents. Heavily constrained output (JSON only, 3 fields). Used when the agent controller can't match a route by convention. |
| **Error handling** | Returns `{ intent: 'unknown', confidence: 0 }` on failure |
| **Testability** | Good — deterministic (temperature 0), JSON-only output, low max tokens. Can test with known inputs. |

### Site 3: Field Schema Inference — `apps/api/docgen/src/pipeline/extractor.ts:76-81`

| | |
|---|---|
| **Function** | `inferFieldSchema()` |
| **Provider** | OpenRouter via `call()` (NO fallback) |
| **Model** | Hardcoded `openai/gpt-4o-mini` |
| **System prompt** | ~600-char multi-paragraph instructing AI to act as "document template analyst". Specifies: JSON output schema, field types (text, textarea, number, phone, email, date, choice, repeatable, image_url), ordering rules (name fields first, content fields last), WhatsApp-specific guidance. |
| **Max tokens** | 2048 |
| **Temperature** | 0.2 |
| **What AI does** | Given placeholder keys extracted from a .docx template, infers the best field schema (labels, types, hints, ordering) for collecting user data via WhatsApp. This is the critical AI step in the SKU upload pipeline. |
| **Error handling** | Returns empty array `[]` on failure |
| **Testability** | Medium — JSON output, low temperature, but the prompt is complex. Needs known template inputs to verify schema quality. |

### Site 4: Visual Description — `apps/api/docgen/src/pipeline/extractor.ts:114-119`

| | |
|---|---|
| **Function** | `generateVisualDescription()` |
| **Provider** | OpenRouter via `call()` (NO fallback) |
| **Model** | Hardcoded `openai/gpt-4o-mini` |
| **System prompt** | `"You are a document designer. Based on the raw extracted content... write a short description (2-3 sentences) of what this document looks like, its purpose, and what it would be used for. Focus on the document's professional value."` |
| **Max tokens** | 256 |
| **Temperature** | 0.3 |
| **What AI does** | Generates a professional description of a document template. Stored as `description` on SKU records, shown in the dashboard SKU list. |
| **Error handling** | Returns `"A professional {documentType} template."` |
| **Testability** | Good — short output, low temperature, easy to verify. |

### Site 5: Docx-to-Markdown — `apps/api/docgen/src/pipeline/converters/docx-to-markdown.ts:16-24`

| | |
|---|---|
| **Function** | `docxToMarkdown()` |
| **Provider** | OpenRouter via `call()` (NO fallback) |
| **Model** | Hardcoded `openai/gpt-4o-mini` |
| **System prompt** | `"Convert the following raw text extracted from a '...' docx template into clean, readable markdown. Preserve headings, lists, and structure. Replace {placeholder} values with [PLACEHOLDER_NAME] in brackets."` |
| **Max tokens** | 1024 |
| **Temperature** | 0.1 |
| **What AI does** | Converts raw docx XML text to clean markdown for SKU preview in the dashboard. Pure extraction/transformation task. |
| **Error handling** | Falls back to raw stripped text |
| **Testability** | High — temperature 0.1, structured input/output, easy to verify markdown quality. |

### Site 6: Vision-to-Schema — `apps/api/docgen/src/pipeline/converters/vision-to-schema.ts:23-27`

| | |
|---|---|
| **Function** | `visionToSchema()` |
| **Provider** | Workers AI (direct `env.AI` binding, NO fallback) |
| **Model** | `@cf/llava-hf/llava-1.5-7b-hf` |
| **System prompt** | `"This is a '...' template called '...'. List every text field or placeholder you can see that a user would need to fill in. For each field, give: the field name (snake_case), what it represents, and whether it is required. Return as JSON array: [{key, description, required}]"` |
| **Max tokens** | 1024 |
| **Temperature** | Not set (default) |
| **What AI does** | Computer vision on uploaded image templates (Canva exports, screenshots) to identify text fields. Results are then passed to `inferFieldSchema()` for structured schema generation. **Requires human review** (`requires_review = 1`). |
| **Error handling** | Returns `{ error: 'Vision extraction failed: ...' }` |
| **Testability** | Low — vision model quality varies, output quality depends on image clarity. Human review is mandatory. |

---

## 3. AI Configuration (DB Schema)

Defined in `apps/api/gateway/drizzle/schema/database.ts` — `agents` table:

| Column | Type | Default | Editable via Dashboard |
|---|---|---|---|
| `system_prompt` | `text NOT NULL` | (required) | ✅ Yes |
| `model_provider` | `text NOT NULL` | `'openrouter'` | ✅ Yes |
| `model_id` | `text NOT NULL` | `'openai/gpt-4o-mini'` | ✅ Yes |

Available models in dashboard (`AgentsPage.tsx:7-12`):

| Provider | Model ID | Use Case |
|---|---|---|
| `openrouter` | `openai/gpt-4o-mini` | Default — fast, cheap, good for chat |
| `openrouter` | `openai/gpt-4o` | Premium — better quality, slower |
| `openrouter` | `anthropic/claude-3.5-haiku` | Alternative — fast, competitive pricing |
| `workers-ai` | `@cf/meta/llama-3.1-8b-instruct` | Free tier — lower quality, no API key needed |

---

## 4. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  @repo/llm-service (shared package)              │
│                                                                  │
│  call(req) ──────────► OpenRouter (primary)                     │
│  callWithFallback(req) ──► OpenRouter (1 retry)                 │
│                              └─► Workers AI (fallback, 0 retry) │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┼──────────────┐
         ▼             ▼              ▼
   ┌──────────┐ ┌──────────┐ ┌──────────────┐
   │ Agent    │ │ Agent    │ │ Docgen       │
   │ Chat     │ │ Route    │ │ Pipeline     │
   │(Agent-   │ │ Classify │ │ (extractor,  │
   │ Worker)  │ │(config)  │ │ converters)  │
   └──────────┘ └──────────┘ └──────────────┘
                                     │
                          ┌──────────┼──────────┐
                          ▼          ▼          ▼
                   ┌──────────┐ ┌────────┐ ┌──────────┐
                   │ Field    │ │Markdown│ │ Vision   │
                   │ Schema   │ │ Convert│ │ to Schema│
                   │(Open-    │ │(Open-  │ │(Workers  │
                   │ Router)  │ │Router) │ │ AI)      │
                   └──────────┘ └────────┘ └──────────┘

Non-AI workers (zero LLM calls):
  api/gateway, api/payments, aaf/whatsapp, aaf/telegram, aaf/sms,
  dashboard, site
```

---

## 5. Performance Testing

### 5.1 What to Measure

| Metric | Where | How |
|---|---|---|
| **Response time (p50/p95/p99)** | All sites | Log `duration` in each caller. Workers don't have built-in percentile metrics — use structured logs + external observability |
| **Token usage (input/output)** | All sites | OpenRouter returns usage in response. Workers AI does not. Log `input_tokens` + `output_tokens` from OpenRouter responses |
| **Failure rate** | All sites | Count errors / total calls. Log on each error path |
| **Fallback rate** | Chat, route classify | Count how often Workers AI is hit vs OpenRouter |
| **Cost per call** | OpenRouter sites | `output_tokens * model_price_per_token`. Not currently tracked |
| **Schema quality** | Field inference | Human review required (`requires_review` flag). Track how often fields need manual editing |
| **Vision accuracy** | Vision-to-schema | Track how often image-based SKUs need human field correction |

### 5.2 Current Observability Gaps

- No token usage logged anywhere
- No response time tracked
- No cost tracking
- No per-agent or per-SKU breakdown of AI usage
- Workers AI calls provide zero telemetry (no token counts, no model versioning)

### 5.3 Testing Approach

| Call Site | Unit Test | Integration Test | E2E Test |
|---|---|---|---|
| Chat (AgentWorker) | Mock `callWithFallback` to return canned responses | Start worker, POST chat messages | Full WhatsApp → gateway → agent loop |
| Route classification | Provide known inputs, assert JSON output | Start agent worker, POST to ambiguous paths | (implicit in full flow) |
| Field schema inference | Provide known placeholder sets, assert schema structure | Start docgen, POST a .docx upload | Upload template via dashboard, verify fields |
| Visual description | Provide known text, assert 2-3 sentence output | (tested with field inference) | (implicit in SKU upload) |
| Markdown conversion | Provide known docx text, assert markdown output | Start docgen, verify markdownPreview | (implicit in SKU upload) |
| Vision to schema | Hard — needs real image inputs | Start docgen, POST image upload | Upload Canva export via dashboard |

### 5.4 Recommended Monitoring

1. **Add token logging** to `packages/llm-service/src/index.ts` — log `input_tokens`, `output_tokens`, `duration_ms`, `model`, `provider` on every response
2. **Tag by call site** — add a `call_site` field (e.g. `agent_chat`, `field_inference`, `markdown_convert`) to every log entry
3. **Alert on failure rate** — if OpenRouter failure rate > 5% in any 5-minute window, alert
4. **Track fallback ratio** — Workers AI is free but lower quality. If fallback rate > 10%, OpenRouter may be degraded
5. **Log cost** — derive from token counts × model pricing

---

## 6. Error Handling Summary

| Call Site | Failure Behavior | Silent? | Degraded UX? |
|---|---|---|---|
| Agent chat | Returns generic apology | No | Yes — user sees "unable to respond" |
| Route classification | Returns `{ intent: 'unknown' }` | Yes | Minimal — routes fall through to 404 |
| Field schema inference | Returns empty array `[]` | Yes | Yes — SKU has no defined fields |
| Visual description | Returns fallback text | Yes | Minimal — generic description shown |
| Markdown conversion | Falls back to raw text | Yes | Minimal — ugly but functional preview |
| Vision to schema | Returns error object | No | Yes — upload fails, user must retry |

**Critical gap:** Field schema inference failing silently (empty array) means a SKU can be created with no fields. The dashboard shows it, users can select it, but no fields are collected and rendering produces an empty document. This should either fail the upload or require non-empty schema validation.

---

## 7. Security & Secrets

| Secret | Stored In | Accessed By | Risk |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Doppler, `.dev.vars` | api-agent, api-docgen | **High** — key leaked = anyone can make paid OpenRouter calls on your account |
| Workers AI binding | `env.AI` (injected by Cloudflare) | api-agent, api-docgen | **Low** — no key to leak, pay-as-you-go via Cloudflare account |

**No API keys are hardcoded in the codebase.** All secrets flow through Doppler → `.dev.vars` → `env.*`. ✅

---

## 8. Data Flow: What Data Reaches AI Providers

| Call Site | Data Sent to AI Provider | Contains PII? |
|---|---|---|
| Agent chat | Full user messages + conversation history | **Yes** — phone numbers, names, job history |
| Route classification | HTTP request path + method | No |
| Field schema inference | Placeholder names from .docx templates | Usually no (generic field names) |
| Visual description | Template placeholder keys + document type | Usually no |
| Markdown conversion | Raw docx text content | Potentially — if template contains sample names/data |
| Vision to schema | Uploaded image bytes | **Yes** — image may contain personal info |

**Note:** All PII-bearing calls go through OpenRouter with configurable data retention. Workers AI is Cloudflare-hosted (data stays within Cloudflare).

---

## 9. Recommendations

### Short-term (no code changes)
1. Add telemetry logging to `packages/llm-service` (token counts, duration, call site)
2. Add non-empty field schema validation in `uploadSKU` after AI inference
3. Document which agents use which models in the dashboard

### Medium-term
4. Add per-agent token usage dashboard widget
5. Add cost tracking + budget alerts per agent
6. Implement model A/B testing — route % of traffic to a different model per agent
7. Add structured output validation on field_schema AI responses (TypeScript runtime checks)

### Long-term
8. Consider self-hosted model (Workers AI with larger model) for cost predictability
9. Add automated regression test suite: known template → expected field schema
10. Evaluate prompt quality — audit each system prompt for clarity, specificity, and guardrails
