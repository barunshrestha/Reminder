import { Module } from "@nestjs/common";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { ConnectorsModule } from "./connectors/connectors.module";
import { DocsModule } from "./docs/docs.module";
import { DocumentsModule } from "./documents/documents.module";
import { HealthModule } from "./health/health.module";
import { ImportModule } from "./import/import.module";
import { IntegrationModule } from "./integration/integration.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { MappingProfilesModule } from "./mapping-profiles/mapping-profiles.module";
import { MetricsModule } from "./metrics/metrics.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PublicModule } from "./public/public.module";
import { ReminderConfigModule } from "./reminder-config/reminder-config.module";
import { ReminderTemplatesModule } from "./reminder-templates/reminder-templates.module";
import { SchedulesModule } from "./schedules/schedules.module";
import { VendorSettingsModule } from "./vendor-settings/vendor-settings.module";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    HealthModule,
    AuthModule,
    MappingProfilesModule,
    InvoicesModule,
    ImportModule,
    IntegrationModule,
    SchedulesModule,
    ConnectorsModule,
    ApiKeysModule,
    MetricsModule,
    PublicModule,
    ReminderConfigModule,
    ReminderTemplatesModule,
    DocsModule,
    DocumentsModule,
    VendorSettingsModule,
  ],
})
export class AppModule {}
