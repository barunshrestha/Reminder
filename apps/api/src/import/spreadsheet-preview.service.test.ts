import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { SpreadsheetPreviewService } from "./spreadsheet-preview.service";

describe("SpreadsheetPreviewService", () => {
  it("returns unknown headers compared to the profile column map", async () => {
    const buffer = Buffer.from(
      XLSX.write(
        {
          SheetNames: ["Sheet1"],
          Sheets: {
            Sheet1: XLSX.utils.aoa_to_sheet([
              ["Client Name", "Extra Column"],
              ["Acme", "value"],
            ]),
          },
        },
        { type: "buffer", bookType: "xlsx" },
      ),
    );

    const mappingProfiles = {
      findOne: vi.fn().mockResolvedValue({
        columnMap: { "Client Name": "client_name" },
      }),
    };

    const service = new SpreadsheetPreviewService(mappingProfiles as never);
    const result = await service.preview(buffer, "preview.xlsx", {
      mappingProfileId: "profile-1",
    });

    expect(result.headers).toContain("Client Name");
    expect(result.unknownHeaders).toEqual(["Extra Column"]);
    expect(result.sampleRows[0]?.["Client Name"]).toBe("Acme");
  });
});
