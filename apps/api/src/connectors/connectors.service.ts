import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ImportSource, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import {
  ImportAnalyzeService,
  type AnalyzeRowInput,
} from "../import/import-analyze.service";
import {
  InvoiceUpsertService,
  type UpsertInvoiceInput,
} from "../invoices/invoice-upsert.service";
import { PrismaService } from "../prisma/prisma.service";
import { assertReadOnlySql } from "./connector-sql";
import type { CreateConnectorDto } from "./dto/create-connector.dto";
import type { UpdateConnectorDto } from "./dto/update-connector.dto";

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyze: ImportAnalyzeService,
    private readonly upsert: InvoiceUpsertService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.connector.findMany({ orderBy: { createdAt: "desc" } });
  }

  async findOne(id: string) {
    const row = await this.prisma.connector.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException("Connector not found");
    }
    return row;
  }

  create(dto: CreateConnectorDto) {
    assertReadOnlySql(dto.sql_query);
    return this.prisma.connector.create({
      data: {
        name: dto.name,
        enabled: dto.enabled ?? true,
        sqlQuery: dto.sql_query,
        columnMap: dto.column_map,
      },
    });
  }

  async update(id: string, dto: UpdateConnectorDto) {
    await this.findOne(id);
    if (dto.sql_query) {
      assertReadOnlySql(dto.sql_query);
    }
    return this.prisma.connector.update({
      where: { id },
      data: {
        name: dto.name,
        enabled: dto.enabled,
        sqlQuery: dto.sql_query,
        columnMap: dto.column_map,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.connector.delete({ where: { id } });
  }

  async sync(id: string) {
    const connector = await this.findOne(id);
    if (!connector.enabled) {
      throw new BadRequestException("Connector is disabled");
    }

    assertReadOnlySql(connector.sqlQuery);
    const columnMap = connector.columnMap as Record<string, string>;
    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      connector.sqlQuery,
    );

    const analyzeRows: AnalyzeRowInput[] = [];
    for (let i = 0; i < rows.length; i++) {
      try {
        analyzeRows.push({
          rowNumber: i + 1,
          rawPayload: rows[i]!,
          mapped: mapConnectorRow(rows[i]!, columnMap),
        });
      } catch (error) {
        analyzeRows.push({
          rowNumber: i + 1,
          rawPayload: rows[i]!,
          mapped: {
            clientName: "",
            invoiceNumber: `__error_${i + 1}`,
            totalAmount: "0",
            balanceDue: "0",
            dueDate: "1970-01-01",
          },
          errorMessage:
            error instanceof Error ? error.message : "Row mapping failed",
        });
      }
    }

    const batchResult = await this.analyze.analyzeBatch(analyzeRows, {
      source: ImportSource.connector,
      connectorId: id,
      changeSource: "connector",
    });

    const seen = batchResult.rows
      .filter((r) => r.status !== "conflict" && r.status !== "error")
      .map((r) => r.invoiceNumber);

    const finalize = await this.upsert.finalizeSync(seen);

    const stats = {
      batch_id: batchResult.batchId,
      inserted: batchResult.summary.new,
      updated: 0,
      skipped_unchanged: batchResult.summary.unchanged,
      conflicts_pending: batchResult.summary.conflict,
      errors: batchResult.summary.error + batchResult.summary.duplicate_in_file,
      deactivated: finalize.deactivated,
      missed_sync_increments: finalize.missedSyncIncrements,
      rows_fetched: rows.length,
    };

    await this.prisma.connector.update({
      where: { id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus:
          batchResult.summary.conflict > 0 ? "pending_review" : "completed",
        lastSyncStats: stats as Prisma.InputJsonValue,
      },
    });

    await this.audit.record("connector.sync", {
      connector_id: id,
      connector_name: connector.name,
      ...stats,
    });

    return stats;
  }

  /** Run all enabled connectors (used before schedule evaluate). */
  async syncAllEnabled(): Promise<void> {
    const connectors = await this.prisma.connector.findMany({
      where: { enabled: true },
    });
    for (const connector of connectors) {
      await this.sync(connector.id);
    }
  }
}

function mapConnectorRow(
  row: Record<string, unknown>,
  columnMap: Record<string, string>,
): UpsertInvoiceInput {
  const canonical: Record<string, string> = {};
  for (const [source, target] of Object.entries(columnMap)) {
    const value = row[source] ?? row[target];
    if (value !== undefined && value !== null) {
      canonical[target] = String(value).trim();
    }
  }

  const required = [
    "client_name",
    "invoice_number",
    "total_amount",
    "balance_due",
    "due_date",
  ];
  for (const field of required) {
    if (!canonical[field]) {
      throw new BadRequestException(`Missing mapped field: ${field}`);
    }
  }

  const mode = parseConnectorDeliveryMode(canonical.reminder_delivery_mode);
  if (mode === "email" && !canonical.client_email) {
    throw new BadRequestException(
      `client_email required for invoice ${canonical.invoice_number}`,
    );
  }
  if (mode === "phone" && !canonical.client_phone) {
    throw new BadRequestException(
      `client_phone required for invoice ${canonical.invoice_number}`,
    );
  }

  return {
    clientName: canonical.client_name,
    invoiceNumber: canonical.invoice_number,
    totalAmount: canonical.total_amount,
    balanceDue: canonical.balance_due,
    dueDate: canonical.due_date.slice(0, 10),
    dateOfService: canonical.date_of_service?.slice(0, 10) ?? null,
    clientEmail: canonical.client_email ?? null,
    clientPhone: canonical.client_phone ?? null,
    externalClientId: canonical.external_client_id ?? null,
    comments: canonical.comments ?? null,
    sendReminder: canonical.send_reminder !== "false",
    emailOptOut: canonical.email_opt_out === "true",
    consentEmail: canonical.consent_email !== "false",
    reminderDeliveryMode: mode,
    status:
      canonical.status === "paid" || canonical.status === "closed"
        ? canonical.status
        : undefined,
  };
}

function parseConnectorDeliveryMode(
  value?: string,
): "email" | "phone" | "document_only" | "na" {
  const normalized = (value ?? "email").toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "document_only" || normalized === "document") {
    return "document_only";
  }
  if (normalized === "phone") {
    return "phone";
  }
  if (normalized === "na" || normalized === "n_a") {
    return "na";
  }
  return "email";
}
