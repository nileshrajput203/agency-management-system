# Blink Beyond — Agency Management System

Full-stack agency OS for Blink Beyond: auth & RBAC, CRM, sales funnel, projects & Kanban tasks, attendance, finance, content workflow, HR, reports, and automation rules.

## Tech stack

- **Next.js 16** (App Router) + TypeScript
- **Prisma 7** + SQLite (local dev)
- **NextAuth v5** (credentials + JWT)
- **Tailwind CSS 4** + shadcn/ui
- **dnd-kit** (Kanban) · **Recharts** (analytics)

## Quick start

```bash
cd C:\Users\USER\Projects\blink-beyond
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo logins (password: `admin123`)

| Email | Role |
|-------|------|
| admin@blinkbeyond.com | Super Admin |
| manager@blinkbeyond.com | Manager |
| sales@blinkbeyond.com | Sales |
| designer@blinkbeyond.com | Designer |
| finance@blinkbeyond.com | Finance |

## What's implemented (v1)

| Module | Status |
|--------|--------|
| Auth & RBAC (8 roles, module access) | ✅ |
| Admin dashboard & stats | ✅ |
| Clients & CRM list | ✅ |
| Sales funnel (visual columns) | ✅ |
| Projects portfolio | ✅ |
| Task Kanban (drag & drop) | ✅ |
| Attendance check-in/out + live board | ✅ |
| HR employee directory | ✅ |
| Finance (templates, catalog) | ✅ UI |
| Content calendar (status columns) | ✅ UI |
| Reports (funnel chart) | ✅ |
| Automation rules list | ✅ |
| Settings (agency profile) | ✅ |

## Database schema

All **10 modules** are modeled in `prisma/schema.prisma` (~40 tables): users, roles, attendance, clients, leads, proposals, agreements, projects, tasks, time entries, invoices, content posts, HR, automation, audit logs, etc.

## Roadmap (next phases)

1. **Proposals & PDF** — branded templates, e-sign, voice-to-agreement (OpenAI)
2. **Ayrshare** — auto-publish after Admin approval
3. **Invoices & payroll** — GST line items, recurring retainers
4. **Gantt / calendar views** — projects & content scheduling
5. **Geo attendance** — optional lat/long on check-in
6. **Client portal** — white-label external access
7. **PostgreSQL** — production database (replace SQLite adapter)
8. **Zapier / WhatsApp / Gmail** — env-driven integrations

## Environment variables

Copy `.env` and set:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="change-me-in-production"
NEXTAUTH_URL="http://localhost:3000"

# Optional integrations
AYRSHARE_API_KEY=
OPENAI_API_KEY=
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Prisma Studio |

---

Built for **Blink Beyond** · Agency OS blueprint (~208 features) — v1 foundation ready to extend.
