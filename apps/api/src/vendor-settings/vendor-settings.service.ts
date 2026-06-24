import {
  BadRequestException,
  Injectable,
  Optional,
} from "@nestjs/common";
import {
  createEmailSenderFromEnv,
  type EmailSender,
} from "@payment-reminder/reminders";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { TestVendorEmailDto } from "./dto/test-vendor-email.dto";
import type { UpdateVendorSettingsDto } from "./dto/update-vendor-settings.dto";

@Injectable()
export class VendorSettingsService {
  private readonly emailSender: EmailSender;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() emailSender?: EmailSender,
  ) {
    this.emailSender = emailSender ?? createEmailSenderFromEnv();
  }

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
        fromEmail: dto.from_email,
        fromName: dto.from_name,
        replyToEmail: dto.reply_to_email,
      },
    });
  }

  async sendTestEmail(
    dto: TestVendorEmailDto,
    fallbackRecipient: string,
  ) {
    const settings = await this.get();
    const to = dto.to ?? fallbackRecipient;
    const fromEmail =
      settings.fromEmail ?? process.env.EMAIL_DEFAULT_FROM ?? undefined;
    if (!fromEmail) {
      throw new BadRequestException(
        "Configure a from email address before sending a test message",
      );
    }

    const fromName = settings.fromName ?? settings.vendorName ?? undefined;
    const result = await this.emailSender.send({
      to,
      subject: "Payment Reminder — test email",
      html: `<p>This is a test message from <strong>${escapeHtml(fromName ?? fromEmail)}</strong>.</p><p>If you received this, outbound email is configured correctly.</p>`,
      text: `This is a test message from ${fromName ?? fromEmail}. If you received this, outbound email is configured correctly.`,
      from: { email: fromEmail, name: fromName },
      replyTo: settings.replyToEmail ?? undefined,
    });

    if (!result.accepted) {
      throw new BadRequestException("Email provider did not accept the test message");
    }

    await this.prisma.vendorSettings.update({
      where: { id: "default" },
      data: { emailVerifiedAt: new Date() },
    });

    await this.audit.record("email.test.sent", {
      to,
      fromEmail,
      providerMessageId: result.providerMessageId,
    });

    return {
      ok: true,
      to,
      providerMessageId: result.providerMessageId,
    };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
