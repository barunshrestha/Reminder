import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { SpreadsheetTemplateService } from "./spreadsheet-template.service";

const mockProfile = {
  id: "profile-1",
  name: "Default spreadsheet",
  columnMap: {
    "Client Name": "client_name",
    "Invoice Number": "invoice_number",
  },
};

function createService() {
  const mappingProfiles = {
    findOne: vi.fn().mockResolvedValue(mockProfile),
  };
  return new SpreadsheetTemplateService(mappingProfiles as never);
}

describe("SpreadsheetTemplateService", () => {
  it("generates xlsx with profile column headers and a sample row", async () => {
    const service = createService();
    const buffer = await service.generateTemplate("profile-1");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]!];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
    }) as string[][];

    expect(rows[0]).toEqual(["Client Name", "Invoice Number"]);
    expect(rows[1]?.[0]).toBe("Acme Corp");
    expect(rows[1]?.[1]).toBe("INV-1001");
  });

  it("generates csv with profile column headers and a sample row", async () => {
    const service = createService();
    const buffer = await service.generateTemplate("profile-1", "csv");
    const workbook = XLSX.read(buffer, { type: "buffer", raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]!];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
    }) as string[][];

    expect(rows[0]).toEqual(["Client Name", "Invoice Number"]);
    expect(rows[1]?.[0]).toBe("Acme Corp");
    expect(rows[1]?.[1]).toBe("INV-1001");
  });
});
