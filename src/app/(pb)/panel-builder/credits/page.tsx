import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { PackageCards } from "@/components/panel-builder/credits/PackageCards";
import { LabelSetCards } from "@/components/panel-builder/credits/LabelSetCards";
import { labelOrderTitle } from "@/lib/operator";
import { getLabelSets, getOperatorProfile } from "@/server/operator";
import { ACTION_PRICE_ROWS, ORDER_STATUS, SUBSCRIPTIONS, creditPackage, formatCzk, subscriptionActive, subscriptionOf, trialRemainingText } from "@/lib/credits";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { requirePanelCompany } from "@/server/panel-session";
import { getCreditOrders } from "@/server/queries/panel-builder";
import { creditStatus } from "@/server/services/credits";

export const metadata: Metadata = { title: "Dobít kredity / Tarify" };

const REASONS: Record<string, string> = {
  SWITCHBOARD: "Rozváděč",
  FLOORPLAN: "2D půdorys",
  BUNDLE_SWITCHBOARD: "Rozváděč – balíček celá zakázka",
  QUOTE: "Cenová nabídka",
  CNC: "CNC výrobní balíček",
  UNLOCK: "Odemčení plné verze",
  TOP_UP: "Dobití kreditů",
  SUBSCRIPTION: "Předplatné",
  REFUND: "Vrácení",
  ADJUST: "Úprava ve velínu",
  CONVERSION: "Převod na nový ceník",
  // Fáze 114: okamžité odemčení po QR platbě a odečtení, když platba nedorazila
  PROVISIONAL_GRANT: "⏳ Předběžně po QR platbě (kontrola výpisu do 48 h)",
  PROVISIONAL_REVOKE: "↩️ Předběžné kredity odečteny (platba nedorazila)",
};

