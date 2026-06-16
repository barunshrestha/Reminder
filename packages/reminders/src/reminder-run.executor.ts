import {
  computeDaysBehind,
  evaluateEligibility,
  type EligibilityInput,
} from "@payment-reminder/domain";
import {
  renderReminderDocumentHtml,
  renderReminderEmail,
  type MilestoneTemplateContent,
  type ReminderTemplateData,
} from "@payment-reminder/email-templates";
import type { PrismaClient } from "@prisma/client";
import type { EmailSender } from "./email-sender";
import { ensureStorageRoot, generateNotificationDocument } from "./document-generator";
import { sendVendorDigest } from "./vendor-digest";

export interface ReminderRunHooks {
  beforeEvaluate?: (scheduleId: string, runId: string) => Promise<void>;
}

export interface RunScheduleOptions {
  scheduleId: string;
  dryRun?: boolean;
  storageRoot?: string;
}

export interface RunScheduleStats {
  evaluated: number;
  eligible: number;
  emailsSent: number;
  documentsGenerated: number;
  skippedAlreadySent: number;
  skippedIneligible: number;
  failed: number;
  dryRun: boolean;
}

export class ReminderRunExecutor {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly emailSender: EmailSender,
    private readonly storageRoot: string,
    private readonly hooks: ReminderRunHooks = {},
  ) {}

  async execute(options: RunScheduleOptions): Promise<{
    runId: string;
    stats: RunScheduleStats;
  }> {
    const schedule = await this.prisma.schedule.findUniqueOrThrow({
      where: { id: options.scheduleId },
    });
    const dryRun = options.dryRun ?? schedule.dryRun;
    const storageRoot = options.storageRoot ?? this.storageRoot;

    const run = await this.prisma.scheduleRun.create({
      data: {
        scheduleId: schedule.id,
        status: "running",
        dryRun,
      },
    });

    const stats: RunScheduleStats = {
      evaluated: 0,
      eligible: 0,
      emailsSent: 0,
      documentsGenerated: 0,
      skippedAlreadySent: 0,
      skippedIneligible: 0,
      failed: 0,
      dryRun,
    };

    try {
      await this.audit("schedule.run.started", {
        scheduleId: schedule.id,
        runId: run.id,
        dryRun,
      });

      if (schedule.runSyncBeforeEvaluate) {
        if (this.hooks.beforeEvaluate) {
          await this.hooks.beforeEvaluate(schedule.id, run.id);
        } else {
          await this.audit("schedule.run.sync_skipped", {
            runId: run.id,
            message: "No connector sync hook configured",
          });
        }
      }

      const vendor = await this.prisma.vendorSettings.findFirstOrThrow({
        where: { id: "default" },
      });

      if (!dryRun) {
        await ensureStorageRoot(storageRoot);
      }

      const templateRows = await this.prisma.reminderMilestoneTemplate.findMany({
        where: { isCustom: true },
      });
      const templateMap = new Map<number, MilestoneTemplateContent>(
        templateRows.map((row) => [
          row.tierDays,
          { subject: row.subject, bodyHtml: row.bodyHtml },
        ]),
      );

      const invoices = await this.prisma.invoice.findMany({
        where: { sendReminder: true, isActive: true, status: "open" },
      });

      const today = new Date();

      for (const invoice of invoices) {
        stats.evaluated++;
        const daysBehind = computeDaysBehind(
          formatDate(invoice.dueDate),
          today,
          vendor.timezone,
        );

        const input: EligibilityInput = {
          clientName: invoice.clientName,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount.toString(),
          balanceDue: invoice.balanceDue.toString(),
          dueDate: formatDate(invoice.dueDate),
          dateOfService: invoice.dateOfService
            ? formatDate(invoice.dateOfService)
            : null,
          services: invoice.services as EligibilityInput["services"],
          clientEmail: invoice.clientEmail,
          comments: invoice.comments,
          sendReminder: invoice.sendReminder,
          externalClientId: invoice.externalClientId,
          status: invoice.status,
          emailOptOut: invoice.emailOptOut,
          consentEmail: invoice.consentEmail,
          reminderDeliveryMode: invoice.reminderDeliveryMode,
          lastTierSent: invoice.lastTierSent,
          isActive: invoice.isActive,
          daysBehind,
        };

        const { eligible, nextTier, failures } = evaluateEligibility(
          input,
          vendor.overdueTiers,
        );

        if (!eligible || nextTier === null) {
          stats.skippedIneligible++;
          continue;
        }

        const existingTier = await this.prisma.tierNotification.findUnique({
          where: {
            invoiceId_tier: { invoiceId: invoice.id, tier: nextTier },
          },
        });
        if (existingTier) {
          stats.skippedAlreadySent++;
          continue;
        }

        stats.eligible++;

        if (dryRun) {
          await this.audit("schedule.run.preview", {
            runId: run.id,
            invoiceNumber: invoice.invoiceNumber,
            tier: nextTier,
            deliveryMode: invoice.reminderDeliveryMode,
          });
          continue;
        }

        const templateData: ReminderTemplateData = {
          clientName: invoice.clientName,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount.toString(),
          balanceDue: invoice.balanceDue.toString(),
          dueDate: formatDate(invoice.dueDate),
          dateOfService: invoice.dateOfService
            ? formatDate(invoice.dateOfService)
            : null,
          services: invoice.services as ReminderTemplateData["services"],
          daysBehind,
          notificationNumber: invoice.notificationNumber,
          comments: invoice.comments,
          includeComments: vendor.includeCommentsInEmail,
          vendorName: vendor.vendorName ?? undefined,
          vendorPhysicalAddress: vendor.vendorPhysicalAddress,
          unsubscribeUrl: `https://localhost/api/v1/unsubscribe?invoice=${invoice.invoiceNumber}`,
        };

        const templateOverride = templateMap.get(nextTier);

        try {
          if (invoice.reminderDeliveryMode === "email") {
            await this.sendEmailReminder(
              invoice.id,
              invoice.clientEmail!,
              nextTier,
              templateData,
              run.id,
              templateOverride,
            );
            stats.emailsSent++;
          } else {
            await this.generateDocumentReminder(
              invoice.id,
              nextTier,
              templateData,
              run.id,
              storageRoot,
              templateOverride,
            );
            stats.documentsGenerated++;
          }

          await this.prisma.$transaction([
            this.prisma.tierNotification.create({
              data: {
                invoiceId: invoice.id,
                tier: nextTier,
                scheduleRunId: run.id,
              },
            }),
            this.prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                lastTierSent: nextTier,
                lastReminderSentAt: new Date(),
                notificationNumber: { increment: 1 },
              },
            }),
          ]);
        } catch (e) {
          stats.failed++;
          const message = e instanceof Error ? e.message : "unknown error";
          await this.audit(
            invoice.reminderDeliveryMode === "email"
              ? "email.failed"
              : "document.failed",
            {
              runId: run.id,
              invoiceNumber: invoice.invoiceNumber,
              tier: nextTier,
              message,
            },
          );
        }
      }

      if (vendor.digestEmailEnabled && !dryRun) {
        const users = await this.prisma.user.findMany({ select: { email: true } });
        const recipients = users.map((u) => u.email);
        const digestResult = await sendVendorDigest(this.emailSender, {
          runId: run.id,
          scheduleName: schedule.name,
          stats,
          vendorName: vendor.vendorName,
          recipients,
        });
        await this.audit("reminder.digest.sent", {
          runId: run.id,
          scheduleId: schedule.id,
          stats,
          recipients_count: recipients.length,
          emails_sent: digestResult.sent,
        });
      }

      await this.prisma.scheduleRun.update({
        where: { id: run.id },
        data: {
          status: "completed",
          endedAt: new Date(),
          stats: stats as object,
        },
      });

      await this.audit("schedule.run.completed", {
        scheduleId: schedule.id,
        runId: run.id,
        stats,
      });

      return { runId: run.id, stats };
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown error";
      await this.prisma.scheduleRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          endedAt: new Date(),
          errorMessage: message,
          stats: stats as object,
        },
      });
      await this.audit("schedule.run.failed", {
        scheduleId: schedule.id,
        runId: run.id,
        message,
      });
      throw e;
    }
  }

  private async sendEmailReminder(
    invoiceId: string,
    to: string,
    tier: number,
    data: ReminderTemplateData,
    runId: string,
    templateOverride?: MilestoneTemplateContent,
  ): Promise<void> {
    const { subject, html, text, templateId } = renderReminderEmail(
      tier,
      data,
      templateOverride,
    );
    const result = await this.emailSender.send({
      to,
      subject,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${data.unsubscribeUrl}>`,
      },
    });
    if (!result.accepted) {
      throw new Error("Email provider did not accept message");
    }
    await this.audit("email.sent", {
      invoiceId,
      tier,
      templateId,
      runId,
      providerMessageId: result.providerMessageId,
    });
  }

  private async generateDocumentReminder(
    invoiceId: string,
    tier: number,
    data: ReminderTemplateData,
    runId: string,
    storageRoot: string,
    templateOverride?: MilestoneTemplateContent,
  ): Promise<void> {
    const { html, templateId } = renderReminderDocumentHtml(
      tier,
      data,
      templateOverride,
    );
    const doc = await generateNotificationDocument({
      invoiceId,
      tier,
      html,
      storageRoot,
    });
    await this.prisma.notificationDocument.create({
      data: {
        invoiceId,
        tier,
        templateVersion: templateId,
        pdfStorageKey: doc.pdfStorageKey,
        htmlSnapshot: doc.htmlSnapshot,
        runId,
      },
    });
    await this.audit("document.generated", {
      invoiceId,
      tier,
      templateId,
      runId,
      pdfStorageKey: doc.pdfStorageKey,
    });
  }

  private async audit(eventType: string, payload: object): Promise<void> {
    await this.prisma.auditEvent.create({
      data: { eventType, payload },
    });
  }
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
