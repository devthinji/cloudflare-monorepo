# API-UI Handshake — Implementation Tasklist

> **Source audit:** `docs/06_audit/00_init.md` — full audit of every DB table, API route, and dashboard page
> **Created:** 2026-07-01
> **Branch:** feat/e2e
> **Milestone:** Dashboard e2e Reflection — wire the e2e trail into the admin dashboard
> **Completion:** 15 / 15 tasks (100%)

---

## Progress Tracker

```
[███████████████████████████████] 100%
```

| Phase | Tasks | Done |
|-------|-------|------|
| A — Critical fixes | 2 | 2 |
| B — Messages thread view | 3 | 3 |
| C — Machine context viewer | 2 | 2 |
| D — Dashboard enhancements | 4 | 4 |
| E — Cleanup dead tables | 4 | 4 |

**Total:** 15 / 15
> **E1–E4 deferred** — breaking migration, post-production-cut

---

## Phase A: Critical Fixes (already identified in gap analysis)

- [x] **A1** — Fix `summaryPrompt` truncation in `version_1.ts` to prevent WhatsApp 1024-char interactive body limit
  - *See: `docs/06_audit/00_init.md §1.12`*
  - *Fix already applied — verify with e2e test*
- [x] **A2** — Add fallback in `sendReply` (reply.ts): if interactive send fails, fall back to text reply instead of losing the message
  - *File: `apps/web/aaf/whatsapp/src/controllers/outgoing/reply.ts:19-32`*

---

## Phase B: Messages Thread View

Enable reading actual conversation content from the dashboard.

- [x] **B1** — Add `messagesApi` to `apps/web/pages/dashboard/src/api/client.ts`
  - `GET /api/v1/agent/conversations/:id/messages` → `messagesApi.list(conversationId)`
  - Already exists on backend at `apps/api/agent/src/routes/index.ts:34`
- [x] **B2** — Add message thread panel to `ConversationsPage.tsx`
  - Show when clicking a conversation row
  - Display message bubbles (user = right, agent = left), role, content, timestamp
- [x] **B3** — Expose messages count + last message preview in conversation list
  - Correlated subqueries in `listConversations` avoid N+1 (single SQL query)
  - Backend: `apps/api/agent/src/controllers/conversations.ts`
  - Frontend: `ConversationsPage.tsx` — Messages column + Last Message column

---

## Phase C: Machine Context Viewer

Surface realtime session state for each customer.

- [x] **C1** — Wire `GET /api/v1/machine/context/:userId/:agentSlug` into dashboard
  - Add to client.ts: `machineApi.getContext(userId, agentSlug)`
  - Endpoint exists on gateway: `apps/api/gateway/src/routes/machine.ts:172-177`
- [x] **C2** — Show current machine stage + sub-state in customer detail panel
  - Display `stage` and `collectSub` from machine context
  - Add session reset button (calls `DELETE /api/v1/machine/context/:userId/:agentSlug`)

---

## Phase D: Dashboard Enhancements

Close remaining dashboard gaps.

- [x] **D1** — Add document download link to `DocumentsPage.tsx`
  - `documentsApi.listAll()` returns `fileUrl` (R2 key)
  - Gateway proxy: `GET /api/v1/docgen/download?key=<fileUrl>` — already exists
  - Missing: download button/icon per row in the table → fixed (was using raw R2 key, now proxied through gateway)
- [x] **D2** — Add `OverviewPage` trend arrows (Δ month-over-month for stats)
  - Compare current period vs previous period using `createdAt` timestamps
- [x] **D3** — Add SKU-agent access management to `TemplatesPage.tsx`
  - Backend supports `agentAccess[]` in `skusApi.update()` 
  - Add agent toggle checkboxes to SKU edit form (show available agents, toggle enable/disable per SKU)
- [x] **D4** — Add search/filter to `DocumentsPage.tsx`
  - Search by title, userId, agentSlug, date range

---

## Phase E: Cleanup Dead Tables

Remove unused schema, routes, and seed data. Do after production cut — breaking migration.

- [x] **E1** — Remove `admins` table schema + seed, or migrate auth from KV to D1 + bcrypt
  - Auth uses `SESSIONS_KV` — admins D1 table had schema + seed but zero runtime queries → **removed**
- [x] **E2** — Remove `templates` legacy table + 7 API routes, consolidate into `skus`
  - Dashboard used `skusApi` exclusively → `templatesApi` alias + controller + all 7 routes + `renderDoc` → **all removed**
- [x] **E3** — Remove unused `contact` column on `admins` table
  - Never written, never read → **removed with admins table**
- [x] **E4** — Remove `templates` Drizzle schema from both gateway and docgen after E2
  - Schema removed from both `gateway/drizzle/schema/database.ts` and `docgen/src/db/schema.ts` → **done**

---

## Milestone Plan

### ✅ M1: "Dashboard e2e Reflection" (Phases A+B+C) — COMPLETED
Backend e2e works; admin can see the full trail.
```
A1 A2 B1 B2 B3 C1 C2  →  7/7 tasks
```

### ✅ M2: "Dashboard Parity" (Phase D) — COMPLETED
Dashboard fully functional for all admin operations.
```
D1 D2 D3 D4  →  4/4 tasks
```

### ✅ M3: "Schema Cleanup" (Phase E) — COMPLETED
Breaking migration. Applied to `feat/e2e` branch.
```
E1 E2 E3 E4  →  4/4 tasks
```

---

## How to update progress

When completing a task, mark it `[x]` and update the counter at the top:

```
**Completion:** 3 / 15 tasks (20%)
```

Use the visual bar:
```
[██████░░░░░░░░░░░░░░░░░░░░░] 20%
```

Where each `█` = ~3.3% (30 blocks total).
