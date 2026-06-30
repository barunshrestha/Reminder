import { Controller, Get, Post } from "@nestjs/common";
import { OffboardingService } from "./offboarding.service";

@Controller("offboarding")
export class OffboardingController {
  constructor(private readonly service: OffboardingService) {}

  @Post("export")
  requestExport() {
    return this.service.requestExport();
  }

  @Get("exports")
  listExports() {
    return this.service.listExportJobs();
  }

  @Post("suspend")
  suspend() {
    return this.service.suspendTenant();
  }
}
