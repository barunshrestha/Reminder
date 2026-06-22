import { loadEnv } from "./load-env";

loadEnv();

import { PrismaClient } from "@prisma/client";
import { Worker } from "bullmq";
import { resolve } from "path";
import {
  createEmailSenderFromEnv,
  ReminderRunExecutor,
} from "@payment-reminder/reminders";
import { REMINDER_QUEUE_NAME } from "./queue-names";
import { startSchedulePoller } from "./schedule-poller";

async function main() {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const connection = parseRedisConnection(redisUrl);
  const prisma = new PrismaClient();
  const storageRoot =
    process.env.STORAGE_ROOT ?? resolve(process.cwd(), "storage");
  const executor = new ReminderRunExecutor(
    prisma,
    createEmailSenderFromEnv(),
    storageRoot,
  );

  const worker = new Worker<{ scheduleId: string; dryRun?: boolean }>(
    REMINDER_QUEUE_NAME,
    async (job) => {
      console.log(`Processing schedule run job ${job.id}`);
      const result = await executor.execute({
        scheduleId: job.data.scheduleId,
        dryRun: job.data.dryRun,
      });
      return result;
    },
    { connection },
  );

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });

  startSchedulePoller(prisma, connection);

  console.log(`Worker listening on queue "${REMINDER_QUEUE_NAME}"`);
}

function parseRedisConnection(redisUrl: string): { host: string; port: number } {
  const url = new URL(redisUrl);
  return {
    host: url.hostname || "localhost",
    port: url.port ? Number(url.port) : 6379,
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
