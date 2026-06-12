import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { VendorSettingsController } from "./vendor-settings.controller";
import { VendorSettingsService } from "./vendor-settings.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [VendorSettingsController],
  providers: [VendorSettingsService],
})
export class VendorSettingsModule {}
