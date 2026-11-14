"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CREDIT_PACKAGES, CREDIT_VALIDITY_MONTHS, FIRST_TOP_UP_LABELS, SUBSCRIPTIONS, formatCzk, subscriptionCode, withVat } from "@/lib/credits";
import { cn } from "@/lib/utils";
import { createCreditOrderAction } from "@/server/actions/credits";

/**
 * Fáze 111: balíčky kreditů nového ceníku (START 30 / MONTÉR 125 / PROJEKČNÍ & MONTÁŽNÍ FIRMA 300) a předplatné PRO;
 * [ Objednat ] založí objednávku a otevře QR platbu se zálohovou fakturou. `preselected` = balíček z odkazu ceníku.
 */
export function PackageCards({ preselected = null, firstTopUp = true, vatPayer = false }: { preselected?: string | null; firstTopUp?: boolean; /** Fáze 113: neplátce DPH = cena je konečná. */ vatPayer?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function order(code: string) {
    startTransition(async () => {
      const result = await createCreditOrderAction(code);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Objednávka VS ${result.data.variableSymbol} založena – zaplaťte QR kódem.`);
      router.push(`/panel-builder/credits/${result.data.id}`);
    });
  }
  const pro = SUBSCRIPTIONS.find((plan) => plan.plan === "PRO")!;
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-4 md:grid-cols-3" data-testid="credit-packages">
        {CREDIT_PACKAGES.map((pkg) => (
          <li
            key={pkg.code}
            className={cn("relative flex flex-col gap-3 rounded-2xl border bg-card p-5", pkg.highlight || preselected === pkg.code ? "border-2 border-primary shadow-lg shadow-primary/10" : "border-border")}
            data-package={pkg.code}
          >
            {pkg.highlight ? <span className="absolute -top-3 left-5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">Nejoblíbenější</span> : null}
            <p className="font-mono text-xs text-primary">{pkg.name}</p>
            <h2 className="text-lg font-bold">{pkg.title}</h2>
            <p>
              <span className="text-3xl font-black tabular-nums">{formatCzk(pkg.priceExclVat)}</span> <span className="text-sm text-muted-foreground">{vatPayer ? "bez DPH" : "konečná cena"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {vatPayer ? `${formatCzk(withVat(pkg.priceExclVat))} s DPH 21 %` : "neplátce DPH"} · {pkg.note}
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              <li className="flex items-center gap-1.5">
                <Check className="size-4 text-emerald-400" aria-hidden /> {pkg.credits} kreditů, platnost {CREDIT_VALIDITY_MONTHS} měsíců
              </li>
              {firstTopUp ? (
                <li className="flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-400" aria-hidden /> Bonus k prvnímu dobití: {FIRST_TOP_UP_LABELS} ks stříbrných QR štítků
                </li>
              ) : null}
              <li className="flex items-center gap-1.5">
                <Check className="size-4 text-emerald-400" aria-hidden /> Platba QR kódem, zálohová faktura ihned
              </li>
            </ul>
            <Button type="button" className="mt-auto touch-target gap-2" variant={pkg.highlight ? "default" : "outline"} disabled={pending} onClick={() => order(pkg.code)} data-testid={`order-${pkg.code}`}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} [ Objednat balíček ]
            </Button>
          </li>
        ))}
      </ul>
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5" aria-label={pro.name} data-testid="credit-subscription-pro">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{pro.name}</p>
          <p className="text-sm text-muted-foreground">{pro.features.join(" · ")}</p>
          <p className="mt-1 text-sm">
            <b>{formatCzk(pro.monthExclVat)}</b> / měsíc nebo <b>{formatCzk(pro.yearExclVat)}</b> / rok <span className="text-xs text-muted-foreground">({vatPayer ? "bez DPH" : "neplátce DPH"})</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={preselected === subscriptionCode("PRO", "MONTH") ? "default" : "outline"} disabled={pending} onClick={() => order(subscriptionCode("PRO", "MONTH"))} data-testid="order-SUB_PRO_MONTH">
            Měsíčně
          </Button>
          <Button type="button" variant={preselected === subscriptionCode("PRO", "YEAR") ? "default" : "outline"} disabled={pending} onClick={() => order(subscriptionCode("PRO", "YEAR"))} data-testid="order-SUB_PRO_YEAR">
            Ročně
          </Button>
        </div>
      </section>
    </div>
  );
}
