import { config } from "dotenv";
import { createHash } from "crypto";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMeNow123!";

  const passwordHash = await argon2.hash(password);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      role: "admin",
    },
    update: {
      passwordHash,
      role: "admin",
    },
  });

  await prisma.vendorSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      vendorName: "Demo Vendor",
      vendorPhysicalAddress: "123 Main Street, Springfield, ST 00000",
    },
    update: {},
  });

  await prisma.mappingProfile.upsert({
    where: { id: "00000000-0000-4000-8000-000000000010" },
    create: {
      id: "00000000-0000-4000-8000-000000000010",
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
    update: {},
  });

  await prisma.connector.upsert({
    where: { id: "00000000-0000-4000-8000-000000000020" },
    create: {
      id: "00000000-0000-4000-8000-000000000020",
      name: "Invoices table sync",
      enabled: true,
      sqlQuery: `SELECT client_name, invoice_number, total_amount::text AS total_amount, balance_due::text AS balance_due, to_char(due_date, 'YYYY-MM-DD') AS due_date, client_email, send_reminder::text AS send_reminder, email_opt_out::text AS email_opt_out, consent_email::text AS consent_email, reminder_delivery_mode::text AS reminder_delivery_mode, status::text AS status FROM invoices`,
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
    update: {},
  });

  await prisma.schedule.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Weekly overdue check",
      cronExpression: "0 9 * * 1",
      timezone: "America/New_York",
      enabled: true,
      dryRun: true,
    },
    update: {},
  });

  const integrationKey =
    process.env.SEED_INTEGRATION_API_KEY ??
    "pr_dev_integration_key_only_for_local";
  const keyHash = createHash("sha256").update(integrationKey).digest("hex");
  await prisma.apiKey.upsert({
    where: { keyHash },
    create: {
      name: "Development integration",
      keyPrefix: integrationKey.slice(0, 12),
      keyHash,
    },
    update: { revokedAt: null },
  });

  console.log(`Seeded admin user: ${email}`);
  console.log(`Integration API key: ${integrationKey}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
