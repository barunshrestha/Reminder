import { describe, expect, it, vi, beforeEach } from "vitest";
import { ImportResolution, ImportRowStatus, ImportSource } from "@prisma/client";
import { ImportCommitService } from "./import-commit.service";

vi.mock("../tenancy/tenant-context", () => ({
  requireTenantId: () => "tenant-test-id",
}));

describe("ImportCommitService", () => {
  const prisma = {
    importBatch: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    importRow: {
      count: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    invoice: {
      findUnique: vi.fn(),
    },
  };

  const upsert = {
    updateExisting: vi.fn(),
    insertNew: vi.fn(),
    deleteInvoiceSafe: vi.fn(),
  };

  let service: ImportCommitService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.importBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      source: ImportSource.spreadsheet,
      stats: {},
      rows: [
        {
          id: "row-1",
          status: ImportRowStatus.conflict,
          invoiceNumber: "INV-1",
          mappedPayload: {
            client_name: "Acme",
            invoice_number: "INV-1",
            total_amount: "100.00",
            balance_due: "10.00",
            due_date: "2026-03-01",
          },
        },
      ],
    });
    prisma.importRow.count.mockResolvedValue(0);
    prisma.invoice.findUnique.mockResolvedValue({
      id: "inv-1",
      invoiceNumber: "INV-1",
    });
    upsert.updateExisting.mockResolvedValue({ invoiceId: "inv-1" });
    service = new ImportCommitService(prisma as never, upsert as never);
  });

  it("applies update resolution for conflict rows", async () => {
    const result = await service.commitBatch(
      "batch-1",
      [{ importRowId: "row-1", resolution: ImportResolution.update }],
      { userId: "user-1" },
    );

    expect(result.updated).toBe(1);
    expect(upsert.updateExisting).toHaveBeenCalledTimes(1);
    expect(prisma.importRow.update).toHaveBeenCalled();
  });

  it("skips rows when keep resolution is chosen", async () => {
    const result = await service.commitBatch(
      "batch-1",
      [{ importRowId: "row-1", resolution: ImportResolution.keep }],
      { userId: "user-1" },
    );

    expect(result.skipped).toBe(1);
    expect(upsert.updateExisting).not.toHaveBeenCalled();
  });
});
