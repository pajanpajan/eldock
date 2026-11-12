"use client";

import { FallbackImg } from "@/components/common/FallbackImg";
import { useCatalogImage } from "@/components/panel-builder/catalog-lookup";
import { cn } from "@/lib/utils";

/**
 * Fáze 105: vizuální náhled skříně rozváděče u výběru skříně (krok 1b), ve „Vybrané skříni“ a v kroku 4. Reálná
 * studiová fotka výrobce (index fotek ze serveru) na světlém podkladu; bez fotky detailní vektorový render podle řady
 * a materiálu – ABB Mistral (bílá plastová skříň s kouřovými / zelenými průhlednými dvířky a DIN lištami uvnitř),
 * oceloplechové skříně (ABB ComfortLine CA, OEZ RN …) s plnými / prosklenými dveřmi a kličkou, zapuštěné rozvodnice
 * s kovovým rámem (ABB CU, Eaton KLV, Hager Volta / Vector, OEZ RZA / RZG).
 */

export interface EnclosureVisualInput {
  manufacturer: string;
  series?: string | null;
  model: string;
  articleNumber?: string | null;
  rows: number;
  modulesPerRow: number;
  widthMm: number;
  heightMm: number;
  installation?: string | null;
  material?: string | null;
}

export type EnclosureLook = "plastic-smoked" | "plastic-green" | "steel-door" | "steel-glass" | "flush-frame";

/** Vzhled renderu podle řady, montáže a materiálu skříně. */
export function enclosureLook(enclosure: Pick<EnclosureVisualInput, "manufacturer" | "series" | "model" | "installation" | "material">): EnclosureLook {
  const key = `${enclosure.manufacturer} ${enclosure.series ?? ""} ${enclosure.model}`.toLowerCase();
  const flush = enclosure.installation === "FLUSH" || /\bcu\d|\bklv|volta.*(flush|zapušt)|vector|\brza|\brzg|zapušt/.test(key);
  if (flush) return "flush-frame";
  if (/mistral65|mistral 65|mistral.*65/.test(key)) return "plastic-green";
  if (/mistral|golf|volta|kaedra|pragma|mini|plastic/.test(key) || enclosure.material === "PLASTIC") return "plastic-smoked";
  if (/glass|prosklen|transparent|\bca\d+v|\bca\d+.*v\b/.test(key)) return "steel-glass";
  return "steel-door";
}

const COLORS: Record<EnclosureLook, { body: string; edge: string; door: string; doorOpacity: number; frame?: string }> = {
  "plastic-smoked": { body: "#f8fafc", edge: "#cbd5e1", door: "#334155", doorOpacity: 0.28 },
  "plastic-green": { body: "#f8fafc", edge: "#cbd5e1", door: "#166534", doorOpacity: 0.26 },
  "steel-door": { body: "#e5e7eb", edge: "#9ca3af", door: "#f3f4f6", doorOpacity: 1 },
  "steel-glass": { body: "#e5e7eb", edge: "#9ca3af", door: "#94a3b8", doorOpacity: 0.3 },
  "flush-frame": { body: "#f1f5f9", edge: "#94a3b8", door: "#f8fafc", doorOpacity: 1, frame: "#9ca3af" },
};

