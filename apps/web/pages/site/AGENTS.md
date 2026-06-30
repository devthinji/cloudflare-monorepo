# AGENTS.md — web/pages/site

> Read the repo-root AGENTS.md first for the full project context.
> This file covers only what is specific to this app.

## Purpose

Public marketing website for the platform. Introduces Taji and Elim to prospective
users, explains the pricing, and provides contact information. No API calls, no auth.
Pure static SPA deployed to Cloudflare Pages.

## Type

Cloudflare Pages — React + Vite + Tailwind CSS

Local dev port: 5174 (run separately from dashboard to avoid port conflict)

## Stack

- React 18
- Vite
- Tailwind CSS
- React Router (client-side routing)

## Pages

```
/           → HomePage.tsx      — hero, product overview, CTA to WhatsApp
/taji       → TajiPage.tsx      — Taji deep-dive: what it does, example flow
/elim       → ElimPage.tsx      — Elim deep-dive: CBC tutoring, for students/parents
/pricing    → PricingPage.tsx   — pricing tiers (update after e2e pricing confirmed)
/contact    → ContactPage.tsx   — contact form or WhatsApp link
```

## Layout

File: `src/components/SiteLayout.tsx`
Shared nav + footer for all pages.

## WhatsApp CTA link format

Direct link to agent WhatsApp number:
```
https://wa.me/254XXXXXXXXX?text=Hello
```
Replace 254XXXXXXXXX with the live Taji WhatsApp number.
Do not hardcode the number — use an env variable:
```
VITE_TAJI_WHATSAPP=254712345678
VITE_ELIM_WHATSAPP=254798765432
```

## Pricing page

Keep prices as placeholders until e2e test completes and real pricing is set in the
dashboard. Use:
- Professional CV: "from KES —"
- Cover Letter: "from KES —"
- Resignation Letter: "from KES —"

Update after pricing is confirmed.

## Environment variables

```
VITE_TAJI_WHATSAPP   — Taji WhatsApp number (no +, no spaces)
VITE_ELIM_WHATSAPP   — Elim WhatsApp number
```

No API gateway calls. This site is fully static.

## Key files

```
src/
  App.tsx                     — router setup
  main.tsx                    — entry point
  components/
    SiteLayout.tsx             — shared nav + footer
  pages/
    HomePage.tsx
    TajiPage.tsx
    ElimPage.tsx
    PricingPage.tsx            — update prices after e2e confirms pricing
    ContactPage.tsx
```

## What NOT to do

- Do not add API calls here — this is a static marketing site only
- Do not link to dashboard pages — dashboard is a separate app on a subdomain
- Do not hardcode WhatsApp numbers — use VITE_ env variables
- Do not block the Pricing page deploy on pricing confirmation — use placeholders
