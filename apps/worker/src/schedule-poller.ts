import { isScheduleDue } from "@payment-reminder/domain";
import type { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import { REMINDER_QUEUE_NAME } from "./queue-names";

const POLL_INTERVAL_MS = 60_000;

export function startSchedulePoller(
  prisma: PrismaClient,
  connection: { host: string; port: number },
): void {
  const queue = new Queue<{ scheduleId: string; tenantId: string; dryRun?: boolean }>(
    REMINDER_QUEUE_NAME,
    { connection },
  );

  const tick = async () => {
    const schedules = await prisma.schedule.findMany({
      where: { enabled: true },
    });
    const now = new Date();

    for (const schedule of schedules) {
      const lastRun = await prisma.scheduleRun.findFirst({
        where: { scheduleId: schedule.id, status: "completed" },
        orderBy: { startedAt: "desc" },
      });

      const due = isScheduleDue(
        {
          cronExpression: schedule.cronExpression,
          rrule: schedule.rrule,
          timezone: schedule.timezone,
        },
        now,
        lastRun?.startedAt ?? null,
      );

      if (due) {
        await queue.add(
          "run-schedule",
          { scheduleId: schedule.id, tenantId: schedule.tenantId },
          { jobId: `schedule-${schedule.id}-${now.toISOString().slice(0, 16)}` },
        );
        console.log(`Enqueued schedule ${schedule.name} (${schedule.id})`);
      }
    }
  };

  void tick();
  setInterval(() => {
    void tick().catch((e) => console.error("Schedule poller error:", e));
  }, POLL_INTERVAL_MS);
}
