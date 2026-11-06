"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TRANSFER_LABEL, type TransferStatus } from "@/lib/panel-builder/manufacturer-transfer";
import { cn } from "@/lib/utils";
import { transferManufacturerAction } from "@/server/actions/panel-transfer";
import type { TransferResult } from "@/server/services/panel-transfer";

const TONE: Record<TransferStatus, string> = {
  exact: "border-emerald-500/50 text-emerald-200",
  width: "border-sky-400/50 text-sky-200",
  estimate: "border-amber-400/60 text-amber-200",
  keep: "border-border text-muted-foreground",
};

/**
 * Fáze 60: „🔄 Převést na jiného výrobce“ – náhled převodní tabulky (shodný přístroj / jiná šířka / odhad / zůstává)
 * a provedení jedním klikem. Značení, popisy obvodů, strom zapojení a pořadí na lištách zůstávají.
 */
export function ManufacturerTransfer({ projectId, current, manufacturers }: { projectId: string; current: string; manufacturers: readonly { name: string; count: number }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const options = manufacturers.filter((option) => option.name !== current);
  const [target, setTarget] = useState(options[0]?.name ?? "");
  const [preview, setPreview] = useState<TransferResult | null>(null);
  const [pending, startTransition] = useTransition();

  function load(manufacturer: string) {
    setTarget(manufacturer);
    setPreview(null);
    if (!manufacturer) return;
    startTransition(async () => {
      const result = await transferManufacturerAction({ projectId, manufacturer, apply: false });
      if (!result.ok) return void toast.error(result.error);
      setPreview(result.data);
    });
  }

  function apply() {
    startTransition(async () => {
      const result = await transferManufacturerAction({ projectId, manufacturer: target, apply: true });
      if (!result.ok) return void toast.error(result.error);
      const { summary, moved } = result.data;
      toast.success(`Rozváděč převeden na ${target}: ${summary.exact} shodných, ${summary.width} jiná šířka, ${summary.estimate} odhad${moved ? `, ${moved} přístrojů přesunuto na další lištu` : ""}. Značení, popisy a strom zůstaly.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && target) load(target);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-9 gap-1.5 text-xs" data-testid="transfer-open" disabled={!options.length}>
          <ArrowRightLeft className="size-3.5" aria-hidden /> Převést na jiného výrobce
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" data-testid="transfer-dialog">
        <DialogHeader>
          <DialogTitle>Převést celý rozváděč na jiného výrobce</DialogTitle>
          <DialogDescription>Hodnoty přístrojů (In, charakteristika, typ a citlivost chrániče, póly, typ SPD), značení, popisy obvodů, strom zapojení a pořadí na lištách zůstávají. Aktuální výrobce: {current}.</DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-sm">
          Nový výrobce:
          <select value={target} onChange={(event) => load(event.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30" aria-label="Nový výrobce rozváděče" data-testid="transfer-manufacturer">
            {options.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name} ({option.count} prvků)
              </option>
            ))}
          </select>
          {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Počítám převod" /> : null}
        </label>
        {preview ? (
          <>
            <p className="text-sm" data-testid="transfer-summary">
              {preview.summary.exact} shodných · {preview.summary.width} jiná šířka · {preview.summary.estimate} odhad (výrobce kus nemá – parametry zůstanou, Pv dle IEC) · {preview.summary.keep} zůstává
            </p>
            <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs" data-testid="transfer-rows">
                <thead className="sticky top-0 bg-card text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Značení</th>
                    <th className="px-2 py-1 text-left font-medium">Obvod</th>
                    <th className="px-2 py-1 text-left font-medium">Teď → po převodu</th>
                    <th className="px-2 py-1 text-left font-medium">Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.itemId} className="border-t border-border" data-status={row.status}>
                      <td className="px-2 py-1 font-mono">{row.designation}</td>
                      <td className="px-2 py-1">{row.label || "–"}</td>
                      <td className="px-2 py-1">
                        {row.from} → <b>{row.to}</b>
                        {row.modulesTo !== row.modulesFrom ? <span className="text-sky-200"> ({row.modulesFrom}M → {row.modulesTo}M)</span> : null}
                      </td>
                      <td className="px-2 py-1">
                        <span className={cn("rounded-full border px-1.5 py-0.5 whitespace-nowrap", TONE[row.status])}>{TRANSFER_LABEL[row.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Zrušit
          </Button>
          <Button type="button" onClick={apply} disabled={pending || !preview || !preview.summary.changed} data-testid="transfer-apply">
            Převést rozváděč na {target || "…"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
