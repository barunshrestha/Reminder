import { Module, forwardRef } from "@nestjs/common";
import { ConnectorsModule } from "../connectors/connectors.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ReminderQueueService } from "./reminder-queue.service";
import { ReminderRunService } from "./reminder-run.service";

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    forwardRef(() => ConnectorsModule),
  ],
  providers: [ReminderRunService, ReminderQueueService],
  exports: [ReminderQueueService, ReminderRunService],
})
export class RemindersModule {}
