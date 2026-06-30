import { Module } from "@nestjs/common";
import { PlatformAdminController } from "./platform-admin.controller";
import { PlatformAdminGuard } from "./platform-admin.guard";

@Module({
  controllers: [PlatformAdminController],
  providers: [PlatformAdminGuard],
})
export class PlatformAdminModule {}
