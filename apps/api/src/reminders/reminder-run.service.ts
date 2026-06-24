import { Injectable, Optional } from "@nestjs/common";
import { resolve } from "path";
import {
  ConsoleEmailSender,
  createEmailSenderFromEnv,
  ReminderRunExecutor,
} from "@payment-reminder/reminders";
import { ConnectorsService } from "../connectors/connectors.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReminderRunService {
  private readonly executor: ReminderRunExecutor;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly connectors?: ConnectorsService,
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

  run(scheduleId: string, dryRun?: boolean) {
    return this.executor.execute({ scheduleId, dryRun });
  }
}
