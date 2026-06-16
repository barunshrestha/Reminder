import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  getDefaultMilestoneTemplate,
  MERGE_FIELDS,
  renderReminderDocumentHtml,
  renderReminderEmail,
  type MilestoneTemplateContent,
  type ReminderTemplateData,
} from "@payment-reminder/email-templates";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { PreviewReminderTemplateDto } from "./dto/update-reminder-template.dto";
import type { UpdateReminderTemplateDto } from "./dto/update-reminder-template.dto";

export interface ReminderTemplateItem {
  tierDays: number;
  subject: string;
  bodyHtml: string;
  isCustom: boolean;
  isDefault: boolean;
}

const SAMPLE_TEMPLATE_DATA: ReminderTemplateData = {
  clientName: "Sample Client LLC",
  invoiceNumber: "INV-1001",
  totalAmount: "1,250.00",
  balanceDue: "850.00",
  dueDate: "2026-01-15",
  dateOfService: "2026-01-01",
  daysBehind: 30,
  notificationNumber: 1,
  vendorName: "Your Company",
  vendorPhysicalAddress: "123 Main Street, Springfield, ST 00000",
  includeComments: false,
  unsubscribeUrl: "https://example.com/unsubscribe",
};

@Injectable()
export class ReminderTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<{
    templates: ReminderTemplateItem[];
    mergeFields: string[];
  }> {
    const vendor = await this.prisma.vendorSettings.findFirstOrThrow({
      where: { id: "default" },
    });
    const stored = await this.prisma.reminderMilestoneTemplate.findMany();
    const storedByTier = new Map(stored.map((row) => [row.tierDays, row]));

    const templates = vendor.overdueTiers.map((tierDays) =>
      this.toTemplateItem(tierDays, storedByTier.get(tierDays)),
    );

    return {
      templates,
      mergeFields: [...MERGE_FIELDS],
    };
  }

  async getOne(tierDays: number): Promise<ReminderTemplateItem> {
    await this.assertTierAllowed(tierDays);
    const stored = await this.prisma.reminderMilestoneTemplate.findUnique({
      where: { tierDays },
    });
    return this.toTemplateItem(tierDays, stored ?? undefined);
  }

  async update(
    tierDays: number,
    dto: UpdateReminderTemplateDto,
  ): Promise<ReminderTemplateItem> {
    await this.assertTierAllowed(tierDays);

    const row = await this.prisma.reminderMilestoneTemplate.upsert({
      where: { tierDays },
      create: {
        tierDays,
        subject: dto.subject.trim(),
        bodyHtml: dto.bodyHtml.trim(),
        isCustom: true,
      },
      update: {
        subject: dto.subject.trim(),
        bodyHtml: dto.bodyHtml.trim(),
        isCustom: true,
      },
    });

    await this.audit.record("reminder_template.updated", {
      tier_days: tierDays,
    });

    return this.toTemplateItem(tierDays, row);
  }

  async reset(tierDays: number): Promise<ReminderTemplateItem> {
    await this.assertTierAllowed(tierDays);

    await this.prisma.reminderMilestoneTemplate.deleteMany({
      where: { tierDays },
    });

    await this.audit.record("reminder_template.reset", {
      tier_days: tierDays,
    });

    return this.toTemplateItem(tierDays, undefined);
  }

  async preview(dto: PreviewReminderTemplateDto) {
    const vendor = await this.prisma.vendorSettings.findFirstOrThrow({
      where: { id: "default" },
    });

    let sample = {
      ...SAMPLE_TEMPLATE_DATA,
      daysBehind: dto.tierDays + 1,
      vendorName: vendor.vendorName ?? SAMPLE_TEMPLATE_DATA.vendorName,
      vendorPhysicalAddress:
        vendor.vendorPhysicalAddress ??
        SAMPLE_TEMPLATE_DATA.vendorPhysicalAddress,
      includeComments: vendor.includeCommentsInEmail,
    };

    if (dto.invoiceNumber) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { invoiceNumber: dto.invoiceNumber },
      });
      if (invoice) {
        sample = {
          clientName: invoice.clientName,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount.toString(),
          balanceDue: invoice.balanceDue.toString(),
          dueDate: invoice.dueDate.toISOString().slice(0, 10),
          dateOfService: invoice.dateOfService
            ? invoice.dateOfService.toISOString().slice(0, 10)
            : null,
          services: invoice.services as ReminderTemplateData["services"],
          daysBehind: dto.tierDays + 5,
          notificationNumber: invoice.notificationNumber,
          comments: invoice.comments,
          vendorName: vendor.vendorName ?? undefined,
          vendorPhysicalAddress: vendor.vendorPhysicalAddress,
          includeComments: vendor.includeCommentsInEmail,
          unsubscribeUrl: `https://localhost/api/v1/unsubscribe?invoice=${invoice.invoiceNumber}`,
        };
      }
    }

    const override: MilestoneTemplateContent = {
      subject: dto.subject,
      bodyHtml: dto.bodyHtml,
    };

    const email = renderReminderEmail(dto.tierDays, sample, override);
    const document = renderReminderDocumentHtml(dto.tierDays, sample, override);

    return {
      subject: email.subject,
      html: email.html,
      text: email.text,
      documentHtml: document.html,
    };
  }

  async loadTemplateMap(): Promise<Map<number, MilestoneTemplateContent>> {
    const rows = await this.prisma.reminderMilestoneTemplate.findMany({
      where: { isCustom: true },
    });
    const map = new Map<number, MilestoneTemplateContent>();
    for (const row of rows) {
      map.set(row.tierDays, {
        subject: row.subject,
        bodyHtml: row.bodyHtml,
      });
    }
    return map;
  }

  resolveTemplate(
    tierDays: number,
    map: Map<number, MilestoneTemplateContent>,
  ): MilestoneTemplateContent | undefined {
    return map.get(tierDays);
  }

  private toTemplateItem(
    tierDays: number,
    stored?: {
      subject: string;
      bodyHtml: string;
      isCustom: boolean;
    },
  ): ReminderTemplateItem {
    if (stored?.isCustom) {
      return {
        tierDays,
        subject: stored.subject,
        bodyHtml: stored.bodyHtml,
        isCustom: true,
        isDefault: false,
      };
    }

    const defaults = getDefaultMilestoneTemplate(tierDays);
    return {
      tierDays,
      subject: defaults.subject,
      bodyHtml: defaults.bodyHtml,
      isCustom: false,
      isDefault: true,
    };
  }

  private async assertTierAllowed(tierDays: number): Promise<void> {
    if (!Number.isInteger(tierDays) || tierDays < 1) {
      throw new BadRequestException("tierDays must be a positive integer");
    }

    const vendor = await this.prisma.vendorSettings.findFirstOrThrow({
      where: { id: "default" },
    });

    if (!vendor.overdueTiers.includes(tierDays)) {
      throw new BadRequestException(
        `Tier ${tierDays} is not in the current overdue milestones`,
      );
    }
  }
}
