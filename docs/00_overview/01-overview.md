# Project Overview

> One platform. Switchable agents. Documents that change lives.

## What we are building

A multi-tenant conversational document platform where AI agents are configured via a
dashboard and deployed through messaging APIs. Each agent has a name, a purpose, and a
set of tools — but they all share the same infrastructure.

Current agents:
- **Taji** — reduces unemployment by creating CVs, cover letters, and resignation letters via WhatsApp
- **Elim** — CBC-aligned exam generation and tutorship for Kenyan students, parents, and institutions

---

## Status (as of 30 June 2026)

Branch `feat/e2e` is ready for end-to-end WhatsApp testing.

**Complete:**
- Full 4-stage ConversationMachine (Identify → Auth → Collect → Farewell)
- Blueprint-driven flow (version_1.ts owns all transitions, guards, messages)
- SKU system: 3 active Taji SKUs seeded at test prices (KES 1–3)
- M-Pesa Daraja STK push + callback
- Dashboard wired to real API (agents, SKUs, transactions, documents, users)
- D1 migrations, seed script, Doppler secrets management
- Pre-flight TypeScript checks pass clean across all workers

**Needs e2e confirmation before production:**
- Full WhatsApp → machine → M-Pesa → docgen → WhatsApp delivery loop
- docxtemplater render wired to collected field values
- WhatsApp media message for generated .docx file

---

## Core philosophy

> Same superpowers. Different intentions. One dashboard.

The platform does not change. Only the agent's name, instructions, tools, model, and
API keys change — configured from the admin dashboard. New sellable document types are
added as SKU records, not code changes.
