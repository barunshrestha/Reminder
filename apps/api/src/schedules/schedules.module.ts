import { Module, forwardRef } from "@nestjs/common";
import { RemindersModule } from "../reminders/reminders.module";
import { SchedulesController } from "./schedules.controller";
import { SchedulesService } from "./schedules.service";

@Module({
  imports: [forwardRef(() => RemindersModule)],
  controllers: [SchedulesController],
  providers: [SchedulesService],
})
export class SchedulesModule {}
