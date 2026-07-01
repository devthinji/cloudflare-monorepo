# API-UI Handshake — Implementation Tasklist

> **Source audit:** `docs/06_audit/00_init.md` — full audit of every DB table, API route, and dashboard page
> **Created:** 2026-07-01
> **Branch:** feat/e2e
> **Milestone:** Dashboard e2e Reflection — wire the e2e trail into the admin dashboard
> **Completion:** 10 / 15 tasks (67%)

---

## Progress Tracker

```
[█████████████████████░░░░░░░░░] 67%
```

| Phase | Tasks | Done |
|-------|-------|------|
| A — Critical fixes | 2 | 2 |
| B — Messages thread view | 3 | 2 |
| C — Machine context viewer | 2 | 2 |
| D — Dashboard enhancements | 4 | 4 |
| E — Cleanup dead tables | 4 | 0 |

**Total:** 10 / 15

> **B3 skipped** — no backend support for message count/last message fields; thread panel (B2) provides equivalent value
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
- [~] **B3** — Expose messages count + last message preview in conversation list
  - **SKIPPED** — not worth N+1 queries per row; thread panel (B2) provides the value

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

- [ ] **E1** — Remove `admins` table schema + seed, or migrate auth from KV to D1 + bcrypt
  - Currently: auth uses `SESSIONS_KV` (`auth.ts:21-61`), D1 `admins` table has schema + seed but zero controllers query it
- [ ] **E2** — Remove `templates` legacy table + 7 API routes, consolidate into `skus`
  - Dashboard uses `skusApi` exclusively (`templatesApi` is just an alias)
  - Legacy `renderDoc` endpoint writes to `templates` table — migrate to SKU pipeline
- [ ] **E3** — Remove unused `contact` column on `admins` table
  - Never written (seed sets null), never read
- [ ] **E4** — Remove `templates` Drizzle schema from both gateway and docgen after E2

---

## Milestone Plan

### M1: "Dashboard e2e Reflection" (Phases A+B+C) — target: current sprint
Backend e2e works; admin should see the full trail.
```
A1 A2 B1 B2 B3 C1 C2  →  7 tasks
```

### M2: "Dashboard Parity" (Phase D) — target: next sprint
Dashboard should be fully functional for all admin operations.
```
D1 D2 D3 D4  →  4 tasks
```

### M3: "Schema Cleanup" (Phase E) — target: post-production-cut
Breaking migration. Only after first production deployment.
```
E1 E2 E3 E4  →  4 tasks
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
