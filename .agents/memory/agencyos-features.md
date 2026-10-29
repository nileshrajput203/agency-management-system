---
name: AgencyOS Feature Set
description: Features implemented — SearchBar, Finance tabbed page, Excel export (xlsx), Dashboard overhaul; notes on DB gaps
---

## Implemented features

### SearchBar
- `artifacts/agency-os/src/components/common/SearchBar.tsx` — reusable controlled input with clear button, Escape key, lucide Search icon.
- Added to: tasks.tsx, sales.tsx, content.tsx (filteredPosts), hawan.tsx (Social Handles tab).
- Pattern: add `searchQuery` state, compute `filtered*` before render, add `<SearchBar>` in header.

### Finance & Docs (tabbed page)
- `artifacts/agency-os/src/pages/finance.tsx` — tab bar (Invoices / Quotations / POs / Proposals), URL param `?tab=` synced via `window.history.pushState`, Excel export via `xlsx`.
- Old sidebar links (4 items) replaced with single `/finance` entry using `Wallet` icon.
- Old routes `/invoices`, `/quotations`, `/purchase-orders`, `/proposals` all redirect to `/finance?tab=<tab>`.
- Excel export fetches data from each tab's API hook independently (all 4 hooks always mounted for instant export readiness).

### Dashboard overhaul
- `artifacts/agency-os/src/pages/dashboard.tsx` — 4 stat cards (border-l accent), AreaChart revenue (range toggle 3M/6M/12M/YTD), PieChart project health donut, sales pipeline bars, content calendar week strip (handles month boundary by fetching adjacent month), activity feed timeline.
- `artifacts/api-server/src/routes/dashboard.ts` — replaced with new file adding `GET /dashboard/project-health` (onTrack/atRisk/delayed/completed) and `GET /dashboard/revenue-chart?range=` alongside existing stats + recent-activity endpoints.

## Shoot scheduling and performance reports

Shoot-specific specifications are stored in the existing meeting description using a versioned marker, with a title prefix identifying shoots; no meetings-table migration is needed. Monthly performance reports are computed from task, attendance, time-entry, and work-report records when requested rather than persisted as duplicate snapshots.

**Why:** Keep shoot scheduling compatible with the current database while making specifications visible/editable, and ensure monthly reports reflect corrected source records without a separate report lifecycle.

**How to apply:** Preserve the marker parsing/serialization when extending shoot details; keep report calculations permission-scoped and derived from source-of-truth rows.

### AI writing assistant (site-wide)
- Backend: `artifacts/api-server/src/routes/ai.ts` — `POST /api/ai/generate` using `OPENAI_API_KEY` (user-provided secret, not the Replit blueprint) + `gpt-4o-mini`, context-aware system prompts keyed by a `context` field (proposal/quotation/invoice/content-caption/task/client-notes/lead/email/general).
- Frontend: `artifacts/agency-os/src/components/common/AiAssistButton.tsx` — reusable Popover+Sparkles button; pass `context`, `currentValue`, `onResult(text)`. Drop it next to any Textarea/rich-text field.
- Wired into: quotations, invoices, content captions, tasks, client activity notes, proposals (Tiptap — wraps output in `<p>` tags via `field.onChange`).
- Pattern for react-hook-form fields: needs `watch` and `setValue` destructured from `useForm` (not just `register`) to read/write the field value for the AI button.

## Pre-existing DB gaps (NOT caused by these features)
- `leads` table: `probability`, `expected_close_date`, `source` columns missing from DB
- `projects` table: `priority` column missing from DB
- These cause 500 errors on `/api/leads` and `/api/projects` — needs a DB migration to add columns.

**Why important:** The Sales Pipeline widget on the dashboard shows empty because `/api/leads` returns 500. Running `pnpm -w drizzle-kit push` should add the missing columns.

## Access model

An empty `allowedModules` list represents the standard employee workspace (tasks, work reports/performance, attendance, and leave). Explicit module selections unlock the complete selected section; selecting both projects and tasks grants the company-wide task assignment workspace.

**Why:** The access UI is section-level rather than action-level, and default employee workflows must remain available without requiring an administrator to toggle every basic module.

**How to apply:** Keep frontend navigation guards and API permission checks aligned with these section-level rules; custom roles use their name as `systemRole` and still receive access through `allowedModules`.

Content Calendar client choices use the full client directory only when Clients access is enabled; otherwise show clients already represented in the user's content history. Public calendar shares remain scoped to one client.

**Why:** The content editor needs useful client choices without silently granting access to the Clients section, and a public link should not mix separate clients' calendars.

**How to apply:** Gate full client-list queries on Clients access, derive limited choices from Content data otherwise, and keep share tokens tied to one client.

Pending task requests remain editable only by their requester even when a legacy request has no assignee. Active tasks remain assignee-scoped, and employees must submit completion for review rather than bypassing approval.

**Why:** Employees need to correct their own requests without gaining access to other people's work or skipping the task approval process.

**How to apply:** Preserve requester ownership for pending requests, assignee ownership for active work, and the review transition for employee completion.

Access changes are surfaced through the Team & Roles audit trail; user role/module/delegation/activation changes and custom-role creation should remain auditable with actor, target, change details, and timestamp.

**Why:** Administrators need to know who changed an employee's access, not only the employee's current state.

**How to apply:** Add audit writes whenever access control or role records are created, updated, or removed, and keep the audit table view readable for role events as well as user events.

Existing accounts can carry their role in either `systemRole` or the legacy `role` field; privileged frontend checks must support both.

**Why:** Imported/older users may not have been synchronized into the newer role column, which otherwise hides manager-only navigation while the API still recognizes the account.

**How to apply:** Prefer `systemRole ?? role` for frontend role gates and keep API role resolution consistent.
