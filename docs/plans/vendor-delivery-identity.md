# Vendor Email/SMS Delivery Identity

Implementation plan for platform-managed outbound email (Phase 1) and SMS (Phase 2, deferred).

## Product decisions

| Decision | Choice |
|----------|--------|
| Rollout | Phase 1: email only; Phase 2 SMS deferred |
| Test from address | `taremamllc@gmail.com` |
| Provider model | Platform-managed (env credentials; vendor sets display From/Reply-To) |
| Geography | US only |
| Channel | Per invoice: email OR sms (mutually exclusive) |
| SMS content (Phase 2) | Short text + signed payment/summary link |
| SMS consent | Import column + invoice UI (`consent_sms`) |
| Phone mode | SMS only; code enum `phone` → product label "SMS" |

## Phase 1 — Email delivery identity

- `VendorSettings`: `fromEmail`, `fromName`, `replyToEmail`, `emailVerifiedAt`
- API: PATCH vendor settings; POST `/vendor-settings/test-email` (admin)
- Platform sender: `ConsoleEmailSender` (dev) or `SendGridEmailSender` (staging/prod)
- Reminder runs use vendor from/reply-to; unsubscribe URL from `PUBLIC_API_BASE_URL`
- Settings UI: Email delivery card with test send
- Skip `phone` mode with audit until SMS ships (no silent PDF generation)

## Phase 2 — SMS (future)

- Schema: `consentSms`, `smsOptOut`, optional `paymentUrl`; vendor `smsEnabled`
- Eligibility: ELIG-10/11; US E.164 validation
- `SmsSender` + Twilio; signed public invoice link in SMS body
- TCPA consent, STOP webhook, 10DLC (ops)

See git history on branch `feature/vendor-delivery-identity` for implementation.
