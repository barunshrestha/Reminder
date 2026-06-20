import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ImportBatchStatus,
  ImportResolution,
  ImportRowStatus,
  ImportSource,
  type Prisma,
} from "@prisma/client";
import {
  InvoiceUpsertService,
  type UpsertInvoiceInput,
  type WriteContext,
} from "../invoices/invoice-upsert.service";
import { snapshotFromInput } from "../invoices/invoice-snapshot.util";
import { PrismaService } from "../prisma/prisma.service";

export interface CommitDecision {
  importRowId: string;
  resolution: ImportResolution;
}

export interface CommitResult {
  batchId: string;
  updated: number;
  skipped: number;
  deleted: number;
  inserted: number;
  errors: Array<{ importRowId: string; message: string }>;
}

@Injectable()
export class ImportCommitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly upsert: InvoiceUpsertService,
  ) {}

  async commitBatch(
    batchId: string,
    decisions: CommitDecision[],
    actor: { userId?: string; apiKeyId?: string },
  ): Promise<CommitResult> {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      include: { rows: true },
    });
    if (!batch) {
      throw new NotFoundException("Import batch not found");
    }

    const decisionMap = new Map(
      decisions.map((d) => [d.importRowId, d.resolution]),
    );

    const result: CommitResult = {
      batchId,
      updated: 0,
      skipped: 0,
      deleted: 0,
      inserted: 0,
      errors: [],
    };

    const changeSource = this.resolveChangeSource(batch.source);

    for (const row of batch.rows) {
      if (row.status !== ImportRowStatus.conflict) {
        continue;
      }

      const resolution = decisionMap.get(row.id);
      if (!resolution) {
        result.errors.push({
          importRowId: row.id,
          message: "Missing resolution for conflict row",
        });
        continue;
      }

      const writeContext: WriteContext = {
        source: changeSource,
        importRowId: row.id,
        actorUserId: actor.userId,
        actorApiKeyId: actor.apiKeyId ?? batch.apiKeyId ?? undefined,
      };

      const input = this.mappedPayloadToInput(
        row.mappedPayload as Record<string, unknown>,
      );

      try {
        if (resolution === ImportResolution.keep) {
          await this.prisma.importRow.update({
            where: { id: row.id },
            data: {
              status: ImportRowStatus.skipped,
              resolution,
              resolvedByUserId: actor.userId ?? null,
              resolvedAt: new Date(),
            },
          });
          result.skipped++;
          continue;
        }

        if (resolution === ImportResolution.update) {
          const existing = await this.prisma.invoice.findUnique({
            where: { invoiceNumber: row.invoiceNumber },
          });
          if (!existing) {
            const { invoiceId } = await this.upsert.insertNew(
              input,
              writeContext,
            );
            await this.finalizeRow(row.id, ImportRowStatus.imported, resolution, {
              invoiceId,
              actorUserId: actor.userId,
            });
            result.inserted++;
            continue;
          }

          const { invoiceId } = await this.upsert.updateExisting(
            existing,
            input,
            writeContext,
          );
          await this.finalizeRow(row.id, ImportRowStatus.imported, resolution, {
            invoiceId,
            actorUserId: actor.userId,
          });
          result.updated++;
          continue;
        }

        if (resolution === ImportResolution.delete_existing) {
          const existing = await this.prisma.invoice.findUnique({
            where: { invoiceNumber: row.invoiceNumber },
          });
          if (existing) {
            const deleted = await this.upsert.deleteInvoiceSafe(
              existing.id,
              writeContext,
            );
            if (!deleted) {
              throw new BadRequestException(
                `Cannot delete invoice ${row.invoiceNumber}: linked to multiple uploads`,
              );
            }
            result.deleted++;
          }

          const { invoiceId } = await this.upsert.insertNew(
            input,
            writeContext,
          );
          await this.finalizeRow(row.id, ImportRowStatus.imported, resolution, {
            invoiceId,
            actorUserId: actor.userId,
          });
          result.inserted++;
        }
      } catch (error) {
        result.errors.push({
          importRowId: row.id,
          message:
            error instanceof Error ? error.message : "Commit failed for row",
        });
      }
    }

    const remainingConflicts = await this.prisma.importRow.count({
      where: {
        batchId,
        status: ImportRowStatus.conflict,
      },
    });

    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status:
          remainingConflicts > 0
            ? ImportBatchStatus.partial
            : ImportBatchStatus.committed,
        stats: {
          ...(batch.stats as Record<string, unknown>),
          commit: result,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return result;
  }

  private async finalizeRow(
    importRowId: string,
    status: ImportRowStatus,
    resolution: ImportResolution,
    params: { invoiceId: string; actorUserId?: string },
  ) {
    await this.prisma.importRow.update({
      where: { id: importRowId },
      data: {
        status,
        resolution,
        invoiceId: params.invoiceId,
        resolvedByUserId: params.actorUserId ?? null,
        resolvedAt: new Date(),
      },
    });
  }

  private mappedPayloadToInput(
    payload: Record<string, unknown>,
  ): UpsertInvoiceInput {
    return {
      clientName: String(payload.client_name),
      invoiceNumber: String(payload.invoice_number),
      totalAmount: String(payload.total_amount),
      balanceDue: String(payload.balance_due),
      dueDate: String(payload.due_date),
      dateOfService: payload.date_of_service
        ? String(payload.date_of_service)
        : null,
      services: payload.services as UpsertInvoiceInput["services"],
      clientEmail: payload.client_email ? String(payload.client_email) : null,
      comments: payload.comments ? String(payload.comments) : null,
      sendReminder: Boolean(payload.send_reminder ?? true),
      externalClientId: payload.external_client_id
        ? String(payload.external_client_id)
        : null,
      status: payload.status as UpsertInvoiceInput["status"],
      emailOptOut: Boolean(payload.email_opt_out ?? false),
      consentEmail: Boolean(payload.consent_email ?? true),
      reminderDeliveryMode:
        (payload.reminder_delivery_mode as UpsertInvoiceInput["reminderDeliveryMode"]) ??
        "email",
    };
  }

  private resolveChangeSource(source: ImportSource): string {
    switch (source) {
      case ImportSource.spreadsheet:
        return "import.spreadsheet";
      case ImportSource.scan:
        return "import.scan";
      case ImportSource.integration:
        return "integration";
      case ImportSource.connector:
        return "connector";
      default:
        return "import";
    }
  }
}