// Fáze 50 / 111: samoobslužné dobíjení kreditů a předplatné – ceník akcí, 1 testovací projekt, balíčky (platnost 12 měsíců),
// předplatné PRO, objednávky s QR platbou a zálohovou fakturou a pohyby kreditů.
export default async function CreditsPage({ searchParams }: PageProps<"/panel-builder/credits">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  // Fáze 112: sady QR štítků a plátcovství DPH z velínu
  const [company, orders, params, labelSets, operator] = await Promise.all([requirePanelCompany(), getCreditOrders(), searchParams, getLabelSets(), getOperatorProfile()]);
  const status = await creditStatus(prisma, company.id);
  const trial = status.demo ? null : trialRemainingText(status);
  const preselected = typeof params.balicek === "string" ? params.balicek : null;
  const plan = subscriptionOf(status.subscriptionPlan);
  const active = subscriptionActive(status);
  return (
    <PageTransition>
      <PageHeader
        breadcrumb={
          <Link href="/panel-builder" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> AI Panel Builder
          </Link>
        }
        title="Dobít kredity / Tarify"
        description={`${company.companyName} · zbývá ${company.creditsRemaining} kreditů${status.creditsValidUntil ? ` (platné do ${formatDate(status.creditsValidUntil)})` : ""}. Rozváděč 15 kreditů, 2D půdorys 15 kreditů, celá zakázka 25 kreditů, samostatná nabídka nebo CNC balíček 8 kreditů.`}
      />
      <div className="mb-6 flex flex-col gap-2">
        {status.demo ? (
          <p className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-sm" data-testid="credits-demo">
            Ukázková firma: všechny projekty jsou zkušební se zkušebním označením výstupů a kredity se neodečítají. Pro plné výstupy si zaregistrujte vlastní firmu.
          </p>
        ) : null}
        {trial ? (
          <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm" data-testid="credits-trial">
            {trial} – výstupy nesou označení „ZKUŠEBNÍ VÝSTUP – ELDOCK TRIAL“.
          </p>
        ) : null}
        {plan ? (
          <p className={cn("rounded-xl border p-3 text-sm", active ? "border-primary/40 bg-primary/10" : "border-border")} data-testid="credits-subscription">
            {active ? "✅ Aktivní předplatné" : "Předplatné skončilo"}: {plan.name}
            {status.subscriptionUntil ? ` · do ${formatDate(status.subscriptionUntil)}` : ""}
          </p>
        ) : null}
      </div>

      <section className="mb-8 flex flex-col gap-2" aria-label="Ceny akcí">
        <h2 className="text-lg font-semibold">Ceny akcí</h2>
        <table className="w-full max-w-3xl border-collapse text-sm" data-testid="credits-prices">
          <tbody>
            {ACTION_PRICE_ROWS.map((row) => (
              <tr key={row.action} className="border-b border-border">
                <td className="py-2 pr-3">{row.title}</td>
                <td className="py-2 text-right font-mono font-bold whitespace-nowrap">
                  {row.credits} kreditů{row.note ? <span className="block text-xs font-normal text-emerald-300">({row.note})</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <PackageCards preselected={preselected} firstTopUp={!status.firstTopUpBonusAt} vatPayer={operator.vatPayer} />
      <LabelSetCards sets={labelSets} vatPayer={operator.vatPayer} />

      <section className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground" aria-label="Tarify budov a průmyslu">
        {SUBSCRIPTIONS.filter((row) => !row.selfService).map((row) => (
          <p key={row.plan}>
            <b className="text-foreground">{row.name}</b>: {formatCzk(row.monthExclVat)} / měsíc ({formatCzk(row.yearExclVat)} / rok) – {row.features.join(", ")}.{" "}
            <Link href={`/kontakt?tema=tarif-${row.plan.toLowerCase()}`} className="text-primary underline-offset-4 hover:underline">
              Objednat tarif
            </Link>
          </p>
        ))}
      </section>

      <section className="mt-8 flex flex-col gap-2" aria-label="Moje objednávky kreditů">
        <h2 className="text-lg font-semibold">Moje objednávky</h2>
        {orders.length ? (
          <ul className="flex flex-col gap-2" data-testid="credit-orders">
            {orders.map((order) => (
              <li key={order.id}>
                <Link href={`/panel-builder/credits/${order.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/50">
                  <span className="font-mono text-primary">VS {order.variableSymbol}</span>
                  <span className="font-semibold">{creditPackage(order.packageCode)?.title ?? labelOrderTitle(order.packageCode, labelSets) ?? order.packageCode}</span>
                  <span className="text-muted-foreground">{formatDate(order.createdAt)}</span>
                  <span className="ml-auto font-mono tabular-nums">{formatCzk(order.priceCzkInclVat)}{order.priceCzkInclVat > order.priceCzkExclVat ? " s DPH" : ""}</span>
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs", ORDER_STATUS[order.status].badge)}>{ORDER_STATUS[order.status].label}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Zatím žádná objednávka.</p>
        )}
      </section>

      <section className="mt-8 flex flex-col gap-2" aria-label="Pohyby kreditů">
        <h2 className="text-lg font-semibold">Pohyby kreditů</h2>
        {status.transactions.length ? (
          <table className="w-full max-w-4xl border-collapse text-sm" data-testid="credit-transactions">
            <tbody>
              {status.transactions.map((row) => (
                <tr key={row.id} className="border-b border-border">
                  <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">{formatDate(row.createdAt)}</td>
                  <td className="py-1.5 pr-3">{REASONS[row.reason] ?? row.reason}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{row.note}</td>
                  <td className={cn("py-1.5 pr-3 text-right font-mono font-bold", row.amount < 0 ? "text-red-300" : "text-emerald-300")}>{row.amount > 0 ? `+${row.amount}` : row.amount}</td>
                  <td className="py-1.5 text-right font-mono text-muted-foreground">{row.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">Zatím žádný pohyb kreditů.</p>
        )}
      </section>
    </PageTransition>
  );
}
