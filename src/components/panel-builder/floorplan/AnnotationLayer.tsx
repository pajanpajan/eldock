import type { PointerEvent as ReactPointerEvent } from "react";

import type { Annotation, HatchId } from "@/lib/panel-builder/floorplan-editor";
import { annotationBounds, wallPolygon } from "@/lib/panel-builder/floorplan-frames";

/**
 * Fáze 59: zakreslené změny nad podkladem – nová příčka (šrafa v barvě), bouraná konstrukce (čárkovaný obrys
 * s křížovou šrafou), šrafovaná oblast a textové pole. Šrafy jsou vzorky v mm půdorysu (vypadají jako ve výkresu).
 */
export function hatchId(hatch: HatchId, color: string) {
  return `fp-hatch-${hatch}-${color.replace("#", "")}`;
}

export function HatchPatterns({ notes, extra = [] }: { notes: readonly Pick<Annotation, "hatch" | "color">[]; extra?: readonly Pick<Annotation, "hatch" | "color">[] }) {
  const used = new Map<string, Pick<Annotation, "hatch" | "color">>();
  for (const note of [...notes, ...extra]) if (note.hatch !== "none" && note.hatch !== "solid") used.set(hatchId(note.hatch, note.color), note);
  const size = 160;
  return (
    <>
      {[...used.entries()].map(([id, note]) => (
        <pattern key={id} id={id} width={size} height={size} patternUnits="userSpaceOnUse" patternTransform={note.hatch === "diagonal" || note.hatch === "cross" ? "rotate(45)" : undefined}>
          {note.hatch === "dots" ? (
            <circle cx={size / 2} cy={size / 2} r={size / 9} fill={note.color} />
          ) : (
            <>
              <line x1={0} y1={size / 2} x2={size} y2={size / 2} stroke={note.color} strokeWidth={size / 9} />
              {note.hatch === "cross" ? <line x1={size / 2} y1={0} x2={size / 2} y2={size} stroke={note.color} strokeWidth={size / 9} /> : null}
            </>
          )}
        </pattern>
      ))}
    </>
  );
}

const fillOf = (note: Pick<Annotation, "hatch" | "color">) => (note.hatch === "none" ? "none" : note.hatch === "solid" ? note.color : `url(#${hatchId(note.hatch, note.color)})`);

export function AnnotationShape({
  note,
  unit,
  selected,
  interactive,
  onDown,
  onHandle,
}: {
  note: Annotation;
  /** Jednotka UI (velikost úchytů a čar drží stejnou velikost na obrazovce). */
  unit: number;
  selected: boolean;
  interactive: boolean;
  onDown?: (event: ReactPointerEvent, note: Annotation) => void;
  onHandle?: (event: ReactPointerEvent, note: Annotation, handle: "a" | "b") => void;
}) {
  const stroke = unit / 16;
  const highlight = selected ? "#38bdf8" : null;
  const down = interactive && onDown ? (event: ReactPointerEvent) => onDown(event, note) : undefined;
  const handles =
    selected && interactive && onHandle && note.kind !== "text" ? (
      <>
        {(["a", "b"] as const).map((handle) => (
          <circle
            key={handle}
            cx={handle === "a" ? note.x : note.x2}
            cy={handle === "a" ? note.y : note.y2}
            r={unit * 0.28}
            fill="#38bdf8"
            stroke="#09090b"
            strokeWidth={stroke * 2}
            className="cursor-crosshair"
            onPointerDown={(event) => onHandle(event, note, handle)}
            data-testid={`note-handle-${handle}`}
          />
        ))}
      </>
    ) : null;

  if (note.kind === "text") {
    const box = annotationBounds(note);
    const lines = (note.text || " ").split("\n");
    return (
      <g data-note={note.kind} data-testid="annotation" className={interactive ? "cursor-move" : undefined} onPointerDown={down}>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={note.background ? "rgba(255,255,255,0.88)" : "transparent"} stroke={highlight ?? (note.background ? "rgba(17,24,39,0.25)" : "none")} strokeWidth={stroke * (selected ? 3 : 1.2)} rx={note.fontMm * 0.12} />
        {lines.map((line, index) => (
          <text key={index} x={note.x + note.fontMm * 0.3} y={note.y + note.fontMm * (1 + index * 1.25)} fontSize={note.fontMm} fontWeight={note.bold ? 800 : 500} fill={note.color} pointerEvents="none">
            {line}
          </text>
        ))}
      </g>
    );
  }
  if (note.kind === "zone") {
    const x = Math.min(note.x, note.x2);
    const y = Math.min(note.y, note.y2);
    return (
      <g data-note={note.kind} data-testid="annotation">
        <rect x={x} y={y} width={Math.abs(note.x2 - note.x)} height={Math.abs(note.y2 - note.y)} fill={fillOf(note)} fillOpacity={note.hatch === "solid" ? 0.3 : 0.75} stroke={highlight ?? note.color} strokeWidth={stroke * (selected ? 4 : 2.5)} className={interactive ? "cursor-move" : undefined} onPointerDown={down} />
        {handles}
      </g>
    );
  }
  // Příčka / bouraná konstrukce: obdélník v tloušťce konstrukce kolem osy
  const points = wallPolygon(note)
    .map((point) => `${Math.round(point.x)},${Math.round(point.y)}`)
    .join(" ");
  const demolish = note.kind === "demolish";
  return (
    <g data-note={note.kind} data-testid="annotation">
      <polygon
        points={points}
        fill={fillOf(note)}
        fillOpacity={note.hatch === "solid" ? (demolish ? 0.35 : 0.85) : 1}
        stroke={highlight ?? note.color}
        strokeWidth={stroke * (selected ? 4 : 2.5)}
        strokeDasharray={demolish ? `${unit / 3} ${unit / 5}` : undefined}
        className={interactive ? "cursor-move" : undefined}
        onPointerDown={down}
      />
      {/* Široká neviditelná osa – tenká příčka jde snadno chytit */}
      {interactive ? <line x1={note.x} y1={note.y} x2={note.x2} y2={note.y2} stroke="transparent" strokeWidth={Math.max(note.thicknessMm, unit * 0.6)} className="cursor-move" onPointerDown={down} /> : null}
      {handles}
    </g>
  );
}
