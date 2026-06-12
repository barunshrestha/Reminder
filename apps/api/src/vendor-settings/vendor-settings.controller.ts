import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UpdateVendorSettingsDto } from "./dto/update-vendor-settings.dto";
import { VendorSettingsService } from "./vendor-settings.service";

@Controller("vendor-settings")
@UseGuards(JwtAuthGuard)
export class VendorSettingsController {
  constructor(private readonly service: VendorSettingsService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles("admin")
  update(@Body() dto: UpdateVendorSettingsDto) {
    return this.service.update(dto);
  }
}
