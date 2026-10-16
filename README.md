# Encore Executive — Management Command Center

Separate **web application** for Encore management (admin / dispatcher). Customers and chauffeurs use the Encore app instead and cannot sign in here.

Part of the Encore Executive platform:

| Repo | What |
|---|---|
| **Management-Repo** (this) | Command Center web app — review, quote, confirm, dispatch, fleet, drivers, customers, payments, invoices, settings |
| [Encore-App-Repo](https://github.com/Octapus-systems/Encore-App-Repo) | Customer + driver app |
| [Backend-App-Management](https://github.com/Octapus-systems/Backend-App-Management) | Shared API |

## Run locally

Start the API first (Backend-App-Management, port 4000), then:

```bash
npm install
npm run dev          # http://localhost:5180
```

Sign in at `/login` with a management account (demo: `admin@encore.test` / `Encore2026!` — development only).

`/api` requests are proxied to `http://localhost:4000`. Point elsewhere with `VITE_API_URL` (dev) or serve behind the same domain as the API in production.

## Build & deploy

```bash
npm run build        # outputs dist/
```

Host `dist/` on any static host (e.g. `admin.encoreexecutive.co.uk`) and route `/api/*` to the backend. All screens are behind management sign-in; the API also enforces admin-only access on every management endpoint.

## Screens

Dashboard · Bookings (search/filter) · Booking detail (review, clarify, quote, confirm, assign with conflict control, status override, payments, notifications, activity) · New booking for a customer · Calendar · Fleet · Drivers · External cover · Customers, corporate accounts, invitations, staff · Payments · Corporate invoices · Notifications log · Activity history · Settings
