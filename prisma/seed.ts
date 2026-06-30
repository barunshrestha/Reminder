import { config } from "dotenv";
import { createHash } from "crypto";
import { resolve } from "path";
import { PrismaClient, type ReminderDeliveryMode } from "@prisma/client";
import * as argon2 from "argon2";
import { computeContentHash } from "../packages/domain/src/content-hash.service";

config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

const DEMO_ACCOUNT_ID = "00000000-0000-4000-8000-000000000100";
const DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000101";
const DEMO_USER_ID = "00000000-0000-4000-8000-000000000102";
const DEMO_PLAN_STARTER = "00000000-0000-4000-8000-000000000103";
const DEMO_SUBSCRIPTION_ID = "00000000-0000-4000-8000-000000000104";

const PLANS = [
  {
    id: DEMO_PLAN_STARTER,
    code: "starter",
    name: "Starter",
    invoiceLimit: 500,
    scheduleLimit: 3,
    connectorLimit: 1,
  },
  {
    id: "00000000-0000-4000-8000-000000000105",
    code: "growth",
    name: "Growth",
    invoiceLimit: 5000,
    scheduleLimit: 10,
    connectorLimit: 5,
  },
  {
    id: "00000000-0000-4000-8000-000000000106",
    code: "enterprise",
    name: "Enterprise",
    invoiceLimit: 100_000,
    scheduleLimit: 50,
    connectorLimit: 25,
  },
] as const;

const DEMO_SCHEDULE_ID = "00000000-0000-4000-8000-000000000001";

function utcDate(daysOffset: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysOffset);
  return date;
}

type DemoInvoice = {
  invoiceNumber: string;
  clientName: string;
  totalAmount: string;
  balanceDue: string;
  dueDate: Date;
  clientEmail?: string;
  status: "open" | "paid" | "closed";
  reminderDeliveryMode: ReminderDeliveryMode;
  sendReminder?: boolean;
  emailOptOut?: boolean;
  lastTierSent?: number;
  notificationNumber?: number;
  paidAt?: Date;
};

const DEMO_INVOICES: DemoInvoice[] = [
  {
    invoiceNumber: "INV-1001",
    clientName: "Acme Corporation",
    totalAmount: "5250.00",
    balanceDue: "5250.00",
    dueDate: utcDate(-22),
    clientEmail: "billing@acme.example.com",
    status: "open",
    reminderDeliveryMode: "email",
  },
  {
    invoiceNumber: "INV-1002",
    clientName: "Beta Services LLC",
    totalAmount: "1800.00",
    balanceDue: "1200.00",
    dueDate: utcDate(-38),
    clientEmail: "ap@beta.example.com",
    status: "open",
    reminderDeliveryMode: "email",
    lastTierSent: 15,
    notificationNumber: 1,
  },
  {
    invoiceNumber: "INV-1003",
    clientName: "Gamma Industries",
    totalAmount: "950.00",
    balanceDue: "950.00",
    dueDate: utcDate(14),
    clientEmail: "finance@gamma.example.com",
    status: "open",
    reminderDeliveryMode: "email",
  },
  {
    invoiceNumber: "INV-1004",
    clientName: "Delta Consulting",
    totalAmount: "3200.00",
    balanceDue: "0.00",
    dueDate: utcDate(-45),
    clientEmail: "accounts@delta.example.com",
    status: "paid",
    reminderDeliveryMode: "email",
    paidAt: utcDate(-5),
  },
  {
    invoiceNumber: "INV-1005",
    clientName: "Echo Print Shop",
    totalAmount: "640.00",
    balanceDue: "640.00",
    dueDate: utcDate(-18),
    status: "open",
    reminderDeliveryMode: "document_only",
    notificationNumber: 1,
    lastTierSent: 15,
  },
  {
    invoiceNumber: "INV-1006",
    clientName: "Foxtrot Media",
    totalAmount: "2100.00",
    balanceDue: "2100.00",
    dueDate: utcDate(-52),
    clientEmail: "billing@foxtrot.example.com",
    status: "open",
    reminderDeliveryMode: "email",
    emailOptOut: true,
  },
  {
    invoiceNumber: "INV-1007",
    clientName: "Hotel Sierra",
    totalAmount: "4100.00",
    balanceDue: "4100.00",
    dueDate: utcDate(-65),
    clientEmail: "ap@sierra.example.com",
    status: "open",
    reminderDeliveryMode: "email",
    lastTierSent: 30,
    notificationNumber: 2,
  },
];

