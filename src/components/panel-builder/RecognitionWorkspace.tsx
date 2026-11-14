"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ComponentCategory, RecognitionStatus } from "@/generated/prisma/enums";
import { blankingPlan, blankingSummary, freeModules, usedModules } from "@/lib/panel-builder/hdo";
import { defaultConfig, withManufacturer, withOption, type ConfigCategory, type ItemConfig } from "@/lib/panel-builder/configurator";
import { enclosureNeed } from "@/lib/panel-builder/enclosures";
import { formatRailSummary, freeOnRail, railSummary } from "@/lib/panel-builder/rails";
import { FIELD_A_LABEL, FIELD_B_LOW_LABEL, FIELD_B_POWER_LABEL, PARTITION_LABEL, SINGLE_LAYOUT, layoutSummaryText, type RailLayout } from "@/lib/panel-builder/rail-layout";
import { deviceWithConfig, type VectorDevice } from "@/lib/panel-builder/vector-symbols";
import { RECOGNITION } from "@/lib/panel-builder/project";
import { cn } from "@/lib/utils";
import { addRailAction, analyzePanelProjectAction, configureItemAction, deleteRailAction, updateItemTextAction } from "@/server/actions/panel-builder";
import { PANEL_PHOTO_MAX_PX, PANEL_PHOTO_QUALITY, resizeImage, uploadPanelFile } from "@/lib/upload-client";
import { analyzeRailDetailAction, moveItemAction, moveRailAction, placeComponentsAction, placeLintDevicesAction, setEnvironmentAction, setRailCapacityAction, setRailCombAction } from "@/server/actions/panel-design";
import { nextChipLabel, presetConfig } from "@/lib/panel-builder/circuit-chips";
import { ENVIRONMENTS, enclosureFitsEnvironment, environmentOf, ipLabel } from "@/lib/panel-builder/environments";
import { validateSwitchboardState, type LintIssue } from "@/lib/panel-builder/linter";
import type { AnalysisMode } from "@/server/services/geminiPanelService";

