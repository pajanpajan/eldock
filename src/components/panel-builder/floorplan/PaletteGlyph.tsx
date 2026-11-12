"use client";

import { memo, useLayoutEffect, useRef } from "react";

import type { InstallLevel } from "@/engine/floorplan-bridge";
import { archDrawing, primitivePath } from "@/lib/panel-builder/architecture";
import { paletteItem } from "@/lib/panel-builder/floorplan-editor";
import { FIXTURES, type ArchType, type FixtureSpec } from "@/lib/panel-builder/fixtures";
import { symbolParts } from "@/lib/panel-builder/symbol-parts";

/**
 * Fáze 100: čistá vektorová CAD značka prvku na dlaždici palety 2D půdorysu – stejné cesty jako na plátně, v tiskovém
 * výkresu i v DXF (ČSN EN 60617-11, okna / dveře / nábytek ve skutečném poměru stran). Kresba je v barvě textu dlaždice
 * (`currentColor`), výřez se po vykreslení přizpůsobí kresbě (getBBox, jednou na značku).
 */

const SIZE = 100;

function FixtureGlyph({ spec }: { spec: FixtureSpec }) {
  const w = spec.w / 2;
  const d = spec.d / 2;
  const line = Math.max(spec.w, spec.d) / 40;
  if (spec.arch) {
    return (
      <g fill="none" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
        {archDrawing(spec.type as ArchType, spec.w, spec.d).map((primitive, index) => (
          <path key={index} d={primitivePath(primitive)} fill={primitive.fill && primitive.closed ? "rgba(161,161,170,0.16)" : "none"} strokeWidth={line * (primitive.weight ?? 1)} strokeDasharray={primitive.dashed ? `${line * 3} ${line * 2.2}` : undefined} />
        ))}
      </g>
    );
  }
  const bowls = spec.type === "double_basin" ? [-w / 2, w / 2] : [0];
  const bowl = { rx: (spec.type === "double_basin" ? w / 2 : w) * 0.7, ry: d * 0.62 };
  return (
    <g fill="none" stroke="currentColor" strokeWidth={line}>
      <rect x={-w} y={-d} width={spec.w} height={spec.d} rx={spec.type === "bath" ? 40 : 20} strokeWidth={line * 1.4} />
      {spec.type === "bath" ? (
        <>
          <rect x={-w + 80} y={-d + 80} width={Math.max(10, spec.w - 160)} height={Math.max(10, spec.d - 160)} rx={Math.max(5, d - 80)} />
          <circle cx={-w + Math.min(260, w)} cy={0} r={45} />
        </>
      ) : null}
      {spec.type === "shower" ? (
        <>
          <path d={`M${-w} ${-d} L${w} ${d} M${w} ${-d} L${-w} ${d}`} strokeOpacity={0.6} />
          <circle cx={0} cy={0} r={50} />
        </>
      ) : null}
      {spec.type === "basin" || spec.type === "double_basin"
        ? bowls.map((cx) => (
            <g key={cx}>
              <ellipse cx={cx} cy={d * 0.1} rx={bowl.rx} ry={bowl.ry} />
              <circle cx={cx} cy={-d + 55} r={22} fill="currentColor" />
            </g>
          ))
        : null}
    </g>
  );
}

function SymbolGlyph({ itemId, symbol, level }: { itemId: string; symbol?: string; level: InstallLevel }) {
  const base = paletteItem(itemId);
  if (!base) return null;
  const parts = symbolParts(symbol ? { ...base, symbol } : base, SIZE, { level });
  const ink = parts.color ?? "currentColor";
  const width = SIZE / 22;
  return (
    <g fill="none" stroke={ink} strokeWidth={width * 1.25} strokeLinecap="round" strokeLinejoin="round">
      {parts.fills.map((fill, index) => (
        <path key={`F${index}`} d={fill} fill={ink} stroke="none" />
      ))}
      {parts.paths.map((d, index) => (
        <path key={index} d={d} />
      ))}
      {parts.circles.map((circle, index) => (
        <circle key={`c${index}`} cx={circle.cx} cy={circle.cy} r={circle.r} fill={circle.fill ? ink : "none"} />
      ))}
      {parts.texts.map((text, index) => (
        <text key={`t${index}`} x={text.x} y={text.y} fontSize={text.size} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={ink} stroke="none">
          {text.value}
        </text>
      ))}
    </g>
  );
}

/** Značka prvku palety (memoizovaná – paleta se při pohybu myší překresluje, značky ne). */
export const PaletteGlyph = memo(function PaletteGlyph({ itemId, symbol, level }: { itemId: string; /** Zkratka spotřebiče z knihovny. */ symbol?: string; level: InstallLevel }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const spec = paletteItem(itemId)?.kind === "fixture" ? (FIXTURES[itemId] ?? null) : null;
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const body = bodyRef.current;
    if (!svg || !body || typeof body.getBBox !== "function") return;
    try {
      const box = body.getBBox();
      if (!(box.width > 0 && box.height > 0)) return;
      const pad = Math.max(box.width, box.height) * 0.08;
      svg.setAttribute("viewBox", `${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`);
    } catch {
      // bez rozvržení (skrytý prvek) zůstane výchozí výřez
    }
  }, [itemId, symbol, level]);
  const fallback = spec ? `${-spec.w / 2 - 60} ${-spec.d / 2 - 60} ${spec.w + 120} ${spec.d + 120}` : `${-SIZE * 0.8} ${-SIZE * 0.8} ${SIZE * 1.6} ${SIZE * 1.6}`;
  return (
    <svg ref={svgRef} viewBox={fallback} className="h-full w-full overflow-visible" aria-hidden focusable="false" data-testid="palette-glyph" data-glyph={itemId}>
      <g ref={bodyRef}>{spec ? <FixtureGlyph spec={spec} /> : <SymbolGlyph itemId={itemId} symbol={symbol} level={level} />}</g>
    </svg>
  );
});
