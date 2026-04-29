import Link from "next/link";
import { Suspense } from "react";
import { Globe, Wallet, CreditCard, Home } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { XeroConnection } from "./xero-connection";

const FINANCE_MODULES = [
  {
    title: "Outreach Finance",
    description: "Track budgets, expenses, receipts, cash batches, and closeouts for international outreach teams.",
    href: "/finance/outreach",
    icon: Globe,
    ready: true,
  },
  {
    title: "Staff Fees",
    description: "Monthly staff fees (R100/month), payment tracking, and status.",
    href: "/finance/staff-fees",
    icon: CreditCard,
    ready: false,
  },
  {
    title: "Rent & Housing",
    description: "Rent payments, housing allocations, and payment history.",
    href: "/finance/rent",
    icon: Home,
    ready: false,
  },
  {
    title: "School Fees",
    description: "Tiered school fee tracking, student payments, and outstanding balances.",
    href: "/finance/school-fees",
    icon: Wallet,
    ready: true,
  },
];

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="page-eyebrow">FINANCIAL MANAGEMENT</p>
        <h1 className="page-title">Finance</h1>
      </div>

      {/* Integrations */}
      <Suspense>
        <XeroConnection />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-2">
        {FINANCE_MODULES.map((mod) => {
          const Icon = mod.icon;
          const content = (
            <Card
              key={mod.title}
              className={
                mod.ready
                  ? "card-hover cursor-pointer"
                  : "opacity-50"
              }
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-5 w-5" style={{ color: "var(--yellow)" }} />
                  {mod.title}
                  {!mod.ready && (
                    <span className="ml-auto text-xs font-normal uppercase tracking-widest text-muted-foreground">
                      Soon
                    </span>
                  )}
                </CardTitle>
                <CardDescription>{mod.description}</CardDescription>
              </CardHeader>
            </Card>
          );

          if (mod.ready) {
            return (
              <Link key={mod.title} href={mod.href}>
                {content}
              </Link>
            );
          }
          return <div key={mod.title}>{content}</div>;
        })}
      </div>
    </div>
  );
}
