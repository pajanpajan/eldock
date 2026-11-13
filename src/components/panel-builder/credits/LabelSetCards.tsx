"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Tag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatCzk } from "@/lib/credits";
import { priceWithVat, type LabelSet } from "@/lib/operator";
import { createCreditOrderAction } from "@/server/actions/credits";

/**
 * Fáze 112: sady stříbrných QR štítků ELDOCK k objednání (ceník z velínu) – objednávka s výzvou k platbě a QR platbou
 * (SPD) stejně jako kredity; po úhradě se série štítků vytiskne a odešle poštou.
 */
export function LabelSetCards({ sets, vatPayer }: { sets: LabelSet[]; vatPayer: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!sets.length) return null;
  return (
    <section className="mt-6 flex flex-col gap-2" aria-label="Sady QR štítků ELDOCK" data-testid="label-sets">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Tag className="size-4" aria-hidden /> 🏷️ Sady QR štítků ELDOCK
      </h2>
      <ul className="grid gap-3 md:grid-cols-3">
        {sets.map((set) => (
          <li key={set.code} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4" data-testid={`label-set-${set.count}`}>
            <p className="font-semibold">{set.title}</p>
            <p>
              <span className="text-xl font-black tabular-nums">{set.count} ks</span> za <b>{formatCzk(set.priceExclVat)}</b>
              <span className="text-xs text-muted-foreground"> {vatPayer ? `bez DPH (${formatCzk(priceWithVat(set.priceExclVat, true))} s DPH)` : "(neplátce DPH)"}</span>
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-auto gap-2"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await createCreditOrderAction(set.code);
                  if (!result.ok) return void toast.error(result.error);
                  toast.success(`Objednávka VS ${result.data.variableSymbol} založena – zaplaťte QR kódem.`);
                  router.push(`/panel-builder/credits/${result.data.id}`);
                })
              }
              data-testid={`order-labels-${set.count}`}
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Objednat sadu
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