async function seedDemoInvoices(tenantId: string) {
  for (const invoice of DEMO_INVOICES) {
    const contentHash = computeContentHash({
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      totalAmount: invoice.totalAmount,
      balanceDue: invoice.balanceDue,
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      clientEmail: invoice.clientEmail,
      status: invoice.status,
      emailOptOut: invoice.emailOptOut ?? false,
      consentEmail: true,
      reminderDeliveryMode: invoice.reminderDeliveryMode,
    });

    await prisma.invoice.upsert({
      where: {
        tenantId_invoiceNumber: {
          tenantId,
          invoiceNumber: invoice.invoiceNumber,
        },
      },
      create: {
        tenantId,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        totalAmount: invoice.totalAmount,
        balanceDue: invoice.balanceDue,
        dueDate: invoice.dueDate,
        clientEmail: invoice.clientEmail ?? null,
        status: invoice.status,
        reminderDeliveryMode: invoice.reminderDeliveryMode,
        sendReminder: invoice.sendReminder ?? true,
        emailOptOut: invoice.emailOptOut ?? false,
        consentEmail: true,
        contentHash,
        lastTierSent: invoice.lastTierSent ?? null,
        notificationNumber: invoice.notificationNumber ?? 0,
        paidAt: invoice.paidAt ?? null,
        isActive: invoice.status === "open",
      },
      update: {
        clientName: invoice.clientName,
        totalAmount: invoice.totalAmount,
        balanceDue: invoice.balanceDue,
        dueDate: invoice.dueDate,
        clientEmail: invoice.clientEmail ?? null,
        status: invoice.status,
        reminderDeliveryMode: invoice.reminderDeliveryMode,
        contentHash,
        lastTierSent: invoice.lastTierSent ?? null,
        notificationNumber: invoice.notificationNumber ?? 0,
        paidAt: invoice.paidAt ?? null,
        isActive: invoice.status === "open",
      },
    });
  }
}

async function seedMilestoneTemplates(tenantId: string) {
  const tiers = [15, 30, 45, 60];
  for (const tierDays of tiers) {
    await prisma.reminderMilestoneTemplate.upsert({
      where: {
        tenantId_tierDays: { tenantId, tierDays },
      },
      create: {
        tenantId,
        tierDays,
        subject: `Payment reminder — invoice {{invoice_number}} (${tierDays} days past due)`,
        bodyHtml: `<p>Hello {{client_name}},</p><p>Your invoice <strong>{{invoice_number}}</strong> is {{days_behind}} days past due. Balance due: <strong>{{balance_due}}</strong>.</p><p>Please remit payment at your earliest convenience.</p>`,
        isCustom: false,
      },
      update: {},
    });
  }
}

