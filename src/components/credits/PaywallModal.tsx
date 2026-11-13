"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ACTION_PRICE_ROWS, CREDIT_PACKAGES, JOB_SAVING, PAYWALL_TITLE, SUBSCRIPTIONS, TRIAL_WATERMARK, formatCzk, type PaywallInfo } from "@/lib/credits";
import { cn } from "@/lib/utils";
import { unlockOutputAction } from "@/server/actions/credits";

import { PAYWALL_EVENT } from "./paywall";

const UNLOCK_LABEL: Record<NonNullable<PaywallInfo["unlock"]>["kind"], string> = {
  switchboard: "Odemknout plnou verzi rozváděče",
  floorplan: "Odemknout plnou verzi 2D půdorysu",
  quote: "Odemknout cenovou nabídku",
  cnc: "Odemknout CNC výrobní balíček",
};

/** Fáze 111: prodejní modal v layoutu AI Panel Builderu – otevře ho událost `showPaywall` z kterékoli akce. */
export function PaywallHost() {
  const [info, setInfo] = useState<PaywallInfo | null>(null);
  useEffect(() => {
    const listener = (event: Event) => setInfo((event as CustomEvent<PaywallInfo>).detail);
    window.addEventListener(PAYWALL_EVENT, listener);
    return () => window.removeEventListener(PAYWALL_EVENT, listener);
  }, []);
  return <PaywallModal info={info} onClose={() => setInfo(null)} onInfo={setInfo} />;
}

/**
 * „💎 Odemkněte plnou verzi ELDOCK – Tato zakázka vám ušetří ~8 hodin práce (5 200 Kč)“: co akce stojí, zůstatek,
 * odemčení za kredity (když stačí), balíčky kreditů a předplatné PRO.
 */
export function PaywallModal({ info, onClose, onInfo }: { info: PaywallInfo | null; onClose: () => void; onInfo?: (info: PaywallInfo) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unlock = info?.unlock ?? null;
  const canUnlock = Boolean(unlock) && info !== null && (info.reason === "TRIAL_OUTPUT" || info.balance >= info.cost);
  const pro = SUBSCRIPTIONS.find((plan) => plan.plan === "PRO")!;

  function doUnlock() {
    if (!unlock || !info) return;
    startTransition(async () => {
      const result = await unlockOutputAction(unlock.kind, unlock.id);
      if (!result.ok) {
        if (result.paywall && onInfo) return onInfo(result.paywall);
        return void toast.error(result.error);
      }
      toast.success(result.data.cost ? `Odemčeno za ${result.data.cost} kreditů – zbývá ${result.data.balance}.` : "Výstup je v ceně – odemčeno.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={info !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid="paywall-modal">
        <DialogHeader>
          <DialogTitle className="text-xl leading-snug">{PAYWALL_TITLE}</DialogTitle>
          <DialogDescription>
            {info?.reason === "TRIAL_OUTPUT"
              ? `Zkušební projekt má výstupy s označením „${TRIAL_WATERMARK}“. Plná verze bez označení: ${info.cost} kreditů (zbývá ${info.balance}).`
              : info?.reason === "EXPIRED"
                ? "Platnost kreditů vypršela (kredity platí 12 měsíců od posledního dobití) – dobijte kredity a pokračujte."
                : info
                  ? `${info.action}: ${info.cost} kreditů – zbývá vám ${info.balance}. Testovací projekt zdarma už je využitý.`
                  : null}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
          ⏱️ Každý rodinný dům = ~{JOB_SAVING.hours} hodin práce méně ({formatCzk(JOB_SAVING.czk)}) – výkres, výkaz kabeláže, rozváděč s elaborátem a nabídka pro zákazníka za pár kreditů.
        </p>

        <table className="w-full border-collapse text-sm" data-testid="paywall-prices">
          <tbody>
            {ACTION_PRICE_ROWS.map((row) => (
              <tr key={row.action} className="border-b border-border">
                <td className="py-1.5 pr-3">{row.title}</td>
                <td className="py-1.5 text-right font-mono font-bold whitespace-nowrap">{row.credits} kr.</td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="grid gap-2 sm:grid-cols-3">
          {CREDIT_PACKAGES.map((pkg) => (
            <li key={pkg.code}>
              <Link
                href={`/panel-builder/credits?balicek=${pkg.code}`}
                onClick={onClose}
                className={cn("flex h-full flex-col gap-1 rounded-xl border p-3 text-sm hover:border-primary", pkg.highlight ? "border-2 border-primary" : "border-border")}
                data-testid={`paywall-package-${pkg.code}`}
              >
                <span className="font-semibold">{pkg.name}</span>
                <span className="font-mono">
                  {pkg.credits} kr. · {formatCzk(pkg.priceExclVat)}
                </span>
                <span className="text-xs text-muted-foreground">{pkg.note}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden /> {pro.name}: {formatCzk(pro.monthExclVat)} / měsíc – {pro.monthlyCredits} kreditů měsíčně, archiv verzí a nabídky z normohodin.
        </p>

        <DialogFooter className="flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onClose} data-testid="paywall-close">
            {info?.reason === "TRIAL_OUTPUT" ? "Pokračovat se zkušebním výstupem" : "Zavřít"}
          </Button>
          {canUnlock && unlock ? (
            <Button type="button" variant="outline" className="gap-2" onClick={doUnlock} disabled={pending} data-testid="paywall-unlock">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} 🔓 {UNLOCK_LABEL[unlock.kind]} ({info?.cost} kr.)
            </Button>
          ) : null}
          <Button asChild className="gap-2 font-bold">
            <Link href="/panel-builder/credits" onClick={onClose} data-testid="paywall-topup">
              💎 Dobít kredity / Tarify
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
