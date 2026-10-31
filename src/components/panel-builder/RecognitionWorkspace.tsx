"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ComponentCategory, RecognitionStatus } from "@/generated/prisma/enums";
import type { BoundingBox } from "@/lib/panel-builder/layout";
import { RECOGNITION } from "@/lib/panel-builder/project";
import { cn } from "@/lib/utils";
import { analyzePanelProjectAction } from "@/server/actions/panel-builder";
import type { PickerComponent } from "@/server/queries/panel-builder";

import { DinRails } from "./DinRails";
import { SmartFallbackPicker } from "./SmartFallbackPicker";

export interface WorkspaceItem {
  id: string;
  designation: string;
  circuitLabel: string;
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
  box: BoundingBox | null;
  recognitionStatus: RecognitionStatus;
  confidence: number;
  rawOcrText: string | null;
  detected: { category?: ComponentCategory | null; poles?: string | null; ratedCurrentA?: number | null; trippingCurve?: string | null; manufacturer?: string | null } | null;
  component: Pick<PickerComponent, "id" | "manufacturer" | "typeCode" | "category" | "powerLossWatts"> | null;
}

const TONE: Record<RecognitionStatus, string> = {
  VERIFIED: "border-emerald-500/70 bg-emerald-500/15 text-emerald-100",
  PARTIAL: "border-yellow-500/80 bg-yellow-500/20 text-yellow-100",
  UNRECOGNIZED: "border-red-500/80 bg-red-500/20 text-red-100",
};

/** Krok 1: fotka s rámečky rozpoznání, DIN lišty v měřítku a Smart Fallback Picker. */
export function RecognitionWorkspace({
  projectId,
  photoUrl,
  items,
  rails,
  modulesPerRail,
  catalog,
  dominant,
}: {
  projectId: string;
  photoUrl: string | null;
  items: WorkspaceItem[];
  rails: number;
  modulesPerRail: number;
  catalog: PickerComponent[];
  dominant: string;
}) {
  const router = useRouter();
  const unresolved = items.filter((item) => item.recognitionStatus !== "VERIFIED");
  const [selectedId, setSelectedId] = useState<string | null>(unresolved[0]?.id ?? null);
  const [analyzing, startAnalyze] = useTransition();
  const selected = items.find((item) => item.id === selectedId) ?? null;

  function nextUnresolved(afterId: string | null) {
    const order = items.filter((item) => item.recognitionStatus !== "VERIFIED" && item.id !== afterId);
    setSelectedId(order[0]?.id ?? null);
  }

  function reanalyze() {
    if (!window.confirm("Znovu analyzovat fotku? Rozpoznané prvky a ruční přiřazení se nahradí.")) return;
    startAnalyze(async () => {
      const result = await analyzePanelProjectAction(projectId);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Rozpoznáno ${result.data.total} přístrojů, k dořešení ${result.data.unresolved}.`);
      if (result.data.warning) toast.warning(result.data.warning);
      router.refresh();
    });
  }

  const counts = { VERIFIED: 0, PARTIAL: 0, UNRECOGNIZED: 0 };
  for (const item of items) counts[item.recognitionStatus]++;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section aria-label="Fotka rozváděče a DIN lišty" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {(["VERIFIED", "PARTIAL", "UNRECOGNIZED"] as const).map((status) => (
            <span key={status} className={cn("rounded-full border px-2 py-0.5 text-xs", RECOGNITION[status].badge)} data-testid={`count-${status}`}>
              {RECOGNITION[status].label}: {counts[status]}
            </span>
          ))}
          <Button variant="outline" size="sm" className="touch-target ml-auto gap-2" onClick={reanalyze} disabled={analyzing}>
            {analyzing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />} Znovu analyzovat fotku
          </Button>
        </div>

        {photoUrl ? (
          <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-border bg-black" data-testid="panel-photo">
            {/* eslint-disable-next-line @next/next/no-img-element -- fotka z /api/files (SVG i JPG), rámečky v % */}
            <img src={photoUrl} alt="Fotka rozváděče" className="block h-auto w-full" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
              {items.map((item) => {
                if (!item.box) return null;
                const [ymin, xmin, ymax, xmax] = item.box;
                const style = RECOGNITION[item.recognitionStatus];
                const active = item.id === selectedId;
                return (
                  <g key={item.id} role="button" tabIndex={0} aria-label={`${item.designation} – ${style.label}`} className="cursor-pointer outline-none" onClick={() => setSelectedId(item.id)} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setSelectedId(item.id)}>
                    <rect x={xmin} y={ymin} width={xmax - xmin} height={ymax - ymin} fill={style.fill} stroke={style.stroke} strokeWidth={active ? 0.9 : 0.45} vectorEffect="non-scaling-stroke" style={{ strokeWidth: active ? 4 : 2 }} />
                    {item.recognitionStatus === "UNRECOGNIZED" ? (
                      <text x={(xmin + xmax) / 2} y={(ymin + ymax) / 2} fontSize={4} fontWeight={800} fill="#fff" textAnchor="middle" dominantBaseline="middle" style={{ paintOrder: "stroke", stroke: "#ef4444", strokeWidth: 0.8 }}>
                        ?
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Projekt nemá fotku – prvky lze doplnit ručně v pickeru.</p>
        )}

        <DinRails
          items={items.map((item) => ({ ...item, caption: item.component?.typeCode ?? (item.recognitionStatus === "UNRECOGNIZED" ? "?" : (item.rawOcrText ?? "")) }))}
          rails={rails}
          modulesPerRail={modulesPerRail}
          selectedIds={new Set(selectedId ? [selectedId] : [])}
          onSelect={(item) => setSelectedId(item.id)}
          tone={(item) => TONE[item.recognitionStatus]}
        />
      </section>

      <section aria-label="Bleskový identifikátor nerozpoznaných prvků" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Bleskový identifikátor nerozpoznaných prvků</h2>
          <span className="text-xs text-muted-foreground">Smart Fallback Picker na 3 kliky</span>
        </div>
        {selected ? (
          <SmartFallbackPicker
            key={selected.id}
            item={selected}
            catalog={catalog}
            dominant={dominant}
            onAssigned={() => {
              nextUnresolved(selected.id);
              router.refresh();
            }}
          />
        ) : (
          <div className="flex flex-col items-start gap-3 py-6 text-sm" data-testid="picker-done">
            <p>{unresolved.length ? "Vyberte prvek na fotce nebo na DIN liště." : "Všechny přístroje jsou ověřené a spárované s katalogem."}</p>
            {unresolved.length ? (
              <Button variant="outline" className="touch-target gap-2" onClick={() => nextUnresolved(null)}>
                Další nerozpoznaný <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
