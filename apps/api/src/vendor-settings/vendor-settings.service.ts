import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateVendorSettingsDto } from "./dto/update-vendor-settings.dto";

@Injectable()
export class VendorSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  get() {
    return this.prisma.vendorSettings.findFirstOrThrow({
      where: { id: "default" },
    });
  }

  update(dto: UpdateVendorSettingsDto) {
    return this.prisma.vendorSettings.update({
      where: { id: "default" },
      data: {
        timezone: dto.timezone,
        overdueTiers: dto.overdue_tiers,
        missedSyncsBeforeInactive: dto.missed_syncs_before_inactive,
        includeCommentsInEmail: dto.include_comments_in_email,
        vendorPhysicalAddress: dto.vendor_physical_address,
        vendorName: dto.vendor_name,
        digestEmailEnabled: dto.digest_email_enabled,
      },
    });
  }
}
