import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import {
  PreviewReminderTemplateDto,
  UpdateReminderTemplateDto,
} from "./dto/update-reminder-template.dto";
import { ReminderTemplatesService } from "./reminder-templates.service";

@Controller("reminder-templates")
@UseGuards(JwtAuthGuard)
export class ReminderTemplatesController {
  constructor(private readonly service: ReminderTemplatesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post("preview")
  preview(@Body() dto: PreviewReminderTemplateDto) {
    return this.service.preview(dto);
  }

  @Get(":tierDays")
  getOne(@Param("tierDays", ParseIntPipe) tierDays: number) {
    return this.service.getOne(tierDays);
  }

  @Patch(":tierDays")
  @UseGuards(RolesGuard)
  @Roles("admin")
  update(
    @Param("tierDays", ParseIntPipe) tierDays: number,
    @Body() dto: UpdateReminderTemplateDto,
  ) {
    return this.service.update(tierDays, dto);
  }

  @Post(":tierDays/reset")
  @UseGuards(RolesGuard)
  @Roles("admin")
  reset(@Param("tierDays", ParseIntPipe) tierDays: number) {
    return this.service.reset(tierDays);
  }
}
