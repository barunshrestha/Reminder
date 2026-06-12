-- Homebrew / native PostgreSQL (no Docker). Run as a superuser, e.g.:
--   psql -h localhost -d postgres -f scripts/setup-local-db.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'payment_reminder') THEN
    CREATE USER payment_reminder WITH PASSWORD 'payment_reminder';
  END IF;
END
$$;

SELECT 'CREATE DATABASE payment_reminder OWNER payment_reminder'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'payment_reminder')\gexec

GRANT ALL PRIVILEGES ON DATABASE payment_reminder TO payment_reminder;
