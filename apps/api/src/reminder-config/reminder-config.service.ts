import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import {
  buildCronFromPreset,
  CANONICAL_REMINDER_SCHEDULE_ID,
  describeProcessingSchedule,
  inferTierPreset,
  resolveOverdueTiers,
  type ProcessingPreset,
  validateOverdueTiers,
} from "@payment-reminder/domain";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateReminderConfigDto } from "./dto/update-reminder-config.dto";

export interface ReminderConfigResponse {
  overdueTiers: number[];
  tierPreset: "standard" | "gentle" | "custom";
  remindersEnabled: boolean;
  processingPreset: ProcessingPreset;
  weeklyDay: number;
  runHour: number;
  timezone: string;
  syncBeforeCheck: boolean;
  scheduleId: string;
  nextRunDescription: string;
}

@Injectable()
export class ReminderConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<ReminderConfigResponse> {
    const vendor = await this.prisma.vendorSettings.findFirstOrThrow({
      where: { id: "default" },
    });
    const schedule = await this.getOrCreateCanonicalSchedule(vendor.timezone);
    return this.toResponse(vendor, schedule);
  }

  async update(dto: UpdateReminderConfigDto): Promise<ReminderConfigResponse> {
    const vendor = await this.prisma.vendorSettings.findFirstOrThrow({
      where: { id: "default" },
    });
    const schedule = await this.getOrCreateCanonicalSchedule(vendor.timezone);

    const tierPreset =
      dto.tierPreset ?? inferTierPreset(vendor.overdueTiers);
    const overdueTiers = resolveOverdueTiers(
      tierPreset,
      dto.overdueTiers ?? vendor.overdueTiers,
    );
    const tierValidation = validateOverdueTiers(overdueTiers);
    if (!tierValidation.valid) {
      throw new BadRequestException(tierValidation.message);
    }

    const processingPreset = parseProcessingPreset(
      dto.processingPreset ?? vendor.processingPreset,
    );
    const runHour = dto.runHour ?? vendor.processingRunHour;
    const weeklyDay = dto.weeklyDay ?? vendor.processingWeeklyDay;
    const timezone = dto.timezone ?? vendor.timezone;
    const remindersEnabled = dto.remindersEnabled ?? vendor.remindersEnabled;
    const syncBeforeCheck =
      dto.syncBeforeCheck ?? schedule.runSyncBeforeEvaluate;

    let cronExpression = schedule.cronExpression ?? "0 8 * * *";
    if (processingPreset !== "manual") {
      cronExpression = buildCronFromPreset({
        preset: processingPreset,
        runHour,
        weeklyDay,
      });
    }

    const scheduleEnabled =
      remindersEnabled && processingPreset !== "manual";

    const updatedVendor = await this.prisma.vendorSettings.update({
      where: { id: "default" },
      data: {
        overdueTiers,
        timezone,
        remindersEnabled,
        processingPreset,
        processingRunHour: runHour,
        processingWeeklyDay: weeklyDay,
      },
    });

    const updatedSchedule = await this.prisma.schedule.update({
      where: { id: CANONICAL_REMINDER_SCHEDULE_ID },
      data: {
        cronExpression,
        rrule: null,
        timezone,
        enabled: scheduleEnabled,
        runSyncBeforeEvaluate: syncBeforeCheck,
        dryRun: false,
      },
    });

    await this.audit.record("reminder_config.updated", {
      overdue_tiers: overdueTiers,
      processing_preset: processingPreset,
      reminders_enabled: remindersEnabled,
      schedule_enabled: scheduleEnabled,
    });

    return this.toResponse(updatedVendor, updatedSchedule);
  }

  private async getOrCreateCanonicalSchedule(timezone: string) {
    const existing = await this.prisma.schedule.findUnique({
      where: { id: CANONICAL_REMINDER_SCHEDULE_ID },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.schedule.create({
      data: {
        id: CANONICAL_REMINDER_SCHEDULE_ID,
        name: "Default reminder processing",
        cronExpression: "0 8 * * *",
        timezone,
        enabled: true,
        dryRun: false,
        runSyncBeforeEvaluate: false,
      },
    });
  }

  private toResponse(
    vendor: {
      overdueTiers: number[];
      timezone: string;
      remindersEnabled: boolean;
      processingPreset: string;
      processingRunHour: number;
      processingWeeklyDay: number;
    },
    schedule: {
      id: string;
      timezone: string;
      runSyncBeforeEvaluate: boolean;
    },
  ): ReminderConfigResponse {
    const processingPreset = parseProcessingPreset(vendor.processingPreset);

    return {
      overdueTiers: vendor.overdueTiers,
      tierPreset: inferTierPreset(vendor.overdueTiers),
      remindersEnabled: vendor.remindersEnabled,
      processingPreset,
      weeklyDay: vendor.processingWeeklyDay,
      runHour: vendor.processingRunHour,
      timezone: vendor.timezone,
      syncBeforeCheck: schedule.runSyncBeforeEvaluate,
      scheduleId: schedule.id,
      nextRunDescription: describeProcessingSchedule({
        processingPreset,
        runHour: vendor.processingRunHour,
        weeklyDay: vendor.processingWeeklyDay,
        timezone: vendor.timezone,
        remindersEnabled: vendor.remindersEnabled,
      }),
    };
  }
}

function parseProcessingPreset(value: string): ProcessingPreset {
  if (value === "weekly" || value === "manual") {
    return value;
  }
  return "daily";
}
