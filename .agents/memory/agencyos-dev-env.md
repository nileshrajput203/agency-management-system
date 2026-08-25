---
name: AgencyOS Dev Environment
description: Known quirks and fixes for the AgencyOS Replit development environment
---

## drizzle-kit location
- Binary is at `lib/db/node_modules/.bin/drizzle-kit` — NOT in root node_modules
- Run DB push from REPO ROOT: `lib/db/node_modules/.bin/drizzle-kit push --config ./lib/db/drizzle.config.ts`
- drizzle-kit push hangs in interactive mode in Replit shell (no TTY) — always add a pseudo-TTY wrapper: `script -q -c '...' /dev/null`
- If drizzle-kit prompts about truncating tables for unique constraints, rename constraints directly via SQL instead (rename `*_key` → `*_unique` pattern)

## pnpm install quirk
- `pnpm install` works fine from root with a 120s timeout — takes ~13s with cold cache

## OpenRouter AI key
- `OPENAI_API_KEY` is actually an OpenRouter key (starts with `sk-or-`)
- `artifacts/api-server/src/routes/ai.ts` auto-detects OpenRouter keys by prefix and sets `baseURL: 'https://openrouter.ai/api/v1'` + model `google/gemini-2.5-flash`
- Fill-form contexts supported: quotation, invoice, proposal, purchase-order, task, content-post, client, lead

## Admin credentials
- Default admin email is configured as `admin@agencyps.com`; the bootstrap password remains environment-overridable.
- DB column is `password_hash` but Drizzle schema field is `password` — maps correctly via `text("password_hash")`

## DB schema gaps fixed
- `agency_settings` was missing: `working_days`, `grace_period_min`, `half_day_cutoff_time`, `absent_cutoff_time` — added via ALTER TABLE
- `leads` was missing: `phone` — added
- `tasks` was missing: `estimated_hours` — added
- `subprojects` was missing: `deleted_at` — added
- All unique constraints renamed from `*_key` → `*_unique` naming pattern drizzle expects

## Neon connection
- NEON_DATABASE_URL secret set and verified
- Server logs `[Database Connection Audit] Provider: Neon PostgreSQL` and `Fallback Mode: FALSE` on startup
- Bootstrap runs successfully and syncs users on every start

## Supabase connection
- Supabase direct database host resolves only to IPv6 in this Replit runtime; use the project's IPv4-compatible Supavisor Session pooler URL when direct connections fail with `ENOTFOUND`.
**Why:** Replit's current runtime cannot reach the project's IPv6-only direct endpoint reliably.
**How to apply:** Store the Session pooler PostgreSQL URL in the `SUPABASE_DATABASE_URL` secret, restart the workflow, then let bootstrap create missing tables and seed the initial admin.

## File upload pattern
- POST multipart/form-data to `/api/uploads` with field `file`
- Response: `{ url: "/api/uploads/<filename>", filename, size, mimetype }`
- Then PATCH the resource with the returned URL stored in a `logoUrl`/similar field

## GitHub push
- Script: `bash push-to-github.sh` — requires `GITHUB_TOKEN` secret in Replit Secrets
- Git username: nileshrajput203