/** Vektorový render konkrétní řady (poměr stran podle rozměrů skříně, řady DIN lišt × moduly). */
export function EnclosureRender({ enclosure, className, label }: { enclosure: EnclosureVisualInput; className?: string; label?: string }) {
  const look = enclosureLook(enclosure);
  const color = COLORS[look];
  const ratio = enclosure.widthMm > 0 && enclosure.heightMm > 0 ? Math.min(1.6, Math.max(0.45, enclosure.widthMm / enclosure.heightMm)) : 0.8;
  const height = 150;
  const width = Math.round(height * ratio);
  const frame = look === "flush-frame" ? 9 : 0;
  const inner = { x: 6 + frame, y: 6 + frame, w: width - 12 - frame * 2, h: height - 12 - frame * 2 };
  const rows = Math.max(1, Math.min(8, enclosure.rows));
  const rowGap = inner.h / (rows + 1);
  const transparent = color.doorOpacity < 1;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("h-28 w-auto shrink-0", className)} role="img" aria-label={label ?? `Náhled skříně ${enclosure.manufacturer} ${enclosure.model}`} data-testid="enclosure-render" data-look={look}>
      <defs>
        <linearGradient id={`shade-${look}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      {/* Kovový rám zapuštěné rozvodnice */}
      {frame ? <rect x={1} y={1} width={width - 2} height={height - 2} rx={4} fill={color.frame} stroke="#6b7280" strokeWidth={1} /> : null}
      <rect x={4 + frame} y={4 + frame} width={width - 8 - frame * 2} height={height - 8 - frame * 2} rx={look.startsWith("plastic") ? 9 : 4} fill={color.body} stroke={color.edge} strokeWidth={1.5} />
      {/* DIN lišty s přístroji (vidět přes průhledná dvířka, u plných dveří jen náznak spáry) */}
      {transparent
        ? Array.from({ length: rows }, (_, row) => {
            const y = inner.y + rowGap * (row + 1);
            const modules = Math.max(4, Math.min(24, enclosure.modulesPerRow));
            const step = (inner.w - 10) / modules;
            return (
              <g key={row}>
                <rect x={inner.x + 3} y={y - 2} width={inner.w - 6} height={4} fill="#9ca3af" />
                {Array.from({ length: Math.round(modules * 0.7) }, (_, module) => (
                  <rect key={module} x={inner.x + 5 + module * step} y={y - 9} width={Math.max(1.5, step - 1)} height={18} rx={1} fill={module % 5 === 0 ? "#e5e7eb" : "#f9fafb"} stroke="#d1d5db" strokeWidth={0.5} />
                ))}
              </g>
            );
          })
        : null}
      {/* Dvířka / dveře */}
      <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} rx={look.startsWith("plastic") ? 7 : 2} fill={color.door} fillOpacity={color.doorOpacity} stroke={color.edge} strokeWidth={1} />
      <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} rx={look.startsWith("plastic") ? 7 : 2} fill={`url(#shade-${look})`} />
      {/* Klika / zámek */}
      {look.startsWith("steel") || look === "flush-frame" ? <rect x={inner.x + inner.w - 8} y={inner.y + inner.h / 2 - 9} width={3.5} height={18} rx={1.5} fill="#4b5563" /> : <rect x={inner.x + inner.w / 2 - 9} y={inner.y + inner.h - 7} width={18} height={3} rx={1.5} fill="#94a3b8" />}
      {/* Větrací štěrbiny ocelové skříně */}
      {look === "steel-door" ? Array.from({ length: 4 }, (_, index) => <rect key={index} x={inner.x + 8} y={inner.y + inner.h - 14 + index * 3} width={inner.w * 0.35} height={1.2} fill="#9ca3af" />) : null}
    </svg>
  );
}

/** Fotka výrobce, nebo render řady (fotku dohledá server; serverová stránka ji může předat přes `image`). */
export function EnclosureVisual({ enclosure, className, image: given }: { enclosure: EnclosureVisualInput; className?: string; image?: { src: string; source: string; license: string } | null }) {
  const found = useCatalogImage("enclosure", given === undefined ? enclosure.articleNumber : null);
  const image = given === undefined ? found : given;
  const render = <EnclosureRender enclosure={enclosure} className={className} />;
  if (!image) {
    return (
      <span className="block shrink-0 rounded-lg bg-white p-1" data-testid="enclosure-visual" data-visual="render">
        {render}
      </span>
    );
  }
  return (
    <figure className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg bg-white p-1" data-testid="enclosure-visual" data-visual="photo" data-src={image.src} title={`${image.source} · ${image.license}`}>
      <FallbackImg src={image.src} alt={`Fotka rozvodnice ${enclosure.manufacturer} ${enclosure.model}`} className={cn("h-28 w-auto object-contain", className)} fallback={render} />
    </figure>
  );
}
