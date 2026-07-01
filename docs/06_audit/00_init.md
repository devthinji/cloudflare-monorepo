# Audit 00: API-UI Handshake & Table Usage

> Recorded: 2026-07-01
> Branch: feat/e2e
> Context: Full audit of every DB table, API route, and dashboard page
> to find stale code and missing data collection wiring.

---

## 1. API-UI Handshake Status

### 1.1 Agents — FULLY WIRED
- agentsApi.list/get/create/update → AGENT_WORKER → D1 `agents` ✅
- AgentsPage: CRUD + toggle active ✅
- OverviewPage: active count ✅

### 1.2 Customers — FULLY WIRED
- customersApi.list/get/patch → AGENT_WORKER → D1 `customers` ✅
- ConversationsPage (Users tab): list, search, block/unblock, detail view ✅
- OverviewPage: total count ✅
- Machine flow: writes via registerUser service ✅

### 1.3 Conversations — PARTIAL
- conversationsApi.list(userId) → AGENT_WORKER → D1 `conversations` ✅
- ConversationsPage (Conversations tab): lists all, filterable ✅
- **Missing: no message thread view** — clicking a conversation does nothing

### 1.4 Messages — ENDPOINT EXISTS, NO UI
- `GET /api/v1/agent/conversations/:id/messages` exists in agent worker ✅
- **No `messagesApi` in dashboard client.ts** ❌
- **No message thread UI anywhere** — can't read actual conversations ❌

### 1.5 SKUs — FULLY WIRED
- skusApi: upload, list, get, update, publish, unpublish, delete → DOCGEN_WORKER ✅
- TemplatesPage: full SKU Studio pipeline ✅
- Machine flow: listSKUs + loadSKU via DOCGEN_WORKER service binding ✅

### 1.6 sku_agent_access — PARTIAL
- Backend: uploadSKU creates row, updateSKU accepts agentAccess[] array ✅
- Client: `skusApi.update()` accepts `agentAccess` param ✅
- **TemplatesPage never sends agentAccess** — SKU-agent assignment not manageable from UI ❌

### 1.7 Documents — FULLY WIRED
- documentsApi.listAll() → DOCGEN_WORKER → D1 `documents` ✅
- DocumentsPage: lists all docs ✅
- OverviewPage: count + recent docs listing ✅
- Issue 2 from gap analysis: **fixed** — listAllDocs now parses fieldValues and joins templateName ✅

### 1.8 Transactions — FULLY WIRED
- transactionsApi.listAll() → PAYMENTS_WORKER → D1 `transactions` ✅
- TransactionsPage: full table, search, filter, refresh ✅
- OverviewPage: revenue calculation ✅
- Issue 3 from gap analysis: **fixed** — listAllTransactions endpoint exists ✅

### 1.9 OverviewPage — FULLY WIRED
- Aggregates from agentsApi, customersApi, documentsApi, transactionsApi ✅
- Issue 4 from gap analysis: **fixed** — no longer hardcoded ✅

### 1.10 Auth — FUNCTIONAL, WRONG STORAGE
- Login/register via KV (SESSIONS_KV), JWT-issued ✅
- LoginPage works ✅
- **admins D1 table is completely unused** ❌

### 1.11 SettingsPage — READ-ONLY DOCS (by design)
- No backend secrets CRUD (by design — secrets via Doppler) ✅
- SettingsPage renders documentation of required secrets ✅

### 1.12 ConversationMachine — FULLY WIRED
- POST /api/v1/machine/advance → 5-stage blueprint → service bindings ✅
- GET/DELETE /context/:userId/:agentSlug for state inspection ✅
- Interactive message hints, document delivery, M-Pesa flow all wired ✅

---

## 2. Table Usage Audit

| Table | Schema | Controller | Routes | Client API | Dashboard UI | Status |
|-------|--------|-----------|--------|-----------|--------------|--------|
| agents | ✅ gateway + agent | ✅ agents.ts | ✅ 5 routes | ✅ list/get/create/update | ✅ AgentsPage | **Active** |
| admins | ✅ gateway only | ❌ **none** | ❌ **none** | ❌ **none** | ❌ **none** | **DEAD** |
| customers | ✅ gateway + agent | ✅ customers.ts | ✅ 4 routes | ✅ list/get/patch | ✅ ConversationsPage | **Active** |
| conversations | ✅ gateway + agent | ✅ conversations.ts | ✅ 1 route | ✅ list(userId) | ✅ ConversationsPage | **Active** |
| messages | ✅ gateway + agent | ✅ conversations.ts | ✅ 1 route | ❌ **none** | ❌ **none** | **UI Gap** |
| skus | ✅ gateway + docgen | ✅ skus.ts | ✅ 5 routes | ✅ full CRUD | ✅ TemplatesPage | **Active** |
| sku_agent_access | ✅ gateway + docgen | ✅ in skus.ts | via PATCH skus/:id | ✅ in update() param | ❌ **never sent** | **UI Gap** |
| templates (legacy) | ✅ gateway + docgen | ✅ templates.ts | ✅ 7 routes | ❌ alias only | ❌ uses skusApi | **DEAD** |
| documents | ✅ gateway + docgen | ✅ documents.ts | ✅ 2 routes | ✅ list/listAll | ✅ DocumentsPage | **Active** |
| transactions | ✅ gateway + payments | ✅ mpesa/transactions/webhooks | ✅ 3+ routes | ✅ listAll/listUser | ✅ TransactionsPage | **Active** |
| contact (admins col) | ✅ nullable | ❌ | ❌ | ❌ | ❌ | **DEAD column** |

