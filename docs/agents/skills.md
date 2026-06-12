# Agent Skills Registry

## Payment Reminder Platform

| Field | Value |
|-------|-------|
| **Version** | 1.2 |
| **Last updated** | 2026-06-04 |
| **Purpose** | Catalog of specialized skills (procedure + inputs/outputs + tools) for worker modules and humans. Extend this file as automation grows. |
| **Related docs** | [PRD](../product/PRD.md) · [Engineering Standards](../engineering/standards.md) · [Reminder Agent](agent.md) |

---

## How to use this registry

1. Each skill has a unique **ID** (`skill-<slug>`).
2. The [Reminder Agent](agent.md) delegates work to **sub-agents** (BullMQ handlers) that invoke one or more skills.
3. When adding a skill, copy the [template](#skill-template) below and register the sub-agent in [agent.md §2](agent.md#2-sub-agents).
4. Set **Status** to `draft` → `active` → `deprecated` as the skill is implemented and superseded.

---

## Skill index

| Skill ID | Status | Used by sub-agent |
|----------|--------|-------------------|
| [skill-import-excel](#skill-import-excel) | active | `sync-agent` |
| [skill-field-mapping](#skill-field-mapping) | active | `sync-agent` (UI-assisted) |
| [skill-api-sync](#skill-api-sync) | active | `sync-agent` |
| [skill-db-connector-sync](#skill-db-connector-sync) | active | `sync-agent` |
| [skill-eligibility-evaluator](#skill-eligibility-evaluator) | active | `eligibility-agent` |
| [skill-schedule-runner](#skill-schedule-runner) | active | `reminder-root` |
| [skill-send-email](#skill-send-email) | active | `delivery-agent` |
| [skill-vendor-digest](#skill-vendor-digest) | active | `digest-agent` |
| [skill-compliance-opt-out](#skill-compliance-opt-out) | active | `delivery-agent`, `eligibility-agent` |
| [skill-audit-logger](#skill-audit-logger) | active | all sub-agents |

---

## Core skills (v1)

### skill-import-excel

- **When to use:** Vendor uploads `.xlsx`, `.xls`, or `.csv`; one-time or repeat import with saved mapping profile.
- **Inputs:**
  - `file_id` or upload path
  - `mapping_profile_id` (optional)
  - Column mapping: source header → canonical field (including `due_date`, optional `email_opt_out`, `consent_email`)
- **Outputs:**
  - `{ inserted, updated, skipped_unchanged, errors[] }`
  - Per-row `content_hash` persisted
- **Tools:** File parser (SheetJS), validation schema (Zod), invoice repository upsert.
- **Rules:** [PRD §9.1](../product/PRD.md#91-excel--csv-upload-one-time-or-repeat), [PRD §9.4](../product/PRD.md#94-content-hash-algorithm).
- **Status:** active

---

### skill-field-mapping

- **When to use:** User maps source columns to canonical schema; preview before commit.
- **Inputs:** Source headers, sample rows (≥3), canonical field definitions.
- **Outputs:** Mapping JSON, validation warnings, preview rows.
- **Tools:** Web UI component; API `POST /mapping-profiles/validate`.
- **Rules:** Required fields per [PRD §9.1](../product/PRD.md#91-excel--csv-upload-one-time-or-repeat).
- **Status:** active

---

### skill-api-sync

- **When to use:** Vendor pushes invoice data via REST integration (`POST /invoices/bulk`).
- **Inputs:** Bulk payload, `Idempotency-Key`, API key context.
- **Outputs:** Upsert counts, error list, audit `sync.api.completed`.
- **Tools:** Integration controller, `ContentHashService`, idempotency store.
- **Rules:** [PRD §9.2](../product/PRD.md#92-vendor-rest-api-integration).
- **Status:** active

---

### skill-db-connector-sync

- **When to use:** Scheduled or manual recurring pull from vendor DB or HTTP API.
- **Inputs:** `connector_id`, `run_id`, credentials from vault.
- **Outputs:** Delta stats `{ inserted, updated, skipped_unchanged, deactivated }`.
- **Tools:** Connector adapter, `ContentHashService`, `missed_sync_count` logic.
- **Rules:** [PRD §9.3](../product/PRD.md#93-recurring-db--api-sync), [standards §11](../engineering/standards.md#11-delta-sync-implementation).
- **Status:** active

---

### skill-eligibility-evaluator

- **When to use:** After sync (or standalone) on schedule trigger; build send candidates by tier.
- **Inputs:**
  - `as_of`: datetime in vendor timezone
  - `tiers`: sorted overdue milestones (default `[15, 30, 45, 60]`)
- **Outputs:** Batches grouped by tier: `{ tier, invoice_ids[] }` (at most one tier per invoice).
- **Tools:** `EligibilityService`, `TierOnceService` (next-tier = min eligible), `OptOutService`.
- **Rules:** [PRD §8](../product/PRD.md#8-overdue-tiers-and-templates), ELIG-01–07; branch on `reminder_delivery_mode`.
- **Status:** active

---

### skill-schedule-runner

- **When to use:** Cron or RRULE fires for a named schedule.
- **Inputs:** `schedule_id`, `run_id`, `dry_run` flag.
- **Outputs:** Invokes [agent.md](agent.md) pipeline; `schedule_run` record.
- **Tools:** BullMQ job `schedule-run`, schedule repository.
- **Rules:** [PRD §11](../product/PRD.md#11-scheduling).
- **Status:** active

---

### skill-send-email

- **When to use:** After eligibility; send tier template to customers.
- **Inputs:** `batch_id`, `tier`, `template_id` (e.g. `reminder_tier_30`).
- **Outputs:** Per-recipient `send_log`; on provider accept, increment `notification_number` and set `last_tier_sent`.
- **Tools:** Email provider adapter (SES/SendGrid), template renderer.
- **Rules:** [PRD §14](../product/PRD.md#14-customer-email-delivery).
- **Status:** active

---

### skill-vendor-digest

- **When to use:** After customer sends complete, when `digest_email_enabled = true`.
- **Inputs:** `batch_id`, run summary (counts by tier, failures).
- **Outputs:** Email to vendor users; audit `reminder.digest.sent`.
- **Tools:** Email provider, batch summary query.
- **Rules:** [PRD §12](../product/PRD.md#12-vendor-digest-optional).
- **Status:** active

---

### skill-compliance-opt-out

- **When to use:** Before enqueue send; on unsubscribe link click; at import when column mapped.
- **Inputs:** `email` (normalized lowercase) or `invoice_id`, `channel`.
- **Outputs:** Set `email_opt_out` on matching invoice(s) in deployment; exclude from eligibility; audit `email.opt_out`.
- **Tools:** Invoice repository, `OptOutService`.
- **Rules:** [PRD §15](../product/PRD.md#15-compliance-and-audit).
- **Status:** active

---

### skill-audit-logger

- **When to use:** After any material action in the pipeline.
- **Inputs:** `event_type`, `payload` (JSON), `correlation_id`, `run_id`.
- **Outputs:** Append-only `audit_events` row.
- **Tools:** Audit repository; no PII in payload (use IDs).
- **Rules:** [PRD §15.3](../product/PRD.md#153-audit-log-required-v1), [standards §14](../engineering/standards.md#14-observability).
- **Status:** active

---

## Planned skills (post-v1)

| Skill ID | Purpose | Status |
|----------|---------|--------|
| `skill-send-sms` | Twilio send with TCPA consent check | planned |
| `skill-retry-failed-sends` | Enhanced manual retry from dashboard | planned |

---

## Skill template

Copy when adding a new skill:

```markdown
### skill-<slug>

- **When to use:**
- **Inputs:**
- **Outputs:**
- **Tools:**
- **Rules:** Link to PRD section
- **Status:** draft
```

---

## Mapping skills to PRD requirements

| PRD section | Skills |
|-------------|--------|
| §9 Ingestion | `skill-import-excel`, `skill-field-mapping`, `skill-api-sync`, `skill-db-connector-sync` |
| §8 Tiers | `skill-eligibility-evaluator`, `skill-send-email`, `skill-generate-notification-document` |
| §14 Delivery | `skill-send-email`, `skill-generate-notification-document` |
| §11 Scheduling | `skill-schedule-runner` |
| §12 Digest | `skill-vendor-digest` |
| §15 Compliance | `skill-compliance-opt-out`, `skill-audit-logger` |

---

## Document history

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-04 | Initial skill registry |
| 1.1 | 2026-06-04 | Remove approval skill; activate vendor digest; next-tier eligibility; per-client opt-out |
| 1.2 | 2026-06-04 | Notification document skill; reminder_delivery_mode; email-only |
