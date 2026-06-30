# Multi-region tenancy

## Overview

The platform stores each tenant in a shared PostgreSQL database with row-level isolation via `tenantId`. Object storage keys are prefixed by region and tenant for future regional bucket routing.

## Regions

| Region enum | Intended deployment |
|-------------|---------------------|
| `us_east` | Primary US |
| `us_west` | US West failover |
| `eu_west` | EU data residency |
| `ap_southeast` | APAC |

Tenants carry a `region` field at creation. Storage helpers use `regionalStorageKey(region, tenantId, ...)` to keep blobs namespaced.

## Request routing

1. Browser sends `x-tenant-id` or `x-tenant-slug` (web client stores active tenant in localStorage).
2. Subdomain middleware on the web app resolves slug from `BASE_DOMAIN`.
3. API `TenantGuard` validates membership and sets AsyncLocalStorage context.
4. Services call `requireTenantId()` for all tenant-scoped reads/writes.

## Data residency notes

- Email delivery may use platform SMTP or per-tenant `TenantEmailConfig`.
- Stripe billing is account-scoped; usage counters are tenant-scoped.
- Export/offboarding jobs write to tenant-prefixed storage keys.

## Operational checklist

- Set `BASE_DOMAIN` in web and API environments.
- Run `prisma db push` after schema upgrades.
- Seed demo tenant with `npm run db:seed`.
- Verify cross-tenant access returns 403 from API integration tests.
