import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { TestVendorEmailDto } from "./dto/test-vendor-email.dto";
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

  @Post("test-email")
  @UseGuards(RolesGuard)
  @Roles("admin")
  testEmail(
    @Body() dto: TestVendorEmailDto,
    @CurrentUser() user: { email: string },
  ) {
    return this.service.sendTestEmail(dto, user.email);
  }
}
