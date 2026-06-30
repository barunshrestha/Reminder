import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { validateScheduleExpression } from "@payment-reminder/domain";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenantId } from "../tenancy/tenant-context";
import { tenantFilter } from "../tenancy/tenant-scope";
import { ReminderQueueService } from "../reminders/reminder-queue.service";
import { CreateScheduleDto } from "./dto/create-schedule.dto";
import { UpdateScheduleDto } from "./dto/update-schedule.dto";

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reminderQueue: ReminderQueueService,
  ) {}

  async create(dto: CreateScheduleDto) {
    this.assertValidExpression(dto);
    return this.prisma.schedule.create({
      data: {
        tenantId: requireTenantId(),
        name: dto.name,
        cronExpression: dto.cronExpression ?? null,
        rrule: dto.rrule ?? null,
        timezone: dto.timezone ?? "America/New_York",
        enabled: dto.enabled ?? true,
        runSyncBeforeEvaluate: dto.runSyncBeforeEvaluate ?? false,
        dryRun: dto.dryRun ?? false,
      },
    });
  }

  findAll() {
    return this.prisma.schedule.findMany({
      where: tenantFilter(),
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id, ...tenantFilter() },
    });
    if (!schedule) {
      throw new NotFoundException("Schedule not found");
    }
    return schedule;
  }

  async update(id: string, dto: UpdateScheduleDto) {
    await this.findOne(id);
    if (dto.cronExpression !== undefined || dto.rrule !== undefined) {
      const current = await this.findOne(id);
      this.assertValidExpression({
        cronExpression: dto.cronExpression ?? current.cronExpression,
        rrule: dto.rrule ?? current.rrule,
      });
    }
    return this.prisma.schedule.update({
      where: { id },
      data: {
        name: dto.name,
        cronExpression: dto.cronExpression,
        rrule: dto.rrule,
        timezone: dto.timezone,
        enabled: dto.enabled,
        runSyncBeforeEvaluate: dto.runSyncBeforeEvaluate,
        dryRun: dto.dryRun,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.schedule.delete({ where: { id } });
  }

  async listRuns(scheduleId: string) {
    await this.findOne(scheduleId);
    return this.prisma.scheduleRun.findMany({
      where: { scheduleId },
      orderBy: { startedAt: "desc" },
      take: 50,
    });
  }

  async triggerRun(scheduleId: string, dryRun?: boolean) {
    const schedule = await this.findOne(scheduleId);
    return this.reminderQueue.enqueueRun({
      scheduleId,
      tenantId: schedule.tenantId,
      dryRun,
    });
  }

  private assertValidExpression(input: {
    cronExpression?: string | null;
    rrule?: string | null;
  }) {
    const result = validateScheduleExpression(input);
    if (!result.valid) {
      throw new BadRequestException(result.message);
    }
  }
}
