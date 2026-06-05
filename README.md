# Merkoll — SaaS Frontend (tenant-facing)

The tenant-facing Next.js app for **Merkoll**, the vertical business operating
system: storefront, CRM, accounting, inventory, bookings, loyalty, B2B,
documents/e-signature and the MoreDealsX marketplace — configured per industry.

This app serves three surfaces from one build:

- **Apex / marketing** (`localhost:3000`, `morefungi.com`) — the landing page
  (`/`) and the **Meroll** payroll/HR landing (`/payroll`).
- **Org admin panel** (`<tenant>.localhost` / `<tenant>.morefungi.com`) — the
  owner dashboard, documents, calendar, billing, staff, settings.
- **Workspace panel** (`/w/<id>/…`) — per-business operations (storefront,
  accounting, leads, agreements, etc.).

The matching **agency portal** (`latest_agency`) and **Django backend**
(`latest_saas`) are separate repos.

## Getting started

```bash
cp .env.example .env.local      # then fill in values (see below)
npm install
npm run dev                     # http://localhost:3000
```

Tenant subdomains in dev work via `*.localhost` (e.g. `swedevital.localhost:3000`),
which most browsers resolve to `127.0.0.1` automatically.

## Environment

All config is in `.env.example`. Key vars:

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend origin in dev (e.g. `http://localhost:8000`) |
| `NEXT_PUBLIC_FRONTEND_APEX` / `NEXT_PUBLIC_API_APEX` | Per-tenant API routing in prod (`<tenant>.morefungi.com` → `<tenant>.api.morefungi.com`) |
| `NEXT_PUBLIC_AGENCY_PORTAL_URL` / `NEXT_PUBLIC_AGENCY_SIGNUP_URL` | Links to the agency portal |

> **Stripe:** there is **no** Stripe key in this app's env — the publishable
> key is resolved **per tenant** at runtime from the backend (the agency's Stripe
> if connected, else the platform's). Never add a Stripe key here.

## Build

```bash
npm run build && npm start
```

`NEXT_PUBLIC_*` values are baked at **build** time, so set production env before
building (or in your host's project settings) and rebuild on change.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Framer Motion · axios ·
Zustand.
