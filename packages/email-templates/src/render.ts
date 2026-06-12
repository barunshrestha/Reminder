import type { ReminderTemplateData } from "./types";

const TIER_SUBJECTS: Record<number, string> = {
  15: "Payment reminder — invoice {{invoice_number}}",
  30: "Follow-up: overdue balance on invoice {{invoice_number}}",
  45: "Urgent: payment overdue — invoice {{invoice_number}}",
  60: "Final notice: invoice {{invoice_number}}",
};

export function templateIdForTier(tier: number): string {
  return `reminder_tier_${tier}`;
}

export function subjectForTier(tier: number, data: ReminderTemplateData): string {
  const pattern =
    TIER_SUBJECTS[tier] ?? `Payment reminder ({{tier}} days) — {{invoice_number}}`;
  return applyMergeFields(pattern.replace("{{tier}}", String(tier)), data);
}

export function renderReminderEmail(
  tier: number,
  data: ReminderTemplateData,
): { subject: string; html: string; text: string; templateId: string } {
  const templateId = templateIdForTier(tier);
  const subject = subjectForTier(tier, data);
  const body = buildBody(tier, data);
  const footer = buildEmailFooter(data);
  const html = `<!DOCTYPE html><html><body>${body}${footer}</body></html>`;
  const text = `${stripHtml(body)}\n\n${stripHtml(footer)}`;
  return { subject, html, text, templateId };
}

export function renderReminderDocumentHtml(
  tier: number,
  data: ReminderTemplateData,
): { html: string; templateId: string } {
  const templateId = templateIdForTier(tier);
  const body = buildBody(tier, data);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${templateId}</title></head><body>${body}<p><em>Notification document — vendor delivery</em></p></body></html>`;
  return { html, templateId };
}

function buildBody(tier: number, data: ReminderTemplateData): string {
  const intro =
    tier <= 15
      ? "This is a friendly reminder that your balance is past due."
      : tier <= 30
        ? "Please review the overdue balance below."
        : tier <= 45
          ? "Immediate attention is requested for the overdue amount."
          : "This is a final notice regarding your overdue balance.";

  const services = formatServices(data.services);
  const comments =
    data.includeComments && data.comments
      ? `<p><strong>Comments:</strong> ${escapeHtml(data.comments)}</p>`
      : "";

  return `<p>Dear ${escapeHtml(data.clientName)},</p>
<p>${intro}</p>
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

function applyMergeFields(template: string, data: ReminderTemplateData): string {
  return template.replace(/\{\{invoice_number\}\}/g, data.invoiceNumber);
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
