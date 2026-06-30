import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import {
  buildCronFromPreset,
  describeProcessingSchedule,
  inferTierPreset,
  resolveOverdueTiers,
  type ProcessingPreset,
  validateOverdueTiers,
} from "@payment-reminder/domain";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenantId } from "../tenancy/tenant-context";
import { tenantFilter } from "../tenancy/tenant-scope";
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

const CANONICAL_SCHEDULE_NAME = "Default reminder processing";

@Injectable()
export class ReminderConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<ReminderConfigResponse> {
    const settings = await this.prisma.tenantSettings.findUniqueOrThrow({
      where: { tenantId: requireTenantId() },
    });
    const schedule = await this.getOrCreateCanonicalSchedule(settings.timezone);
    return this.toResponse(settings, schedule);
  }

  async update(dto: UpdateReminderConfigDto): Promise<ReminderConfigResponse> {
    const tenantId = requireTenantId();
    const settings = await this.prisma.tenantSettings.findUniqueOrThrow({
      where: { tenantId },
    });
    const schedule = await this.getOrCreateCanonicalSchedule(settings.timezone);

    const tierPreset =
      dto.tierPreset ?? inferTierPreset(settings.overdueTiers);
    const overdueTiers = resolveOverdueTiers(
      tierPreset,
      dto.overdueTiers ?? settings.overdueTiers,
    );
    const tierValidation = validateOverdueTiers(overdueTiers);
    if (!tierValidation.valid) {
      throw new BadRequestException(tierValidation.message);
    }

    const processingPreset = parseProcessingPreset(
      dto.processingPreset ?? settings.processingPreset,
    );
    const runHour = dto.runHour ?? settings.processingRunHour;
    const weeklyDay = dto.weeklyDay ?? settings.processingWeeklyDay;
    const timezone = dto.timezone ?? settings.timezone;
    const remindersEnabled = dto.remindersEnabled ?? settings.remindersEnabled;
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

    const updatedSettings = await this.prisma.tenantSettings.update({
      where: { tenantId },
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
      where: { id: schedule.id },
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

    return this.toResponse(updatedSettings, updatedSchedule);
  }

  private async getOrCreateCanonicalSchedule(timezone: string) {
    const existing = await this.prisma.schedule.findFirst({
      where: { ...tenantFilter(), name: CANONICAL_SCHEDULE_NAME },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.schedule.create({
      data: {
        tenantId: requireTenantId(),
        name: CANONICAL_SCHEDULE_NAME,
        cronExpression: "0 8 * * *",
        timezone,
        enabled: true,
        dryRun: false,
        runSyncBeforeEvaluate: false,
      },
    });
  }

  private toResponse(
    settings: {
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
    const processingPreset = parseProcessingPreset(settings.processingPreset);

    return {
      overdueTiers: settings.overdueTiers,
      tierPreset: inferTierPreset(settings.overdueTiers),
      remindersEnabled: settings.remindersEnabled,
      processingPreset,
      weeklyDay: settings.processingWeeklyDay,
      runHour: settings.processingRunHour,
      timezone: settings.timezone,
      syncBeforeCheck: schedule.runSyncBeforeEvaluate,
      scheduleId: schedule.id,
      nextRunDescription: describeProcessingSchedule({
        processingPreset,
        runHour: settings.processingRunHour,
        weeklyDay: settings.processingWeeklyDay,
        timezone: settings.timezone,
        remindersEnabled: settings.remindersEnabled,
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
