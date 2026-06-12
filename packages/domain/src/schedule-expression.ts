import { CronExpressionParser } from "cron-parser";
import { RRule } from "rrule";

export interface ScheduleExpressionInput {
  cronExpression?: string | null;
  rrule?: string | null;
}

export function validateScheduleExpression(
  input: ScheduleExpressionInput,
): { valid: true } | { valid: false; message: string } {
  const hasCron = Boolean(input.cronExpression?.trim());
  const hasRrule = Boolean(input.rrule?.trim());

  if (hasCron === hasRrule) {
    return {
      valid: false,
      message: "Provide exactly one of cron_expression or rrule",
    };
  }

  if (hasCron) {
    try {
      CronExpressionParser.parse(input.cronExpression!.trim());
      return { valid: true };
    } catch (e) {
      return {
        valid: false,
        message: e instanceof Error ? e.message : "Invalid cron expression",
      };
    }
  }

  try {
    RRule.fromString(input.rrule!.trim());
    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      message: e instanceof Error ? e.message : "Invalid RRULE",
    };
  }
}

/** True if the schedule should fire in the given minute window (UTC comparison with timezone-aware "now"). */
export function isScheduleDue(
  input: ScheduleExpressionInput & { timezone: string },
  now: Date,
  lastRunAt: Date | null,
): boolean {
  const zonedNow = now;
  const after = lastRunAt ?? new Date(zonedNow.getTime() - 60_000);

  if (input.cronExpression?.trim()) {
    try {
      const interval = CronExpressionParser.parse(input.cronExpression.trim(), {
        currentDate: after,
        tz: input.timezone,
      });
      const next = interval.next().toDate();
      return next.getTime() <= zonedNow.getTime();
    } catch {
      return false;
    }
  }

  if (input.rrule?.trim()) {
    try {
      const rule = RRule.fromString(input.rrule.trim());
      const occurrences = rule.between(after, zonedNow, true);
      return occurrences.length > 0;
    } catch {
      return false;
    }
  }

  return false;
}
