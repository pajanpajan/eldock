"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { markBatchPrintedAction } from "@/server/actions/qr-labels";

/**
 * Fáze 103: lišta tisku štítků – tisk / uložení PDF z prohlížeče (Zebra ZD421t: ovladač tiskárny, velikost papíru =
 * rozměr štítku, měřítko 100 %); po tisku ze série velínu uloží datum tisku.
 */
export function LabelPrintToolbar({ hint, batchId }: { hint: React.ReactNode; batchId?: string }) {
  useEffect(() => {
    if (!batchId) return;
    const onAfterPrint = () => void markBatchPrintedAction(batchId);
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, [batchId]);
  return (
    <div className="no-print flex w-full flex-wrap items-center gap-2">
      <p className="flex-1 text-sm text-muted-foreground">{hint}</p>
      <Button type="button" className="touch-target gap-2" onClick={() => window.print()} data-testid="label-print">
        <Printer className="size-4" aria-hidden /> Vytisknout / uložit PDF 1:1
      </Button>
    </div>
  );
}
