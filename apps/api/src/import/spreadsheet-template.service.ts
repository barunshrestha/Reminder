import { Injectable } from "@nestjs/common";
import * as XLSX from "xlsx";
import { MappingProfilesService } from "../mapping-profiles/mapping-profiles.service";

export type TemplateFormat = "xlsx" | "csv";

@Injectable()
export class SpreadsheetTemplateService {
  constructor(private readonly mappingProfiles: MappingProfilesService) {}

  async generateTemplate(
    mappingProfileId: string,
    format: TemplateFormat = "xlsx",
  ): Promise<Buffer> {
    const profile = await this.mappingProfiles.findOne(mappingProfileId);
    const columnMap = profile.columnMap as Record<string, string>;
    const [headers, sampleRow] = buildTemplateRows(columnMap);
    const sheet = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Template");
    return Buffer.from(
      XLSX.write(workbook, { type: "buffer", bookType: format }),
    );
  }
}

export function buildTemplateRows(
  columnMap: Record<string, string>,
): [string[], string[]] {
  const headers = Object.keys(columnMap);
  const sampleRow = headers.map((header) => sampleValueForHeader(header));
  return [headers, sampleRow];
}

function sampleValueForHeader(header: string): string {
  const key = header.toLowerCase();
  if (key.includes("client name")) return "Acme Corp";
  if (key.includes("invoice")) return "INV-1001";
  if (key.includes("total")) return "500.00";
  if (key.includes("balance")) return "250.00";
  if (key.includes("due")) return "2026-01-15";
  if (key.includes("email")) return "billing@acme.com";
  if (key.includes("service")) return "2025-12-01";
  return "";
}
