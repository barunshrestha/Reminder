export const CANONICAL_REMINDER_SCHEDULE_ID =
  "00000000-0000-4000-8000-000000000001";

export type ProcessingPreset = "daily" | "weekly" | "manual";
export type TierPreset = "standard" | "gentle" | "custom";

export const TIER_PRESETS: Record<Exclude<TierPreset, "custom">, number[]> = {
  standard: [15, 30, 45, 60],
  gentle: [30, 60],
};

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function inferTierPreset(tiers: readonly number[]): TierPreset {
  const sorted = [...tiers].sort((a, b) => a - b);
  if (arraysEqual(sorted, TIER_PRESETS.standard)) {
    return "standard";
  }
  if (arraysEqual(sorted, TIER_PRESETS.gentle)) {
    return "gentle";
  }
  return "custom";
}

export function resolveOverdueTiers(
  preset: TierPreset,
  customTiers?: number[],
): number[] {
  if (preset === "custom") {
    return normalizeTiers(customTiers ?? []);
  }
  return [...TIER_PRESETS[preset]];
}

export function normalizeTiers(tiers: number[]): number[] {
  const unique = [...new Set(tiers.map((t) => Math.trunc(t)))].filter(
    (t) => t >= 1,
  );
  unique.sort((a, b) => a - b);
  return unique;
}

export function validateOverdueTiers(
  tiers: number[],
): { valid: true } | { valid: false; message: string } {
  if (tiers.length === 0) {
    return { valid: false, message: "At least one overdue tier is required" };
  }
  for (const tier of tiers) {
    if (!Number.isInteger(tier) || tier < 1) {
      return {
        valid: false,
        message: "Each tier must be a positive integer (days past due)",
      };
    }
  }
  return { valid: true };
}

export function buildCronFromPreset(input: {
  preset: Exclude<ProcessingPreset, "manual">;
  runHour: number;
  weeklyDay?: number;
}): string {
  const hour = clampHour(input.runHour);
  if (input.preset === "daily") {
    return `0 ${hour} * * *`;
  }
  const dow = clampWeekday(input.weeklyDay ?? 1);
  return `0 ${hour} * * ${dow}`;
}

export function inferProcessingFromSchedule(input: {
  enabled: boolean;
  cronExpression: string | null;
}): {
  processingPreset: ProcessingPreset;
  runHour: number;
  weeklyDay: number;
} {
  if (!input.enabled || !input.cronExpression?.trim()) {
    return { processingPreset: "manual", runHour: 8, weeklyDay: 1 };
  }

  const parts = input.cronExpression.trim().split(/\s+/);
  if (parts.length < 5) {
    return { processingPreset: "manual", runHour: 8, weeklyDay: 1 };
  }

  const [, hourStr, , , dayOfWeek] = parts;
  const runHour = parseInt(hourStr ?? "8", 10);

  if (dayOfWeek === "*") {
    return {
      processingPreset: "daily",
      runHour: Number.isNaN(runHour) ? 8 : runHour,
      weeklyDay: 1,
    };
  }

  const weeklyDay = parseInt(dayOfWeek ?? "1", 10);
  return {
    processingPreset: "weekly",
    runHour: Number.isNaN(runHour) ? 8 : runHour,
    weeklyDay: Number.isNaN(weeklyDay) ? 1 : weeklyDay,
  };
}

export function describeProcessingSchedule(input: {
  processingPreset: ProcessingPreset;
  runHour: number;
  weeklyDay?: number;
  timezone: string;
  remindersEnabled: boolean;
}): string {
  if (!input.remindersEnabled) {
    return "Reminders are turned off";
  }
  if (input.processingPreset === "manual") {
    return "Manual only — run from the Schedules page";
  }

  const time = formatHour(input.runHour);
  if (input.processingPreset === "daily") {
    return `Every day at ${time} (${input.timezone})`;
  }

  const day =
    WEEKDAY_NAMES[clampWeekday(input.weeklyDay ?? 1)] ?? "Monday";
  return `Every ${day} at ${time} (${input.timezone})`;
}

function formatHour(hour: number): string {
  const h = clampHour(hour);
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${suffix}`;
}

function clampHour(hour: number): number {
  if (!Number.isFinite(hour)) {
    return 8;
  }
  return Math.min(23, Math.max(0, Math.trunc(hour)));
}

function clampWeekday(day: number): number {
  if (!Number.isFinite(day)) {
    return 1;
  }
  return Math.min(6, Math.max(0, Math.trunc(day)));
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