async function seedDemoActivity(
  tenantId: string,
  scheduleId: string,
  actorUserId: string,
) {
  await prisma.scheduleRun.upsert({
    where: { id: "00000000-0000-4000-8000-000000000030" },
    create: {
      id: "00000000-0000-4000-8000-000000000030",
      scheduleId,
      status: "completed",
      dryRun: true,
      stats: {
        evaluated: 5,
        eligible: 2,
        emailsSent: 0,
        documentsGenerated: 0,
        skippedAlreadySent: 1,
        skippedIneligible: 2,
        failed: 0,
        dryRun: true,
      },
      startedAt: utcDate(-1),
      endedAt: utcDate(-1),
    },
    update: { scheduleId },
  });

  const auditEvents = [
    {
      id: "00000000-0000-4000-8000-000000000040",
      eventType: "email.sent",
      payload: { invoice_number: "INV-1002", tier: 15 },
    },
    {
      id: "00000000-0000-4000-8000-000000000041",
      eventType: "document.generated",
      payload: { invoice_number: "INV-1005", tier: 15 },
    },
    {
      id: "00000000-0000-4000-8000-000000000042",
      eventType: "import.spreadsheet.analyze",
      payload: { filename: "demo-clients.xlsx", row_count: 7, error_count: 0 },
    },
    {
      id: "00000000-0000-4000-8000-000000000043",
      eventType: "schedule.run.completed",
      payload: { schedule_id: scheduleId, dry_run: true },
    },
  ];

  for (const event of auditEvents) {
    await prisma.auditEvent.upsert({
      where: { id: event.id },
      create: {
        id: event.id,
        tenantId,
        eventType: event.eventType,
        payload: event.payload,
        createdAt: utcDate(-2),
      },
      update: {
        tenantId,
        eventType: event.eventType,
        payload: event.payload,
      },
    });
  }

  await prisma.invoiceChangeLog.upsert({
    where: { id: "00000000-0000-4000-8000-000000000050" },
    create: {
      id: "00000000-0000-4000-8000-000000000050",
      invoiceNumber: "INV-1001",
      source: "seed",
      action: "inserted",
      actorUserId,
      after: { invoice_number: "INV-1001", client_name: "Acme Corporation" },
    },
    update: {},
  });
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMeNow123!";
  const passwordHash = await argon2.hash(password);

  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      create: {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        invoiceLimit: plan.invoiceLimit,
        scheduleLimit: plan.scheduleLimit,
        connectorLimit: plan.connectorLimit,
      },
      update: {
        name: plan.name,
        invoiceLimit: plan.invoiceLimit,
        scheduleLimit: plan.scheduleLimit,
        connectorLimit: plan.connectorLimit,
      },
    });
  }

  await prisma.user.upsert({
    where: { email },
    create: {
      id: DEMO_USER_ID,
      email,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.platformAdmin.upsert({
    where: { userId: DEMO_USER_ID },
    create: { userId: DEMO_USER_ID },
    update: {},
  });

  await prisma.account.upsert({
    where: { id: DEMO_ACCOUNT_ID },
    create: {
      id: DEMO_ACCOUNT_ID,
      name: "Demo Agency",
    },
    update: { name: "Demo Agency" },
  });

  await prisma.accountMembership.upsert({
    where: {
      accountId_userId: { accountId: DEMO_ACCOUNT_ID, userId: DEMO_USER_ID },
    },
    create: {
      accountId: DEMO_ACCOUNT_ID,
      userId: DEMO_USER_ID,
      role: "owner",
    },
    update: { role: "owner" },
  });

  const trialEnd = new Date(Date.now() + 14 * 86400000);
  await prisma.subscription.upsert({
    where: { id: DEMO_SUBSCRIPTION_ID },
    create: {
      id: DEMO_SUBSCRIPTION_ID,
      accountId: DEMO_ACCOUNT_ID,
      planId: DEMO_PLAN_STARTER,
      status: "trialing",
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEnd,
    },
    update: {
      planId: DEMO_PLAN_STARTER,
      status: "trialing",
      currentPeriodEnd: trialEnd,
    },
  });

  await prisma.tenant.upsert({
    where: { id: DEMO_TENANT_ID },
    create: {
      id: DEMO_TENANT_ID,
      accountId: DEMO_ACCOUNT_ID,
      slug: "demo",
      subdomain: "demo",
      name: "Tarema LLC",
      region: "us_east",
      status: "active",
    },
    update: {
      accountId: DEMO_ACCOUNT_ID,
      name: "Tarema LLC",
    },
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: { tenantId: DEMO_TENANT_ID, userId: DEMO_USER_ID },
    },
    create: {
      tenantId: DEMO_TENANT_ID,
      userId: DEMO_USER_ID,
      role: "admin",
    },
    update: { role: "admin" },
  });

  await prisma.tenantSettings.upsert({
    where: { tenantId: DEMO_TENANT_ID },
    create: {
      tenantId: DEMO_TENANT_ID,
      vendorName: "Tarema LLC",
      fromName: "Tarema LLC",
      fromEmail: process.env.EMAIL_DEFAULT_FROM ?? "billing@demo.local",
      vendorPhysicalAddress: "123 Main Street, Springfield, ST 00000",
    },
    update: {
      vendorName: "Tarema LLC",
      fromName: "Tarema LLC",
    },
  });

  await prisma.tenantBranding.upsert({
    where: { tenantId: DEMO_TENANT_ID },
    create: { tenantId: DEMO_TENANT_ID },
    update: {},
  });

  const period = new Date().toISOString().slice(0, 7);
  for (const metric of ["invoices", "emails", "scans"]) {
    await prisma.usageCounter.upsert({
      where: {
        tenantId_metric_period: {
          tenantId: DEMO_TENANT_ID,
          metric,
          period,
        },
      },
      create: {
        tenantId: DEMO_TENANT_ID,
        metric,
        period,
        count: 0,
      },
      update: {},
    });
  }

  await prisma.schedule.upsert({
    where: { id: DEMO_SCHEDULE_ID },
    create: {
      id: DEMO_SCHEDULE_ID,
      tenantId: DEMO_TENANT_ID,
      name: "Default reminder processing",
      cronExpression: "0 8 * * *",
      timezone: "America/New_York",
      enabled: true,
      dryRun: false,
    },
    update: { tenantId: DEMO_TENANT_ID },
  });

  await prisma.mappingProfile.upsert({
    where: { id: "00000000-0000-4000-8000-000000000010" },
    create: {
      id: "00000000-0000-4000-8000-000000000010",
      tenantId: DEMO_TENANT_ID,
      name: "Default spreadsheet",
      columnMap: {
        "Client Name": "client_name",
        "Invoice Number": "invoice_number",
        "Total Amount": "total_amount",
        "Balance Due": "balance_due",
        "Due Date": "due_date",
        "Client Email": "client_email",
      },
    },
    update: { tenantId: DEMO_TENANT_ID },
  });

  await prisma.connector.upsert({
    where: { id: "00000000-0000-4000-8000-000000000020" },
    create: {
      id: "00000000-0000-4000-8000-000000000020",
      tenantId: DEMO_TENANT_ID,
      name: "Invoices table sync",
      enabled: true,
      sqlQuery: `SELECT client_name, invoice_number, total_amount::text AS total_amount, balance_due::text AS balance_due, to_char(due_date, 'YYYY-MM-DD') AS due_date, client_email, send_reminder::text AS send_reminder, email_opt_out::text AS email_opt_out, consent_email::text AS consent_email, reminder_delivery_mode::text AS reminder_delivery_mode, status::text AS status FROM invoices WHERE tenant_id = '${DEMO_TENANT_ID}'`,
      columnMap: {
        client_name: "client_name",
        invoice_number: "invoice_number",
        total_amount: "total_amount",
        balance_due: "balance_due",
        due_date: "due_date",
        client_email: "client_email",
        send_reminder: "send_reminder",
        email_opt_out: "email_opt_out",
        consent_email: "consent_email",
        reminder_delivery_mode: "reminder_delivery_mode",
        status: "status",
      },
    },
    update: { tenantId: DEMO_TENANT_ID },
  });

  const integrationKey =
    process.env.SEED_INTEGRATION_API_KEY ??
    "pr_dev_integration_key_only_for_local";
  const keyHash = createHash("sha256").update(integrationKey).digest("hex");
  await prisma.apiKey.upsert({
    where: { keyHash },
    create: {
      tenantId: DEMO_TENANT_ID,
      name: "Development integration",
      keyPrefix: integrationKey.slice(0, 12),
      keyHash,
    },
    update: { revokedAt: null, tenantId: DEMO_TENANT_ID },
  });

  await seedDemoInvoices(DEMO_TENANT_ID);
  await seedMilestoneTemplates(DEMO_TENANT_ID);
  await seedDemoActivity(DEMO_TENANT_ID, DEMO_SCHEDULE_ID, DEMO_USER_ID);

  const openInvoices = DEMO_INVOICES.filter((inv) => inv.status === "open").length;
  await prisma.usageCounter.upsert({
    where: {
      tenantId_metric_period: {
        tenantId: DEMO_TENANT_ID,
        metric: "invoices",
        period: new Date().toISOString().slice(0, 7),
      },
    },
    create: {
      tenantId: DEMO_TENANT_ID,
      metric: "invoices",
      period: new Date().toISOString().slice(0, 7),
      count: openInvoices,
    },
    update: { count: openInvoices },
  });

  console.log(`Seeded demo tenant: demo (${DEMO_TENANT_ID})`);
  console.log(`Seeded admin user: ${email}`);
  console.log(`Login password: ${password}`);
  console.log(`Seeded ${DEMO_INVOICES.length} demo invoices`);
  console.log(`Integration API key: ${integrationKey}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
