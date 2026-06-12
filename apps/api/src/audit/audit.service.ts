import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(eventType: string, payload: object): Promise<void> {
    await this.prisma.auditEvent.create({
      data: { eventType, payload },
    });
  }

  list(limit: number, eventType?: string) {
    return this.prisma.auditEvent.findMany({
      where: eventType ? { eventType } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
