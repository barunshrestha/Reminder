import type {
  MergeFieldContext,
  MilestoneTemplateContent,
  ReminderTemplateData,
} from "./types";
import { MERGE_FIELDS } from "./types";

export { MERGE_FIELDS };
export type { MilestoneTemplateContent, ReminderTemplateData, MergeFieldContext };

export function templateIdForTier(tier: number): string {
  return `reminder_tier_${tier}`;
}

export function getDefaultMilestoneTemplate(tier: number): MilestoneTemplateContent {
  return {
    subject:
      "Payment reminder — invoice {{invoice_number}} ({{days_behind}} days past due)",
    bodyHtml: `{{days_behind}} days past due

Your invoice {{invoice_number}} is past due by more than {{tier}} days from its due date of {{due_date}}. The outstanding balance is {{balance_due}}. Please make a payment as soon as possible.`,
  };
}

export function applyMergeFields(
  template: string,
  data: MergeFieldContext,
): string {
  const replacements: Record<string, string> = {
    client_name: data.clientName,
    invoice_number: data.invoiceNumber,
    balance_due: data.balanceDue,
    total_amount: data.totalAmount,
    due_date: data.dueDate,
    days_behind: String(data.daysBehind),
    tier: String(data.tier),
    vendor_name: data.vendorName ?? "",
    date_of_service: data.dateOfService ?? "",
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in replacements ? replacements[key]! : match;
  });
}

export function resolveMilestoneTemplate(
  tier: number,
  override?: MilestoneTemplateContent,
): MilestoneTemplateContent {
  return override ?? getDefaultMilestoneTemplate(tier);
}

export function subjectForTier(
  tier: number,
  data: MergeFieldContext,
  override?: MilestoneTemplateContent,
): string {
  const template = resolveMilestoneTemplate(tier, override);
  return applyMergeFields(template.subject, data);
}

export function renderReminderEmail(
  tier: number,
  data: ReminderTemplateData,
  override?: MilestoneTemplateContent,
): { subject: string; html: string; text: string; templateId: string } {
  const templateId = templateIdForTier(tier);
  const mergeContext: MergeFieldContext = { ...data, tier };
  const template = resolveMilestoneTemplate(tier, override);
  const subject = applyMergeFields(template.subject, mergeContext);
  const body = buildBody(tier, data, template.bodyHtml);
  const footer = buildEmailFooter(data);
  const html = `<!DOCTYPE html><html><body>${body}${footer}</body></html>`;
  const text = `${stripHtml(body)}\n\n${stripHtml(footer)}`;
  return { subject, html, text, templateId };
}

export function renderReminderDocumentHtml(
  tier: number,
  data: ReminderTemplateData,
  override?: MilestoneTemplateContent,
): { html: string; templateId: string } {
  const templateId = templateIdForTier(tier);
  const template = resolveMilestoneTemplate(tier, override);
  const body = buildBody(tier, data, template.bodyHtml);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(templateId)}</title></head><body>${body}<p><em>Notification document — vendor delivery</em></p></body></html>`;
  return { html, templateId };
}

function buildBody(
  tier: number,
  data: ReminderTemplateData,
  messageTemplate: string,
): string {
  const mergeContext: MergeFieldContext = { ...data, tier };
  const messageHtml = plainTextToHtml(
    applyMergeFields(messageTemplate, mergeContext),
  );

  const services = formatServices(data.services);
  const comments =
    data.includeComments && data.comments
      ? `<p><strong>Comments:</strong> ${escapeHtml(data.comments)}</p>`
      : "";

  return `<p>Dear ${escapeHtml(data.clientName)},</p>
${messageHtml}
<ul>
  <li><strong>Invoice:</strong> ${escapeHtml(data.invoiceNumber)}</li>
  <li><strong>Due date:</strong> ${escapeHtml(data.dueDate)}</li>
  <li><strong>Balance due:</strong> $${escapeHtml(data.balanceDue)}</li>
  <li><strong>Total amount:</strong> $${escapeHtml(data.totalAmount)}</li>
  <li><strong>Days past due:</strong> ${data.daysBehind}</li>
  ${data.dateOfService ? `<li><strong>Date of service:</strong> ${escapeHtml(data.dateOfService)}</li>` : ""}
  ${services ? `<li><strong>Services:</strong> ${services}</li>` : ""}
</ul>
${comments}`;
}

function plainTextToHtml(text: string): string {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    return "";
  }
  return paragraphs
    .map((paragraph) => {
      const withBreaks = escapeHtml(paragraph).replace(/\n/g, "<br/>");
      const isHeadline =
        /^\d+\s+days past due$/i.test(paragraph) ||
        paragraph.endsWith("days past due");
      if (isHeadline) {
        return `<p><strong>${withBreaks}</strong></p>`;
      }
      return `<p>${withBreaks}</p>`;
    })
    .join("\n");
}

function buildEmailFooter(data: ReminderTemplateData): string {
  const address = data.vendorPhysicalAddress
    ? `<p>${escapeHtml(data.vendorPhysicalAddress)}</p>`
    : "<p><em>Vendor address not configured</em></p>";
  const unsub = data.unsubscribeUrl
    ? `<p><a href="${escapeHtml(data.unsubscribeUrl)}">Unsubscribe</a></p>`
    : "";
  return `<hr/>${address}${unsub}`;
}

function formatServices(
  services?: Array<string | { name: string; amount?: string }>,
): string {
  if (!services?.length) {
    return "";
  }
  return services
    .map((s) =>
      typeof s === "string"
        ? escapeHtml(s)
        : `${escapeHtml(s.name)}${s.amount ? ` ($${escapeHtml(s.amount)})` : ""}`,
    )
    .join(", ");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
