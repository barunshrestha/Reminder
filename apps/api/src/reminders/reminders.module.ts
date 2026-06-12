import { Module, forwardRef } from "@nestjs/common";
import { ConnectorsModule } from "../connectors/connectors.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ReminderQueueService } from "./reminder-queue.service";
import { ReminderRunService } from "./reminder-run.service";

@Module({
  imports: [PrismaModule, forwardRef(() => ConnectorsModule)],
  providers: [ReminderRunService, ReminderQueueService],
  exports: [ReminderQueueService, ReminderRunService],
})
export class RemindersModule {}
