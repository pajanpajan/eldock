import type { ReactNode } from "react";

import type { InstallLevel } from "@/engine/floorplan-bridge";
import type { PaletteItem } from "@/lib/panel-builder/floorplan-editor";
import { FIXTURES, ZONE2_MM } from "@/lib/panel-builder/fixtures";
import { SYMBOL_PLATE, SYMBOL_PLATE_PX, SYMBOL_STROKE_FACTOR, MIN_SYMBOL_STROKE_PX } from "@/lib/panel-builder/symbol-colors";
import { symbolParts } from "@/lib/panel-builder/symbol-parts";

export { symbolParts };

/**
 * Fáze 57: značky do půdorysu podle ČSN EN 60617-11 (instalační plány budov) místo vyplněných tvarů:
 * – zásuvka 11-13-01: oblouk otevřený do místnosti s „nožičkou“ ke stěně, s ochranným kontaktem 11-13-04 vodorovná
 *   čára přes vrchol oblouku, vícenásobná zásuvka = šikmá čárka s počtem, sdělovací zásuvka 11-13-09 (RJ45),
 * – spínač 11-14: kroužek s šikmou čarou zakončenou praporkem – řazení 1 jedna čára, 5 dvě čáry do V, 6 čáry na obě
 *   strany, 7 (a 6+6) čtyři čáry, se signální doutnavkou kroužek s křížkem, stmívač klínek, tlačítko soustředné kroužky,
 * – svítidlo ⊗ (nástěnné s nožičkou ke stěně), spotřebiče jako vývod se zkratkou, rozváděč obdélník s polovinou vyplněnou.
 * Sběrnicové prvky se kreslí v rámečku (prvek na sběrnici 24 V DC), bezdrátové s vlnkami, chytrý modul štítkem „M“.
 * Počátek (0, 0) = bod u stěny (zásuvky, nástěnná svítidla) nebo střed přístroje; kreslí se v mm plánu, `size` je
 * velikost značky. Popisek (řazení, IP44 …) se neotáčí se značkou.
 */
export function FloorSymbol({
  item,
  size,
  active,
  onPaper,
  rotation = 0,
  switchNo,
  level = "classic",
  lem,
  hitSlot = null,
  plate = false,
  ink: inkOverride = null,
  uniform = false,
  mmPerPx = 0,
}: {
  item: PaletteItem;
  size: number;
  active: boolean;
  /**
   * Fáze 62: přístroj ve víceramečku – klikací plocha jen na jeho pozici v rámečku (délka v ose rámečku), aby se
   * přisazení sousedé nepřekrývali; kresba značky pak kliky nezachytává.
   */
  hitSlot?: { length: number; horizontal: boolean } | null;
  /** Podklad (bílý výkres) → černá kresba; čistý rastr (tmavý) → světlá kresba. */
  onPaper: boolean;
  rotation?: number;
  /** Skutečné řazení z párování (č. 1 / 6 / 7 …). */
  switchNo?: string;
  level?: InstallLevel;
  /** Barva domovních přístrojů (fáze 51) – tečka u popisku. */
  lem?: string | null;
  /**
   * Fáze 100: podkladový štítek na plátně – silnější obrys značky v barvě podkladu (zakryje čáru stěny pod značkou,
   * kroužky vyplní) a popisek světle na tmavém obrysu (`paint-order: stroke`). Tiskový výkres ho nemá.
   */
  plate?: boolean;
  /** Fáze 109: barva značky z přepínače „🎨 Barva značek“ (dle typu / kontrolní). */
  ink?: string | null;
  /** Fáze 109: jednotná kontrolní barva (červená, žlutá, cyan, vlastní) – přebije i zelenou nouzového svítidla. */
  uniform?: boolean;
  /** Fáze 109: mm plánu na 1 px obrazovky – minimální tloušťka čar a štítku na plátně. */
  mmPerPx?: number;
}) {
  const parts = symbolParts(item, size, { switchNo, level });
  // Fáze 93: nouzové únikové svítidlo zelenou kresbou; fáze 109: barva z přepínače, kontrolní barva přebije vše
  const ink = (uniform ? inkOverride : null) ?? parts.color ?? inkOverride ?? (onPaper ? "#111827" : "#f4f4f5");
  const halo = active ? "#facc15" : onPaper ? "rgba(255,255,255,0.9)" : plate ? SYMBOL_PLATE : "rgba(9,9,11,0.85)";
  // Fáze 109: na plátně o 35 % silnější čáry, na obrazovce aspoň 2,4 px (tiskový výkres beze změny)
  const w = plate ? Math.max((size / 22) * SYMBOL_STROKE_FACTOR, MIN_SYMBOL_STROKE_PX * mmPerPx) : size / 22;
  const draw = (stroke: string, width: number, key: string, wipe = false) => (
    <g key={key} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {parts.paths.map((d, index) => (
        <path key={index} d={d} />
      ))}
      {parts.circles.map((circle, index) => (
        <circle key={`c${index}`} cx={circle.cx} cy={circle.cy} r={circle.r} fill={circle.fill || wipe ? stroke : "none"} />
      ))}
    </g>
  );
  // Fáze 100: štítek pod značkou – obrys 4,5× (vybraná 5,5×) tloušťky čáry, vnitřek kroužků zakrytý; fáze 109: aspoň 4,5 px
  const haloWidth = Math.max(w * (plate ? (active ? 5.5 : 4.5) : active ? 4.5 : 3.2), plate ? SYMBOL_PLATE_PX * mmPerPx * 2 : 0);
  const labelText = parts.label;
  const font = size * 0.3;
  const spec = item.kind === "fixture" ? (FIXTURES[item.id] ?? null) : null;
  const fixture = spec ? { w: spec.w, h: spec.d } : null;
  return (
    <g data-symbol={parts.kind}>
      {/* Neviditelná plocha pro snadné kliknutí; u vany / sprchy celý obdélník a zóna 2 (0,6 m) čárkovaně */}
      {fixture ? (
        <g transform={rotation ? `rotate(${rotation})` : undefined}>
          {/* Fáze 90: zóna 2 jen u vany a sprchy (okna, dveře a nábytek zóny nemají) */}
          {spec?.zone === "bath" ? <rect x={-fixture.w / 2 - ZONE2_MM} y={-fixture.h / 2 - ZONE2_MM} width={fixture.w + ZONE2_MM * 2} height={fixture.h + ZONE2_MM * 2} rx={ZONE2_MM} fill="rgba(56,189,248,0.06)" stroke="#38bdf8" strokeOpacity={0.6} strokeWidth={w * 0.8} strokeDasharray={`${w * 4} ${w * 3}`} pointerEvents="none" /> : null}
          <rect x={-fixture.w / 2} y={-fixture.h / 2} width={fixture.w} height={fixture.h} fill="rgba(56,189,248,0.12)" />
        </g>
      ) : hitSlot ? (
        // Fáze 63: pozice v rámečku v ose značky (i u šikmé stěny)
        <rect x={-hitSlot.length / 2} y={-size * 0.75} width={hitSlot.length} height={size * 1.5} fill="transparent" transform={rotation ? `rotate(${rotation % 180})` : undefined} data-testid="frame-slot" />
      ) : (
        <circle cx={0} cy={0} r={size * 0.75} fill="transparent" />
      )}
      <g transform={rotation ? `rotate(${rotation})` : undefined} pointerEvents={hitSlot ? "none" : undefined}>
        {draw(halo, haloWidth, "halo", plate && !active)}
        {parts.fills.map((fill, index) => (
          <path key={`F${index}`} d={fill} fill={ink} stroke="none" />
        ))}
        {draw(ink, w, "ink")}
        {parts.texts.map((text, index) => (
          <text key={`t${index}`} x={text.x} y={text.y} fontSize={text.size} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={ink} stroke="none" transform={rotation ? `rotate(${-rotation} ${text.x} ${text.y})` : undefined}>
            {text.value}
          </text>
        ))}
      </g>
      {labelText ? (
        <g pointerEvents="none">
          <text
            x={size * 0.62}
            y={-size * 0.5}
            fontSize={font}
            fontWeight={800}
            fill={plate ? (uniform ? ink : "#f8fafc") : ink}
            stroke={plate ? SYMBOL_PLATE : onPaper ? "#fff" : "#09090b"}
            strokeWidth={plate ? Math.max(font * 0.32, SYMBOL_PLATE_PX * mmPerPx) : w * 1.4}
            strokeLinejoin="round"
            paintOrder="stroke"
            data-testid={plate ? "symbol-label" : undefined}
          >
            {labelText}
          </text>
          {lem ? <circle cx={size * 0.5} cy={-size * 0.6} r={size * 0.07} fill={lem} stroke={ink} strokeWidth={w * 0.5} /> : null}
        </g>
      ) : null}
    </g>
  );
}

