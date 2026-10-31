"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ComponentCategory, RecognitionStatus } from "@/generated/prisma/enums";
import type { ItemConfig } from "@/lib/panel-builder/configurator";
import type { BoundingBox } from "@/lib/panel-builder/layout";
import { RECOGNITION } from "@/lib/panel-builder/project";
import { cn } from "@/lib/utils";
import { addModuleAction, addRailAction, analyzePanelProjectAction, deleteRailAction } from "@/server/actions/panel-builder";
import type { AnalysisMode } from "@/server/services/geminiPanelService";

import { DinRails } from "./DinRails";
import { ItemConfigurator } from "./ItemConfigurator";

export interface WorkspaceItem {
  id: string;
  designation: string;
  circuitLabel: string;
  customTypeCode: string | null;
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
  box: BoundingBox | null;
  recognitionStatus: RecognitionStatus;
  confidence: number;
  rawOcrText: string | null;
  detected: { category?: ComponentCategory | null; poles?: string | null; ratedCurrentA?: number | null; trippingCurve?: string | null; manufacturer?: string | null } | null;
  config: ItemConfig | null;
  component: { id: string; manufacturer: string; typeCode: string; articleNumber: string; category: ComponentCategory; powerLossWatts: number; estimated: boolean } | null;
}

const TONE: Record<RecognitionStatus, string> = {
  VERIFIED: "border-emerald-500/70 bg-emerald-500/15 text-emerald-100",
  PARTIAL: "border-yellow-500/80 bg-yellow-500/20 text-yellow-100",
  UNRECOGNIZED: "border-red-500/80 bg-red-500/20 text-red-100",
};

const SELECTED = "#fbbf24";

const ANALYSIS_MODES: { value: AnalysisMode; label: string; hint: string }[] = [
  { value: "AUTO", label: "🔍 Auto-detekce", hint: "AI sama pozná, zda je rozváděč zakrytovaný" },
  { value: "UNCOVERED", label: "🔩 Odkrytovaný", hint: "počítání podle šroubků svorek" },
  { value: "COVERED", label: "🛡️ Zakrytovaný", hint: "podle páček a kalibrace šířky 1M" },
];

