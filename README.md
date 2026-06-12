# Payment Reminder Platform

Subscription service for vendors to send **email reminders** or generate **downloadable notification documents** for overdue client balances.

## Documentation

- [PRD](docs/product/PRD.md)
- [Engineering standards](docs/engineering/standards.md)
- [Database setup](docs/development/database-setup.md)

## Development

```bash
npm install
npm test
npm run setup:env
```

**Database (pick one):**

- **Docker** (Postgres + Redis): `docker compose up -d`
- **macOS Homebrew** (no Docker): see [database-setup.md](docs/development/database-setup.md#option-b--postgresql-installed-locally). You already have Postgres if `pg_isready` succeeds; create the app DB once:

```bash
brew services start postgresql@15   # if not running
psql -h localhost -d postgres -f scripts/setup-local-db.sql
```

Then:

```bash
npm run db:push
npm run db:seed
npm run dev:api        # http://localhost:3000/api/v1/health
npm run dev:web        # http://localhost:3001 — vendor dashboard
```

Set `WEB_ORIGIN=http://localhost:3001` in `.env` (see `.env.example`).

Redis is optional for schedule runs: without it, `POST /schedules/:id/run` executes inline. With Redis + `npm run dev:worker`, runs are queued.

### Schedules (Phase 3)

| Method | Path | Auth |
|--------|------|------|
| CRUD | `/api/v1/schedules` | required |
| POST | `/api/v1/schedules/:id/run` | optional `?dryRun=true` |
| GET | `/api/v1/schedules/:id/runs` | required |

### Integration API (Phase 4) — API key only

Header: `X-API-Key: pr_dev_integration_key_only_for_local` (after `npm run db:seed`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/integration/health` | Connector health |
| POST | `/api/v1/integration/invoices/bulk` | `Idempotency-Key`, optional `complete_sync: true` |
| PATCH | `/api/v1/integration/invoices/:invoiceNumber` | Partial update |
| GET | `/api/v1/docs/openapi.yaml` | OpenAPI spec |

### Vendor API (Phase 4) — session cookie

| Method | Path | Auth |
|--------|------|------|
| GET/PATCH | `/api/v1/invoices` | required |
| GET | `/api/v1/metrics` | required |
| CRUD | `/api/v1/api-keys` | admin only |
| GET/POST | `/api/v1/public/unsubscribe?email=` | public (no auth) |

### API (Phase 2)

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/auth/login` | — |
| GET | `/api/v1/auth/me` | cookie or Bearer |
| CRUD | `/api/v1/mapping-profiles` | required |
| GET | `/api/v1/import/template?mappingProfileId=` | download template (`.xlsx` default; `format=csv` for CSV) |
| GET | `/api/v1/import/uploads` | list stored uploads |
| DELETE | `/api/v1/import/uploads/:id` | delete upload + reconcile invoices |
| POST | `/api/v1/import/preview` | multipart `file` → headers / unknown columns |
| POST | `/api/v1/import/spreadsheet` | multipart `file` + `mappingProfileId`; `override=true` replaces same filename |
| POST | `/api/v1/import/spreadsheet/batch` | multipart `files` (multi-file) |

The **Import** page (`/import`) supports Excel and CSV template download (Default spreadsheet profile), drag-and-drop multi-file upload, filename conflict override, dynamic header mapping, and upload history with delete.

**Invoice scan** (`/import/scan`): capture or upload invoice images; OpenAI vision extracts fields; review and confirm before import. Set `OPENAI_API_KEY` in `.env`. Due date defaults to invoice date + 30 days when not found on the document.

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/import/scan/extract` | multipart `file` |
| POST | `/api/v1/import/scan/extract/batch` | multipart `files` |
| POST | `/api/v1/import/scan/confirm` | JSON confirmed fields |
| POST | `/api/v1/import/scan/confirm/batch` | JSON `{ items: [...] }` |
| GET | `/api/v1/import/scan/history` | scan upload history |
| GET | `/api/v1/import/scan/:id/image` | stored scan image |

## Progress

See [progress.txt](progress.txt).
