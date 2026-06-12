# Production deployment runbook

## Per-vendor instance (subscription)

Each subscribing vendor receives one **isolated deployment**: application containers, dedicated PostgreSQL, Redis, and secrets vault. This is not a shared multi-tenant application database.

## Local development (all services)

From the repository root:

```bash
npm install
npm run setup:env
brew services start postgresql@15   # or Docker Postgres
npm run db:push && npm run db:seed
```

Run in **three terminals** (or background):

| Terminal | Command | URL |
|----------|---------|-----|
| API | `npm run dev:api` | http://localhost:3000/api/v1/health |
| Web | `npm run dev:web` | http://localhost:3001 |
| Worker (optional) | `npm run dev:worker` | Requires Redis for queued schedule runs |

**Login:** `admin@example.com` / `ChangeMeNow123!`

**Integration API key** (after seed): `pr_dev_integration_key_only_for_local`

Ensure `.env` includes `WEB_ORIGIN=http://localhost:3001` so the API accepts browser cookies from the web app.

## Pre-deploy checklist

- [ ] `SESSION_SECRET` rotated (32+ chars)
- [ ] `vendor_physical_address` and `vendor_name` set in vendor settings
- [ ] `EMAIL_PROVIDER` configured (SES/SendGrid credentials in vault)
- [ ] `digest_email_enabled` reviewed (default off; emails all `users` when on)
- [ ] TLS termination on all public endpoints
- [ ] Database backups enabled (retain audit events ≥ 2 years)
- [ ] PRD §2.2 success metric alerts configured (`GET /api/v1/metrics`)

## Deploy steps

1. Run `prisma migrate deploy` against production `DATABASE_URL`.
2. Deploy API, worker, and web images (or processes).
3. Set `WEB_ORIGIN` to the production web URL; set `NEXT_PUBLIC_API_URL` on the web build.
4. Verify `GET /api/v1/health` returns `{ status: "ok" }`.
5. Verify `GET /api/v1/integration/health` with a valid API key.
6. Verify worker connected to Redis (`reminder-runs` queue) if using async schedule runs.
7. Smoke test: login (web) → import sample with `due_date` → dry-run schedule → confirm tier-15 preview in audit log.
8. Optional: enable digest in settings; run live schedule; confirm `reminder.digest.sent` audit event.

## Components

| Process | Responsibility |
|---------|----------------|
| **api** | REST + session auth + integration API + inline schedule runs (no Redis) |
| **worker** | BullMQ consumer + schedule poller (use with Redis) |
| **web** | Next.js vendor dashboard |

**Connector sync before evaluate:** When a schedule has `run_sync_before_evaluate`, the API runs all **enabled connectors** (read-only SQL) before eligibility. With Redis worker-only runs, trigger connector sync via `POST /api/v1/connectors/:id/sync` or use API inline schedule execution.

## Alerts (configure in monitoring)

| Condition | Action |
|-----------|--------|
| Schedule job failed 2× consecutively | Page on-call |
| Email failure rate > 5% / 1h | Investigate provider |
| Sync connector auth failure | Check vault credentials |
| Opt-out latency > 5 minutes | Check unsubscribe handler |
| Import mapping success < 95% (rolling) | Review vendor data quality |
| `GET /api/v1/metrics` delta_skip_rate low | Connector or data churn issue |

## Rollback

1. Stop worker to prevent sends.
2. Redeploy previous API/web artifacts.
3. Do **not** roll back destructive migrations without DBA review.

## Structured logs

Workers and API emit JSON logs with `correlation_id`, `run_id`, `schedule_id`, `invoice_id` (never raw email in production).
