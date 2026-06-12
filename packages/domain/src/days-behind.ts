/**
 * Calendar days between due date and as-of date in the vendor timezone.
 * Uses UTC date parts after shifting as-of instant to vendor TZ.
 */
export function computeDaysBehind(
  dueDateIso: string,
  asOf: Date,
  vendorTimezone: string,
): number {
  const dueParts = parseDateOnly(dueDateIso);
  const asOfParts = getZonedDateParts(asOf, vendorTimezone);
  const dueUtc = Date.UTC(dueParts.year, dueParts.month - 1, dueParts.day);
  const asOfUtc = Date.UTC(asOfParts.year, asOfParts.month - 1, asOfParts.day);
  const diffMs = asOfUtc - dueUtc;
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

function parseDateOnly(iso: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) {
    throw new Error(`Invalid due date: ${iso}`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function getZonedDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}
