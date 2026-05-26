# Platform Design — One Unit, Many Agents

## The Core Idea

The platform is a **configurable agent factory**. You don't build a new platform for each product — you create a new agent configuration in the dashboard. The infrastructure stays the same.

```
Dashboard Admin Action:
  → Create agent named "Taji"
  → Set system prompt: "You help people write CVs..."
  → Enable tools: [docgen, memory, conversation_auth]
  → Set model: groq/llama-3.3-70b-versatile
  → Set channel: whatsapp
  → Set WhatsApp phone number ID
  → Save

Result: Taji is live on WhatsApp. No code deployed.
```

## Agent Configuration Model

Every agent is a row in the `agents` table with:

```
name            → "Taji" or "Elim"
slug            → "taji" or "elim"  
system_prompt   → Full instructions for the agent
tools_enabled   → ["docgen", "memory", "exam_gen"] (JSON array)
model_provider  → "groq" | "cloudflare_ai" | "openai"
model_id        → "llama-3.3-70b-versatile"
channel         → "whatsapp" | "telegram" | "sms" | "ussd"
channel_config  → { phone_number_id, verify_token, ... } (encrypted JSON)
api_keys        → encrypted JSON of all secrets for this agent
is_active       → true/false
```

## How a Message Flows

```
1. User sends WhatsApp message to Taji's number
2. WhatsApp webhook → Gateway Worker
3. Gateway identifies agent by phone number → loads agent config from KV (cached)
4. Channel Worker receives message + agent config
5. Channel Worker → loads conversation history from D1
6. Channel Worker → calls AI (Groq) with system_prompt + history + message
7. AI decides: respond / use tool (docgen / memory / search)
8. If docgen tool → Channel Worker calls DocGen Worker via binding
9. DocGen creates .docx → stores in R2 → returns download link
10. Channel Worker sends response back to user via WhatsApp API
11. Conversation saved to D1
```

## Switching "Superpowers" per Agent

| Superpower | Taji | Elim | Future |
|------------|------|------|--------|
| Document creation (CV, letter) | ✅ | ✅ (exam papers) | ✅ |
| Memory / conversation history | ✅ | ✅ | ✅ |
| Auth via conversation | ✅ | ✅ | ✅ |
| Document processing (upload) | ✅ | ✅ | ✅ |
| Transactions / payments | Roadmap | Roadmap | ✅ |
| Voice | Roadmap | Roadmap | ✅ |
| Exam generation (CBC) | ❌ | ✅ | configurable |
| Student progress tracking | ❌ | ✅ | configurable |
| Parent/institution stats | ❌ | ✅ | configurable |

## Multi-Tenancy

Each agent can serve multiple organizations (e.g., multiple schools use Elim). The `tenants` table links agents to organizations, and all data is scoped by `tenant_id`.
