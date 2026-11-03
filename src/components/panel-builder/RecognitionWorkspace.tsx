"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ComponentCategory, RecognitionStatus } from "@/generated/prisma/enums";
import { defaultConfig, type ConfigCategory, type ItemConfig } from "@/lib/panel-builder/configurator";
import { enclosureNeed } from "@/lib/panel-builder/enclosures";
import { formatRailSummary, freeOnRail, railSummary } from "@/lib/panel-builder/rails";
import { deviceWithConfig, type VectorDevice } from "@/lib/panel-builder/vector-symbols";
import { RECOGNITION } from "@/lib/panel-builder/project";
import { cn } from "@/lib/utils";
import { addModuleAction, addRailAction, analyzePanelProjectAction, deleteRailAction, updateItemTextAction } from "@/server/actions/panel-builder";
import { moveRailAction, placeComponentsAction, setRailCapacityAction } from "@/server/actions/panel-design";
import type { AnalysisMode } from "@/server/services/geminiPanelService";

import { CascadePicker } from "./CascadePicker";
import { EnclosurePicker } from "./EnclosurePicker";
import { ItemConfigurator } from "./ItemConfigurator";
import { PhotoViewer } from "./PhotoViewer";
import { PlacementCard } from "./PlacementCard";
import { VectorPanel } from "./VectorPanel";

export interface WorkspaceItem {
  id: string;
  designation: string;
  circuitLabel: string;
  customTypeCode: string | null;
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
  recognitionStatus: RecognitionStatus;
  confidence: number;
  rawOcrText: string | null;
  detected: { category?: ComponentCategory | null; poles?: string | null; ratedCurrentA?: number | null; trippingCurve?: string | null; manufacturer?: string | null } | null;
  config: ItemConfig | null;
  component: { id: string; manufacturer: string; typeCode: string; articleNumber: string; category: ComponentCategory; powerLossWatts: number; estimated: boolean } | null;
  /** Přístroj pro 2D vektorový rozváděč (fáze 42). */
  device: VectorDevice;
}

/** Obrys symbolu podle stavu rozpoznání (ověřené bez obrysu). */
const STATUS_OUTLINE: Record<RecognitionStatus, { color: string; dashed?: boolean } | null> = {
  VERIFIED: null,
  PARTIAL: { color: "#eab308", dashed: true },
  UNRECOGNIZED: { color: "#ef4444", dashed: true },
};

const ANALYSIS_MODES: { value: AnalysisMode; label: string; hint: string }[] = [
  { value: "AUTO", label: "🔍 Auto-detekce", hint: "AI sama pozná, zda je rozváděč zakrytovaný" },
  { value: "UNCOVERED", label: "🔩 Odkrytovaný", hint: "počítání podle šroubků svorek" },
  { value: "COVERED", label: "🛡️ Zakrytovaný", hint: "podle páček a kalibrace šířky 1M" },
];

type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Krok 1: 2D vektorový rozváděč a kaskádové pravé menu (výrobce → kategorie → parametry → karta
 * k osazení). Pasportizace z fotky má navíc čistou referenční fotku a analýzu; návrh od nuly (fáze 43)
 * plátno bez fotky s ovládáním šířky a pořadí lišt.
 */
