import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ReminderTemplatesController } from "./reminder-templates.controller";
import { ReminderTemplatesService } from "./reminder-templates.service";

@Module({
  imports: [PrismaModule],
  controllers: [ReminderTemplatesController],
  providers: [ReminderTemplatesService],
  exports: [ReminderTemplatesService],
})
export class ReminderTemplatesModule {}
