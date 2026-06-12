import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MetricsService } from "./metrics.service";

@Controller("metrics")
@UseGuards(JwtAuthGuard)
export class MetricsController {
  constructor(private readonly service: MetricsService) {}

  @Get()
  summary() {
    return this.service.getSummary();
  }
}
