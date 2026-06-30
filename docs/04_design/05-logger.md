# ASSAPPFAC Platform Logger Scheme — Implementation Spec

## Goal

Right now every service (`docgen`, `agents`, `admin`, `wa-worker`) logs in
default plain text. When they all run together via `pnpm dev`, the terminal
is a wall of indistinguishable grey/white lines. We want each service to be
instantly recognizable by **color + icon + tag**, and each log *level*
(info/warn/error/debug/success) to be visually distinct *within* that
service's color family.

This file is the spec. opencode should implement a shared logger module and
wire it into all four services so the dev terminal looks like the mockup
below instead of plain `console.log`.

---

## 1. Visual identity per service

Each service gets one fixed **hue** (bright/bold variant for contrast on
dark terminal backgrounds) and one fixed **emoji/icon**. The hue stays
constant across all log levels for that service — only the *brightness /
style* (bold, dim, underline) and a level-specific icon change to indicate
severity. This way your eye locks onto "color = which service" instantly,
and "icon/weight = how serious" as a secondary signal.

| Service              | Tag           | Color (ANSI bright)      | Hex (for reference) | Icon |
|----------------------|---------------|---------------------------|----------------------|------|
| `admin`              | `[ADMIN]`     | bright magenta            | `#FF6AC1`            | 🛠️  |
| `agents`             | `[AGENTS]`    | bright cyan               | `#56E1E9`            | 🧠   |
| `docgen`             | `[DOCGEN]`    | bright yellow             | `#F4D35E`            | 📄   |
| `wa-worker`          | `[WA]`        | bright green              | `#5AF78E`            | 💬   |
| `dashboard`          | `[DASH]`      | bright blue               | `#5A9CF8`            | 🖥️  |

Rationale: these five hues are maximally separated on the color wheel
(magenta/cyan/yellow/green/blue), so even with 4-5 services interleaving
output, no two adjacent lines will share a color. Avoid bright red/white for
service identity — reserve **red** exclusively for error severity and
**white/gray** for neutral system noise, so they keep their universal
"alert" / "background noise" meaning across every service.

---

## 2. Log levels (severity styling, applies on top of service color)