export function RecognitionWorkspace({
  projectId,
  designMode,
  photoUrl,
  items,
  capacities,
  dominant,
  coverState,
  brandCounts,
  enclosure,
}: {
  projectId: string;
  designMode: "PHOTO" | "DESIGN";
  photoUrl: string | null;
  items: WorkspaceItem[];
  /** Kapacita každé DIN lišty v modulech. */
  capacities: number[];
  dominant: string;
  coverState: string | null;
  brandCounts: Readonly<Record<string, number>>;
  enclosure: { model: string; enclosureId: string | null };
}) {
  const router = useRouter();
  const design = designMode === "DESIGN";
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(coverState === "UNCOVERED" || coverState === "COVERED" ? coverState : "AUTO");
  const [editing, startEditing] = useTransition();
  const unresolved = items.filter((item) => item.recognitionStatus !== "VERIFIED");
  const [selectedId, setSelectedId] = useState<string | null>(design ? null : (unresolved[0]?.id ?? null));
  const [analyzing, startAnalyze] = useTransition();
  const [placing, startPlacing] = useTransition();
  const [activeRailState, setActiveRail] = useState(1);
  const activeRail = Math.min(Math.max(1, activeRailState), capacities.length);
  // Paleta nového přístroje (kaskádové menu bez vybraného prvku)
  const [palette, setPalette] = useState<{ manufacturer: string | null; chosen: boolean; config: ItemConfig | null }>(() => ({
    manufacturer: dominant && dominant !== "MIX" ? dominant : null,
    chosen: false,
    config: null,
  }));
  const [paletteLabel, setPaletteLabel] = useState("");
  // Popis obvodu psaný v konfigurátoru se hned ukáže na dlaždici lišty
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(new Map());
  const labelPreview = useCallback(
    (itemId: string, label: string | null) =>
      setLabels((current) => {
        const next = new Map(current);
        if (label === null) next.delete(itemId);
        else next.set(itemId, label);
        return next;
      }),
    [],
  );
  // Optimistický náhled konfigurace (prvek → rozklikaná konfigurace), než dorazí uložená data
  const [previews, setPreviews] = useState<ReadonlyMap<string, ItemConfig>>(new Map());
  const preview = useCallback(
    (itemId: string, config: ItemConfig | null) =>
      setPreviews((current) => {
        const next = new Map(current);
        if (config) next.set(itemId, config);
        else next.delete(itemId);
        return next;
      }),
    [],
  );
  // Po sloučení zmizí sousední prvky – vybraný (sloučený) zůstává, smazaný výběr spadne na paletu.
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const rightNeighbors = selected ? items.filter((item) => item.dinRailIndex === selected.dinRailIndex && item.positionOnRail > selected.positionOnRail).length : 0;
  // Karta k osazení: rozklikaný vybraný přístroj (vložit další stejné), jinak paleta
  const cardConfig = selected ? (previews.get(selected.id) ?? selected.config) : palette.config;

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

  function railAction<T>(run: () => Promise<Result<T>>, success: string | null, after?: (data: T) => void) {
    startEditing(async () => {
      const result = await run();
      if (!result.ok) return void toast.error(result.error);
      if (success) toast.success(success);
      after?.(result.data);
      router.refresh();
    });
  }

  function place(count: number, rail = activeRail, position: number | null = null) {
    if (!cardConfig) return void toast.error("Nejdřív vyberte výrobce, kategorii a parametry přístroje.");
    startPlacing(async () => {
      const result = await placeComponentsAction({ projectId, config: cardConfig, rail, count, position, circuitLabel: paletteLabel });
      if (!result.ok) return void toast.error(result.error);
      setActiveRail(rail);
      toast.success(`Vloženo ${result.data.placed}× ${result.data.typeCode} na lištu ${rail}.`);
      if (result.data.placed < result.data.requested) toast.warning(`Na lištu ${rail} se vešlo jen ${result.data.placed} z ${result.data.requested} kusů.`);
      router.refresh();
    });
  }

  function paletteCategory(category: ConfigCategory) {
    setPalette((current) => ({ ...current, config: current.config?.category === category ? current.config : defaultConfig(category, { manufacturer: current.manufacturer, modules: 1 }) }));
  }

  // Vektorové symboly: uložený stav + optimistický náhled konfigurace a popisu obvodu
  const devices = items.map((item) => {
    const draft = previews.get(item.id);
    const device = draft ? deviceWithConfig(item.device, draft) : item.device;
    return { ...device, label: labels.get(item.id) ?? item.circuitLabel };
  });

  const counts = { VERIFIED: 0, PARTIAL: 0, UNRECOGNIZED: 0 };
  for (const item of items) counts[item.recognitionStatus]++;
  const summary = railSummary(capacities, items);

  return (
    <div
      className={cn(
        "grid gap-6",
        design ? "xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_minmax(0,1fr)]",
      )}
    >
      {design ? null : (
        <section aria-label="Referenční fotka rozváděče" className="flex flex-col gap-4 xl:col-start-1 xl:row-start-1 2xl:col-start-1">
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
            <PhotoViewer src={photoUrl} />
          ) : (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Projekt nemá fotku – prvky lze nastavit ručně v konfigurátoru.</p>
          )}
        </section>
      )}

      <section aria-label="2D vektorový rozváděč" className={cn("flex flex-col gap-3", design ? "xl:col-start-1" : "xl:col-start-1 xl:row-start-2 2xl:col-start-2 2xl:row-start-1")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{design ? "📐 Návrh rozváděče – 2D vektorové plátno" : "2D vektorový rozváděč"}</h2>
          <span className="text-xs text-muted-foreground">Klik = výběr přístroje · dvojklik na spodní štítek = funkce obvodu{design ? " · kartu z pravého menu přetáhněte na lištu" : ""}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("rounded-md border px-2.5 py-1.5 font-mono text-xs", summary.used > summary.total ? "border-red-500/60 text-red-300" : "border-border text-muted-foreground")} data-testid="rail-summary" role="status">
            {formatRailSummary(summary)}
          </p>
          <div className="ml-auto">
            <EnclosurePicker projectId={projectId} need={enclosureNeed(capacities, items)} current={enclosure} />
          </div>
        </div>
        <VectorPanel
          devices={devices}
          rails={capacities.length}
          modulesPerRail={capacities}
          selectedIds={new Set(selectedId ? [selectedId] : [])}
          outlineFor={(device) => STATUS_OUTLINE[device.status]}
          onSelect={(device) => {
            setSelectedId(device.id);
            setActiveRail(device.dinRailIndex);
          }}
          onLabelEdit={(device, label) => {
            const item = items.find((candidate) => candidate.id === device.id);
            if (!item) return;
            labelPreview(item.id, label);
            startEditing(async () => {
              const result = await updateItemTextAction(item.id, { customTypeCode: item.customTypeCode, circuitLabel: label });
              if (!result.ok) {
                labelPreview(item.id, null);
                return void toast.error(result.error);
              }
              router.refresh();
            });
          }}
          busy={editing || placing}
          onAddModule={design ? undefined : (rail) => railAction(() => addModuleAction(projectId, rail), `Modul přidán na lištu ${rail}.`, (data) => setSelectedId(data.id))}
          onDeleteRail={(rail) => {
            if (!window.confirm(`Smazat celou lištu ${rail} se všemi jejími prvky? Lišty pod ní se posunou nahoru.`)) return;
            railAction(() => deleteRailAction(projectId, rail), `Lišta ${rail} smazána.`);
          }}
          onAddRail={() => railAction(() => addRailAction(projectId), "DIN lišta přidána.", (data) => setActiveRail(data.dinRailsCount))}
          onRailCapacity={(rail, modules) =>
            railAction(() => setRailCapacityAction(projectId, rail, modules), null, (data) => {
              if (data.overflow > 0) toast.warning(`Lišta ${rail} je přeplněná o ${String(data.overflow).replace(".", ",")} M – přesuňte přístroje nebo lištu rozšiřte.`);
            })
          }
          onMoveRail={(rail, direction) => railAction(() => moveRailAction(projectId, rail, direction), null, (data) => setActiveRail(data.rail))}
          activeRail={activeRail}
          onActivateRail={setActiveRail}
          onPlaceDrop={(rail, position) => place(1, rail, position)}
        />
        {selected ? (
          <p className="text-xs text-muted-foreground" data-testid="vector-selected">
            Upravujete <b className="font-mono text-amber-300">{selected.designation}</b> · lišta {selected.dinRailIndex}, {String(selected.modulesWidth).replace(".", ",")}M
          </p>
        ) : null}
      </section>

      <section
        aria-label="Konfigurátor prvku"
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5 xl:self-start",
          design ? "xl:col-start-2 xl:row-start-1" : "xl:col-start-2 xl:row-span-2 xl:row-start-1 2xl:col-start-3 2xl:row-span-1",
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{selected ? "Konfigurátor prvku" : "Vložit nový přístroj"}</h2>
          {selected ? (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setSelectedId(null)}>
              <Plus className="size-3.5" aria-hidden /> Nový přístroj
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Výrobce → kategorie → parametry → přetáhnout na lištu</span>
          )}
        </div>
        {selected ? (
          <>
            {/* Klíč bez katalogového kusu: uložení konfigurace prvek znovu nepřipojí (žádná ztráta stavu ani probliknutí) */}
            <ItemConfigurator
              key={`${selected.id}:${selected.modulesWidth}:${selected.circuitLabel}`}
              item={selected}
              dominant={dominant}
              rightNeighbors={rightNeighbors}
              brandCounts={brandCounts}
              onPreview={preview}
              onLabel={labelPreview}
              onChanged={() => router.refresh()}
              onDeleted={() => {
                setSelectedId(null);
                router.refresh();
              }}
            />
            {!design && unresolved.some((item) => item.id !== selected.id) ? (
              <Button variant="outline" className="touch-target gap-2 self-start" onClick={nextUnresolved}>
                Další nedořešený prvek <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : null}
          </>
        ) : (
          <>
            {!design && unresolved.length ? (
              <div className="flex flex-wrap items-center gap-3 text-sm" data-testid="picker-done">
                <p>Vyberte prvek na DIN liště, nebo vložte nový přístroj.</p>
                <Button variant="outline" size="sm" className="touch-target gap-2" onClick={nextUnresolved}>
                  Další nerozpoznaný <ArrowRight className="size-4" aria-hidden />
                </Button>
              </div>
            ) : !design ? (
              <p className="text-sm" data-testid="picker-done">
                Všechny přístroje jsou ověřené a spárované s katalogem.
              </p>
            ) : null}
            <CascadePicker
              manufacturer={palette.manufacturer}
              chosen={palette.chosen}
              config={palette.config}
              brandCounts={brandCounts}
              onManufacturer={(value) => setPalette((current) => ({ manufacturer: value, chosen: true, config: current.config ? { ...current.config, manufacturer: value } : null }))}
              onCategory={paletteCategory}
              onOption={(patch) => setPalette((current) => (current.config ? { ...current, config: { ...current.config, ...patch } } : current))}
            />
          </>
        )}
        <PlacementCard
          config={cardConfig}
          label={paletteLabel}
          onLabelChange={setPaletteLabel}
          activeRail={activeRail}
          freeModules={freeOnRail(capacities, items, activeRail)}
          busy={placing}
          onInsert={(count) => place(count)}
        />
      </section>
    </div>
  );
}
