# Platform Design — One Unit, Many Agents

## The Core Idea

The platform is a **configurable agent factory**. You don't build a new platform for each product — you create a new agent configuration in the dashboard. The infrastructure stays the same.

```
Dashboard Admin Action:
  → Create agent named "Taji"
  → Set system prompt: "You help people write CVs..."
  → Enable tools: [docgen, memory, conversation_auth]
  → Set model: openai/gpt-4o-mini (via OpenRouter)
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
model_provider  → "openrouter" | "workers-ai"
model_id        → "openai/gpt-4o-mini"
channel         → "whatsapp" | "telegram" | "sms" | "ussd"
channel_config  → { phone_number_id, verify_token, ... } (encrypted JSON)
api_keys        → encrypted JSON of all secrets for this agent
is_active       → true/false
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
