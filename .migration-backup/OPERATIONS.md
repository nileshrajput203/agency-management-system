# Blink Beyond — Owner & Operations Guide

## Your owner login (Super Admin)

| Field | Value |
|-------|--------|
| **Email** | `admin@blinkbeyond.com` |
| **Password** | `admin123` (change after first login) |
| **Access** | Everything — clients, team, finance, settings |

After login, open **Team & Logins** in the sidebar to create real accounts for staff and set their roles.

## Other seeded team accounts (same password until you change them)

| Email | Role |
|-------|------|
| `manager@blinkbeyond.com` | Manager |
| `sales@blinkbeyond.com` | Sales Executive |
| `designer@blinkbeyond.com` | Designer |
| `finance@blinkbeyond.com` | Finance Executive |

## What you can do now (end-to-end)

1. **Clients** — Add / Edit / Delete client records (Super Admin + Account Manager + Sales)
2. **Team & Logins** — Add employees, assign roles, reset passwords (Super Admin only)
3. **Sales** — Add leads, change funnel stage; **Won** auto-creates a client
4. **Projects** — Create projects linked to clients
5. **Tasks** — Create tasks + Kanban drag-and-drop
6. **Finance** — Create proposals; mark **Approved** → agreement draft; create invoices; mark paid
7. **Content** — Add posts, move workflow; Super Admin **Admin approve**
8. **Attendance** — Check in / out; admin sees live board
9. **Settings** — Edit agency name, GST, check-in deadline (Super Admin)
10. **Audit log** — Visible in Settings

## Run locally

```bash
cd C:\Users\USER\Projects\blink-beyond
npm run dev
```

## Production checklist

- Set strong `AUTH_SECRET` in `.env`
- Change owner password via **Team & Logins** → edit your user
- Use PostgreSQL for production (replace SQLite adapter)
- Configure `AYRSHARE_API_KEY` for social auto-publish
- Configure SMTP for proposal/invoice emails
