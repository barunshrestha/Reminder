import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UpdateReminderConfigDto } from "./dto/update-reminder-config.dto";
import { ReminderConfigService } from "./reminder-config.service";

@Controller("reminder-config")
@UseGuards(JwtAuthGuard)
export class ReminderConfigController {
  constructor(private readonly service: ReminderConfigService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles("admin")
  update(@Body() dto: UpdateReminderConfigDto) {
    return this.service.update(dto);
  }
}
