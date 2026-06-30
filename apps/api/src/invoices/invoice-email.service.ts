import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  computeDaysBehind,
  getNextTier,
} from "@payment-reminder/domain";
import {
  renderReminderEmail,
  type MilestoneTemplateContent,
  type ReminderTemplateData,
} from "@payment-reminder/email-templates";
import {
  buildUnsubscribeUrl,
  createEmailSenderFromEnv,
  type EmailSender,
} from "@payment-reminder/reminders";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenantId } from "../tenancy/tenant-context";
import {
  tenantInvoiceUnique,
  tenantMilestoneUnique,
} from "../tenancy/tenant-scope";

@Injectable()
export class InvoiceEmailService {
  private readonly emailSender: EmailSender;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() emailSender?: EmailSender,
  ) {
    this.emailSender = emailSender ?? createEmailSenderFromEnv();
  }

  async sendToClient(invoiceNumber: string, actorUserId?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: tenantInvoiceUnique(invoiceNumber),
    });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    const clientEmail = invoice.clientEmail?.trim();
    if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      throw new BadRequestException("Invoice has no valid client email address");
    }
    if (invoice.emailOptOut) {
      throw new BadRequestException("Client has opted out of email");
    }
    if (invoice.status !== "open" || invoice.balanceDue.lte(0)) {
      throw new BadRequestException("Invoice is not open with a balance due");
    }

    const settings = await this.prisma.tenantSettings.findUniqueOrThrow({
      where: { tenantId: requireTenantId() },
    });
    const fromEmail =
      settings.fromEmail ?? process.env.EMAIL_DEFAULT_FROM ?? undefined;
    if (!fromEmail?.trim()) {
      throw new BadRequestException(
        "Configure a from email address in Settings before sending",
      );
    }
    if (!settings.vendorPhysicalAddress?.trim()) {
      throw new BadRequestException(
        "Configure a vendor physical address in Settings before sending",
      );
    }

    const today = new Date();
    const dueDate = invoice.dueDate.toISOString().slice(0, 10);
    const daysBehind = computeDaysBehind(dueDate, today, settings.timezone);

    let tier = getNextTier(
      daysBehind,
      invoice.lastTierSent,
      settings.overdueTiers,
    );
    if (tier === null) {
      const sorted = [...settings.overdueTiers].sort((a, b) => a - b);
      const minTier = sorted[0];
      if (minTier === undefined || daysBehind < minTier) {
        throw new BadRequestException(
          "Invoice is not overdue enough to send a payment reminder",
        );
      }
      tier = sorted.filter((t) => daysBehind >= t).at(-1)!;
    }

    const templateOverride = await this.loadTemplateOverride(tier);
    const templateData: ReminderTemplateData = {
      clientName: invoice.clientName,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount.toString(),
      balanceDue: invoice.balanceDue.toString(),
      dueDate,
      dateOfService: invoice.dateOfService
        ? invoice.dateOfService.toISOString().slice(0, 10)
        : null,
      services: invoice.services as ReminderTemplateData["services"],
      daysBehind,
      notificationNumber: invoice.notificationNumber + 1,
      comments: invoice.comments,
      includeComments: settings.includeCommentsInEmail,
      vendorName: settings.vendorName ?? undefined,
      vendorPhysicalAddress: settings.vendorPhysicalAddress,
      unsubscribeUrl: buildUnsubscribeUrl(invoice.invoiceNumber),
    };

    const { subject, html, text, templateId } = renderReminderEmail(
      tier,
      templateData,
      templateOverride,
    );

    const result = await this.emailSender.send({
      to: clientEmail,
      subject,
      html,
      text,
      from: {
        email: fromEmail,
        name: settings.fromName ?? settings.vendorName ?? undefined,
      },
      replyTo: settings.replyToEmail ?? undefined,
      headers: {
        "List-Unsubscribe": `<${templateData.unsubscribeUrl}>`,
      },
    });

    if (!result.accepted) {
      throw new BadRequestException("Email provider did not accept the message");
    }

    const isNewTier =
      invoice.lastTierSent === null || tier > invoice.lastTierSent;

    await this.prisma.$transaction(async (tx) => {
      if (isNewTier) {
        await tx.tierNotification.create({
          data: {
            invoiceId: invoice.id,
            tier,
          },
        });
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          lastReminderSentAt: new Date(),
          notificationNumber: { increment: 1 },
          ...(isNewTier ? { lastTierSent: tier } : {}),
        },
      });
    });

    await this.audit.record("email.sent", {
      source: "manual",
      invoice_number: invoiceNumber,
      tier,
      template_id: templateId,
      to: clientEmail,
      from_email: fromEmail,
      actor_user_id: actorUserId,
      provider_message_id: result.providerMessageId,
    });

    const updated = await this.prisma.invoice.findUniqueOrThrow({
      where: tenantInvoiceUnique(invoiceNumber),
    });

    return {
      ok: true,
      to: clientEmail,
      tier,
      providerMessageId: result.providerMessageId,
      invoice: updated,
    };
  }

  private async loadTemplateOverride(
    tier: number,
  ): Promise<MilestoneTemplateContent | undefined> {
    const row = await this.prisma.reminderMilestoneTemplate.findUnique({
      where: tenantMilestoneUnique(tier),
    });
    if (!row?.isCustom) {
      return undefined;
    }
    return { subject: row.subject, bodyHtml: row.bodyHtml };
  }
}
