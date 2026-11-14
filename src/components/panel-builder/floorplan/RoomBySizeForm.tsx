"use client";

import { useId, useState } from "react";
import { ArrowLeftRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ROOM_PRESETS, formatRoomSize, nextRoomPreset, parseRoomSize, type SizeUnit } from "@/lib/panel-builder/room-builder";
import { cn } from "@/lib/utils";

const field = "h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30";

/**
 * Fáze 89: generátor místnosti podle rozměrů X × Y – název z předvoleb (nebo vlastní text), Šířka X a Hloubka Y
 * v metrech či milimetrech (tečka i čárka), [ + Vytvořit místnost ] nebo Enter a [ ↻ Prohodit X ↔ Y ]. Místnost se
 * vloží na volné místo plochy, hned je vybraná a jde chytit myší a přisunout k ostatním (magnetické stěny a rohy).
 * Fáze 90: po vytvoření se rovnou předvyplní další typ místnosti (po obývacím pokoji kuchyň, ložnice, koupelna …),
 * průvodce zůstává v kroku 1 – dům se skládá místnost po místnosti na jedno kliknutí.
 */
export function RoomBySizeForm({ onCreate, rooms = [], className, stacked = false }: { onCreate: (room: { name: string; w: number; h: number }) => void; rooms?: readonly string[]; className?: string; /** Fáze 114: úzký levý sloupec – pole pod sebou v mřížce, nic nepřeteče. */ stacked?: boolean }) {
  const listId = useId();
  const [first] = useState(() => nextRoomPreset(rooms));
  const [name, setName] = useState<string>(first.name);
  const [unit, setUnit] = useState<SizeUnit>("m");
  const [x, setX] = useState(formatRoomSize(first.w));
  const [y, setY] = useState(formatRoomSize(first.h));

  function changeName(value: string) {
    setName(value);
    // Předvolba z nabídky předvyplní typický rozměr (jde přepsat)
    const preset = ROOM_PRESETS.find((option) => option.name === value);
    if (preset) {
      setX(formatRoomSize(preset.w, unit));
      setY(formatRoomSize(preset.h, unit));
    }
  }

  function changeUnit(next: SizeUnit) {
    if (next === unit) return;
    const convert = (text: string) => {
      const mm = parseRoomSize(text, unit);
      return mm ? formatRoomSize(mm, next) : text;
    };
    setX(convert(x));
    setY(convert(y));
    setUnit(next);
  }

  function submit() {
    const w = parseRoomSize(x, unit);
    const h = parseRoomSize(y, unit);
    if (!w || !h) return void toast.error(unit === "m" ? "Zadejte šířku X a hloubku Y od 0,5 do 100 m (desetinná tečka i čárka)." : "Zadejte šířku X a hloubku Y od 500 do 100 000 mm.");
    const created = name.trim() || "Místnost";
    onCreate({ name: created, w, h });
    // Fáze 90: další typ místnosti s typickým rozměrem (jde přepsat)
    const next = nextRoomPreset([...rooms, created], created);
    setName(next.name);
    setX(formatRoomSize(next.w, unit));
    setY(formatRoomSize(next.h, unit));
  }

  const nameField = (
    <>
      <input list={listId} value={name} onChange={(event) => changeName(event.target.value)} maxLength={40} className={cn(field, stacked ? "w-full min-w-0" : "w-40")} aria-label="Název / typ místnosti" placeholder="Název místnosti" data-testid="room-size-name" />
      <datalist id={listId}>
        {ROOM_PRESETS.map((preset) => (
          <option key={preset.name} value={preset.name} />
        ))}
      </datalist>
    </>
  );
  const sizeField = (axis: "x" | "y") => (
    <label className={cn("flex items-center gap-1", stacked && "min-w-0")}>
      {axis === "x" ? "X" : "Y"}
      <input
        value={axis === "x" ? x : y}
        onChange={(event) => (axis === "x" ? setX : setY)(event.target.value)}
        inputMode="decimal"
        className={cn(field, stacked ? "w-full min-w-0" : "w-16", "text-right font-mono tabular-nums")}
        aria-label={axis === "x" ? `Šířka nové místnosti X [${unit}]` : `Hloubka nové místnosti Y [${unit}]`}
        data-testid={`room-size-${axis}`}
      />
    </label>
  );
  const unitToggle = (
    <span className="flex overflow-hidden rounded-md border border-border" role="radiogroup" aria-label="Jednotka rozměrů">
      {(["m", "mm"] as const).map((option) => (
        <button key={option} type="button" role="radio" aria-checked={unit === option} onClick={() => changeUnit(option)} className={cn("px-1.5 py-1 font-mono", stacked && "flex-1", unit === option ? "bg-primary/20 text-foreground" : "hover:text-foreground")} data-testid={`room-size-unit-${option}`}>
          {option}
        </button>
      ))}
    </span>
  );
  const swapButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("h-8 gap-1 px-2", stacked && "w-full min-w-0 justify-center whitespace-normal leading-snug")}
      onClick={() => {
        setX(y);
        setY(x);
      }}
      title="Prohodit šířku a hloubku"
      data-testid="room-size-swap"
    >
      <ArrowLeftRight className="size-3.5" aria-hidden /> ↻ Prohodit X ↔ Y
    </Button>
  );
  const createButton = (
    <Button type="submit" size="sm" className={cn("h-8 gap-1", stacked && "w-full min-w-0")} data-testid="room-size-create">
      <Plus className="size-4" aria-hidden /> Vytvořit místnost
    </Button>
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className={cn(stacked ? "flex min-w-0 flex-col gap-2" : "flex flex-wrap items-center gap-1.5", "text-xs text-muted-foreground", className)}
      aria-label="Místnost podle rozměrů X × Y"
      data-testid="room-by-size"
    >
      {stacked ? (
        <>
          {nameField}
          {/* Fáze 114: rozměry X × Y v čisté mřížce – vstupy stejně široké, nic nepřeteče šířku sloupce */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
            {sizeField("x")}
            <span aria-hidden>×</span>
            {sizeField("y")}
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-1.5">
            {unitToggle}
            {swapButton}
          </div>
          {createButton}
        </>
      ) : (
        <>
          {nameField}
          {sizeField("x")}
          <span aria-hidden>×</span>
          {sizeField("y")}
          {unitToggle}
          {swapButton}
          {createButton}
        </>
      )}
    </form>
  );
}
