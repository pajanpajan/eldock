"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Check, Link2, Loader2, Scissors, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS, formatWatts, isMix } from "@/lib/panel-builder/catalog";
import { catalogCategory, defaultConfig, toConfigCategory, type ConfigCategory, type ItemConfig } from "@/lib/panel-builder/configurator";
import { RECOGNITION } from "@/lib/panel-builder/project";
import { cn } from "@/lib/utils";
import { assignComponentAction, configureItemAction, deleteItemAction, lookupComponentAction, mergeItemsAction, searchCatalogAction, splitItemAction, updateItemTextAction } from "@/server/actions/panel-builder";
import type { CatalogHit } from "@/server/services/panel-builder";

import { CascadePicker } from "./CascadePicker";
import { WiringSection } from "./WiringSection";
import { insertNextToAction } from "@/server/actions/panel-design";
import { CircuitChips } from "./CircuitChips";
import { nextChipLabel, presetConfig, type CircuitChip } from "@/lib/panel-builder/circuit-chips";
import type { WorkspaceItem } from "./RecognitionWorkspace";

/** Prodleva uložení při rychlém klikání po dlaždicích parametrů (ms). */
const CONFIGURE_DEBOUNCE_MS = 250;

/**
 * Živý konfigurátor vybraného modulu: každý klik (výrobce, kategorie, parametr) modul rovnou uloží,
 * přiřadí nejbližší přesný kus z katalogu a označí ho jako ověřený. Nahoře geometrie na DIN liště
 * (sloučení / rozdělení), dole karta přiřazeného přístroje.
 */
