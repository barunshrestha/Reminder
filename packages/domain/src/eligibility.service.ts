import type { EligibilityFailure, EligibilityInput } from "./types";
import { getNextTier } from "./tier-once.service";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function evaluateEligibility(
  invoice: EligibilityInput,
  overdueTiers: readonly number[] = [15, 30, 45, 60],
): { eligible: boolean; nextTier: number | null; failures: EligibilityFailure[] } {
  const failures: EligibilityFailure[] = [];

  if (!invoice.sendReminder) {
    failures.push({ rule: "ELIG-01", message: "send_reminder is false" });
  }
  if (!invoice.isActive) {
    failures.push({ rule: "ELIG-02", message: "is_active is false" });
  }
  if (invoice.status !== "open" || parseAmount(invoice.balanceDue) <= 0) {
    failures.push({ rule: "ELIG-03", message: "not open or balance_due <= 0" });
  }

  if (invoice.reminderDeliveryMode === "email") {
    if (!invoice.clientEmail || !EMAIL_REGEX.test(invoice.clientEmail)) {
      failures.push({ rule: "ELIG-04", message: "invalid or missing client_email" });
    }
    if (invoice.emailOptOut) {
      failures.push({ rule: "ELIG-05", message: "email_opt_out is true" });
    }
    if (!invoice.consentEmail) {
      failures.push({ rule: "ELIG-07", message: "consent_email is false" });
    }
  }

  if (invoice.reminderDeliveryMode === "phone") {
    if (!invoice.clientPhone?.trim()) {
      failures.push({ rule: "ELIG-09", message: "invalid or missing client_phone" });
    }
  }

  if (invoice.reminderDeliveryMode === "na") {
    failures.push({ rule: "ELIG-08", message: "delivery mode is N/A" });
  }

  const nextTier = getNextTier(
    invoice.daysBehind,
    invoice.lastTierSent,
    overdueTiers,
  );
  if (nextTier === null) {
    failures.push({ rule: "ELIG-06", message: "no eligible next tier" });
  }

  const eligible = failures.length === 0 && nextTier !== null;
  return { eligible, nextTier, failures };
}

function parseAmount(value: string): number {
  return Number.parseFloat(value);
}
