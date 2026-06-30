import { Module } from "@nestjs/common";
import { NotificationDispatcherService } from "./notification-dispatcher.service";
import { NotificationsController } from "./notifications.controller";

@Module({
  controllers: [NotificationsController],
  providers: [NotificationDispatcherService],
  exports: [NotificationDispatcherService],
})
export class NotificationsModule {}