| Level     | Style applied                                  | Icon | When to use                                |
|-----------|-------------------------------------------------|------|---------------------------------------------|
| `success` | service color, **bold**                        | ✅   | completed action, e.g. doc generated, message sent |
| `info`    | service color, normal weight                    | ℹ️   | routine lifecycle events, state transitions |
| `step`    | service color, dim/faint                        | →    | sub-steps inside a pipeline/loop (e.g. admin's LLM step-through) |
| `warn`    | bright yellow background OR bold yellow text    | ⚠️   | recoverable issues, retries, fallback paths |
| `error`   | bright red, bold, optionally red background     | ❌   | exceptions, failed requests, crash paths    |
| `debug`   | gray/dim, service color only on the tag          | 🔍   | verbose, off by default (env-gated)         |

Severity color (yellow/red) **overrides** the service color for the message
text itself, but the `[TAG]` prefix always stays in the service's color so
you can still tell at a glance *which service* errored.

---

## 3. Line format (consistent across all services)

```
<gray timestamp> <service-color icon TAG> <level-icon> <message> <gray dim metadata>
```

Example renders (describe colors in comments since this is plain text):

```
12:41:02  🛠️  [ADMIN]   ℹ️  Starting pipeline: extract-template-fields        (job=tpl_8821)
12:41:02  🛠️  [ADMIN]   →  step 2/5: chunking document sections
12:41:03  🧠  [AGENTS]  ℹ️  Reasoning over 4 candidate completions
12:41:03  📄  [DOCGEN]  ✅  Rendered contract_v2.docx                          (812ms)
12:41:04  💬  [WA]      ℹ️  Incoming message from +254712xxxxxx
12:41:05  💬  [WA]      ⚠️  Session state stale, re-syncing with admin
12:41:06  🛠️  [ADMIN]   ❌  Failed to parse placeholder map: missing {{client_name}}
```

- Timestamp: dim gray, `HH:MM:SS` (24h, local time) — keep it short, this is
  a dev console not a log file.
- Tag block width should be padded/aligned (`[ADMIN]  `, `[AGENTS] `, etc.)
  so the message columns line up vertically — this alone makes scanning
  dramatically easier.
- Metadata (job id, duration, request id) goes at the end, dim/gray, in
  parens — never colored the same as the message, so it doesn't compete for
  attention.

---

## 4. Implementation notes for opencode

### 4.1 Shared package
Create a shared logger so all 4 services import the *same* formatting logic
instead of reinventing it:

```
packages/logger/
  src/
    index.ts        # createLogger(serviceName) -> { info, success, step, warn, error, debug }
    colors.ts        # service -> ansi color map (table above)
    format.ts        # timestamp + padding + icon assembly
  package.json
```

Use `picocolors` or `chalk` (prefer `picocolors` — smaller, faster, already
likely a transitive dep) for ANSI coloring. Use `bright*` ANSI variants
(`chalk.cyanBright`, etc.) — never the dim base 8 colors — since the dev
terminal background is dark and bright colors stay readable while keeping
contrast against gray/dim metadata text.

Usage in each service should be a one-liner:

```ts
// apps/backend/admin/src/index.ts
import { createLogger } from "@assappfac/logger";
const log = createLogger("admin");

log.info("Starting pipeline: extract-template-fields", { job: "tpl_8821" });
log.step("step 2/5: chunking document sections");
log.error("Failed to parse placeholder map", { missing: "{{client_name}}" });
```

### 4.2 Per-runtime constraints
- **`admin` / `agents` / `docgen`** (plain Node via `tsx watch`): full ANSI
  support, no issue. Use the shared logger directly.
- **`wa-worker`** (Cloudflare Workers via `wrangler dev`): Workers runtime
  supports `console.log` with ANSI codes fine in `wrangler dev`'s terminal
  output, but **does not** support `process.stdout` — make sure the shared
  logger only ever calls `console.log/warn/error/debug` (never
  `process.stdout.write`) so it works identically in Workers and Node.
- **`pages/dashboard`**: this runs in the browser, so ANSI codes won't
  render. Use `%c` CSS-in-console formatting instead for DevTools:
  ```ts
  console.log("%c🖥️ [DASH] %cInfo message", "color:#5A9CF8;font-weight:bold", "color:inherit");
  ```
  Keep the same hue (`#5A9CF8`) and tag conventions so mental mapping
  carries over between terminal and browser console.

### 4.3 Noise reduction (this matters as much as color)
Right now wrangler/drizzle-kit print their own framework banners (the ⛅,
▲, ⎔ lines in your paste) which visually compete with your app logs. Two
options, pick one and note it in the README:
1. Leave framework banners as-is (they're infrequent, only at boot) and just
   make sure *your* app logs are visually louder (bold, bright) than them
   for anything emitted *after* boot.
2. Optionally pipe each `pnpm --filter` dev command through a prefixer
   (e.g. `concurrently` already used by `run/dev.sh`? if so, leverage its
   `--prefix-colors` flag) so even framework output gets a colored gutter
   per service, fully unifying the visual scheme.

### 4.4 Env-gated verbosity
Add `LOG_LEVEL=info|debug|warn|error` per service (`.env` / wrangler vars).
Default to `info` in dev so `step`/`debug` don't flood the terminal unless
explicitly turned up — useful for admin's LLM-loop-through-collection steps,
which could otherwise print a line per state per item.

---

## 5. Acceptance checklist (for opencode to self-verify)

- [ ] Shared `@assappfac/logger` package created and importable from all 4 services
- [ ] Each service uses its assigned color+icon consistently (table in §1)
- [ ] All 5 log levels implemented with correct styling (table in §2)
- [ ] Timestamps + tag-padding aligned so columns visually line up
- [ ] `wa-worker` confirmed working under `wrangler dev` (no `process.stdout` usage)
- [ ] `dashboard` uses `%c` CSS console formatting, not ANSI
- [ ] `LOG_LEVEL` env var respected, defaults to `info`
- [ ] Manually run `pnpm dev` and confirm output visually matches §3 example