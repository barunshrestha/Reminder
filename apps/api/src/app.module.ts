import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { AccountsModule } from "./accounts/accounts.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { BrandingModule } from "./branding/branding.module";
import { ConnectorsModule } from "./connectors/connectors.module";
import { DocsModule } from "./docs/docs.module";
import { DocumentsModule } from "./documents/documents.module";
import { HealthModule } from "./health/health.module";
import { ImportModule } from "./import/import.module";
import { IntegrationModule } from "./integration/integration.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { MappingProfilesModule } from "./mapping-profiles/mapping-profiles.module";
import { MetricsModule } from "./metrics/metrics.module";
import { OffboardingModule } from "./offboarding/offboarding.module";
import { PlatformAdminModule } from "./platform/platform-admin.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PublicModule } from "./public/public.module";
import { ReminderConfigModule } from "./reminder-config/reminder-config.module";
import { ReminderTemplatesModule } from "./reminder-templates/reminder-templates.module";
import { SchedulesModule } from "./schedules/schedules.module";
import { VendorSettingsModule } from "./vendor-settings/vendor-settings.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { MfaGuard } from "./tenancy/mfa.guard";
import { SubscriptionGuard } from "./tenancy/subscription.guard";
import { TenantContextInterceptor } from "./tenancy/tenant-context.interceptor";
import { TenantContextMiddleware } from "./tenancy/tenant-context.middleware";
import { TenantGuard } from "./tenancy/tenant.guard";
import { TenancyModule } from "./tenancy/tenancy.module";

@Module({
  imports: [
    PrismaModule,
    TenancyModule,
    BillingModule,
    AccountsModule,
    PlatformAdminModule,
    BrandingModule,
    OffboardingModule,
    AuditModule,
    HealthModule,
    AuthModule,
    NotificationsModule,
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
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: SubscriptionGuard },
    { provide: APP_GUARD, useClass: MfaGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
