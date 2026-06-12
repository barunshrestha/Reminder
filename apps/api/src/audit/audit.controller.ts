import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuditService } from "./audit.service";

@Controller("audit-events")
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query("limit") limit?: string,
    @Query("event_type") eventType?: string,
  ) {
    return this.audit.list(
      limit ? Math.min(Number(limit), 200) : 50,
      eventType,
    );
  }
}
