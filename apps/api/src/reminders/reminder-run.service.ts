import { Injectable, Optional } from "@nestjs/common";
import { resolve } from "path";
import {
  ConsoleEmailSender,
  createEmailSenderFromEnv,
  ReminderRunExecutor,
  type RunScheduleStats,
} from "@payment-reminder/reminders";
import { ConnectorsService } from "../connectors/connectors.service";
import { NotificationDispatcherService } from "../notifications/notification-dispatcher.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReminderRunService {
  private readonly executor: ReminderRunExecutor;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly connectors?: ConnectorsService,
    @Optional() private readonly notifications?: NotificationDispatcherService,
  ) {
    const storageRoot =
      process.env.STORAGE_ROOT ?? resolve(process.cwd(), "storage");
    this.executor = new ReminderRunExecutor(
      prisma,
      createEmailSenderFromEnv(),
      storageRoot,
      {
        beforeEvaluate: this.connectors
          ? async () => {
              await this.connectors!.syncAllEnabled();
            }
          : undefined,
      },
    );
  }

  async run(scheduleId: string, dryRun?: boolean) {
    try {
      const result = await this.executor.execute({ scheduleId, dryRun });
      if (result.stats.failed > 0) {
        await this.dispatchRunFailureAlert(result.stats, scheduleId);
      }
      return result;
    } catch (error) {
      await this.dispatchRunFailureAlert(undefined, scheduleId, error);
      throw error;
    }
  }

  private async dispatchRunFailureAlert(
    stats: RunScheduleStats | undefined,
    scheduleId: string,
    error?: unknown,
  ) {
    if (!this.notifications) {
      return;
    }
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: { name: true },
    });
    const message =
      error instanceof Error
        ? error.message
        : `${stats?.failed ?? 0} reminder(s) failed`;
    void this.notifications.dispatchAlert("reminder_run_failure", {
      title: "Reminder run failed",
      body: schedule?.name
        ? `${schedule.name}: ${message}`
        : message,
      url: "/schedules",
      tag: "reminder-run-failure",
    });
  }
}
