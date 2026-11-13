"use client";

import { Button } from "@/components/ui/button";
import type { PaywallInfo } from "@/lib/credits/entitlements";
import { cn } from "@/lib/utils";

import { showPaywall } from "./paywall";

/**
 * Fáze 111: cena akce před začátkem práce („🎁 Zkušební 2D půdorys zdarma“ / „Nový 2D půdorys – 15 kreditů“); bez kreditů
 * tlačítko otevře prodejní modal. Text i data spočítá server.
 */
export function ChargeNotice({ text, tone, paywall = null, testId }: { text: string; tone: "trial" | "paid" | "blocked" | "demo"; paywall?: PaywallInfo | null; testId: string }) {
  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 text-sm",
        tone === "trial" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
        tone === "paid" && "border-primary/40 bg-primary/10",
        tone === "blocked" && "border-amber-500/50 bg-amber-500/10 text-amber-100",
        tone === "demo" && "border-sky-500/40 bg-sky-500/10",
      )}
      role="status"
      data-testid={testId}
    >
      <span className="min-w-0 flex-1">{text}</span>
      {paywall ? (
        <Button type="button" size="sm" className="font-semibold" onClick={() => showPaywall(paywall)} data-testid={`${testId}-paywall`}>
          💎 Odemknout plnou verzi
        </Button>
      ) : null}
    </div>
  );
}
