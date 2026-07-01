# Database Schema

Single D1 database: `platform-db`

Migration: `apps/api/gateway/drizzle/migration/0000_init.sql`
Drizzle schema: `apps/api/gateway/drizzle/schema/database.ts`

All IDs are ULIDs (sortable, URL-safe). All timestamps are ISO 8601 TEXT.

## Tables

### agents

One row = one deployed agent.

| Column          | Type    | Notes                                    |
|-----------------|---------|------------------------------------------|
| id              | TEXT PK | ULID                                     |
| name            | TEXT    | "Taji"                                   |
| slug            | TEXT UQ | "taji"                                   |
| description     | TEXT    |                                          |
| system_prompt   | TEXT    | Full AI persona                          |
| tools_enabled   | TEXT    | JSON string[]                            |
| model_provider  | TEXT    | "openrouter" or "workers-ai"             |
| model_id        | TEXT    | "openai/gpt-4o-mini"                     |
| channel         | TEXT    | "whatsapp"                               |
| channel_config  | TEXT    | encrypted JSON                           |
| api_keys        | TEXT    | encrypted JSON                           |
| is_active       | INTEGER | 1 = active                               |

### customers

Anyone who has sent a WhatsApp message to any agent.

| Column        | Type    | Notes                                      |
|---------------|---------|--------------------------------------------|
| id            | TEXT PK |                                            |
| name          | TEXT    | Collected during auth stage                |
| phone         | TEXT    | +254XXXXXXXXX format                       |
| channel       | TEXT    | "whatsapp"                                 |
| agent_slug    | TEXT    | Which agent this customer talks to          |
| is_registered | INTEGER | 1 = name collected, auth complete          |
| is_blocked    | INTEGER | 1 = blocked from service                   |
| metadata      | TEXT    | JSON: any extra customer data              |

### admins

Dashboard admin users with login credentials.

| Column     | Type    | Notes                                      |
|------------|---------|--------------------------------------------|
| id         | TEXT PK | ULID                                       |
| name       | TEXT    | Full name                                  |
| email      | TEXT    | Login email (unique)                       |
| phone      | TEXT    | Contact phone                              |
| role       | TEXT    | "admin" or "superadmin"                    |
| hash       | TEXT    | bcrypt password hash                       |
| contacts   | TEXT    | JSON: extra contact info                   |
| is_active  | INTEGER | 1 = active                                 |
| created_at | TEXT    | ISO 8601                                   |
| updated_at | TEXT    | ISO 8601                                   |

### conversations

One session = one row. Status closes after farewell.

| Column    | Type    | Notes                          |
|-----------|---------|--------------------------------|
| id        | TEXT PK |                                |
| user_id   | TEXT    |                                |
| agent_slug| TEXT    |                                |
| channel   | TEXT    |                                |
| status    | TEXT    | "active" or "closed"           |
| context   | TEXT    | JSON: machine context snapshot |

### messages

Every turn in every conversation.

| Column          | Type    | Notes               |
|-----------------|---------|---------------------|
| id              | TEXT PK |                     |
| conversation_id | TEXT    |                     |
| role            | TEXT    | "user" or "assistant"|
| content         | TEXT    |                     |
| tool_call       | TEXT    | JSON if tool used   |
| tokens_used     | INTEGER |                     |

### skus

Every sellable document product. Drives the ConversationMachine.
Agent access is managed via the `sku_agent_access` junction table — `agent_slug` is NOT a direct column.

| Column             | Type    | Notes                                     |
|--------------------|---------|-------------------------------------------|
| id                 | TEXT PK |                                           |
| name               | TEXT    | "Professional CV"                         |
| slug               | TEXT UQ | "professional-cv"                         |
| description        | TEXT    |                                           |
| template_type      | TEXT    | "docx"                                    |
| file_key           | TEXT    | R2 object key for the .docx template      |
| preview_key        | TEXT    | R2 key for preview image                  |
| markdown_preview   | TEXT    | Readable text version                     |
| price              | REAL    | KES. Test: 1–3. Production: via dashboard |
| currency           | TEXT    | "KES"                                     |
| field_schema       | TEXT    | JSON: FieldSchema[] — stored as string, parsed on read |
| conversation_steps | TEXT    | JSON: ConversationStep[] — stored as string, parsed on read |
| is_active          | INTEGER | 0/1 (boolean mode in Drizzle)             |
| requires_review    | INTEGER | 1 = admin must approve after AI extraction|
| version            | INTEGER | incremented on field_schema update        |

### sku_agent_access

Junction table linking SKUs to agents. One row per (sku, agent) pair.

| Column     | Type    | Notes                     |
|------------|---------|---------------------------|
| id         | TEXT PK |                           |
| sku_id     | TEXT    | FK → skus.id              |
| agent_slug | TEXT    | "taji" or "elim"          |
| enabled    | INTEGER | 1 = this agent can sell it|
| created_at | TEXT    |                           |
| updated_at | TEXT    |                           |

### templates (legacy)

Older template records. Superseded by skus. Do not use for new features.

### documents

Every document ever generated.

| Column        | Type    | Notes                          |
|---------------|---------|--------------------------------|
| id            | TEXT PK |                                |
| user_id       | TEXT    |                                |
| agent_slug    | TEXT    |                                |
| template_id   | TEXT    | SKU id used                    |
| type          | TEXT    | "cv", "cover_letter", etc.     |
| title         | TEXT    |                                |
| file_url      | TEXT    | R2 object key (not a public URL) — use download endpoint |
| field_values  | TEXT    | JSON: collected user data      |
| transaction_id| TEXT    | Linked payment                 |

### transactions

One M-Pesa STK push = one row.

| Column               | Type    | Notes                           |
|----------------------|---------|---------------------------------|
| id                   | TEXT PK |                                 |
| user_id              | TEXT    |                                 |
| agent_slug           | TEXT    |                                 |
| provider             | TEXT    | "mpesa"                         |
| amount               | REAL    | KES                             |
| status               | TEXT    | pending / completed / failed    |
| checkout_request_id  | TEXT    | Daraja reference                |
| mpesa_receipt_number | TEXT    | Set on callback                 |
| phone_number         | TEXT    | +254XXXXXXXXX                   |

## Drizzle usage

Read:
```typescript
import { db } from './db'
import { skus } from '../drizzle/schema/database'
import { eq } from 'drizzle-orm'

const sku = await db.select().from(skus).where(eq(skus.slug, 'professional-cv')).get()
```

Create:
```typescript
await db.insert(skus).values({ id: generateId(), slug: 'new-sku', ... })
```

Never write raw SQL in TypeScript files. Migrations only in .sql files.
