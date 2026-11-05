import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { PackageCards } from "@/components/panel-builder/credits/PackageCards";
import { ORDER_STATUS, creditPackage, formatCzk } from "@/lib/credits";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requirePanelCompany } from "@/server/panel-session";
import { getCreditOrders } from "@/server/queries/panel-builder";

export const metadata: Metadata = { title: "Dobít kredity" };

// Fáze 50: samoobslužné dobíjení kreditů – balíčky, objednávky s QR platbou a zálohovou fakturou.
export default async function CreditsPage({ searchParams }: PageProps<"/panel-builder/credits">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const [company, orders, params] = await Promise.all([requirePanelCompany(), getCreditOrders(), searchParams]);
  const noCredits = params.reason === "no-credits";
  return (
    <PageTransition>
      <PageHeader
        breadcrumb={
          <Link href="/panel-builder" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> AI Panel Builder
          </Link>
        }
        title="Dobít kredity pro AI Panel Builder"
        description={`${company.companyName} · zbývá ${company.creditsRemaining} kreditů. 1 kredit = 1 nový rozváděč (z fotky, od nuly, ze soupisu místností nebo z 2D půdorysu).`}
      />
      {noCredits ? (
        <p className="mb-4 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-100" role="alert" data-testid="no-credits">
          Došly vám kredity – pro založení dalšího projektu vyberte balíček. Kredity připíšeme hned po připsání platby na účet.
        </p>
      ) : null}
      <PackageCards />
      <section className="mt-8 flex flex-col gap-2" aria-label="Moje objednávky kreditů">
        <h2 className="text-lg font-semibold">Moje objednávky</h2>
        {orders.length ? (
          <ul className="flex flex-col gap-2" data-testid="credit-orders">
            {orders.map((order) => (
              <li key={order.id}>
                <Link href={`/panel-builder/credits/${order.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/50">
                  <span className="font-mono text-primary">VS {order.variableSymbol}</span>
                  <span className="font-semibold">{creditPackage(order.packageCode)?.title ?? order.packageCode}</span>
                  <span className="text-muted-foreground">{formatDate(order.createdAt)}</span>
                  <span className="ml-auto font-mono tabular-nums">{formatCzk(order.priceCzkInclVat)} s DPH</span>
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs", ORDER_STATUS[order.status].badge)}>{ORDER_STATUS[order.status].label}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Zatím žádná objednávka.</p>
        )}
      </section>
    </PageTransition>
  );
}
