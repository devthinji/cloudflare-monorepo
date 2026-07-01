# AGENTS.md — web/pages/dashboard

> Read the repo-root AGENTS.md first for full project context.
> This file covers only what is specific to this app.

## Purpose

Admin dashboard. Manages agents, SKUs, customers, conversations, documents,
transactions, and platform settings. All data via api/gateway (JWT-protected).

## Type / local port

Cloudflare Pages — React 18 + Vite + Tailwind CSS — port 5173

## Pages

```
/login                    — LoginPage.tsx
/dashboard/overview       — OverviewPage.tsx       key stats
/dashboard/agents         — AgentsPage.tsx          agent CRUD + toggle active
/dashboard/templates      — TemplatesPage.tsx       SKU Studio: upload, extract, price, activate
/dashboard/conversations  — ConversationsPage.tsx   all sessions + message thread view
/dashboard/documents      — DocumentsPage.tsx       generated docs + download links
/dashboard/transactions   — TransactionsPage.tsx    M-Pesa transactions + status
/dashboard/settings       — SettingsPage.tsx
```

## API client

File: `src/api/client.ts`

Base URL: `VITE_API_URL` env variable (gateway URL).
Auth: JWT in localStorage attached as `Authorization: Bearer <token>`.

Modules:
```typescript
agentsApi.list()
agentsApi.get(slug)
agentsApi.create(data)
agentsApi.update(slug, data)
agentsApi.delete(slug)

conversationsApi.list()
conversationsApi.getMessages(id)

documentsApi.list()

transactionsApi.list()
transactionsApi.listByUser(userId)
```

## SKU Studio (TemplatesPage)

1. Upload .docx → POST multipart to /api/v1/templates/upload
2. Poll every 3 seconds while extractionStatus = "processing"
3. When extractionStatus = "done": show extracted field_schema for review
4. Operator sets price + toggles is_active = true
5. SKU is immediately live to agents — no code deploy

## Auth flow

1. POST /api/v1/auth/login → { token }
2. Store in localStorage
3. Attach as Authorization header on all requests
4. On 401 → redirect to /login

## Environment variables

```
VITE_API_URL    — gateway base URL
                  local: http://localhost:8787
                  prod:  set in Cloudflare Pages settings
```

Set in `.env.local` (gitignored):
```
VITE_API_URL=http://localhost:8787
```

## Key files

```
src/
  App.tsx
  main.tsx
  api/client.ts                       — all API calls (never call workers directly)
  components/
    DashLayout.tsx                    — sidebar + nav
    ui/                               — shadcn/ui components
  hooks/useAuth.tsx
  pages/
    LoginPage.tsx
    dash/
      OverviewPage.tsx
      AgentsPage.tsx
      TemplatesPage.tsx               — SKU Studio
      ConversationsPage.tsx
      DocumentsPage.tsx
      TransactionsPage.tsx
      SettingsPage.tsx
```

## Rules

- Never call API workers directly — always go through VITE_API_URL (gateway)
- JWT in localStorage only — not sessionStorage or cookies
- Pure static SPA — no server-side logic
- Never hardcode API URL — always VITE_API_URL