export function ItemConfigurator({
  item,
  dominant,
  rightNeighbors,
  onChanged,
  onDeleted,
  onInserted,
  onPreview,
  onLabel,
  brandCounts,
  chips,
  onChipsChange,
  existingLabels,
  placement,
  absorbNeighbors = true,
}: {
  item: WorkspaceItem;
  dominant: string;
  /** Počty kusů v databázi podle výrobce (karty kaskádového menu). */
  brandCounts: Readonly<Record<string, number>>;
  rightNeighbors: number;
  onChanged: () => void;
  onDeleted: () => void;
  /** Nový prvek vpravo / duplikát – vybrat ho k úpravě. */
  onInserted?: (itemId: string) => void;
  /** Optimistický náhled na DIN liště (null = zrušit po uložení nebo chybě). */
  onPreview: (itemId: string, config: ItemConfig | null) => void;
  /** Okamžitý popis obvodu na dlaždici DIN lišty (null = zrušit náhled). */
  onLabel?: (itemId: string, label: string | null) => void;
  /** Štítky funkce obvodu se Smart Presety (fáze 45) a popisy ostatních přístrojů (číslování). */
  chips: CircuitChip[];
  onChipsChange: (chips: CircuitChip[]) => void;
  existingLabels: string[];
  /** Sticky karta přiřazeného přístroje (hned pod funkcí obvodu). */
  placement?: ReactNode;
  absorbNeighbors?: boolean;
}) {
  const initialManufacturer = item.config?.manufacturer ?? item.component?.manufacturer ?? item.detected?.manufacturer ?? (isMix(dominant) ? null : dominant);
  const [config, setConfig] = useState<ItemConfig | null>(item.config);
  const [manufacturer, setManufacturer] = useState<string | null>(initialManufacturer);
  // Krok A kaskády: výrobce zvolen (i „obecný přístroj“ bez výrobce) → zobrazí se kategorie
  const [chosen, setChosen] = useState(initialManufacturer !== null || item.config !== null);
  // Pasportizace: širší přístroj pohltí moduly, které AI rozsekala; návrh od nuly sousedy nepohlcuje
  const [mergeRight, setMergeRight] = useState(absorbNeighbors);
  const [pending, startTransition] = useTransition();
  const [lookupText, setLookupText] = useState(item.rawOcrText?.replace(/[?б]/g, "") ?? "");
  // Našeptávač z databáze prvků (filtr podle dlaždic výrobce → kategorie → póly)
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CatalogHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Optimistické UI: dlaždice i modul na liště se překreslí hned, uložení (configureItem) běží na pozadí
  // s debounce. Server Action sama obnoví data stránky (revalidatePath) – žádný router.refresh, žádné probliknutí.
  const queued = useRef<{ config: ItemConfig; absorb: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function save(job: { config: ItemConfig; absorb: boolean }) {
    startTransition(async () => {
      const result = await configureItemAction(item.id, job.config, job.absorb);
      if (!result.ok) {
        toast.error(result.error);
        setConfig(item.config);
      }
      // Uložená data dorazí se stejnou odpovědí – náhled už není potřeba (pokud mezitím nepřišel další klik).
      if (!queued.current) onPreview(item.id, null);
    });
  }

  function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const job = queued.current;
    queued.current = null;
    if (job) save(job);
  }

  // Přepnutí na jiný prvek během debounce: rozklikaná konfigurace se uloží hned.
  const itemId = item.id;
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      const job = queued.current;
      if (!job) return;
      void configureItemAction(itemId, job.config, job.absorb).then((result) => (result.ok ? onPreview(itemId, null) : toast.error(result.error)));
    },
    [itemId, onPreview],
  );

  function apply(next: ItemConfig) {
    setConfig(next);
    onPreview(item.id, next);
    const absorb = mergeRight && next.modules > item.modulesWidth;
    if (next.modules > item.modulesWidth && !mergeRight) toast.warning(`Přístroj má ${next.modules}M, ale modul na liště jen ${item.modulesWidth}M – zapněte „Sloučit se sousedními moduly vpravo“.`);
    queued.current = { config: next, absorb };
    if (timer.current) clearTimeout(timer.current);
    // Sloučení mění geometrii lišty – uložit hned; parametry s debounce.
    if (absorb) return flush();
    timer.current = setTimeout(flush, CONFIGURE_DEBOUNCE_MS);
  }

  function pickManufacturer(value: string | null) {
    setManufacturer(value);
    setChosen(true);
    if (config) apply({ ...config, manufacturer: value });
  }

  function pickCategory(category: ConfigCategory) {
    const base = { manufacturer, modules: item.modulesWidth, ratedCurrentA: item.detected?.ratedCurrentA ?? config?.ratedCurrentA ?? null, curve: item.detected?.trippingCurve ?? config?.curve ?? null };
    apply(config?.category === category ? config : defaultConfig(category, base));
  }

  function geometry(run: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, success: string) {
    startTransition(async () => {
      const result = await run();
      if (!result.ok) return void toast.error(result.error);
      toast.success(success);
      onChanged();
    });
  }

  function lookup(text = lookupText) {
    startTransition(async () => {
      const found = await lookupComponentAction({
        itemId: item.id,
        text,
        hints: { category: config && config.category !== "OTHER" && config.category !== "ACCESSORY" ? config.category : null, poles: config?.poles ?? null, current: config?.ratedCurrentA ?? null, curve: config?.curve ?? null, manufacturer },
      });
      if (!found.ok) return void toast.error(found.error);
      if (!found.data.component) return void toast.error("Přístroj se podle textu nepodařilo dohledat. Zkuste delší úsek typového označení.");
      const assigned = await assignComponentAction(item.id, found.data.component.id);
      if (!assigned.ok) return void toast.error(assigned.error);
      toast.success(`Přiřazeno: ${found.data.component.manufacturer} ${found.data.component.typeCode}${found.data.mode === "GEMINI" ? " (Gemini AI)" : ""}`);
      onChanged();
    });
  }

  function runSearch(text: string, filters: { manufacturer: string | null; config: ItemConfig | null }) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setHits(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const result = await searchCatalogAction({
        q: text,
        manufacturer: filters.manufacturer,
        category: filters.config ? catalogCategory(filters.config) : null,
        poles: filters.config?.poles && filters.config.poles !== "2x1P" ? filters.config.poles : null,
      });
      setSearching(false);
      if (!result.ok) return void toast.error(result.error);
      setHits(result.data);
    }, 200);
  }

  /** Výběr kusu z databáze: symbol se hned přepíše (náhled), přiřazení se uloží. */
  function pickHit(hit: CatalogHit) {
    const category = toConfigCategory(hit.category);
    if (category) {
      const next: ItemConfig = { category, manufacturer: hit.manufacturer, poles: hit.poles, modules: hit.modulesCount || item.modulesWidth, ratedCurrentA: hit.ratedCurrentA || null, curve: hit.trippingCurve, rcdType: hit.rcdType, rcdSensitivityMa: hit.rcdSensitivityMa };
      setConfig(next);
      setManufacturer(hit.manufacturer);
      onPreview(item.id, next);
    }
    setHits(null);
    setQuery("");
    startTransition(async () => {
      const result = await assignComponentAction(item.id, hit.id);
      onPreview(item.id, null);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Přiřazeno z databáze: ${hit.manufacturer} ${hit.typeCode}`);
      onChanged();
    });
  }

  /** „➕ Přidat prvek vpravo“ / „📑 Duplikovat prvek“ – nový prvek hned napravo a rovnou vybraný. */
  function insertNext(mode: "blank" | "duplicate") {
    startTransition(async () => {
      const result = await insertNextToAction(item.id, mode);
      if (!result.ok) return void toast.error(result.error);
      toast.success(mode === "duplicate" ? `${item.designation} duplikován vpravo.` : "Nový prvek přidán vpravo.");
      onInserted?.(result.data.id);
    });
  }

  function saveText(patch: { customTypeCode?: string | null; circuitLabel?: string; designation?: string }) {
    const next = {
      customTypeCode: patch.customTypeCode !== undefined ? patch.customTypeCode : item.customTypeCode,
      circuitLabel: patch.circuitLabel ?? item.circuitLabel,
      designation: patch.designation ?? null,
    };
    if (next.customTypeCode === item.customTypeCode && next.circuitLabel === item.circuitLabel && (!next.designation || next.designation === item.designation)) return;
    if (patch.circuitLabel !== undefined) onLabel?.(item.id, patch.circuitLabel);
    startTransition(async () => {
      const result = await updateItemTextAction(item.id, next);
      if (patch.circuitLabel !== undefined) onLabel?.(item.id, null);
      if (!result.ok) return void toast.error(result.error);
    });
  }

  // Funkce obvodu: lokální stav (okamžitě na dlaždici), uložení po opuštění pole nebo kliknutím na štítek
  const [label, setLabel] = useState(item.circuitLabel);

  // Rozklikaný (zatím neuložený) prvek je hned „ověřený“ – stejně jako po uložení konfigurace.
  const shownStatus = config && config !== item.config ? "VERIFIED" : item.recognitionStatus;
  const suggested = item.recognitionStatus === "PARTIAL" ? item.component : null;

  return (
    <div className="flex flex-col gap-4" data-testid="item-configurator">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          key={`designation:${item.id}:${item.designation}`}
          defaultValue={item.designation}
          aria-label="Značení přístroje"
          title="IEC značení – ručně přepsatelné (-Q1, -FI1, -FA1, -F3 …)"
          maxLength={8}
          className="h-9 w-24 font-mono text-lg font-semibold"
          onBlur={(event) => {
            const value = event.target.value.trim().toUpperCase();
            if (value && value !== item.designation) saveText({ designation: value });
            else event.target.value = item.designation;
          }}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
        <span className={cn("rounded-full border px-2 py-0.5 text-xs", RECOGNITION[shownStatus].badge)} data-testid="configurator-status">
          {RECOGNITION[shownStatus].label}
        </span>
        {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Ukládám" /> : null}
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          OCR: {item.rawOcrText || "–"} · jistota {Math.round(item.confidence * 100)} %
        </span>
        <Button
          size="sm"
          variant="outline"
          className="touch-target gap-1.5 border-red-500/50 text-red-300 hover:bg-red-500/15"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Smazat prvek ${item.designation}? Ostatní prvky se přečíslují.`)) return;
            startTransition(async () => {
              const result = await deleteItemAction(item.id);
              if (!result.ok) return void toast.error(result.error);
              toast.success(`${item.designation} smazán.`);
              onDeleted();
            });
          }}
        >
          <Trash2 className="size-3.5" aria-hidden /> Smazat prvek
        </Button>
        <Button size="sm" variant="outline" className="touch-target gap-1.5" disabled={pending} onClick={() => insertNext("blank")}>
          ➕ Přidat prvek vpravo
        </Button>
        <Button size="sm" variant="outline" className="touch-target gap-1.5" disabled={pending} onClick={() => insertNext("duplicate")}>
          📑 Duplikovat prvek
        </Button>
      </div>

      {/* Funkce obvodu hned pod hlavičkou prvku + rychlé štítky */}
      <section aria-label="Funkce obvodu" className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Funkce / Popis obvodu
          <Input
            value={label}
            placeholder="např. Zásuvky kuchyně"
            maxLength={80}
            className="h-11 text-base"
            aria-label="Popis obvodu"
            onChange={(event) => {
              setLabel(event.target.value);
              onLabel?.(item.id, event.target.value);
            }}
            onBlur={() => saveText({ circuitLabel: label })}
            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          />
        </label>
        <CircuitChips
          chips={chips}
          onChange={onChipsChange}
          active={label}
          onPick={(chip) => {
            const next = nextChipLabel(chip, existingLabels);
            setLabel(next);
            saveText({ circuitLabel: next });
            // Smart Preset: kategorie, póly, charakteristika a proud jedním klikem
            if (chip.preset) {
              setChosen(true);
              apply(presetConfig(chip.preset, manufacturer));
            }
          }}
        />
      </section>

      {placement}

      {/* Geometrie na DIN liště */}
      <section aria-label="Geometrie na DIN liště" className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-semibold uppercase">Geometrie na DIN liště</span>
          <span>
            lišta {item.dinRailIndex}, pozice {item.positionOnRail} · šířka <b className="text-foreground">{item.modulesWidth}M</b>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="touch-target gap-1.5" disabled={pending || rightNeighbors < 1} onClick={() => geometry(() => mergeItemsAction(item.id, 2), "Sloučeno: 2 sousední moduly.")}>
            <Link2 className="size-3.5" aria-hidden /> Sloučit 2 sousední (2M)
          </Button>
          <Button size="sm" variant="outline" className="touch-target gap-1.5" disabled={pending || rightNeighbors < 2} onClick={() => geometry(() => mergeItemsAction(item.id, 3), "Sloučeno: 3× 1M → 3P.")}>
            <Link2 className="size-3.5" aria-hidden /> Sloučit 3× 1M → 3P (3 moduly)
          </Button>
          <Button size="sm" variant="outline" className="touch-target gap-1.5" disabled={pending || rightNeighbors < 3} onClick={() => geometry(() => mergeItemsAction(item.id, 4), "Sloučeno: 4 sousední moduly.")}>
            <Link2 className="size-3.5" aria-hidden /> Sloučit 4 sousední (4M)
          </Button>
          {item.config?.poles === "2x1P" ? (
            <Button size="sm" variant="outline" className="touch-target gap-1.5" disabled={pending} onClick={() => geometry(() => splitItemAction(item.id), "Rozděleno na 2 obvodové větve.")}>
              <Scissors className="size-3.5" aria-hidden /> Rozdělit na 2 obvodové větve (2×1P)
            </Button>
          ) : item.modulesWidth >= 2 ? (
            <Button size="sm" variant="outline" className="touch-target gap-1.5" disabled={pending} onClick={() => geometry(() => splitItemAction(item.id), "Rozděleno na 1M moduly.")}>
              <Scissors className="size-3.5" aria-hidden /> Rozdělit na 1M moduly
            </Button>
          ) : null}
        </div>
      </section>

      {suggested ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
          <span>
            Návrh AI: <b>{suggested.manufacturer} {suggested.typeCode}</b>
          </span>
          <Button
            className="touch-target ml-auto gap-2"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await assignComponentAction(item.id, suggested.id);
                if (!result.ok) return void toast.error(result.error);
                onChanged();
              })
            }
          >
            <Check className="size-4" aria-hidden /> Potvrdit návrh
          </Button>
        </div>
      ) : null}

      <section aria-label="Našeptávač databáze prvků" className="flex flex-col gap-2 rounded-lg border border-sky-500/40 bg-sky-500/5 p-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-sky-200">
          Rychlé hledání v databázi prvků
          <span className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              placeholder="např. S201 B16, FH204 30mA, SD203 …"
              className="h-10 pl-8"
              aria-label="Hledat v databázi prvků"
              onChange={(event) => {
                setQuery(event.target.value);
                runSearch(event.target.value, { manufacturer, config });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && hits?.[0]) {
                  event.preventDefault();
                  pickHit(hits[0]);
                }
                if (event.key === "Escape") setHits(null);
              }}
            />
            {searching ? <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Hledám" /> : null}
          </span>
        </label>
        <p className="text-[11px] text-muted-foreground" data-testid="catalog-filter">
          Filtr podle dlaždic: {manufacturer ?? "všichni výrobci"} → {config ? CATEGORY_LABELS[catalogCategory(config)] : "všechny kategorie"}
          {config?.poles && config.poles !== "2x1P" ? ` → ${config.poles}` : ""}
        </p>
        {hits ? (
          hits.length ? (
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto" aria-label="Nalezené prvky" data-testid="catalog-hits">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => pickHit(hit)}
                    className="flex w-full flex-wrap items-baseline gap-x-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-left text-sm hover:border-primary"
                  >
                    <b>
                      {hit.manufacturer} {hit.typeCode}
                    </b>
                    <span className="font-mono text-[11px] text-muted-foreground">{hit.articleNumber}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {hit.poles}
                      {hit.ratedCurrentA ? ` · ${hit.trippingCurve ?? ""}${hit.ratedCurrentA} A` : ""}
                      {hit.rcdSensitivityMa ? ` · ${hit.rcdSensitivityMa} mA` : ""} · {hit.modulesCount}M · Pv {formatWatts(hit.powerLossWatts)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="catalog-no-hits">
              Typ v databázi zatím není.
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
                disabled={pending}
                onClick={() => {
                  setLookupText(query);
                  setHits(null);
                  lookup(query);
                }}
              >
                <Sparkles className="size-3.5" aria-hidden /> Dohledat přes Gemini AI a uložit do databáze
              </Button>
            </div>
          )
        ) : null}
      </section>

      <CascadePicker
        manufacturer={manufacturer}
        chosen={chosen}
        config={config}
        brandCounts={brandCounts}
        onManufacturer={pickManufacturer}
        onCategory={pickCategory}
        onOption={(patch) => config && apply({ ...config, ...patch })}
        fieldExtra={(field) =>
          field.key === "poles" || field.key === "contacts" ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="size-4 accent-primary" checked={mergeRight} onChange={(event) => setMergeRight(event.target.checked)} />
              Sloučit se sousedními moduly vpravo (širší přístroj pohltí moduly, které AI rozsekala)
            </label>
          ) : null
        }
        advanced={
          <>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Typové označení (ručně)
              <Input
                key={`type:${item.id}:${item.customTypeCode ?? ""}`}
                defaultValue={item.customTypeCode ?? ""}
                placeholder={item.component?.typeCode ?? "např. S201-B16"}
                maxLength={80}
                className="h-10"
                aria-label="Typové označení"
                onBlur={(event) => saveText({ customTypeCode: event.target.value.trim() || null })}
              />
            </label>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                lookup();
              }}
            >
              <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                Exotický prvek – text z čela přístroje
                <Input value={lookupText} onChange={(event) => setLookupText(event.target.value)} placeholder="např. Hager MBN116" className="h-10" aria-label="Text z čela přístroje" />
              </label>
              <Button type="submit" variant="secondary" className="touch-target gap-2" disabled={pending}>
                <Sparkles className="size-4" aria-hidden /> Dohledat přes Gemini AI
              </Button>
            </form>
          </>
        }
      />

      {item.component?.category === "MCB" || item.component?.category === "RCBO" || item.config?.category === "MCB" || item.config?.category === "RCBO" ? <WiringSection itemId={item.id} wiring={item.wiring ?? []} /> : null}
    </div>
  );
}
