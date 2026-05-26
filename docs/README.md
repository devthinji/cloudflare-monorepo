# Project Documentation

> One platform. Switchable agents. Documents that change lives.

## What We're Building

A **multi-tenant conversational document platform** where AI agents are configured via a dashboard and deployed through messaging APIs (WhatsApp, SMS, Telegram, USSD). Each agent has a name, a purpose, and a set of tools — but they all share the same infrastructure.

The first two agents:
- **Taji** — Reduces unemployment by creating CVs, application letters, and resignation letters through WhatsApp conversation
- **Elim** — Provides CBE/CBC-aligned exam generation, tutorship, and student progress tracking for Kenyan students, parents, and institutions

---

## Documentation Index

| File | What it covers |
|------|---------------|
| [architecture/overview.md](architecture/overview.md) | System architecture, workers, service bindings |
| [architecture/platform.md](architecture/platform.md) | How the platform works as one configurable unit |
| [products/taji.md](products/taji.md) | Taji — problem, solution, flows |
| [products/elim.md](products/elim.md) | Elim — problem, solution, flows |
| [database/schema.md](database/schema.md) | Minimal D1 database design |
| [agents/agent-model.md](agents/agent-model.md) | How agents are configured and switched |
| [api/channels.md](api/channels.md) | WhatsApp-first API-as-frontend design |
| [roadmap/staging-plan.md](roadmap/staging-plan.md) | How we build this realistically, starting now |

---

## Core Philosophy

> "Same superpowers. Different intentions. One dashboard."

The platform doesn't change. Only the agent's name, instructions, tools, model, and API keys change — configured from the admin dashboard. This makes it infinitely extensible without rebuilding the infrastructure.
