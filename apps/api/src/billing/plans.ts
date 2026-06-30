export interface PlanDefinition {
  code: string;
  name: string;
  invoiceLimit: number;
  scheduleLimit: number;
  connectorLimit: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
}

export const PLANS: PlanDefinition[] = [
  {
    code: "starter",
    name: "Starter",
    invoiceLimit: 500,
    scheduleLimit: 3,
    connectorLimit: 1,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
  },
  {
    code: "growth",
    name: "Growth",
    invoiceLimit: 5000,
    scheduleLimit: 10,
    connectorLimit: 5,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_GROWTH_YEARLY,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    invoiceLimit: 100_000,
    scheduleLimit: 50,
    connectorLimit: 25,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
  },
];

export function getPlanByCode(code: string): PlanDefinition | undefined {
  return PLANS.find((p) => p.code === code);
}