import { CascadePicker } from "./CascadePicker";
import { CircuitChips, useCircuitChips } from "./CircuitChips";
import { LinterPanel } from "./LinterPanel";
import { StandardEditionSelect } from "./documentation/RoutineTestPanel";
import { standardEditionOf } from "@/lib/legislation-2027";
import { EnclosurePicker } from "./EnclosurePicker";
import { ItemConfigurator } from "./ItemConfigurator";
import { ManufacturerTransfer } from "./ManufacturerTransfer";
import { ModeBar } from "./ModeBar";
import { PhotoViewer } from "./PhotoViewer";
import { PlacementCard } from "./PlacementCard";
import { RailLayoutToolbar } from "./RailLayoutToolbar";
import { VectorPanel } from "./VectorPanel";
import type { ItemWiring } from "./WiringSection";

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
  /** Nadřazený prvek ve stromu zapojení (elektro-linter: okruhy pod chráničem). */
  parentItemId?: string | null;
  /** Domovní přístroje obvodu (fáze 47). */
  wiring?: ItemWiring[];
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
  environment,
  chipsJson = null,
  standardEdition = "CSN_61439_3_ED2",
  railPhotos = [],
  boardManufacturers = [],
  occupancy = "RESIDENTIAL",
  railLayout = SINGLE_LAYOUT,
  supplyPhases = 3,
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
  enclosure: { model: string; enclosureId: string | null; label: string; ipRating: string; totalModules: number | null };
  /** Prostředí instalace (ČSN 33 2000-5-51 ed. 3). */
  environment: string;
  /** Štítky funkce obvodu firmy (DB) – synchronizace s localStorage. */
  chipsJson?: string | null;
  /** Edice normy rozváděče (fáze 46). */
  standardEdition?: string;
  /** Detailní fotky lišt / sekcí (fáze 47). */
  railPhotos?: { rail: number; url: string }[];
  /** Fáze 60: výrobci, na které jde rozváděč převést (jističe i chrániče v databázi). */
  boardManufacturers?: { name: string; count: number }[];
  /** Fáze 93: typ objektu – Elektro-linter BD4 (CENTRAL STOP, MID) a zdravotnictví (okruhy A / B, chrániče ≤ 30 mA). */
  occupancy?: string;
  /** Fáze 111: uspořádání lišt – dvě pole vedle sebe (Silnoproud | Slaboproud) nebo přepážka. */
  railLayout?: RailLayout;
  /** Fáze 112: soustava přívodu – hřebeny 1f / 3f a fáze jističů na plátně. */
  supplyPhases?: 1 | 3;
}) {
  const router = useRouter();
  const design = designMode === "DESIGN";
  // Fáze 111: pole vedle sebe a přepážka na plátně (stabilní objekty pro výpočet rozložení)
  const { fields: fieldCount, fieldARails, fieldBLow, partitionAfterRail } = railLayout;
  const railFields = useMemo(() => (fieldCount === 2 ? { aRails: fieldARails, labels: [FIELD_A_LABEL, fieldBLow ? FIELD_B_LOW_LABEL : FIELD_B_POWER_LABEL] as [string, string] } : null), [fieldCount, fieldARails, fieldBLow]);
  const railPartition = useMemo(() => (fieldCount === 1 && partitionAfterRail ? { afterRail: partitionAfterRail, label: PARTITION_LABEL } : null), [fieldCount, partitionAfterRail]);
  const layoutNeedInput = useMemo(() => ({ fields: fieldCount, fieldARails }), [fieldCount, fieldARails]);
  const layoutText = layoutSummaryText(railLayout, capacities.length);
  // Fáze 112: krycí záslepky neobsazených modulů (stejný výpočet jako kusovník v dokumentaci)
  const blanking = blankingPlan(freeModules(capacities, usedModules(items, capacities.length)));
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
  /** Fáze 59: kam paleta vloží další přístroj („vpravo od -F3“, „na konec lišty 2“); null = aktivní lišta, na konec. */
  const [target, setTarget] = useState<{ rail: number; position: number | null; label: string } | null>(null);
  const [chips, saveChips] = useCircuitChips(chipsJson);
  const [fixing, startFixing] = useTransition();
  // Pravidlo F (fáze 47): detailní fotka jedné lišty / sekce velkého rozváděče
  const railPhotoInput = useRef<HTMLInputElement>(null);
  const [railPhotoTarget, setRailPhotoTarget] = useState(1);
  const [railPhotoBusy, startRailPhoto] = useTransition();
  function pickRailPhoto(rail: number) {
    setRailPhotoTarget(rail);
    railPhotoInput.current?.click();
  }
  function uploadRailPhoto(file: File) {
    const rail = railPhotoTarget;
    startRailPhoto(async () => {
      try {
        const resized = file.type.startsWith("image/") && file.type !== "image/svg+xml" ? await resizeImage(file, PANEL_PHOTO_MAX_PX, PANEL_PHOTO_QUALITY) : file;
        const uploaded = await uploadPanelFile("photo", resized);
        const result = await analyzeRailDetailAction(projectId, rail, uploaded.url);
        if (!result.ok) return void toast.error(result.error);
        if (result.data.mode === "DEMO") toast.info(result.data.warning ?? `Detailní fotka lišty ${rail} je uložená.`);
        else toast.success(`Lišta ${rail} přečtena z detailní fotky: ${result.data.total} prvků${result.data.unresolved ? `, ${result.data.unresolved} k ověření` : ""}.`);
        setActiveRail(rail);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Fotku lišty se nepodařilo nahrát.");
      }
    });
  }
  const env = environmentOf(environment);
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

  /**
   * Fáze 59: po vložení nezůstane nic vybrané – další klik do kaskády tak nikdy nezmění právě vložený přístroj.
   * Paleta si drží konfiguraci vloženého přístroje (další stejný kus jedním klikem), cíl vložení se zruší.
   */
  function afterInsert(config: ItemConfig) {
    setSelectedId(null);
    setTarget(null);
    setPalette((current) => ({ manufacturer: config.manufacturer ?? current.manufacturer, chosen: true, config }));
  }

  /** Žádná lišta nemá místo: přidat lištu a vložit na ni. */
  function addRailAndPlace(count: number) {
    const config = cardConfig;
    startPlacing(async () => {
      const added = await addRailAction(projectId);
      if (!added.ok) return void toast.error(added.error);
      const rail = added.data.dinRailsCount;
      if (!config) return;
      const result = await placeComponentsAction({ projectId, config, rail, count, position: null, circuitLabel: paletteLabel });
      if (!result.ok) return void toast.error(result.error);
      setActiveRail(rail);
      afterInsert(config);
      toast.success(`Přidána lišta ${rail} a vloženo ${result.data.placed}× ${result.data.typeCode}.`);
      router.refresh();
    });
  }

  /** Fáze 59: přesun přístroje (◀ ▶, jiná lišta, přetažení na liště) – výběr, strom i konfigurace zůstávají. */
  function move(itemId: string, rail: number, position: number) {
    const item = items.find((candidate) => candidate.id === itemId);
    startEditing(async () => {
      const result = await moveItemAction(itemId, { rail, position });
      if (!result.ok) return void toast.error(result.error);
      setActiveRail(result.data.rail);
      toast.success(`${item?.designation ?? "Přístroj"} přesunut na lištu ${result.data.rail}, pozice ${result.data.position}.`);
      router.refresh();
    });
  }

  // Esc = ukončit úpravu vybraného přístroje (zpět na vkládání nového)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      setSelectedId(null);
      setTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Elektro-linter nad uloženým stavem (každá změna = nový výpočet)
  const issues = useMemo(
    () =>
      validateSwitchboardState({
        devices: items.map((item) => ({
          id: item.id,
          designation: item.designation,
          dinRailIndex: item.dinRailIndex,
          positionOnRail: item.positionOnRail,
          modulesWidth: item.modulesWidth,
          category: item.device.category,
          poles: item.device.poles,
          ratedCurrentA: item.device.ratedCurrentA,
          manufacturer: item.device.manufacturer,
          typeCode: item.device.typeCode,
          label: item.circuitLabel,
          parentItemId: item.parentItemId ?? null,
          config: item.config,
        })),
        capacities,
        enclosureModules: enclosure.totalModules,
        occupancy,
      }),
    [items, capacities, enclosure.totalModules, occupancy],
  );

  function fix(issue: LintIssue) {
    const action = issue.fix;
    if (!action) return;
    if (action.kind === "palette") {
      setSelectedId(null);
      setPalette({ manufacturer: action.config.manufacturer, chosen: true, config: action.config });
      return void toast.info("Chránič připraven v kartě k osazení – vložte ho na lištu.");
    }
    startFixing(async () => {
      if (action.kind === "configure" || action.kind === "configure-many") {
        for (const job of action.kind === "configure" ? [{ itemId: action.itemId, config: action.config }] : action.items) {
          const result = await configureItemAction(job.itemId, job.config);
          if (!result.ok) return void toast.error(result.error);
        }
      } else if (action.kind === "sync-text") {
        const item = items.find((candidate) => candidate.id === action.itemId);
        if (item?.customTypeCode) {
          const cleared = await updateItemTextAction(action.itemId, { customTypeCode: null, circuitLabel: item.circuitLabel });
          if (!cleared.ok) return void toast.error(cleared.error);
        }
        if (action.config) {
          const result = await configureItemAction(action.itemId, action.config);
          if (!result.ok) return void toast.error(result.error);
        }
      } else if (action.kind === "add-rail") {
        const result = await addRailAction(projectId);
        if (!result.ok) return void toast.error(result.error);
      } else if (action.kind === "add-devices") {
        // Fáze 93: úprava stávajících přístrojů (RCBO okruhů A / B) a doplnění nových na lištu s volným místem
        for (const job of action.configure ?? []) {
          const result = await configureItemAction(job.itemId, job.config);
          if (!result.ok) return void toast.error(result.error);
        }
        if (action.devices.length) {
          const result = await placeLintDevicesAction({ projectId, devices: action.devices });
          if (!result.ok) return void toast.error(result.error);
        }
      }
      toast.success(`Opraveno: ${action.label}`);
      router.refresh();
    });
  }

  function chooseEnvironment(value: string) {
    startEditing(async () => {
      const result = await setEnvironmentAction(projectId, value);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Prostředí: ${environmentOf(value).label} · teplota okolí ${result.data.ambientTempC} °C`);
      router.refresh();
    });
  }

  /** Vložení z karty / přetažením: přetažení určí lištu a pozici samo, jinak cíl palety („vpravo od -F3“) nebo konec lišty. */
  function place(count: number, rail = activeRail, position: number | null = null, dropped = false) {
    const config = cardConfig;
    if (!config) return void toast.error("Nejdřív vyberte výrobce, kategorii a parametry přístroje.");
    const at = !dropped && target && target.rail === rail ? { rail, position: target.position } : { rail, position };
    startPlacing(async () => {
      const result = await placeComponentsAction({ projectId, config, rail: at.rail, count, position: at.position, circuitLabel: paletteLabel });
      if (!result.ok) return void toast.error(result.error);
      setActiveRail(at.rail);
      afterInsert(config);
      toast.success(`Vloženo ${result.data.placed}× ${result.data.typeCode} na lištu ${at.rail}${at.position ? `, pozice ${at.position}` : ""}.`);
      if (result.data.placed < result.data.requested) toast.warning(`Na lištu ${at.rail} se vešlo jen ${result.data.placed} z ${result.data.requested} kusů.`);
      router.refresh();
    });
  }

  function paletteCategory(category: ConfigCategory) {
    setPalette((current) => ({ ...current, config: current.config?.category === category ? current.config : defaultConfig(category, { manufacturer: current.manufacturer, modules: 1 }) }));
  }

  // Vektorové symboly: uložený stav + optimistický náhled konfigurace a popisu obvodu
  // Fáze 112: strom zapojení pro hřebeny a fáze na plátně (bez modrých spojnic kroku 2)
  const combNodes = useMemo(() => items.map((item) => ({ id: item.id, parentItemId: item.parentItemId ?? null })), [items]);
  const devices = items.map((item) => {
    const draft = previews.get(item.id);
    const device = draft ? deviceWithConfig(item.device, draft) : item.device;
    return { ...device, label: labels.get(item.id) ?? item.circuitLabel };
  });

  // Jedna sticky karta „Přiřazený přístroj (k osazení)“ hned pod funkcí obvodu
  const placementCard = (
    <PlacementCard
      config={cardConfig}
      label={paletteLabel}
      onLabelChange={setPaletteLabel}
      activeRail={target?.rail ?? activeRail}
      rails={capacities.map((_, index) => ({ index: index + 1, free: freeOnRail(capacities, items, index + 1) }))}
      busy={placing}
      onInsert={(count, rail) => place(count, rail)}
      onAddRailInsert={addRailAndPlace}
      assigned={
        selected?.component
          ? {
              componentId: selected.component.id,
              manufacturer: selected.component.manufacturer,
              typeCode: selected.customTypeCode || selected.component.typeCode,
              articleNumber: selected.component.articleNumber,
              modules: selected.modulesWidth,
              powerLossWatts: selected.component.powerLossWatts,
              estimated: selected.component.estimated,
            }
          : null
      }
    />
  );

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

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/5 px-2.5 py-2 text-xs" data-testid="rail-photo-bar">
            <Button size="sm" variant="outline" className="touch-target gap-1.5 border-sky-500/60 text-sky-200" disabled={railPhotoBusy} onClick={() => pickRailPhoto(railPhotoTarget)}>
              {railPhotoBusy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Camera className="size-3.5" aria-hidden />} 📷 Nahrát detailní fotku této lišty / sekce
            </Button>
            <label className="flex items-center gap-1 text-muted-foreground">
              lišta
              <select className="h-8 rounded-md border border-input bg-transparent px-1.5 text-foreground dark:bg-input/30" value={Math.min(railPhotoTarget, capacities.length)} onChange={(event) => setRailPhotoTarget(Number(event.target.value))} aria-label="Lišta pro detailní fotku">
                {capacities.map((_, index) => (
                  <option key={index} value={index + 1}>
                    {index + 1}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-muted-foreground">Velký rozváděč? Vyfoťte zblízka jednu lištu – AI přečte jen ji a ostatní lišty nechá.</span>
            {railPhotos.length ? (
              <div className="flex w-full flex-wrap gap-1.5" data-testid="rail-photos">
                {railPhotos.map((photo) => (
                  <a key={`${photo.rail}-${photo.url}`} href={photo.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded border border-border bg-background/60 p-0.5 pr-1.5 hover:border-sky-400">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={`Detail lišty ${photo.rail}`} className="size-9 rounded object-cover" />
                    Lišta {photo.rail}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <input
            ref={railPhotoInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label="Soubor detailní fotky lišty"
            data-testid="rail-photo-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) uploadRailPhoto(file);
            }}
          />

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
        <div className="flex flex-wrap items-center gap-2" data-testid="environment-bar">
          <span className="text-xs text-muted-foreground" data-testid="enclosure-info">
            {enclosure.label} · <b className="text-foreground">{enclosure.ipRating}</b>
          </span>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Prostředí instalace
            <select
              className="h-9 max-w-72 rounded-md border border-input bg-transparent px-2 text-xs text-foreground dark:bg-input/30"
              value={env.id}
              disabled={editing}
              onChange={(event) => chooseEnvironment(event.target.value)}
              aria-label="Prostředí instalace"
            >
              {ENVIRONMENTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} ({option.codes})
                </option>
              ))}
            </select>
          </label>
          <StandardEditionSelect projectId={projectId} value={standardEditionOf(standardEdition).id} compact />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {items.length ? <ManufacturerTransfer projectId={projectId} current={dominant} manufacturers={boardManufacturers} /> : null}
            {enclosureFitsEnvironment(enclosure.ipRating, env) ? (
              <EnclosurePicker projectId={projectId} need={enclosureNeed(capacities, items, layoutNeedInput)} current={enclosure} minIp={env.minIp} />
            ) : (
              <>
                <span className="rounded-full border border-amber-500/70 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200" data-testid="environment-warning" role="alert">
                  ⚠ Skříň {enclosure.ipRating} nevyhovuje prostředí (min. {ipLabel(env.minIp)})
                </span>
                <EnclosurePicker projectId={projectId} need={enclosureNeed(capacities, items, layoutNeedInput)} current={enclosure} minIp={env.recommendedIp} warning triggerLabel={`Vybrat vhodnou skříň (min. ${ipLabel(env.recommendedIp)})`} />
              </>
            )}
          </div>
          {env.notes.length ? (
            <p className="w-full text-[11px] text-sky-200" data-testid="environment-notes">
              {env.notes.join(" ")} Minimální krytí {ipLabel(env.minIp)}
              {env.minIk ? `, odolnost min. IK ${String(env.minIk).padStart(2, "0")}` : ""}.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <p className={cn("rounded-md border px-2.5 py-1.5 font-mono text-xs", summary.used > summary.total ? "border-red-500/60 text-red-300" : "border-border text-muted-foreground")} data-testid="rail-summary" role="status">
          {formatRailSummary(summary)}
          {layoutText ? ` · ${layoutText}` : ""}
        </p>
        {/* Fáze 112: volné moduly všech lišt → dělitelné krycí záslepky v kusovníku (List 4) */}
        {blanking ? (
          <p className="rounded-md border border-border px-2.5 py-1.5 font-mono text-xs text-muted-foreground" data-testid="blanking-summary">
            🔲 {blankingSummary(blanking)}
          </p>
        ) : null}
        <LinterPanel
          issues={issues}
          busy={fixing || editing}
          onFix={fix}
          onFocus={(itemId) => {
            const item = items.find((candidate) => candidate.id === itemId);
            if (!item) return;
            setSelectedId(item.id);
            setActiveRail(item.dinRailIndex);
          }}
        />
        </div>
        {/* Fáze 62: lišta kroku nad rozváděčem (lepkavá) – úprava přístroje se ukončuje „Hotovo“ tady, ne v bočním
            panelu; vykreslená vždy, ať se rozváděč po kliknutí na přístroj neposune */}
        <ModeBar
          tone={selected ? "edit" : "idle"}
          title={
            selected ? (
              <>
                ✏️ Úprava přístroje <span className="font-mono text-amber-300">{selected.designation}</span>
              </>
            ) : (
              "Výběr přístroje"
            )
          }
          hint={
            selected ? (
              <span data-testid="vector-selected">
                Upravujete <b className="font-mono text-amber-300">{selected.designation}</b> · lišta {selected.dinRailIndex}, {String(selected.modulesWidth).replace(".", ",")}M · změny v pravém panelu se ukládají hned · Esc = konec úprav
              </span>
            ) : (
              "Kliknutím přístroj upravíte, přetažením ho přesunete na jinou pozici nebo lištu."
            )
          }
          onDone={selected ? () => setSelectedId(null) : undefined}
          testId="edit-bar"
          doneTestId="edit-done"
        />
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
          onAddModule={(rail) => {
            // Fáze 59: „+“ na liště = vložení z palety na konec lišty (nový přístroj se nevybírá)
            setSelectedId(null);
            setActiveRail(rail);
            setTarget({ rail, position: null, label: `na konec lišty ${rail}` });
            toast.info(`Vyberte přístroj v pravém menu – vloží se na konec lišty ${rail}.`);
          }}
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
          onPlaceDrop={(rail, position) => place(1, rail, position, true)}
          onMoveDevice={move}
          onRailPhoto={design ? undefined : pickRailPhoto}
          fields={railFields}
          partition={railPartition}
          combs={railLayout.combs}
          combNodes={combNodes}
          supplyPhases={supplyPhases}
          onRailComb={(rail, setting) => railAction(() => setRailCombAction(projectId, rail, setting), `Hřeben lišty ${rail}: ${setting === "AUTO" ? "automaticky podle chrániče" : setting === "OFF" ? "vypnutý" : setting === "3F" ? "3f (L1 / L2 / L3 / N)" : "1f (L / N)"}.`)}
          toolbar={<RailLayoutToolbar projectId={projectId} layout={railLayout} capacities={capacities} disabled={editing || placing} />}
        />
      </section>

      <section
        aria-label="Konfigurátor prvku"
        data-mode={selected ? "edit" : "insert"}
        className={cn(
          "flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5 xl:self-start",
          selected ? "border-amber-400/70 ring-1 ring-amber-400/30" : "border-border",
          design ? "xl:col-start-2 xl:row-start-1" : "xl:col-start-2 xl:row-span-2 xl:row-start-1 2xl:col-start-3 2xl:row-span-1",
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold" data-testid="configurator-mode">
            {selected ? (
              <>
                ✏️ Úprava přístroje <span className="font-mono text-amber-300">{selected.designation}</span>
              </>
            ) : (
              "➕ Vložit nový přístroj"
            )}
          </h2>
          {selected ? (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setSelectedId(null)}>
              <Plus className="size-3.5" aria-hidden /> Nový přístroj
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Výrobce → kategorie → parametry → přetáhnout na lištu</span>
          )}
        </div>
        {selected ? (
          <p className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-xs text-amber-100" data-testid="edit-banner">
            Změny v kaskádě se ukládají rovnou do <b>{selected.designation}</b> (lišta {selected.dinRailIndex}, pozice {selected.positionOnRail}). Úpravu ukončíte tlačítkem „Hotovo“ nad rozváděčem nebo klávesou Esc.
          </p>
        ) : target ? (
          <p className="flex flex-wrap items-center gap-2 rounded-md border border-sky-400/50 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-100" data-testid="insert-target">
            Vkládáte {target.label} – vyberte přístroj a vložte ho kartou nebo přetažením.
            <button type="button" className="ml-auto rounded border border-sky-400/50 px-1.5 py-0.5 hover:bg-sky-500/20" onClick={() => setTarget(null)}>
              Zrušit cíl
            </button>
          </p>
        ) : null}
        {selected ? (
          <>
            {/* Klíč bez katalogového kusu: uložení konfigurace prvek znovu nepřipojí (žádná ztráta stavu ani probliknutí) */}
            <ItemConfigurator
              key={`${selected.id}:${selected.modulesWidth}:${selected.circuitLabel}`}
              item={selected}
              dominant={dominant}
              rightNeighbors={rightNeighbors}
              brandCounts={brandCounts}
              chips={chips}
              onChipsChange={saveChips}
              existingLabels={items.filter((item) => item.id !== selected.id).map((item) => item.circuitLabel)}
              absorbNeighbors={!design}
              placement={placementCard}
              onPreview={preview}
              onLabel={labelPreview}
              onChanged={() => router.refresh()}
              onDeleted={() => {
                setSelectedId(null);
                router.refresh();
              }}
              railCount={capacities.length}
              railItems={items.filter((item) => item.dinRailIndex === selected.dinRailIndex).length}
              onMove={(rail, position) => move(selected.id, rail, position)}
              onInsertRight={() => {
                // Fáze 59: „Přidat vpravo“ = vložení z palety hned za vybraný přístroj (nic nezůstane vybrané)
                setTarget({ rail: selected.dinRailIndex, position: selected.positionOnRail + 1, label: `vpravo od ${selected.designation} (lišta ${selected.dinRailIndex}, pozice ${selected.positionOnRail + 1})` });
                setActiveRail(selected.dinRailIndex);
                setSelectedId(null);
              }}
              onInserted={(itemId) => {
                // Duplikát se nevybírá – úpravu nabídne toast
                setSelectedId(null);
                toast.success(`${selected.designation} duplikován vpravo.`, { action: { label: "Upravit kopii", onClick: () => setSelectedId(itemId) } });
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
            <section aria-label="Funkce obvodu nového přístroje" className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">Funkce / Popis obvodu</h3>
              <CircuitChips
                chips={chips}
                onChange={saveChips}
                active={paletteLabel}
                onPick={(chip) => {
                  setPaletteLabel(nextChipLabel(chip, items.map((item) => item.circuitLabel)));
                  const preset = chip.preset;
                  if (preset) setPalette((current) => ({ manufacturer: current.manufacturer, chosen: true, config: presetConfig(preset, current.manufacturer) }));
                }}
              />
            </section>
            {placementCard}
            <CascadePicker
              manufacturer={palette.manufacturer}
              chosen={palette.chosen}
              config={palette.config}
              brandCounts={brandCounts}
              onManufacturer={(value) => setPalette((current) => ({ manufacturer: value, chosen: true, config: current.config ? withManufacturer(current.config, value) : null }))}
              onCategory={paletteCategory}
              onOption={(patch) => setPalette((current) => (current.config ? { ...current, config: withOption(current.config, patch) } : current))}
            />
          </>
        )}
      </section>
    </div>
  );
}
