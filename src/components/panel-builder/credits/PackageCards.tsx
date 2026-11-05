"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CREDIT_PACKAGES, formatCzk, withVat } from "@/lib/credits";
import { cn } from "@/lib/utils";
import { createCreditOrderAction } from "@/server/actions/credits";

/** Tři balíčky kreditů; [ Objednat balíček ] založí objednávku a otevře QR platbu se zálohovou fakturou. */
export function PackageCards() {
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
  return (
    <ul className="grid gap-4 md:grid-cols-3" data-testid="credit-packages">
      {CREDIT_PACKAGES.map((pkg) => (
        <li key={pkg.code} className={cn("relative flex flex-col gap-3 rounded-2xl border bg-card p-5", pkg.highlight ? "border-2 border-primary shadow-lg shadow-primary/10" : "border-border")} data-package={pkg.code}>
          {pkg.highlight ? <span className="absolute -top-3 left-5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">Nejoblíbenější</span> : null}
          <p className="font-mono text-xs text-primary">{pkg.name}</p>
          <h2 className="text-lg font-bold">{pkg.title}</h2>
          <p>
            <span className="text-3xl font-black tabular-nums">{formatCzk(pkg.priceExclVat)}</span> <span className="text-sm text-muted-foreground">bez DPH</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {formatCzk(withVat(pkg.priceExclVat))} s DPH 21 % · {pkg.note}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            <li className="flex items-center gap-1.5">
              <Check className="size-4 text-emerald-400" aria-hidden /> {pkg.credits} kreditů = {pkg.credits} nových rozváděčů
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="size-4 text-emerald-400" aria-hidden /> Platba QR kódem, zálohová faktura ihned
            </li>
          </ul>
          <Button type="button" className="mt-auto touch-target gap-2" variant={pkg.highlight ? "default" : "outline"} disabled={pending} onClick={() => order(pkg.code)}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} [ Objednat balíček ]
          </Button>
        </li>
      ))}
    </ul>
  );
}
