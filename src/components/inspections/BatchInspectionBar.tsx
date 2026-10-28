"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EquipmentType, InspectionResult } from "@/generated/prisma/enums";
import { formatCount, formatDateShort } from "@/lib/format";
import { computeValidUntil } from "@/lib/inspection";
import { inspectionRuleFor } from "@/lib/inspection-rules";
import { INSPECTION_RESULT } from "@/lib/status";
import { cn } from "@/lib/utils";
import { recordBatchInspectionAction } from "@/server/actions/inspection";

import { useInspectorProfile } from "./inspector-profile";

export interface BatchItem {
  id: string;
  tag: string;
  name: string;
  type: EquipmentType;
  usageGroup?: string | null;
  protectionClass?: string | null;
  inspectionIntervalMonths: number;
}

const RESULTS: InspectionResult[] = ["CAPABLE", "CAPABLE_WITH_DEFECTS", "INCAPABLE"];
const ITEMS = ["položka", "položky", "položek"] as const;

/** Plovoucí lišta „Zapsat hromadnou revizi (X vybráno)“ + dialog s jedním zápisem technika. */
export function BatchInspectionBar({ items, today, onClear }: { items: BatchItem[]; today: string; onClear: () => void }) {
  const router = useRouter();
  const [profile, updateProfile] = useInspectorProfile();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(today);
  const [result, setResult] = useState<InspectionResult>("CAPABLE");
  const [defects, setDefects] = useState("");

  if (items.length === 0) return null;

  const needsDefects = result !== "CAPABLE";
  const valid =
    !!date && date <= today && profile.name.trim() !== "" && profile.license.trim() !== "" && (!needsDefects || defects.trim().length >= 3);
  const preview = (item: BatchItem) => {
    if (result === "INCAPABLE") return "vyřazeno";
    try {
      return formatDateShort(computeValidUntil(new Date(`${date}T10:00:00Z`), item.inspectionIntervalMonths));
    } catch {
      return "–";
    }
  };

  function submit() {
    if (!valid) return;
    startTransition(async () => {
      const response = await recordBatchInspectionAction({
        equipmentIds: items.map((item) => item.id),
        inspectionDate: date,
        inspectorName: profile.name,
        inspectorLicense: profile.license,
        measuringInstrument: profile.instrument || null,
        result,
        defectsSummary: needsDefects ? defects : defects.trim() || null,
      });
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      toast.success(`Hromadná revize zapsána: ${formatCount(response.data.count, ITEMS)}.`, {
        description: `Protokol ${response.data.reportNumber} · platnost podle lhůty každého zařízení.`,
      });
      setOpen(false);
      setDefects("");
      setResult("CAPABLE");
      onClear();
      router.refresh();
    });
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-safe" role="region" aria-label="Hromadná revize">
        <div className="flex w-full max-w-2xl flex-wrap items-center gap-2 rounded-2xl border border-primary/50 bg-zinc-900/95 p-2 shadow-2xl shadow-black/60 backdrop-blur">
          <Button size="lg" className="h-12 flex-1 gap-2 text-base font-semibold" onClick={() => setOpen(true)}>
            <ClipboardCheck className="size-5" aria-hidden />
            Zapsat hromadnou revizi ({items.length} vybráno)
          </Button>
          <Button size="lg" variant="ghost" className="h-12 gap-2" onClick={onClear}>
            <X className="size-4" aria-hidden />
            Zrušit výběr
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Hromadná revize – {formatCount(items.length, ITEMS)}</DialogTitle>
            <DialogDescription>Jeden zápis technika pro všechna vybraná zařízení. Platnost se každému spočítá podle jeho normy.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="batch-inspector">Revizní technik</Label>
                <Input id="batch-inspector" value={profile.name} onChange={(event) => updateProfile({ name: event.target.value })} maxLength={120} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-license">Ev. č. osvědčení TIČR</Label>
                <Input id="batch-license" value={profile.license} onChange={(event) => updateProfile({ license: event.target.value })} maxLength={120} className="h-11 font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-date">Datum revize</Label>
                <Input id="batch-date" type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-instrument">Měřicí přístroj</Label>
                <Input id="batch-instrument" value={profile.instrument} onChange={(event) => updateProfile({ instrument: event.target.value })} maxLength={120} className="h-11" />
              </div>
            </div>

            <div className="space-y-2">
              <Label id="batch-result-label">Výsledek</Label>
              <div role="radiogroup" aria-labelledby="batch-result-label" className="grid gap-2 sm:grid-cols-3">
                {RESULTS.map((value) => {
                  const style = INSPECTION_RESULT[value];
                  const Icon = style.icon;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={result === value}
                      onClick={() => setResult(value)}
                      className={cn(
                        "touch-target flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        result === value ? style.badge : "border-border bg-card hover:bg-muted/50",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", style.text)} aria-hidden />
                      {style.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {needsDefects ? (
              <div className="space-y-2">
                <Label htmlFor="batch-defects">
                  Soupis závad <span className="text-red-400">*</span>
                </Label>
                <Textarea id="batch-defects" value={defects} onChange={(event) => setDefects(event.target.value)} rows={3} maxLength={4000} />
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-sm font-medium">Nová platnost</p>
              <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="font-mono font-semibold">{item.tag}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {inspectionRuleFor(item).standard} · {formatCount(item.inspectionIntervalMonths, ["měsíc", "měsíce", "měsíců"])}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono">{preview(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="touch-target">
                Zpět
              </Button>
            </DialogClose>
            <Button className="touch-target gap-2" onClick={submit} disabled={pending || !valid}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
              Zapsat {formatCount(items.length, ITEMS)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
