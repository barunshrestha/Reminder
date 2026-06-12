import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateScheduleDto } from "./dto/create-schedule.dto";
import { UpdateScheduleDto } from "./dto/update-schedule.dto";
import { SchedulesService } from "./schedules.service";

@Controller("schedules")
@UseGuards(JwtAuthGuard)
export class SchedulesController {
  constructor(private readonly service: SchedulesService) {}

  @Post()
  create(@Body() dto: CreateScheduleDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateScheduleDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Get(":id/runs")
  listRuns(@Param("id") id: string) {
    return this.service.listRuns(id);
  }

  @Post(":id/run")
  triggerRun(
    @Param("id") id: string,
    @Query("dryRun") dryRun?: string,
  ) {
    const dry =
      dryRun === "true" ? true : dryRun === "false" ? false : undefined;
    return this.service.triggerRun(id, dry);
  }
}
