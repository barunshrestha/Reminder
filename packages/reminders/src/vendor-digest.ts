import type { EmailSender } from "./email-sender";
import type { RunScheduleStats } from "./reminder-run.executor";

export interface VendorDigestParams {
  runId: string;
  scheduleName: string;
  stats: RunScheduleStats;
  vendorName?: string | null;
  recipients: string[];
}

export async function sendVendorDigest(
  emailSender: EmailSender,
  params: VendorDigestParams,
): Promise<{ sent: number }> {
  if (params.recipients.length === 0) {
    return { sent: 0 };
  }

  const subject = `[Payment Reminder] Schedule run summary — ${params.scheduleName}`;
  const html = buildDigestHtml(params);
  const text = stripHtml(html);

  let sent = 0;
  for (const to of params.recipients) {
    const result = await emailSender.send({ to, subject, html, text });
    if (result.accepted) {
      sent++;
    }
  }
  return { sent };
}

function buildDigestHtml(params: VendorDigestParams): string {
  const s = params.stats;
  const vendor = params.vendorName ?? "Your organization";
  return `<!DOCTYPE html><html><body>
<h2>Schedule run summary</h2>
<p><strong>Vendor:</strong> ${escapeHtml(vendor)}</p>
<p><strong>Schedule:</strong> ${escapeHtml(params.scheduleName)}</p>
<p><strong>Run ID:</strong> ${escapeHtml(params.runId)}</p>
<p><strong>Dry run:</strong> ${s.dryRun ? "Yes" : "No"}</p>
<ul>
  <li>Evaluated: ${s.evaluated}</li>
  <li>Eligible: ${s.eligible}</li>
  <li>Emails sent: ${s.emailsSent}</li>
  <li>Documents generated: ${s.documentsGenerated}</li>
  <li>Skipped (ineligible): ${s.skippedIneligible}</li>
  <li>Skipped (already sent tier): ${s.skippedAlreadySent}</li>
  <li>Failed: ${s.failed}</li>
</ul>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
