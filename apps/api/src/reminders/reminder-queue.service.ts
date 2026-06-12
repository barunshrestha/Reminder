import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { ReminderRunService } from "./reminder-run.service";

export const REMINDER_QUEUE_NAME = "reminder-runs";

export interface EnqueueRunPayload {
  scheduleId: string;
  dryRun?: boolean;
}

@Injectable()
export class ReminderQueueService {
  private readonly logger = new Logger(ReminderQueueService.name);
  private queue: Queue<EnqueueRunPayload> | null = null;

  constructor(private readonly reminderRun: ReminderRunService) {}

  private async getQueue(): Promise<Queue<EnqueueRunPayload> | null> {
    if (this.queue) {
      return this.queue;
    }
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl || process.env.REDIS_ENABLED === "false") {
      return null;
    }
    try {
      const connection = {
        ...parseRedisConnection(redisUrl),
        maxRetriesPerRequest: null,
        lazyConnect: true,
      };
      const queue = new Queue<EnqueueRunPayload>(REMINDER_QUEUE_NAME, {
        connection,
      });
      await queue.waitUntilReady();
      this.queue = queue;
      return queue;
    } catch (e) {
      this.logger.warn(
        `Redis unavailable; schedule runs execute inline. ${e}`,
      );
      return null;
    }
  }

  async enqueueRun(payload: EnqueueRunPayload) {
    const queue = await this.getQueue();
    if (queue) {
      try {
        const job = await queue.add("run-schedule", payload, {
          removeOnComplete: 100,
          removeOnFail: 50,
        });
        return { queued: true, jobId: job.id };
      } catch (e) {
        this.logger.warn(`Queue add failed; running inline. ${e}`);
      }
    }
    const result = await this.reminderRun.run(
      payload.scheduleId,
      payload.dryRun,
    );
    return { queued: false, ...result };
  }
}

function parseRedisConnection(redisUrl: string): { host: string; port: number } {
  const url = new URL(redisUrl);
  return {
    host: url.hostname || "localhost",
    port: url.port ? Number(url.port) : 6379,
  };
}