/** Krok 1: fotka s rámečky rozpoznání, DIN lišty v měřítku a živý konfigurátor vybraného modulu. */
export function RecognitionWorkspace({
  projectId,
  photoUrl,
  items,
  rails,
  modulesPerRail,
  dominant,
  coverState,
}: {
  projectId: string;
  photoUrl: string | null;
  items: WorkspaceItem[];
  rails: number;
  modulesPerRail: number;
  dominant: string;
  coverState: string | null;
}) {
  const router = useRouter();
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(coverState === "UNCOVERED" || coverState === "COVERED" ? coverState : "AUTO");
  const [editing, startEditing] = useTransition();
  const unresolved = items.filter((item) => item.recognitionStatus !== "VERIFIED");
  const [selectedId, setSelectedId] = useState<string | null>(unresolved[0]?.id ?? null);
  const [analyzing, startAnalyze] = useTransition();
  // Po sloučení zmizí sousední prvky – vybraný (sloučený) zůstává, smazaný výběr spadne na první prvek.
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const rightNeighbors = selected ? items.filter((item) => item.dinRailIndex === selected.dinRailIndex && item.positionOnRail > selected.positionOnRail).length : 0;

  function nextUnresolved() {
    const order = items.filter((item) => item.recognitionStatus !== "VERIFIED" && item.id !== selectedId);
    setSelectedId(order[0]?.id ?? null);
  }

  function reanalyze() {
    if (!window.confirm("Znovu analyzovat fotku? Rozpoznané prvky a ruční nastavení se nahradí.")) return;
    startAnalyze(async () => {
      const result = await analyzePanelProjectAction(projectId, analysisMode);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Rozpoznáno ${result.data.total} přístrojů, k dořešení ${result.data.unresolved}.`);
      if (result.data.warning) toast.warning(result.data.warning);
      router.refresh();
    });
  }

  function railAction(run: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, success: string, after?: (data: unknown) => void) {
    startEditing(async () => {
      const result = await run();
      if (!result.ok) return void toast.error(result.error);
      toast.success(success);
      after?.(result.data);
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

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" role="group" aria-label="Režim analýzy fotky">
          <span className="mr-1">Režim analýzy:</span>
          {ANALYSIS_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              aria-pressed={analysisMode === mode.value}
              title={mode.hint}
              onClick={() => setAnalysisMode(mode.value)}
              className={cn("min-h-8 rounded-md border px-2.5 font-semibold", analysisMode === mode.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:text-foreground")}
            >
              {mode.label}
            </button>
          ))}
          {coverState ? <span className="ml-auto">Poslední analýza: {coverState === "UNCOVERED" ? "odkrytovaný" : "zakrytovaný"}</span> : null}
        </div>

        {photoUrl ? (
          <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-border bg-black" data-testid="panel-photo">
            {/* eslint-disable-next-line @next/next/no-img-element -- fotka z /api/files (SVG i JPG), rámečky v % */}
            <img src={photoUrl} alt="Fotka rozváděče" className="block h-auto w-full" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
              {/* Vybraný rámeček se kreslí naposledy, ať je nahoře */}
              {[...items].sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId)).map((item) => {
                if (!item.box) return null;
                const [ymin, xmin, ymax, xmax] = item.box;
                const style = RECOGNITION[item.recognitionStatus];
                const active = item.id === selectedId;
                return (
                  <g
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${item.designation} – ${style.label}`}
                    aria-pressed={active}
                    className="cursor-pointer outline-none"
                    opacity={selected && !active ? 0.3 : 1}
                    onClick={() => setSelectedId(item.id)}
                    onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setSelectedId(item.id)}
                  >
                    <rect
                      x={xmin}
                      y={ymin}
                      width={xmax - xmin}
                      height={ymax - ymin}
                      fill={active ? "rgba(251,191,36,0.22)" : style.fill}
                      stroke={active ? SELECTED : style.stroke}
                      vectorEffect="non-scaling-stroke"
                      style={{ strokeWidth: active ? 3 : 2, filter: active ? "drop-shadow(0 0 4px rgba(251,191,36,0.9))" : undefined }}
                    />
                    {/* Tečkované dělení po 1M uvnitř vícemodulových přístrojů – kontrola šířky proti šroubkům a spárám */}
                    {item.modulesWidth > 1
                      ? Array.from({ length: Math.ceil(item.modulesWidth) - 1 }, (_, index) => {
                          const x = xmin + ((xmax - xmin) / item.modulesWidth) * (index + 1);
                          return <line key={index} x1={x} x2={x} y1={ymin} y2={ymax} stroke={active ? SELECTED : style.stroke} strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1 }} opacity={0.9} data-module-divider="" />;
                        })
                      : null}
                    {item.recognitionStatus === "UNRECOGNIZED" && !active ? (
                      <text x={(xmin + xmax) / 2} y={(ymin + ymax) / 2} fontSize={4} fontWeight={800} fill="#fff" textAnchor="middle" dominantBaseline="middle" style={{ paintOrder: "stroke", stroke: "#ef4444", strokeWidth: 0.8 }}>
                        ?
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
            {/* Jmenovka vybraného modulu v HTML (ostrý text nezávislý na deformaci SVG) */}
            {selected?.box ? (
              <span
                className="pointer-events-none absolute -translate-y-full rounded-sm bg-amber-400 px-1.5 py-0.5 font-mono text-[11px] font-extrabold whitespace-nowrap text-neutral-950 shadow-[0_0_12px_rgba(251,191,36,0.8)]"
                style={{ left: `${selected.box[1]}%`, top: `calc(${selected.box[0]}% - 2px)` }}
                data-testid="photo-selected-label"
              >
                {selected.designation} · {selected.modulesWidth}M
              </span>
            ) : null}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Projekt nemá fotku – prvky lze nastavit ručně v konfigurátoru.</p>
        )}

        <DinRails
          items={items.map((item) => ({ ...item, caption: item.customTypeCode || item.component?.typeCode || (item.recognitionStatus === "UNRECOGNIZED" ? "?" : (item.rawOcrText ?? "")) }))}
          rails={rails}
          modulesPerRail={modulesPerRail}
          selectedIds={new Set(selectedId ? [selectedId] : [])}
          selectedVariant="edit"
          onSelect={(item) => setSelectedId(item.id)}
          tone={(item) => TONE[item.recognitionStatus]}
          busy={editing}
          onAddModule={(rail) => railAction(() => addModuleAction(projectId, rail), `Modul přidán na lištu ${rail}.`, (data) => setSelectedId((data as { id: string }).id))}
          onDeleteRail={(rail) => {
            if (!window.confirm(`Smazat celou lištu ${rail} se všemi jejími prvky? Lišty pod ní se posunou nahoru.`)) return;
            railAction(() => deleteRailAction(projectId, rail), `Lišta ${rail} smazána.`);
          }}
          onAddRail={() => railAction(() => addRailAction(projectId), "DIN lišta přidána.")}
        />
      </section>

      <section aria-label="Konfigurátor prvku" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Konfigurátor prvku</h2>
          <span className="text-xs text-muted-foreground">Každý klik se hned uloží a modul zezelená</span>
        </div>
        {selected ? (
          <>
            <ItemConfigurator key={`${selected.id}:${selected.modulesWidth}:${selected.component?.id ?? "-"}`} item={selected} dominant={dominant} rightNeighbors={rightNeighbors}
              onChanged={() => router.refresh()}
              onDeleted={() => {
                setSelectedId(null);
                router.refresh();
              }}
            />
            {unresolved.some((item) => item.id !== selected.id) ? (
              <Button variant="outline" className="touch-target gap-2 self-start" onClick={nextUnresolved}>
                Další nedořešený prvek <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-start gap-3 py-6 text-sm" data-testid="picker-done">
            <p>{unresolved.length ? "Vyberte prvek na fotce nebo na DIN liště." : "Všechny přístroje jsou ověřené a spárované s katalogem."}</p>
            {unresolved.length ? (
              <Button variant="outline" className="touch-target gap-2" onClick={nextUnresolved}>
                Další nerozpoznaný <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
