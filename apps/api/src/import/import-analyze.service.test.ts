import { describe, expect, it, vi, beforeEach } from "vitest";
import { ImportRowStatus, ImportSource } from "@prisma/client";
import { ImportAnalyzeService } from "./import-analyze.service";
import type { UpsertInvoiceInput } from "../invoices/invoice-upsert.service";

vi.mock("../tenancy/tenant-context", () => ({
  requireTenantId: () => "tenant-test-id",
}));

function baseInput(overrides: Partial<UpsertInvoiceInput> = {}): UpsertInvoiceInput {
  return {
    clientName: "Acme",
    invoiceNumber: "INV-100",
    totalAmount: "100.00",
    balanceDue: "50.00",
    dueDate: "2026-03-01",
    ...overrides,
  };
}

describe("ImportAnalyzeService", () => {
  const prisma = {
    importBatch: {
      create: vi.fn(),
      update: vi.fn(),
    },
    importRow: {
      create: vi.fn(),
    },
    invoice: {
      findUnique: vi.fn(),
    },
  };

  const upsert = {
    classify: vi.fn(),
    insertNew: vi.fn(),
    touchUnchanged: vi.fn(),
  };

  let service: ImportAnalyzeService;
  let rowIdCounter: number;

  beforeEach(() => {
    vi.clearAllMocks();
    rowIdCounter = 0;
    prisma.importBatch.create.mockResolvedValue({ id: "batch-1" });
    prisma.importRow.create.mockImplementation(async (args: { data: { invoiceNumber: string; status: ImportRowStatus } }) => {
      rowIdCounter += 1;
      return {
        id: `row-${rowIdCounter}`,
        rowNumber: args.data.invoiceNumber === "INV-100" ? 2 : rowIdCounter + 1,
        invoiceNumber: args.data.invoiceNumber,
        status: args.data.status,
        existingSnapshot: null,
        changedFields: [],
        invoiceId: null,
        errorMessage: null,
      };
    });
    service = new ImportAnalyzeService(prisma as never, upsert as never);
  });

  it("flags duplicate invoice numbers within the same batch", async () => {
    upsert.classify.mockReturnValue("new");
    upsert.insertNew.mockResolvedValue({ invoiceId: "inv-dup" });

    const result = await service.analyzeBatch(
      [
        {
          rowNumber: 2,
          rawPayload: {},
          mapped: baseInput({ invoiceNumber: "INV-DUP" }),
        },
        {
          rowNumber: 3,
          rawPayload: {},
          mapped: baseInput({ invoiceNumber: "INV-DUP" }),
        },
      ],
      {
        source: ImportSource.spreadsheet,
        changeSource: "import.spreadsheet",
      },
    );

    expect(result.summary.duplicate_in_file).toBe(1);
    expect(result.summary.new).toBe(1);
    expect(upsert.insertNew).toHaveBeenCalledTimes(1);
  });

  it("auto-applies new rows and stages conflicts", async () => {
    prisma.invoice.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "inv-2",
        invoiceNumber: "INV-2",
        clientName: "Old",
        totalAmount: { toString: () => "100.00" },
        balanceDue: { toString: () => "50.00" },
        dueDate: new Date("2026-03-01"),
        dateOfService: null,
        services: null,
        clientEmail: null,
        comments: null,
        sendReminder: true,
        externalClientId: null,
        status: "open",
        emailOptOut: false,
        consentEmail: true,
        reminderDeliveryMode: "email",
        contentHash: "old",
        isActive: true,
      });

    upsert.classify
      .mockReturnValueOnce("new")
      .mockReturnValueOnce("conflict");
    upsert.insertNew.mockResolvedValue({ invoiceId: "inv-1" });

    const result = await service.analyzeBatch(
      [
        { rowNumber: 2, rawPayload: {}, mapped: baseInput({ invoiceNumber: "INV-NEW" }) },
        { rowNumber: 3, rawPayload: {}, mapped: baseInput({ invoiceNumber: "INV-2", balanceDue: "10.00" }) },
      ],
      {
        source: ImportSource.integration,
        changeSource: "integration",
      },
    );

    expect(result.summary.new).toBe(1);
    expect(result.summary.conflict).toBe(1);
    expect(result.status).toBe("pending_review");
    expect(upsert.insertNew).toHaveBeenCalledTimes(1);
  });
});
