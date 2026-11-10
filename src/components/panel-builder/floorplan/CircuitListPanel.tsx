"use client";

import { DoorOpen, Eye, EyeOff, ListTree, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CIRCUIT_LAYERS, type CircuitLayer, type DisplayCircuit } from "@/lib/panel-builder/route-display";
import { cn } from "@/lib/utils";

import { PanelSection } from "./RightPanels";

/** Řádek soupisu (okruh z výpočtu, přívod podružného rozváděče nebo datová zásuvka). */
export type CircuitEntry = Omit<DisplayCircuit, "legs" | "edited" | "tag"> & { color: string; edited: boolean; onFloor: boolean };

export interface BoardOption {
  code: string;
  label: string;
}

const m = (value: number) => `${value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} m`;
const count = (value: number, one: string, few: string, many: string) => `${value} ${value === 1 ? one : value >= 2 && value <= 4 ? few : many}`;

/** Fáze 74: přepínače vrstev okruhů (nad plátnem i v soupisu) – skrytý druh se na plátně nekreslí. */
export function LayerChips({ entries, hidden, onToggle, compact = false }: { entries: readonly Pick<CircuitEntry, "layer">[]; hidden: ReadonlySet<CircuitLayer>; onToggle: (layer: CircuitLayer) => void; compact?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Vrstvy okruhů" data-testid={compact ? "layer-chips-canvas" : "layer-chips"}>
      {CIRCUIT_LAYERS.map((layer) => {
        const total = entries.filter((entry) => entry.layer === layer.id).length;
        const shown = !hidden.has(layer.id);
        return (
          <button
            key={layer.id}
            type="button"
            aria-pressed={shown}
            onClick={() => onToggle(layer.id)}
            title={`${shown ? "Skrýt" : "Zobrazit"} – ${layer.label}`}
            className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", shown ? "border-sky-400/70 bg-sky-500/15 text-foreground" : "border-border text-muted-foreground line-through decoration-1")}
            data-testid={`layer-${layer.id}`}
          >
            {shown ? <Eye className="size-3" aria-hidden /> : <EyeOff className="size-3" aria-hidden />}
            {layer.short}
            <span className="font-mono tabular-nums opacity-80">{total}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Fáze 74: výběr rozváděče okruhu / prvku (automaticky, hlavní, podružné). */
export function BoardSelect({ value, auto, boards, onChange, label = "Rozváděč", testId = "board-select" }: { value: string | null; auto: string; boards: readonly BoardOption[]; onChange: (code: string | null) => void; label?: string; testId?: string }) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="shrink-0 font-semibold text-foreground">{label}</span>
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value || null)} className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1.5 text-xs text-foreground dark:bg-input/30" aria-label={label} data-testid={testId}>
        <option value="">Automaticky ({auto})</option>
        {boards.map((board) => (
          <option key={board.code} value={board.code}>
            {board.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Fáze 74: detail podružného rozváděče – přívod z hlavního rozváděče a jeho okruhy. */
export function SubpanelInfo({ code, entries }: { code: string; entries: readonly CircuitEntry[] }) {
  const feeder = entries.find((entry) => entry.id === `feeder-${code}`);
  const own = entries.filter((entry) => entry.board === code && entry.layer !== "data");
  const data = entries.filter((entry) => entry.board === code && entry.layer === "data").length;
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-violet-500/40 bg-violet-500/5 p-2 text-xs" data-testid="subpanel-info">
      <p className="font-semibold text-foreground">⚡ Podružný rozváděč {code}</p>
      <p className="text-muted-foreground">
        {count(own.length, "okruh", "okruhy", "okruhů")}
        {data ? ` · ${count(data, "datová zásuvka", "datové zásuvky", "datových zásuvek")}` : ""} – prvky na podlaží bez hlavního rozváděče k němu patří samy, ostatní přiřadíte v soupisu okruhů nebo v detailu prvku.
      </p>
      {feeder ? (
        <p className="font-mono text-foreground" data-testid="subpanel-feeder">
          Přívod z RH: {feeder.designation ?? "–"} · {feeder.cable} · {m(feeder.lengthM)}
        </p>
      ) : (
        <p className="text-amber-200">Přívod se dopočítá, až bude mít rozváděč aspoň jeden okruh.</p>
      )}
    </div>
  );
}

/**
 * Fáze 74: soupis okruhů celého domu – barva jako na plátně, označení jističe (u podružného rozváděče s jeho kódem),
 * druh, prvky a délka. Najetí okruh na plátně zvýrazní, klik ho vybere (ostatní se ztlumí a úseky trasy jdou posouvat
 * jen u něj); u vybraného okruhu rozváděč, výběr prvků a reset trasy.
 */
export function CircuitListPanel({
  entries,
  hidden,
  onToggleLayer,
  focusId,
  onFocus,
  onHover,
  boards,
  boardOf,
  onAssignBoard,
  onSelectElements,
  onResetRoute,
  hiddenCircuits = new Set<string>(),
  onToggleCircuit,
  onShowAll,
  onHideAll,
  onOnlyRoom,
  roomLabel = null,
}: {
  entries: readonly CircuitEntry[];
  hidden: ReadonlySet<CircuitLayer>;
  onToggleLayer: (layer: CircuitLayer) => void;
  /** Fáze 76: skryté okruhy (oko 👁️) – trasa ani zvýraznění prvků se na plátně nekreslí. */
  hiddenCircuits?: ReadonlySet<string>;
  onToggleCircuit?: (id: string) => void;
  onShowAll?: () => void;
  onHideAll?: () => void;
  /** Jen okruhy s prvky ve vybrané místnosti (`roomLabel` = název místnosti, bez výběru null). */
  onOnlyRoom?: () => void;
  roomLabel?: string | null;
  focusId: string | null;
  onFocus: (id: string | null) => void;
  onHover: (id: string | null) => void;
  /** Rozváděče nákresu (víc než jeden = skupiny podle rozváděče a výběr rozváděče okruhu). */
  boards: readonly BoardOption[];
  /** Ruční rozváděč okruhu (všechny prvky mají stejný ruční rozváděč), jinak null = automaticky. */
  boardOf: (entry: CircuitEntry) => string | null;
  onAssignBoard: (entry: CircuitEntry, code: string | null) => void;
  onSelectElements: (entry: CircuitEntry) => void;
  onResetRoute: (entry: CircuitEntry) => void;
}) {
  const multiple = boards.length > 1;
  const groups = multiple ? boards.map((board) => ({ board, rows: entries.filter((entry) => entry.board === board.code) })).filter((group) => group.rows.length) : [{ board: null, rows: [...entries] }];
  const shownCount = entries.filter((entry) => !hiddenCircuits.has(entry.id)).length;
  return (
    // Fáze 76: sbalovací karta pravého sloupce s okem u každého okruhu
    <PanelSection
      id="circuits"
      title="Soupis okruhů"
      testId="circuit-list"
      className="border-sky-500/40"
      icon={<ListTree className="size-4 text-sky-300" aria-hidden />}
      badge={
        <span className="text-xs font-normal text-muted-foreground" data-testid="circuit-list-count">
          {shownCount < entries.length ? `${shownCount} z ` : ""}
          {count(entries.length, "okruh", "okruhy", "okruhů")}
        </span>
      }
    >
      {onShowAll ? (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Viditelnost okruhů">
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={onShowAll} disabled={!hiddenCircuits.size && !hidden.size} data-testid="circuits-show-all">
            <Eye className="size-3.5" aria-hidden /> Zobrazit vše
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={onHideAll} disabled={entries.length > 0 && hiddenCircuits.size >= entries.length} data-testid="circuits-hide-all">
            <EyeOff className="size-3.5" aria-hidden /> Skrýt vše
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={onOnlyRoom} disabled={!roomLabel} title={roomLabel ? `Jen okruhy s prvky v místnosti ${roomLabel}` : "Nejdřív vyberte místnost nebo prvek v ní"} data-testid="circuits-only-room">
            <DoorOpen className="size-3.5" aria-hidden /> Jen vybraná místnost{roomLabel ? ` (${roomLabel})` : ""}
          </Button>
        </div>
      ) : null}
      <LayerChips entries={entries} hidden={hidden} onToggle={onToggleLayer} />
      {entries.length ? (
        <div className="flex max-h-[22rem] flex-col gap-2 overflow-y-auto pr-0.5">
          {groups.map((group) => (
            <div key={group.board?.code ?? "all"} className="flex flex-col gap-0.5">
              {group.board ? <p className="px-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{group.board.label}</p> : null}
              <ul className="flex flex-col gap-0.5" data-testid="circuit-rows">
                {group.rows.map((entry) => {
                  const active = entry.id === focusId;
                  const layerHidden = entry.layer !== "feeder" && entry.layer !== "bus" && hidden.has(entry.layer);
                  const visible = !hiddenCircuits.has(entry.id);
                  const name = entry.designation ?? entry.label;
                  return (
                    <li key={entry.id} className={cn("flex flex-wrap items-stretch rounded-md border", active ? "border-sky-400 bg-sky-500/10" : "border-transparent")}>
                      {/* Fáze 76: oko = zaškrtávátko viditelnosti okruhu na plátně */}
                      {onToggleCircuit ? (
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={visible}
                          aria-label={`${visible ? "Skrýt" : "Zobrazit"} okruh ${name}`}
                          title={`${visible ? "Skrýt" : "Zobrazit"} okruh na plátně`}
                          onClick={() => onToggleCircuit(entry.id)}
                          className={cn("flex w-7 shrink-0 items-center justify-center rounded-md", visible ? "text-sky-200 hover:bg-muted/50" : "text-muted-foreground hover:bg-muted/50")}
                          data-testid="circuit-eye"
                          data-circuit={entry.id}
                        >
                          {visible ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onFocus(active ? null : entry.id)}
                        onMouseEnter={() => onHover(entry.id)}
                        onMouseLeave={() => onHover(null)}
                        onFocus={() => onHover(entry.id)}
                        onBlur={() => onHover(null)}
                        aria-pressed={active}
                        className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-muted/50", (layerHidden || !visible) && "opacity-45")}
                        data-testid="circuit-row"
                        data-circuit={entry.id}
                        data-layer={entry.layer}
                        data-board={entry.board}
                        title={!visible ? "Okruh je skrytý (oko) – na plátně se nekreslí" : layerHidden ? "Vrstva je skrytá – okruh se na plátně nekreslí" : entry.onFloor ? "Zvýraznit a vybrat okruh" : "Okruh je na jiném podlaží"}
                      >
                        <span className="h-3 w-3 shrink-0 rounded-full border border-black/40" style={{ background: entry.color }} aria-hidden />
                        <span className="w-14 shrink-0 font-mono font-bold">{entry.designation ?? "–"}</span>
                        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                        {entry.edited ? <span className="text-[10px] text-amber-300" title="Ručně upravená trasa">✎</span> : null}
                        {!entry.onFloor ? <span className="text-[10px] text-muted-foreground">jiné podl.</span> : null}
                        <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">{m(entry.lengthM)}</span>
                      </button>
                      {active ? (
                        <div className="flex w-full flex-col gap-1.5 border-t border-sky-500/30 px-2 py-1.5 text-xs" data-testid="circuit-detail">
                          <p className="text-muted-foreground">
                            {entry.cable} · {entry.routing === "TOP" ? "vrchem" : "spodem"} · {count(entry.elementIds.length, "prvek", "prvky", "prvků")}
                          </p>
                          {multiple && entry.layer !== "feeder" ? <BoardSelect value={boardOf(entry)} auto={entry.board} boards={boards} onChange={(code) => onAssignBoard(entry, code)} label="Rozváděč okruhu" testId="circuit-board" /> : null}
                          <div className="flex flex-wrap gap-1">
                            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onSelectElements(entry)} disabled={!entry.elementIds.length} data-testid="circuit-select-elements">
                              Vybrat prvky
                            </Button>
                            {entry.edited ? (
                              <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => onResetRoute(entry)} data-testid="circuit-reset-route">
                                <RotateCcw className="size-3.5" aria-hidden /> Trasa na automat
                              </Button>
                            ) : null}
                            <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 gap-1 px-2 text-xs" onClick={() => onFocus(null)} aria-label="Zrušit výběr okruhu">
                              <X className="size-3.5" aria-hidden />
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground">Úseky trasy teď jdou na plátně posouvat jen u tohoto okruhu (↕ / ↔, dvojklik = odskok, pravé tlačítko = automat).</p>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Okruhy se objeví po vložení rozváděče a prvků.</p>
      )}
    </PanelSection>
  );
}