/** Rozváděč: obdélník s vyplněnou polovinou (úhlopříčka) a označením. */
export function PanelSymbol({ size, active, onPaper, label, ink: inkOverride = null }: { size: number; active: boolean; onPaper: boolean; label: string; ink?: string | null }): ReactNode {
  // Fáze 109: barva rozváděče z přepínače „🎨 Barva značek“
  const ink = inkOverride ?? (onPaper ? "#111827" : "#f4f4f5");
  const w = size * 0.6;
  const h = size * 0.35;
  return (
    <g data-symbol="panel">
      <rect x={-w} y={-h} width={w * 2} height={h * 2} fill={onPaper ? "#fff" : "#18181b"} stroke={active ? "#facc15" : ink} strokeWidth={size / (active ? 9 : 16)} />
      <path d={`M${-w} ${h} L${w} ${-h} L${w} ${h} Z`} fill={ink} />
      <text x={-w * 0.55} y={-h * 0.38} fontSize={size * 0.24} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={ink}>
        {label}
      </text>
    </g>
  );
}

/** Fáze 77: barvy štítků svítidla – stmívání, CCT, barva, technologie řízení. */
const BADGE_FILL: Record<string, string> = { DIM: "#a16207", CCT: "#0369a1", RGB: "#a21caf", RGBW: "#a21caf", DALI: "#15803d", "24V": "#0f766e" };

/** Fáze 77: štítky DIM / CCT / RGB(W) / DALI / 24V pod značkou svítidla (neotáčí se se značkou). */
export function LightBadges({ badges, size }: { badges: readonly string[]; size: number }): ReactNode {
  if (!badges.length) return null;
  const font = size * 0.2;
  const pad = font * 0.35;
  const widths = badges.map((badge) => badge.length * font * 0.68 + pad * 2);
  // Štítky vedle sebe zleva od značky (pozice = součet šířek předchozích)
  const lefts = widths.map((_, index) => -size * 0.55 + widths.slice(0, index).reduce((sum, width) => sum + width + font * 0.25, 0));
  return (
    <g pointerEvents="none" data-testid="light-badges" data-badges={badges.join(" ")}>
      {badges.map((badge, index) => {
        const width = widths[index];
        return (
          <g key={badge} transform={`translate(${lefts[index]} ${size * 0.52})`}>
            <rect width={width} height={font * 1.35} rx={font * 0.3} fill={BADGE_FILL[badge] ?? "#3f3f46"} />
            <text x={width / 2} y={font * 0.7} fontSize={font} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill="#fafafa">
              {badge}
            </text>
          </g>
        );
      })}
    </g>
  );
}
