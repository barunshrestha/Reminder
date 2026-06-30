import { Global, Module } from "@nestjs/common";
import { TenantProvisioningService } from "./tenant-provisioning.service";

@Global()
@Module({
  providers: [TenantProvisioningService],
  exports: [TenantProvisioningService],
})
export class TenancyModule {}