### Dead Items (remove or revive)

1. **admins table** — Schema defined, seed data inserted, but ZERO controllers query it. Auth uses KV (`SESSIONS_KV`). Either migrate auth to D1 + bcrypt, or drop the table + seed.
2. **templates table (legacy)** — 7 API routes still active at `/api/v1/templates/*`, but dashboard client aliases `templatesApi = skusApi`. The machine uses the `skus` table exclusively. Templates are written to by `renderDoc` (legacy endpoint) and standard CRUD, but nothing reads them for business logic.
3. **contact column on admins** — Never written (seed sets null), never read. Schema has both `contact` singular and some references to `contacts` (unrelated WhatsApp context).

### UI Gaps to Close for e2e Dashboard Reflection

1. **Message thread view** — `GET /api/v1/agent/conversations/:id/messages` exists but no dashboard UI calls it. Add a messagesApi + thread panel when clicking a conversation.
2. **SKU-agent access management** — Backend handles it, the client supports it in the type signature, but TemplatesPage never sends `agentAccess` in update calls. Add a "linked agents" UI to TemplatesPage.
3. **Document download from dashboard** — Need to verify DocumentsPage has a working download link (or add one).

---

## 3. Data Collection Wiring Needed

For the e2e flow to fully reflect in the dashboard:

### What's already collecting data:
- WhatsApp messages → machine advance → conversations + messages tables ✅
- Auth/naming → customers table ✅
- SKU selection + field collection → MachineContext.collectedFields ✅
- M-Pesa STK push → transactions table ✅
- Document generation → documents table + R2 ✅

### What the dashboard can already see:
- Customer list + registration status ✅
- Conversation list per customer ✅
- Generated documents list ✅
- Transaction list with statuses ✅
- Overview stats ✅

### What's missing for full reflection:
1. **Message content** — cannot read actual conversation text from dashboard (messagesApi + UI)
2. **Realtime state** — cannot see the current machine stage for a given customer from dashboard (GET /context endpoint exists but no UI calls it)
3. **Document download** — the R2 fileUrl exists in documents table, need a download button
4. **Session reset** — DELETE /context endpoint exists, no UI to reset a customer's session

### Data flow diagram (current state):

```
WhatsApp user → aaf/whatsapp → POST /advance → machine.ts
  ├─ lookupUser → GET /api/v1/agent/customers/:userId      → D1 customers
  ├─ registerUser → POST /api/v1/agent/customers            → D1 customers
  ├─ listSKUs → GET /api/v1/docgen/skus                    → D1 skus
  ├─ initiatePayment → POST /api/v1/payments/mpesa/stk     → D1 transactions
  ├─ checkPayment → GET /api/v1/payments/mpesa/stk/:id     → D1 transactions
  ├─ renderDoc → POST /api/v1/docgen/render                 → D1 documents + R2
  └─ context persisted → SESSIONS_KV                        → KV

Dashboard (admin) → VITE_API_URL → api/gateway
  ├─ agentsApi        → GET /api/v1/agent/agents            → D1 agents ✅
  ├─ customersApi     → GET /api/v1/agent/customers         → D1 customers ✅
  ├─ conversationsApi → GET /api/v1/agent/conversations/:id → D1 conversations ✅
  ├─ **MISSING** messagesApi → GET /api/v1/agent/conversations/:id/messages → D1 messages ❌
  ├─ skusApi          → GET /api/v1/docgen/skus             → D1 skus ✅
  ├─ documentsApi     → GET /api/v1/docgen/documents/all    → D1 documents ✅
  ├─ transactionsApi  → GET /api/v1/payments/transactions   → D1 transactions ✅
  └─ machine context  → GET /api/v1/machine/context/:user/:agent  → KV ❌ no UI
```

---

## 4. Recommendations

### Milestone: "Dashboard e2e Reflection"

Add these in order:

1. **Messages thread view** (high priority) — Add messagesApi to client.ts, add message thread panel to ConversationsPage when clicking a conversation row or detail view
2. **Machine context viewer** (medium) — Show current machine stage per customer in ConversationsPage user detail
3. **Session reset button** (medium) — Add DELETE context button in user detail panel
4. **SKU-agent access UI** (low) — Add agent toggle checkboxes to TemplatesPage SKU edit form
5. **Document download from dashboard** (low) — Add download link to DocumentsPage rows
6. **Cleanup dead tables** (post-e2e):
   - Remove `admins` table schema + seed, or migrate auth to D1 + bcrypt
   - Remove `templates` legacy table + routes, or consolidate into `skus`
   - Remove `contact` column if unused

### Known issues already fixed (cross off gap analysis):
- ~~Issue 2: listAllDocs parses fieldValues + joins templateName~~ ✅
- ~~Issue 3: listAllTransactions endpoint exists~~ ✅
- ~~Issue 4: OverviewPage aggregates from live APIs~~ ✅
- ~~Issue 6: templateName returned in listAllDocs response~~ ✅
