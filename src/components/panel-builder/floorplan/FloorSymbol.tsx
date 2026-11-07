import type { ReactNode } from "react";

import type { InstallLevel } from "@/engine/floorplan-bridge";
import type { PaletteItem } from "@/lib/panel-builder/floorplan-editor";
import { FIXTURES, ZONE2_MM } from "@/lib/panel-builder/fixtures";
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
}) {
  const ink = onPaper ? "#111827" : "#f4f4f5";
  const halo = active ? "#facc15" : onPaper ? "rgba(255,255,255,0.9)" : "rgba(9,9,11,0.85)";
  const w = size / 22;
  const parts = symbolParts(item, size, { switchNo, level });
  const draw = (stroke: string, width: number, key: string) => (
    <g key={key} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {parts.paths.map((d, index) => (
        <path key={index} d={d} />
      ))}
      {parts.circles.map((circle, index) => (
        <circle key={`c${index}`} cx={circle.cx} cy={circle.cy} r={circle.r} fill={circle.fill ? stroke : "none"} />
      ))}
    </g>
  );
  const labelText = parts.label;
  const font = size * 0.3;
  const spec = item.kind === "fixture" ? (FIXTURES[item.id] ?? null) : null;
  const fixture = spec ? { w: spec.w, h: spec.d } : null;
  return (
    <g data-symbol={parts.kind}>
      {/* Neviditelná plocha pro snadné kliknutí; u vany / sprchy celý obdélník a zóna 2 (0,6 m) čárkovaně */}
      {fixture ? (
        <g transform={rotation ? `rotate(${rotation})` : undefined}>
          <rect x={-fixture.w / 2 - ZONE2_MM} y={-fixture.h / 2 - ZONE2_MM} width={fixture.w + ZONE2_MM * 2} height={fixture.h + ZONE2_MM * 2} rx={ZONE2_MM} fill="rgba(56,189,248,0.06)" stroke="#38bdf8" strokeOpacity={0.6} strokeWidth={w * 0.8} strokeDasharray={`${w * 4} ${w * 3}`} pointerEvents="none" />
          <rect x={-fixture.w / 2} y={-fixture.h / 2} width={fixture.w} height={fixture.h} fill="rgba(56,189,248,0.12)" />
        </g>
      ) : hitSlot ? (
        // Fáze 63: pozice v rámečku v ose značky (i u šikmé stěny)
        <rect x={-hitSlot.length / 2} y={-size * 0.75} width={hitSlot.length} height={size * 1.5} fill="transparent" transform={rotation ? `rotate(${rotation % 180})` : undefined} data-testid="frame-slot" />
      ) : (
        <circle cx={0} cy={0} r={size * 0.75} fill="transparent" />
      )}
      <g transform={rotation ? `rotate(${rotation})` : undefined} pointerEvents={hitSlot ? "none" : undefined}>
        {draw(halo, w * (active ? 4.5 : 3.2), "halo")}
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
          <text x={size * 0.62} y={-size * 0.5} fontSize={font} fontWeight={800} fill={ink} stroke={onPaper ? "#fff" : "#09090b"} strokeWidth={w * 1.4} paintOrder="stroke">
            {labelText}
          </text>
          {lem ? <circle cx={size * 0.5} cy={-size * 0.6} r={size * 0.07} fill={lem} stroke={ink} strokeWidth={w * 0.5} /> : null}
        </g>
      ) : null}
    </g>
  );
}

/** Rozváděč: obdélník s vyplněnou polovinou (úhlopříčka) a označením. */
export function PanelSymbol({ size, active, onPaper, label }: { size: number; active: boolean; onPaper: boolean; label: string }): ReactNode {
  const ink = onPaper ? "#111827" : "#f4f4f5";
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
