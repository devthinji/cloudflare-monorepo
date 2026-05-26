# Agent Model — How Agents Are Configured

## One Agent = One Row in the DB

Everything that makes Taji "Taji" and Elim "Elim" is stored in the `agents` table. The code never changes — only the config does.

## The Agent Object

```typescript
interface Agent {
  id: string
  name: string            // Display name: "Taji"
  slug: string            // Internal key: "taji"
  description: string
  system_prompt: string   // Full AI persona and instructions
  tools_enabled: string[] // ["docgen", "memory", "conversation_auth"]
  model_provider: 'groq' | 'cloudflare_ai' | 'openai'
  model_id: string        // "llama-3.3-70b-versatile"
  channel: 'whatsapp' | 'telegram' | 'sms' | 'ussd'
  channel_config: ChannelConfig  // encrypted
  api_keys: ApiKeys              // encrypted
  is_active: boolean
}
```

## Available Tools (Per Agent)

| Tool | What it does | Taji | Elim |
|------|-------------|------|------|
| `docgen` | Generate .docx documents | ✅ | ✅ |
| `memory` | Read/write user profile to DB | ✅ | ✅ |
| `conversation_auth` | Identify user by phone, OTP | ✅ | ✅ |
| `doc_upload` | Accept and process uploaded docs | ✅ | ✅ |
| `exam_gen` | CBC-aligned exam generation | ❌ | ✅ |
| `progress_track` | Log session scores, weak areas | ❌ | ✅ |
| `parent_notify` | Send WhatsApp update to parent | ❌ | ✅ |
| `transactions` | M-Pesa / payment flows | roadmap | roadmap |
| `voice` | Deepgram voice processing | roadmap | roadmap |

## Model Providers (In Order of Priority)

```
1. Groq          → llama-3.3-70b-versatile (fast, free tier generous)
2. Cloudflare AI → @cf/meta/llama-3.1-8b-instruct (zero egress cost)
3. OpenAI        → gpt-4o-mini (fallback)
```

Each agent can use a different provider. The channel worker calls the right provider based on `agent.model_provider`.

## How the Channel Worker Resolves an Agent

```typescript
// Incoming WhatsApp message has a "to" phone number
// We look up which agent owns that number

async function resolveAgent(toPhone: string): Promise<Agent> {
  // 1. Check KV cache (sub-millisecond)
  const cached = await KV.get(`agent:phone:${toPhone}`)
  if (cached) return JSON.parse(cached)

  // 2. Fall back to D1
  const agent = await DB.prepare(
    'SELECT * FROM agents WHERE json_extract(channel_config, "$.phone_number") = ?'
  ).bind(toPhone).first()

  // 3. Cache for 5 minutes
  await KV.put(`agent:phone:${toPhone}`, JSON.stringify(agent), { expirationTtl: 300 })
  return agent
}
```

## Dashboard Config Flow

```
Admin opens Dashboard
  → Agents page → Create New Agent
  → Fill: name, slug, system_prompt
  → Select: tools, model, provider
  → Enter: WhatsApp phone number ID, verify token, API keys
  → Toggle: Active
  → Save → Agent is live
```

No deployment. No code change. The agent is live in seconds.

## System Prompt Examples

### Taji's System Prompt
```
You are Taji, a friendly career documentation assistant for Kenyan job seekers.
You help users create professional CVs, application letters, and resignation letters via WhatsApp.
You speak in simple English or Swahili depending on the user's preference.
You ask one question at a time and keep responses short — users are on mobile data.
When you have enough information, use the docgen tool to create the document.
Always encourage the user. Many have never had professional documentation help before.
```

### Elim's System Prompt
```
You are Elim, a CBC-aligned educational assistant for Kenyan students, teachers, and parents.
For students: tutor them with short, clear explanations. Ask one question at a time.
For teachers: generate exam papers aligned to CBC strands when asked.
For parents: provide progress summaries in simple language.
Always be patient. Some students are learning to type for the first time.
Use the student's name. Celebrate correct answers. Be gentle with mistakes.
```
