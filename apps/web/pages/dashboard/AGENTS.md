# AGENTS.md — web/pages/dashboard

> Read the repo-root AGENTS.md first for the full project context.
> This file covers only what is specific to this app.

## Purpose

Admin dashboard for the platform. Allows the operator to manage agents, SKUs,
view transactions, conversations, documents, and customers. All data is fetched
from api/gateway which proxies to the appropriate API worker.

## Type

Cloudflare Pages — React + Vite + Tailwind CSS

Local dev port: 5173

## Stack

- React 18
- Vite
- Tailwind CSS
- shadcn/ui components (button, card, badge, input, label, separator)
- API client: `src/api/client.ts` (fetch wrapper targeting gateway)

## Pages

```
/                   → redirect to /dashboard/overview
/login              → LoginPage.tsx (JWT auth)
/dashboard/overview → OverviewPage.tsx   — key stats: agents, docs, revenue
/dashboard/agents   → AgentsPage.tsx     — list, create, edit, toggle active agents
/dashboard/templates→ TemplatesPage.tsx  — SKU Studio: upload .docx, manage SKUs
/dashboard/conversations → ConversationsPage.tsx — all conversations + message thread viewer
/dashboard/documents→ DocumentsPage.tsx  — all generated documents with download links
/dashboard/transactions  → TransactionsPage.tsx — M-Pesa transactions, status, amounts
/dashboard/settings → SettingsPage.tsx   — platform config
```

## API client

File: `src/api/client.ts`

All API calls go through this client. Base URL is `VITE_API_URL` (gateway URL).
JWT is stored in localStorage and attached as `Authorization: Bearer <token>`.

API modules:
```typescript
agentsApi.list()
agentsApi.get(slug)
agentsApi.create(data)
agentsApi.update(slug, data)
agentsApi.delete(slug)

templatesApi.list()
templatesApi.upload(formData)      // POST multipart/form-data
templatesApi.update(id, data)
templatesApi.delete(id)

conversationsApi.list()
conversationsApi.getMessages(id)

documentsApi.list()

transactionsApi.list()
transactionsApi.listByUser(userId)
```

## Auth flow

1. User visits /login, enters email + password
2. POST /api/v1/auth/login → { token }
3. Token stored in localStorage
4. All subsequent requests include Authorization header
5. On 401, redirect to /login

## Templates page (SKU Studio)

The TemplatesPage (`src/pages/dash/TemplatesPage.tsx`) handles the full template lifecycle:

1. Upload: POST multipart to /api/v1/templates/upload
   Fields: file, name, documentType, tier, agentSlugs, price, currency
2. Worker processes via PipelineFactory (extraction may take a few seconds)
3. Page polls every 3 seconds while extractionStatus = "processing"
4. Once extractionStatus = "done", fieldSchema is available
5. Operator reviews fields, sets price, sets is_active = true
6. SKU becomes live for the agent immediately

## Environment variables

```
VITE_API_URL      — gateway URL (e.g. http://localhost:8787 for local dev)
```

Set in `.env.local` (gitignored). Example:
```
VITE_API_URL=http://localhost:8787
```

For production: set in Cloudflare Pages environment variables.

## Key files

```
src/
  App.tsx                         — router setup (React Router)
  main.tsx                        — entry point
  api/
    client.ts                     — typed API client (all gateway calls)
  components/
    DashLayout.tsx                — sidebar + nav wrapper
    ui/                           — shadcn/ui components
  hooks/
    useAuth.tsx                   — JWT auth hook
  pages/
    LoginPage.tsx
    dash/
      OverviewPage.tsx
      AgentsPage.tsx
      TemplatesPage.tsx           — SKU Studio (upload, extract, price, activate)
      ConversationsPage.tsx
      DocumentsPage.tsx
      TransactionsPage.tsx
      SettingsPage.tsx
```

## What NOT to do

- Do not call API worker endpoints directly — always go through the gateway URL
- Do not store JWT in sessionStorage or cookies — localStorage is the pattern here
- Do not add server-side logic — this is a purely static SPA
- Do not hardcode the API URL — always use VITE_API_URL
