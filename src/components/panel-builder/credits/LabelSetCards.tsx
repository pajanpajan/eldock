"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Tag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatCzk } from "@/lib/credits";
import { LABEL_KINDS, pricePerPiece, priceWithVat, type LabelSet } from "@/lib/operator";
import { createCreditOrderAction } from "@/server/actions/credits";

/**
 * Fáze 112: sady QR štítků ELDOCK k objednání (ceník z velínu) – objednávka s výzvou k platbě a QR platbou (SPD) stejně
 * jako kredity; po úhradě se série štítků vytiskne a odešle poštou. Fáze 113: výchozí sady (spotřebič 30 × 15 mm,
 * rozváděč 50 × 25 mm, stroj 70 × 40 mm a startovací mix) s cenou za kus.
 */
export function LabelSetCards({ sets, vatPayer }: { sets: LabelSet[]; vatPayer: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!sets.length) return null;
  return (
    <section className="mt-6 flex flex-col gap-2" aria-label="Sady QR štítků ELDOCK" data-testid="label-sets">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Tag className="size-4" aria-hidden /> 🏷️ Sady odolných QR štítků ELDOCK
      </h2>
      <p className="text-sm text-muted-foreground">Termotransfer 300 DPI na PET s resinem – čitelné i po letech v rozváděči, na stroji i na prodlužovačce. Po úhradě štítky vytiskneme a pošleme poštou.</p>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sets.map((set) => (
          <li key={set.code} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4" data-testid={`label-set-${set.code}`}>
            <p className="font-semibold">{set.title}</p>
            {set.description ? <p className="text-xs text-muted-foreground">{set.description}</p> : null}
            <ul className="flex flex-wrap gap-1 text-[11px]" aria-label="Složení sady">
              {set.items.map((item) => (
                <li key={item.kind} className="rounded-full border border-border px-2 py-0.5">
                  {item.count}× {LABEL_KINDS[item.kind].label} {LABEL_KINDS[item.kind].size}
                </li>
              ))}
            </ul>
            <p>
              <span className="text-xl font-black tabular-nums">{formatCzk(priceWithVat(set.priceExclVat, vatPayer))}</span>
              <span className="text-xs text-muted-foreground"> {vatPayer ? `s DPH (${formatCzk(set.priceExclVat)} bez DPH)` : "– neplátce DPH, konečná cena"} · {pricePerPiece(set, vatPayer)}</span>
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
              data-testid={`order-labels-${set.code}`}
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Objednat sadu ({set.count} ks)
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
