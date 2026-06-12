import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  extractHeaders,
  findUnknownHeaders,
  normalizeHeaderKey,
  parseSpreadsheetRows,
} from "./spreadsheet-parser";

describe("spreadsheet-parser", () => {
  function buildWorkbookBuffer(
    rows: string[][],
    bookType: XLSX.BookType = "xlsx",
  ): Buffer {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
    return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType }));
  }

  it("extracts headers from the first row", () => {
    const buffer = buildWorkbookBuffer([
      ["Client Name", "Invoice Number"],
      ["Acme", "INV-1"],
    ]);
    expect(extractHeaders(buffer, "data.xlsx")).toEqual([
      "Client Name",
      "Invoice Number",
    ]);
  });

  it("detects headers not present in the column map", () => {
    const headers = ["Client Name", "Custom Field"];
    const columnMap = { "Client Name": "client_name" };
    expect(findUnknownHeaders(headers, columnMap)).toEqual(["Custom Field"]);
  });

  it("strips BOM from header keys", () => {
    expect(normalizeHeaderKey("\uFEFFClient Name")).toBe("Client Name");
  });

  it("parses data rows after the header", () => {
    const buffer = buildWorkbookBuffer([
      ["Client Name", "Invoice Number"],
      ["Acme", "INV-1"],
    ]);
    const rows = parseSpreadsheetRows(buffer, "import.xlsx");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.["Client Name"]).toBe("Acme");
  });
});
