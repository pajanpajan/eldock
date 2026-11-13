import Link from "next/link";
import { Check } from "lucide-react";

import { ACTION_PRICE_ROWS, CREDIT_PACKAGES, CREDIT_VALIDITY_MONTHS, FIRST_TOP_UP_LABELS, SUBSCRIPTIONS, formatCzk, withVat } from "@/lib/credits";
import { cn } from "@/lib/utils";

/**
 * Fáze 111: ceník ELDOCK – 1 testovací projekt zdarma, ceny akcí v kreditech, balíčky kreditů (platnost 12 měsíců, bonus
 * k prvnímu dobití) a předplatné. `installer` = elektrikáři a projektanti (balíčky + PRO), `buildings` = budovy
 * a průmysl (tarify Hlídače revizí). Bez stavu – web, podsekce i stránka kreditů.
 */
export function PricingOverview({ audience, orderHref = (code) => `/panel-builder/credits?balicek=${code}` }: { audience: "installer" | "buildings"; orderHref?: (code: string) => string }) {
  const plans = audience === "installer" ? SUBSCRIPTIONS.filter((plan) => plan.plan === "PRO") : SUBSCRIPTIONS.filter((plan) => plan.plan !== "PRO");
  return (
    <div className="flex flex-col gap-6" data-testid={`pricing-${audience}`}>
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs tracking-widest text-primary uppercase">Ceník & kredity</span>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{audience === "installer" ? "1 testovací projekt zdarma, pak platíte jen za hotové zakázky" : "Tarify Hlídače revizí pro budovy a průmysl"}</h2>
      </div>

      {audience === "installer" ? (
        <>
          <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm" data-testid="pricing-trial">
            🎁 <b>1 testovací projekt zdarma</b> – zkušební 2D půdorys + zkušební rozváděč. Výstupy (PDF elaborát, cenová nabídka) nesou jemné označení „ZKUŠEBNÍ VÝSTUP – ELDOCK TRIAL“.
          </p>
          <table className="w-full border-collapse text-sm" data-testid="pricing-actions">
            <caption className="mb-2 text-left font-semibold">Ceny akcí po vyčerpání testovacího projektu</caption>
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
          <ul className="grid gap-4 md:grid-cols-3" data-testid="pricing-packages">
            {CREDIT_PACKAGES.map((pkg) => (
              <li key={pkg.code} className={cn("relative flex flex-col gap-2 rounded-2xl border bg-card p-5", pkg.highlight ? "border-2 border-primary" : "border-border")}>
                {pkg.highlight ? <span className="absolute -top-3 left-5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">Nejoblíbenější</span> : null}
                <p className="font-semibold">{pkg.title}</p>
                <p>
                  <span className="text-2xl font-black tabular-nums">{pkg.credits} kreditů</span> za <b>{formatCzk(pkg.priceExclVat)}</b> <span className="text-xs text-muted-foreground">bez DPH</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {pkg.note} · {formatCzk(withVat(pkg.priceExclVat))} s DPH
                </p>
                <Link href={orderHref(pkg.code)} className="mt-auto inline-flex min-h-10 items-center justify-center rounded-lg border border-primary/60 px-3 text-sm font-semibold text-primary hover:bg-primary/10">
                  Objednat balíček
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Kredity platí {CREDIT_VALIDITY_MONTHS} měsíců od dobití. Bonus: ke každému prvnímu dobití {FIRST_TOP_UP_LABELS} ks stříbrných QR štítků ELDOCK zdarma. Platba QR kódem s okamžitou zálohovou fakturou.
          </p>
        </>
      ) : null}

      <ul className={cn("grid gap-4", plans.length > 1 ? "md:grid-cols-2" : "")} data-testid="pricing-subscriptions">
        {plans.map((plan) => (
          <li key={plan.plan} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5" data-plan={plan.plan}>
            <p className="font-semibold">{plan.name}</p>
            <p>
              <span className="text-2xl font-black tabular-nums">{formatCzk(plan.monthExclVat)}</span> / měsíc <span className="text-xs text-muted-foreground">(nebo {formatCzk(plan.yearExclVat)} / rok, bez DPH)</span>
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden /> {feature}
                </li>
              ))}
            </ul>
            <Link
              href={plan.selfService ? orderHref(`SUB_${plan.plan}_MONTH`) : `/kontakt?tema=tarif-${plan.plan.toLowerCase()}`}
              className="mt-auto inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              data-testid={`pricing-order-${plan.plan}`}
            >
              {plan.selfService ? "Objednat předplatné" : "Objednat tarif (aktivuje obchod do 1 pracovního dne)"}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
