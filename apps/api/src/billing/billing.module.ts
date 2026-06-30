import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { StripeBillingService } from "./stripe-billing.service";
import { UsageService } from "./usage.service";

@Module({
  controllers: [BillingController],
  providers: [UsageService, StripeBillingService],
  exports: [UsageService, StripeBillingService],
})
export class BillingModule {}
