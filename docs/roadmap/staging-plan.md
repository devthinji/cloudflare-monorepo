# Staging Plan — How We Build This Realistically

## Principle

> Ship the smallest thing that proves the idea. Then add one layer at a time.

We are on Cloudflare free tier. We start with Taji. We don't build Elim until Taji works end-to-end.

---

## Phase 0 — Foundation (Current) ✅

**Goal:** Monorepo, workers, dashboard scaffolded and pushed to GitHub.

- [x] pnpm + Turborepo monorepo
- [x] Gateway Worker (Hono, JWT, routing)
- [x] Auth Worker (KV sessions)
- [x] Data Worker (D1 CRUD)
- [x] React + shadcn dashboard
- [x] GitHub repo with main/staging/feat/test branches
- [x] Full documentation

**Branch:** `main`

---

## Phase 1 — Core Infrastructure (Next) 🔨

**Goal:** Workers talk to each other. DB is real. Dashboard works.

### Tasks
- [ ] Add Channel Worker (new Hono worker, handles WhatsApp webhooks)
- [ ] Add DocGen Worker (docx + docxtemplater, R2 for storage)
- [ ] Update D1 schema to match `database/schema.md`
- [ ] Wire service bindings: Gateway → Channel, Channel → DocGen, Channel → Data
- [ ] Dashboard: Agent CRUD (create/edit/delete agents, toggle active)
- [ ] KV: agent config caching
- [ ] R2: bucket for document storage

**Branch:** `feat/phase-1` → merge to `staging` → test → merge to `main`

**Cloudflare Resources Needed:**
- 1x D1 database
- 1x KV namespace
- 1x R2 bucket
- 5x Workers (gateway, auth, data, channel, docgen)
- 1x Pages project (dashboard)

**Free Tier Check:**
| Resource | Free Limit | Our Usage |
|----------|-----------|-----------|
| Workers | 100k req/day | ✅ Fine for staging |
| D1 | 5M rows read/day | ✅ Fine |
| KV | 100k reads/day | ✅ Fine |
| R2 | 10GB storage | ✅ Fine |
| Pages | Unlimited | ✅ |

---

## Phase 2 — Taji MVP 🎯

**Goal:** A real user can WhatsApp Taji and get a CV back.

### Tasks
- [ ] WhatsApp Business API setup (Meta Developer Account)
- [ ] Groq API key + agent brain in Channel Worker
- [ ] CV conversation flow (multi-turn, saves to D1)
- [ ] CV docx template (professional, clean)
- [ ] DocGen: populate template with user data → R2 → WhatsApp doc message
- [ ] User profile saved to D1 after CV creation
- [ ] Dashboard: view conversations, documents generated
- [ ] Application letter flow
- [ ] Test with 3-5 real users

**Branch:** `feat/taji-mvp` → `staging` → `main`

---

## Phase 3 — Taji Hardening 🔒

**Goal:** Taji is reliable, handles edge cases, ready for real users.

### Tasks
- [ ] Conversation auth (OTP via WhatsApp to identify returning users)
- [ ] Rate limiting (KV-based, per phone number)
- [ ] Error handling in all flows (AI timeout, docgen fail, etc.)
- [ ] Resignation letter flow
- [ ] Cover letter flow
- [ ] "Remember me" — returning user skips re-entering details
- [ ] Bilingual: English + Swahili detection and response
- [ ] Analytics: docs generated per day (dashboard chart)

---

## Phase 4 — Elim MVP 📚

**Goal:** A student can WhatsApp Elim and get tutored in Maths.

### Tasks
- [ ] Elim agent config in dashboard (new system prompt, tools)
- [ ] Same WhatsApp infrastructure — just a different number
- [ ] Student session tracking (D1: student_sessions table)
- [ ] CBC subject + strand awareness in system prompt
- [ ] Score tracking per session
- [ ] Teacher flow: exam generation → docx → download
- [ ] Parent flow: progress summary on demand

---

## Phase 5 — Platform Features 🌍

**Goal:** The platform is real. Other agents can be created.

### Tasks
- [ ] Dashboard: full agent builder UI
- [ ] Telegram channel support
- [ ] SMS channel support (Africa's Talking)
- [ ] M-Pesa Daraja STK Push integration (live credentials ready)
- [ ] Public website (marketing page for Taji + Elim)
- [ ] Deepgram voice support (voice notes → text → agent)

---

## What We're NOT Building Yet

| Feature | Why not now |
|---------|------------|
| Mobile app | WhatsApp IS the app |
| User accounts with passwords | Phone + OTP is enough |
| Multi-model routing | Groq first, add fallbacks later |
| Payments | Free first, monetize after users trust it |
| USSD | Add after WhatsApp is stable |
| Instagram/Facebook | Add after core platform is solid |

---

## Git Workflow

```
feat/phase-1      ← active development
      ↓ PR + review
staging           ← integration testing, WhatsApp sandbox
      ↓ PR + sign-off
main              ← production (Cloudflare auto-deploy)
```

Every feature starts as `feat/<feature-name>`, tested in staging, then merged to main.

---

## Next Immediate Action

1. **You provide:** Cloudflare API Token + Account ID
2. **I deploy:** Phase 0 infrastructure to Cloudflare
3. **We build:** Phase 1 Channel + DocGen workers together
4. **Target:** Taji MVP live on WhatsApp within 2 weeks
