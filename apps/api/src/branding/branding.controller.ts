import { Body, Controller, Get, Patch } from "@nestjs/common";
import { BrandingService } from "./branding.service";

@Controller("branding")
export class BrandingController {
  constructor(private readonly service: BrandingService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Patch()
  update(
    @Body()
    body: {
      logo_url?: string;
      primary_color?: string;
      accent_color?: string;
    },
  ) {
    return this.service.update(body);
  }
}
