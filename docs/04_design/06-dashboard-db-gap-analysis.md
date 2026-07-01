# Dashboard ↔ Database Gap Analysis

> Recorded: 2026-07-01
> Branch: feat/e2e
> Context: backend e2e confirmed working; this audit documents mismatches between
> the dashboard UI, the API client contract, and what the database/R2 actually stores.

---

## Summary

7 gaps identified. 2 are critical (broken at runtime). 3 are missing endpoints.
2 are lower priority.

| # | Severity | Area | Gap |
|---|----------|------|-----|
| 1 | Critical | Schema | `skus` table defined twice — inline in controller and in gateway schema |
| 2 | Critical | API | `listAllDocs` returns raw `fieldValues` JSON string, not parsed object |
| 3 | Missing  | API | No `listAll` transactions endpoint for admin Transactions page |
| 4 | Missing  | API | No stats/activity endpoint — OverviewPage uses hardcoded mock data |
| 5 | Missing  | API | SettingsPage save button does nothing — no secrets CRUD endpoint |
| 6 | Minor    | Contract | `Document.templateUsed` field doesn't exist in DB (DB has `templateId`) |
| 7 | Refactor | Schema | `templates` and `skus` are two separate tables that need consolidation |

---

## Issue 1 — CRITICAL: Duplicate `skus` table definition

**File:** `apps/api/docgen/src/controllers/skus.ts`

The controller defines its own `sqliteTable('skus', ...)` and
`sqliteTable('sku_agent_access', ...)` inline instead of importing from the
canonical gateway schema at `apps/api/gateway/drizzle/schema/database.ts`.

Both definitions are currently in sync, but there is no enforcement. Any schema
change to one will silently diverge from the other.

**Fix:** Move `skus` and `sku_agent_access` out of the controller and into the
docgen schema file (`apps/api/docgen/src/db/schema.ts`), then import from there.
Remove the inline definitions from the controller entirely.

---

## Issue 2 — CRITICAL: `listAllDocs` returns unparsed `fieldValues`

**File:** `apps/api/docgen/src/controllers/documents.ts`

```ts
// listUserDocs — correct
return c.json(ok(rows.map(r => ({ ...r, fieldValues: r.fieldValues ? JSON.parse(r.fieldValues) : null }))))

// listAllDocs — broken
const rows = await db.select().from(documents).orderBy(desc(documents.createdAt)).limit(100)
return c.json(ok(rows))   // fieldValues is a raw JSON string here
```

The DocumentsPage calls `listAllDocs` and will receive `fieldValues` as a string.
Any UI component that tries to read it as an object will either error or render `[object Object]`.

**Fix:** Apply the same `JSON.parse` map to `listAllDocs` as `listUserDocs` uses.

---

## Issue 3 — MISSING: No admin-level `listAll` transactions endpoint

**File:** `apps/api/payments/src/controllers/transactions.ts`

The payments worker only exposes:
```
GET /api/v1/payments/transactions/:userId
```

The dashboard `TransactionsPage` needs all transactions across all users for the
admin view. It currently renders hardcoded mock data as a placeholder.

**Fix:** Add `listAllTransactions` controller and register
`GET /api/v1/payments/transactions` (no userId param) in the payments router.
The gateway already proxies `/api/v1/payments/*` so no gateway change is needed.

Also required: wire `TransactionsPage` to `transactionsApi.listAll()` — the API
client does not yet have a `transactionsApi` export at all.

---

## Issue 4 — MISSING: OverviewPage is fully hardcoded

**File:** `apps/web/pages/dashboard/src/pages/dash/OverviewPage.tsx`

All 6 stat cards and the recent activity table are static values. There is no API
call in this component.

No stats or activity endpoint exists on any worker.

**Fix:** Add a `GET /api/v1/agent/stats` endpoint that queries:
- active agent count
- total customer count
- total document count (from docgen)
- recent activity log (last N conversation events)

Alternatively, compose the stats client-side from existing endpoints
(`listCustomers`, `listAllDocs`, `listAgents`) and aggregate on the frontend.
The latter requires no new backend work and is the faster path.

---

## Issue 5 — MISSING: SettingsPage has no backend

**File:** `apps/web/pages/dashboard/src/pages/dash/SettingsPage.tsx`

```ts
function handleSave(e: React.FormEvent) {
  e.preventDefault()
  setSaved(true)               // local state only
  setTimeout(() => setSaved(false), 2500)
  // no fetch, no API call
}
```

There is no settings CRUD endpoint on any worker. The fields map to Cloudflare
Worker secrets (WhatsApp token, M-Pesa keys, JWT secret, etc.) which are managed
via Doppler/wrangler, not via a database table.

**Fix options:**

Option A (recommended): Remove SettingsPage from the live dashboard and replace
it with a static read-only display of which secrets are configured (present/absent)
using a `GET /api/v1/agent/config/status` endpoint that returns booleans, not values.

Option B: Persist settings as an encrypted `platform_config` D1 row and provide
CRUD endpoints. More work but enables dashboard-driven secret rotation.

---

## Issue 6 — MINOR: `Document.templateUsed` field does not exist in DB

**File:** `apps/web/pages/dashboard/src/api/client.ts`

```ts
export interface Document {
  templateUsed?: string   // ← this field
  ...
}
```

The `documents` D1 table has `templateId` (the SKU id) but not `templateUsed`
(a human-readable name). The DocumentsPage renders this field and it will always
be `undefined`.

**Fix:** Either rename the UI field to `templateId` and display the raw id, or
join the SKU name server-side in `listAllDocs` and return it as `templateName`.

---

## Issue 7 — REFACTOR: `templates` and `skus` are two separate tables

The docgen worker has two separate DB-backed systems:

- `templates` table (`apps/api/docgen/src/db/schema.ts`) — original design with
  `extractionStatus`, `r2Key`, `agentSlugs`, `tier`, `previewUrl` columns.
  Still has live CRUD routes at `/api/v1/templates/*`.

- `skus` table (defined inline in `skus.ts`, mirrored in gateway migration) —
  newer design with `fileKey`, `sku_agent_access` junction table, `conversationSteps`,
  `requiresReview`, `version` columns.

The machine and the dashboard both use the `skus` table. The `templates` table
is written to only by the legacy `renderDoc` endpoint.

**Fix (post-e2e):** Migrate `templates` → `skus`, remove the legacy
`/api/v1/templates/*` routes, and consolidate to a single product schema.
This is a breaking migration so do it after the first production cut.

---

## What is working correctly

- Agents CRUD: `listAgents`, `getAgent`, `createAgent`, `updateAgent`, `deleteAgent` — all wired end-to-end
- SKU Studio: upload → extraction → review → publish flow — fully wired
- SKU list + get + update + delete — all working
- Customers list + get + patch — fully wired
- Conversations + messages list — fully wired
- Documents `listUserDocs` (by userId) — working and parses `fieldValues` correctly
- Documents download via R2 key — working
- Agents toggle active/inactive — working
