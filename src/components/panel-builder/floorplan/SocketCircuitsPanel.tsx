"use client";

import { Plug, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SOCKET_GROUPINGS, type SocketGrouping } from "@/engine/socket-zones";
import { SOCKET_GROUPING_LABEL, type SocketCircuitRow } from "@/lib/panel-builder/socket-circuits";
import { cn } from "@/lib/utils";

const m = (value: number) => `${value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} m`;

export type SocketMoveTarget = { kind: "auto" } | { kind: "new" } | { kind: "row"; row: SocketCircuitRow };

/** Fáze 65: okruh vybrané zásuvky v jejím detailu – automaticky, přesun do jiného okruhu, nový ruční okruh. */
export function SocketCircuitPicker({ manual, current, rows, onMove }: { manual: string | null; current: SocketCircuitRow | null; rows: SocketCircuitRow[]; onMove: (target: SocketMoveTarget) => void }) {
  const value = manual && current ? current.id : "auto";
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-sky-500/40 bg-sky-500/5 p-2 text-xs" data-testid="socket-circuit-picker">
      <label className="flex flex-col gap-1">
        <span className="font-semibold text-foreground">🔌 Okruh zásuvky</span>
        <select
          value={value}
          onChange={(event) => {
            const next = event.target.value;
            const row = rows.find((candidate) => candidate.id === next);
            onMove(next === "auto" ? { kind: "auto" } : next === "new" ? { kind: "new" } : row ? { kind: "row", row } : { kind: "auto" });
          }}
          className="h-8 rounded-md border border-input bg-transparent px-1.5 text-xs text-foreground dark:bg-input/30"
          aria-label="Okruh zásuvky"
          data-testid="socket-circuit-select"
        >
          <option value="auto">Automaticky{!manual && current ? ` (teď ${current.designation} – ${current.label.replace(/^Zásuvky – /, "")})` : ""}</option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.designation} – {row.label.replace(/^Zásuvky – /, "")} ({outlets(row.outlets)}){row.manual ? ` · ruční ${row.manual}` : ""}
            </option>
          ))}
          <option value="new">+ Nový ruční okruh</option>
        </select>
      </label>
      <span className="text-muted-foreground" data-testid="socket-circuit-current">
        {current ? `Teď: ${current.designation} · ${outlets(current.outlets)} · ${m(current.lengthM)} · ${manual ? `ruční okruh ${manual}` : "automaticky"}` : "Okruh se dopočítá po vložení rozváděče."}
      </span>
    </div>
  );
}
const outlets = (count: number) => `${count} ${count === 1 ? "zásuvka" : count >= 2 && count <= 4 ? "zásuvky" : "zásuvek"}`;

/**
 * Fáze 65: zásuvkové okruhy půdorysu – volba rozdělení (optimalizované zóny / každá místnost zvlášť / podle vzdálenosti
 * od rozváděče), „✨ Optimalizovat zásuvkové okruhy“ a přehled okruhů s označením jističe; klik na okruh vybere jeho
 * zásuvky na plátně (pak jde okruh měnit v detailu zásuvky nebo ve výběru).
 */
export function SocketCircuitsPanel({
  grouping,
  rows,
  activeIds,
  onGrouping,
  onOptimize,
  onSelect,
}: {
  grouping: SocketGrouping;
  rows: SocketCircuitRow[];
  /** Vybrané prvky na plátně (zvýraznění okruhu). */
  activeIds: readonly string[];
  onGrouping: (grouping: SocketGrouping) => void;
  onOptimize: () => void;
  onSelect: (row: SocketCircuitRow) => void;
}) {
  const manual = rows.filter((row) => row.manual).length;
  const longest = rows.reduce((best, row) => Math.max(best, row.lengthM), 0);
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm" aria-label="Zásuvkové okruhy" data-testid="socket-circuits">
      <h3 className="flex items-center gap-1.5 font-bold">
        <Plug className="size-4 text-sky-300" aria-hidden /> Zásuvkové okruhy
      </h3>
      <div className="flex flex-col gap-1" role="radiogroup" aria-label="Rozdělení zásuvek do okruhů">
        {SOCKET_GROUPINGS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={grouping === option}
            onClick={() => onGrouping(option)}
            className={cn("flex flex-col rounded-lg border px-2 py-1.5 text-left text-xs", grouping === option ? "border-sky-400 bg-sky-500/10" : "border-border hover:border-sky-400/60")}
            data-testid={`socket-grouping-${option}`}
          >
            <b className="text-foreground">{SOCKET_GROUPING_LABEL[option].label}</b>
            {grouping === option ? <span className="text-muted-foreground">{SOCKET_GROUPING_LABEL[option].detail}</span> : null}
          </button>
        ))}
      </div>
      {grouping === "distance" && rows.length > 1 ? (
        <p className="rounded-md border border-amber-400/50 bg-amber-500/10 px-2 py-1 text-xs text-amber-100" data-testid="socket-distance-hint">
          Okruhy se dělí podle vzdálenosti od rozváděče – ve velké místnosti nebo v půdorysu bez zakreslených místností tak sbírají zásuvky z protilehlých konců bytu.
        </p>
      ) : null}
      <Button type="button" size="sm" className="gap-1.5" onClick={onOptimize} disabled={!rows.length} data-testid="optimize-sockets">
        <Sparkles className="size-4" aria-hidden /> Optimalizovat zásuvkové okruhy
      </Button>
      {rows.length ? (
        <>
          <p className="text-xs text-muted-foreground" data-testid="socket-summary">
            {rows.length} {rows.length === 1 ? "okruh" : rows.length <= 4 ? "okruhy" : "okruhů"} · nejdelší {m(longest)}
            {manual ? ` · ${manual} ${manual <= 4 ? "ruční" : "ručních"}` : ""}
          </p>
          <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto text-xs" data-testid="socket-circuit-list">
            {rows.map((row) => {
              const active = row.elementIds.length > 0 && row.elementIds.every((id) => activeIds.includes(id));
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row)}
                    className={cn("flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left", active ? "border-sky-400 bg-sky-500/10" : "border-transparent hover:border-border")}
                    data-testid="socket-circuit-row"
                    data-designation={row.designation}
                    title="Vybrat zásuvky okruhu na plátně"
                  >
                    <span className="w-10 shrink-0 font-mono font-bold">{row.designation}</span>
                    <span className="min-w-0 flex-1 truncate">{row.label.replace(/^Zásuvky – /, "")}</span>
                    {row.manual ? <span className="rounded border border-sky-400/60 px-1 text-[10px] text-sky-200">ruční {row.manual}</span> : null}
                    <span className={cn("shrink-0 tabular-nums", row.outlets > 10 ? "text-red-300" : "text-muted-foreground")}>{outlets(row.outlets)}</span>
                    <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">{m(row.lengthM)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            Změna: klik na okruh vybere jeho zásuvky. Zásuvku přesunete v jejím detailu (Okruh zásuvky), víc zásuvek najednou výběrem (Shift / obdélník) → „Spojit do jednoho okruhu“. Ctrl+Z vrátí.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Vložte zásuvky – okruhy po max. 10 zásuvkách (ČSN 33 2130 ed. 4) se rozdělí samy.</p>
      )}
    </section>
  );
}
