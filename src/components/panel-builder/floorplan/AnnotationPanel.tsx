"use client";

import { Bold, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HATCHES, type Annotation, type AnnotationKind } from "@/lib/panel-builder/floorplan-editor";
import { ANNOTATION_COLORS, ANNOTATION_LABEL, FONT_SIZES, WALL_THICKNESSES, annotationLength } from "@/lib/panel-builder/floorplan-frames";
import { cn } from "@/lib/utils";

export type NoteStyle = Pick<Annotation, "color" | "hatch" | "thicknessMm" | "fontMm" | "bold" | "background">;

const meters = (mm: number) => `${(mm / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} m`;

/** Barva, šrafa, tloušťka konstrukce a písmo – před kreslením (lišta nástroje) i u vybrané poznámky. */
export function NoteStyleControls({ kind, style, onChange, compact = false }: { kind: AnnotationKind; style: NoteStyle; onChange: (patch: Partial<NoteStyle>) => void; compact?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 text-xs", compact ? "" : "flex-col items-start")} data-testid="note-style">
      <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Barva zakreslení">
        <span className="mr-1 text-muted-foreground">Barva:</span>
        {ANNOTATION_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={style.color === color}
            aria-label={`Barva ${color}`}
            onClick={() => onChange({ color })}
            className={cn("size-6 rounded-full border-2", style.color === color ? "border-sky-400 ring-2 ring-sky-400/40" : "border-zinc-600")}
            style={{ background: color }}
          />
        ))}
      </div>
      {kind !== "text" ? (
        <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Šrafování">
          <span className="mr-1 text-muted-foreground">Šrafa:</span>
          {HATCHES.map((hatch) => (
            <button
              key={hatch.id}
              type="button"
              role="radio"
              aria-checked={style.hatch === hatch.id}
              title={hatch.label}
              onClick={() => onChange({ hatch: hatch.id })}
              className={cn("flex size-7 items-center justify-center rounded border", style.hatch === hatch.id ? "border-sky-400 bg-sky-500/15" : "border-border")}
            >
              <HatchIcon hatch={hatch.id} color={style.color} />
              <span className="sr-only">{hatch.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      {kind === "wall" || kind === "demolish" ? (
        <label className="flex items-center gap-1 text-muted-foreground">
          Tloušťka:
          <select value={style.thicknessMm} onChange={(event) => onChange({ thicknessMm: Number(event.target.value) })} className="h-7 rounded-md border border-input bg-transparent px-1 text-foreground dark:bg-input/30" aria-label="Tloušťka konstrukce [mm]">
            {[...new Set([...WALL_THICKNESSES, style.thicknessMm])].sort((a, b) => a - b).map((mm) => (
              <option key={mm} value={mm}>
                {mm} mm
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {kind === "text" ? (
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Písmo">
          <span className="mr-1 text-muted-foreground">Písmo:</span>
          {FONT_SIZES.map((size) => (
            <button key={size.label} type="button" aria-pressed={style.fontMm === size.mm} onClick={() => onChange({ fontMm: size.mm })} className={cn("min-w-7 rounded border px-1.5 py-0.5 font-semibold", style.fontMm === size.mm ? "border-sky-400 bg-sky-500/15 text-foreground" : "border-border text-muted-foreground")}>
              {size.label}
            </button>
          ))}
          <input type="number" min={40} max={3000} step={10} value={style.fontMm} onChange={(event) => onChange({ fontMm: Math.min(3000, Math.max(40, Math.round(Number(event.target.value) || 250))) })} className="h-7 w-16 rounded-md border border-input bg-transparent px-1 text-right text-foreground tabular-nums dark:bg-input/30" aria-label="Velikost písma [mm]" />
          <span className="text-muted-foreground">mm</span>
          <button type="button" aria-pressed={style.bold} onClick={() => onChange({ bold: !style.bold })} className={cn("flex size-7 items-center justify-center rounded border", style.bold ? "border-sky-400 bg-sky-500/15" : "border-border")} aria-label="Tučné písmo">
            <Bold className="size-3.5" aria-hidden />
          </button>
          <label className="ml-1 flex items-center gap-1 text-muted-foreground">
            <input type="checkbox" checked={style.background} onChange={(event) => onChange({ background: event.target.checked })} /> bílý podklad
          </label>
        </div>
      ) : null}
    </div>
  );
}

function HatchIcon({ hatch, color }: { hatch: string; color: string }) {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
      <rect x={1} y={1} width={18} height={18} fill={hatch === "solid" ? color : "none"} stroke={color} strokeWidth={1.4} />
      {hatch === "diagonal" || hatch === "cross" ? <path d="M1 19 L19 1 M1 10 L10 1 M10 19 L19 10" stroke={color} strokeWidth={1.2} /> : null}
      {hatch === "cross" ? <path d="M1 1 L19 19 M1 10 L10 19 M10 1 L19 10" stroke={color} strokeWidth={1.2} /> : null}
      {hatch === "horizontal" ? <path d="M1 6 H19 M1 10 H19 M1 14 H19" stroke={color} strokeWidth={1.2} /> : null}
      {hatch === "dots" ? [5, 10, 15].flatMap((x) => [5, 10, 15].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} fill={color} />)) : null}
    </svg>
  );
}

/** Detail vybrané zakreslené změny: vzhled, text, délka a smazání. */
export function AnnotationDetail({ note, onChange, onDelete }: { note: Annotation; onChange: (patch: Partial<Annotation>) => void; onDelete: () => void }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border-2 border-sky-500/50 bg-card p-3 text-sm" aria-label="Detail zakreslené změny" data-testid="annotation-detail">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">✏️ {ANNOTATION_LABEL[note.kind]}</h3>
        <button type="button" onClick={onDelete} className="rounded p-1 text-muted-foreground hover:bg-red-500/15 hover:text-red-300" aria-label="Smazat zakreslenou změnu">
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      {note.kind === "text" ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Text (Enter = nový řádek)
          <textarea
            autoFocus
            value={note.text}
            maxLength={500}
            rows={3}
            onChange={(event) => onChange({ text: event.target.value })}
            className="rounded-md border border-input bg-transparent px-2 py-1 text-sm text-foreground dark:bg-input/30"
            aria-label="Text poznámky"
            data-testid="annotation-text"
          />
        </label>
      ) : (
        <p className="text-xs text-muted-foreground" data-testid="annotation-size">
          {note.kind === "zone" ? `Oblast ${meters(Math.abs(note.x2 - note.x))} × ${meters(Math.abs(note.y2 - note.y))}` : `Délka ${meters(annotationLength(note))} · tloušťka ${note.thicknessMm} mm`}
        </p>
      )}
      <NoteStyleControls kind={note.kind} style={note} onChange={onChange} />
      {note.kind === "wall" ? <p className="text-[11px] text-muted-foreground">Nová příčka se počítá jako stěna pro vedení kabelů a je v dokumentaci vyznačená jako změna.</p> : null}
      <Button type="button" variant="destructive" size="sm" className="gap-1.5 self-start" onClick={onDelete}>
        <Trash2 className="size-4" aria-hidden /> Smazat
      </Button>
    </section>
  );
}
