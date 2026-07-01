# AGENTS.md — web/pages/site

> Read the repo-root AGENTS.md first for full project context.
> This file covers only what is specific to this app.

## Purpose

Public marketing website. Introduces Taji and Elim to prospective users, explains
pricing, and links to WhatsApp. No API calls. Fully static SPA.

## Type / local port

Cloudflare Pages — React 18 + Vite + Tailwind CSS — port 5174

## Pages

```
/          — HomePage.tsx      hero, product overview, CTA to WhatsApp
/taji      — TajiPage.tsx      what Taji does, example conversation flow
/elim      — ElimPage.tsx      CBC tutoring, for students, parents, schools
/pricing   — PricingPage.tsx   pricing (use placeholders until e2e pricing confirmed)
/contact   — ContactPage.tsx   contact form or direct WhatsApp link
```

## WhatsApp CTA link format

```
https://wa.me/254XXXXXXXXX?text=Hello
```

Use env variables — never hardcode numbers:
```
VITE_TAJI_WHATSAPP=254712345678
VITE_ELIM_WHATSAPP=254798765432
```

## Pricing page rule

Keep all prices as *"from KES —"* until the e2e test passes and real pricing is
confirmed in the dashboard. Update only after production prices are set.

## Environment variables

```
VITE_TAJI_WHATSAPP   — Taji number (no +, no spaces, e.g. 254712345678)
VITE_ELIM_WHATSAPP   — Elim number
```

No VITE_API_URL needed — this site makes no API calls.

Set in `.env.local` (gitignored).
For production: Cloudflare Pages environment variables.

## Key files

```
src/
  App.tsx
  main.tsx
  components/SiteLayout.tsx     — shared nav + footer
  pages/
    HomePage.tsx
    TajiPage.tsx
    ElimPage.tsx
    PricingPage.tsx             — use placeholder prices until e2e confirmed
    ContactPage.tsx
```

## Rules

- No API calls — static marketing only
- No links to dashboard pages — separate subdomain
- No hardcoded phone numbers — VITE_ env variables only
- No content about real pricing until post-e2e confirmation
