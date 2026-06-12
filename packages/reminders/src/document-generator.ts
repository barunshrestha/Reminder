import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";

export interface GenerateDocumentInput {
  invoiceId: string;
  tier: number;
  html: string;
  storageRoot: string;
}

export interface GenerateDocumentResult {
  pdfStorageKey: string;
  htmlSnapshot: string;
}

/** v1: store HTML and a minimal PDF placeholder (HTML bytes as application/pdf label). */
export async function generateNotificationDocument(
  input: GenerateDocumentInput,
): Promise<GenerateDocumentResult> {
  const dir = join(
    input.storageRoot,
    "documents",
    input.invoiceId,
    String(input.tier),
  );
  await mkdir(dir, { recursive: true });

  const htmlPath = join(dir, "preview.html");
  const pdfPath = join(dir, "notice.pdf");
  await writeFile(htmlPath, input.html, "utf8");

  const pdfContent = buildSimplePdf(input.html);
  await writeFile(pdfPath, pdfContent);

  const pdfStorageKey = `documents/${input.invoiceId}/${input.tier}/notice.pdf`;
  return { pdfStorageKey, htmlSnapshot: input.html };
}

function buildSimplePdf(text: string): Buffer {
  const escaped = text.replace(/[()\\]/g, "\\$&").slice(0, 2000);
  const stream = `BT /F1 10 Tf 50 750 Td (${escaped}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length ${stream.length} >>stream
${stream}
endstream endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
trailer<< /Size 6 /Root 1 0 R >>
startxref
0
%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export async function ensureStorageRoot(storageRoot: string): Promise<void> {
  await mkdir(storageRoot, { recursive: true });
  await mkdir(dirname(join(storageRoot, "documents", "x")), {
    recursive: true,
  }).catch(() => undefined);
}
