# Local database setup

## `Environment variable not found: DATABASE_URL`

Prisma and the API read `DATABASE_URL` from a **`.env` file at the repo root** (not committed; copy from `.env.example`):

```bash
npm run setup:env
# or: cp .env.example .env
```

Edit `.env` if your Postgres user, password, host, or database name differ. Then start Postgres (Docker or local) and run `npm run db:push`.

The seed script and API also load this file automatically when you run `npm run db:seed` or `npm run dev:api`.

---

Prisma error **P1001** means nothing is listening on the host/port in `DATABASE_URL` (default `localhost:5432`).

You need **PostgreSQL** (and **Redis** for the worker) before `prisma db push`, `db:seed`, or `dev:api`.

Works on **macOS, Linux, and Windows**.

---

## Option A — Docker (recommended, all platforms)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine on Linux).
2. Start Docker and wait until it is running.
3. From the **repository root**:

```bash
docker compose up -d
npx prisma db push
npm run db:seed
```

Windows (PowerShell) uses the same commands from the repo root.

---

## Option B — PostgreSQL installed locally

### macOS

```bash
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis
```

Create the database user and database:

```bash
brew services start postgresql@15   # adjust version if needed
psql -h localhost -d postgres -f scripts/setup-local-db.sql
```

Or run the SQL in `scripts/setup-local-db.sql` manually in pgAdmin/psql.

### Linux

Install PostgreSQL 15+ and Redis from your distribution packages, then run the same SQL as above.

### Windows

1. Install PostgreSQL 15+ ([EDB installer](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads) or `winget install PostgreSQL.PostgreSQL.17`).
2. Open **pgAdmin** or `psql` and run `scripts/setup-local-db.sql`, or use the SQL in the macOS section.

### Apply schema (all platforms)

Set `.env`:

```
DATABASE_URL=postgresql://payment_reminder:payment_reminder@localhost:5432/payment_reminder
REDIS_URL=redis://localhost:6379
```

Then:

```bash
npx prisma db push
npm run db:seed
```

If you use only the default `postgres` superuser:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/payment_reminder
```

Create the `payment_reminder` database first.

---

## Option C — Cloud Postgres (no local install)

Use a free [Neon](https://neon.tech) or [Supabase](https://supabase.com) project.

1. Copy the **connection string** (pooled or direct; Prisma works with either).
2. Set `DATABASE_URL` in `.env`.
3. Run:

```bash
npx prisma db push
npm run db:seed
```

Redis is still required for schedules/worker. For API + web only (login, import, invoices), Postgres alone is enough. Options:

- Docker: `docker compose up -d` (Redis + Postgres)
- macOS/Linux: `brew install redis` / distro package
- Windows: [Memurai](https://www.memurai.com/) or a cloud Redis URL in `REDIS_URL`

---

## Verify connectivity

```bash
npx prisma db push
```

If that succeeds, the P1001 error is resolved.

On bash:

```bash
echo "SELECT 1" | npx prisma db execute --stdin
```

---

## Redis (worker / schedule runs)

Default: `REDIS_URL=redis://localhost:6379`

- **Docker:** `docker compose up -d` starts Redis with Postgres.
- **Native:** install Redis per OS above, or set `REDIS_URL` to a managed Redis instance.
