import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ReminderConfigController } from "./reminder-config.controller";
import { ReminderConfigService } from "./reminder-config.service";

@Module({
  imports: [PrismaModule],
  controllers: [ReminderConfigController],
  providers: [ReminderConfigService],
  exports: [ReminderConfigService],
})
export class ReminderConfigModule {}
