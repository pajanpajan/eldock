import type { ReactNode } from "react";

import type { InstallLevel } from "@/engine/floorplan-bridge";
import type { PaletteItem } from "@/lib/panel-builder/floorplan-editor";

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
}: {
  item: PaletteItem;
  size: number;
  active: boolean;
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
  return (
    <g data-symbol={parts.kind}>
      {/* Neviditelná plocha pro snadné kliknutí */}
      <circle cx={0} cy={0} r={size * 0.75} fill="transparent" />
      <g transform={rotation ? `rotate(${rotation})` : undefined}>
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

interface Parts {
  kind: string;
  paths: string[];
  circles: { cx: number; cy: number; r: number; fill?: boolean }[];
  fills: string[];
  texts: { x: number; y: number; size: number; value: string }[];
  label: string | null;
}

const f = (value: number) => Math.round(value * 10) / 10;

/** Čára spínače z kroužku pod úhlem `angle` (° od vodorovné, proti směru hodin) s praporkem ven. */
function lever(radius: number, length: number, flag: number, angle: number, extra: (end: { x: number; y: number }, dir: { x: number; y: number }, out: { x: number; y: number }) => string = () => ""): string {
  const rad = (angle * Math.PI) / 180;
  const dir = { x: Math.cos(rad), y: -Math.sin(rad) };
  const start = { x: dir.x * radius, y: dir.y * radius };
  const end = { x: dir.x * (radius + length), y: dir.y * (radius + length) };
  // Praporek: od konce čáry „ven“ a zpět k místnosti (≈ 110° od čáry), u levých čar zrcadlově
  const side = dir.x >= 0 ? 1 : -1;
  const vertical = dir.y <= 0 ? 1 : -1;
  const out = { x: side * 0.64, y: vertical * 0.77 };
  return `M${f(start.x)} ${f(start.y)} L${f(end.x)} ${f(end.y)} l${f(out.x * flag)} ${f(out.y * flag)}${extra(end, dir, out)}`;
}

export function symbolParts(item: PaletteItem, size: number, options: { switchNo?: string; level?: InstallLevel } = {}): Parts {
  const parts: Parts = { kind: "appliance", paths: [], circles: [], fills: [], texts: [], label: null };
  const R = size * 0.3;
  const L = size * 0.28;

  // --- Zásuvky (oblouk s nožičkou ke stěně v -y, ochranný kontakt) ---
  if (item.kind === "single_socket" || item.kind === "double_socket") {
    parts.kind = "socket";
    // Nožička od stěny (0,0) k vrcholu oblouku, oblouk otevřený do místnosti
    parts.paths.push(`M0 0 V${f(L)}`, `M${f(-R)} ${f(L + R)} A${f(R)} ${f(R)} 0 0 1 ${f(R)} ${f(L + R)}`);
    // Ochranný kontakt (ČSN: zásuvky vždy s kolíkem PE)
    parts.paths.push(`M${f(-R)} ${f(L)} H${f(R)}`);
    if (item.kind === "double_socket") {
      // Vícenásobná zásuvka: šikmá čárka s počtem vývodů
      parts.paths.push(`M${f(R * 0.35)} ${f(L + R * 0.9)} L${f(R * 1.05)} ${f(L + R * 0.2)}`);
      parts.texts.push({ x: R * 1.45, y: L + R * 0.2, size: size * 0.26, value: "2" });
    }
    parts.label = item.variant === "ip44" ? "IP44" : item.variant === "worktop" ? "+1150" : null;
    return parts;
  }
  if (item.kind === "data_socket") {
    parts.kind = "socket";
    parts.paths.push(`M0 0 V${f(L)}`, `M${f(-R)} ${f(L + R * 0.8)} V${f(L)} H${f(R)} V${f(L + R * 0.8)}`);
    parts.label = "RJ45";
    return parts;
  }

  // --- Svítidla ---
  if (item.kind === "light") {
    parts.kind = "light";
    const r = size * 0.26;
    const cy = item.variant === "wall" ? L + r : 0;
    if (item.variant === "wall") parts.paths.push(`M0 0 V${f(L)}`, `M${f(-r)} 0 H${f(r)}`);
    parts.circles.push({ cx: 0, cy, r });
    const d = r * 0.7071;
    parts.paths.push(`M${f(-d)} ${f(cy - d)} L${f(d)} ${f(cy + d)} M${f(d)} ${f(cy - d)} L${f(-d)} ${f(cy + d)}`);
    return parts;
  }

  // --- Ovládání ---
  if (item.kind === "switch") {
    parts.kind = "switch";
    const c = size * 0.14;
    const length = size * 0.42;
    const flag = size * 0.16;
    const cross = (radius: number) => {
      const d = radius * 0.7071;
      parts.paths.push(`M${f(-d)} ${f(-d)} L${f(d)} ${f(d)} M${f(d)} ${f(-d)} L${f(-d)} ${f(d)}`);
    };
    const radio = () => parts.paths.push(`M${f(c * 1.6)} ${f(-c * 1.6)} a${f(c * 1.2)} ${f(c * 1.2)} 0 0 1 ${f(c * 0.9)} ${f(c * 0.9)}`, `M${f(c * 1.9)} ${f(-c * 2.4)} a${f(c * 2)} ${f(c * 2)} 0 0 1 ${f(c * 1.6)} ${f(c * 1.6)}`);

    if (item.bus) {
      // Sběrnicový prvek: rámeček „sběrnice“ + vnitřní značka podle role
      parts.kind = "bus";
      const box = size * 0.3;
      parts.paths.push(`M${f(-box)} ${f(-box)} H${f(box)} V${f(box)} H${f(-box)} Z`);
      if (item.bus.role === "button" || item.bus.role === "blind") {
        parts.circles.push({ cx: 0, cy: 0, r: c * 1.2 }, { cx: 0, cy: 0, r: c * 0.6 });
        if (item.bus.role === "blind") parts.paths.push(`M${f(-c * 0.35)} ${f(-c * 1.6)} L0 ${f(-c * 2)} L${f(c * 0.35)} ${f(-c * 1.6)} M${f(-c * 0.35)} ${f(c * 1.6)} L0 ${f(c * 2)} L${f(c * 0.35)} ${f(c * 1.6)}`);
        parts.label = item.bus.role === "blind" ? "BUS ↕" : `BUS ${item.bus.channels}×`;
      } else if (item.bus.role === "presence") {
        parts.paths.push(`M${f(-c * 1.3)} ${f(c * 0.6)} A${f(c * 1.3)} ${f(c * 1.3)} 0 0 1 ${f(c * 1.3)} ${f(c * 0.6)} Z`, `M${f(-c * 1.9)} ${f(-c * 0.6)} a${f(c * 2)} ${f(c * 2)} 0 0 1 ${f(c * 3.8)} 0`);
        parts.label = "BUS DP";
      } else {
        parts.texts.push({ x: 0, y: 0, size: size * 0.2, value: item.bus.role === "room_unit" ? "t°" : item.bus.role === "sensor" ? "θ %" : "▭" });
        parts.label = item.bus.role === "room_unit" ? "BUS PJ" : item.bus.role === "sensor" ? "BUS ČT" : "BUS DTP";
      }
      return parts;
    }

    if (item.wireless) {
      parts.kind = "wireless";
      if (item.variant === "button") parts.circles.push({ cx: 0, cy: 0, r: c }, { cx: 0, cy: 0, r: c * 0.5 });
      else parts.paths.push(`M${f(-c * 1.2)} ${f(c * 0.5)} A${f(c * 1.2)} ${f(c * 1.2)} 0 0 1 ${f(c * 1.2)} ${f(c * 0.5)} Z`);
      radio();
      parts.label = item.id === "wireless-2" ? "2× bez kabelu" : "bez kabelu";
      return parts;
    }

    const no = (options.switchNo ?? item.fixedSwitchNo ?? item.switchNo ?? "1").replace(/S+o?$/, "");
    const led = Boolean(item.led);
    if (item.control === "thermostat") {
      parts.circles.push({ cx: 0, cy: 0, r: c * 1.3 });
      parts.texts.push({ x: 0, y: 0, size: size * 0.2, value: "t°" });
      parts.label = "TER";
    } else if (item.wiringCategory === "WD_SENSOR") {
      // Pohybové čidlo: kryt s detekčním polem
      parts.paths.push(`M${f(-c * 1.3)} ${f(c * 0.6)} A${f(c * 1.3)} ${f(c * 1.3)} 0 0 1 ${f(c * 1.3)} ${f(c * 0.6)} Z`, `M${f(-c * 1.9)} ${f(-c * 0.6)} a${f(c * 2)} ${f(c * 2)} 0 0 1 ${f(c * 3.8)} 0`);
      parts.label = "PIR";
    } else if (item.control === "blind") {
      parts.circles.push({ cx: 0, cy: 0, r: c });
      parts.paths.push(lever(c, length, flag, 70), lever(c, length, flag, 250));
      parts.paths.push(`M${f(-c * 0.4)} ${f(-c * 0.1)} L0 ${f(-c * 0.55)} L${f(c * 0.4)} ${f(-c * 0.1)} M${f(-c * 0.4)} ${f(c * 0.1)} L0 ${f(c * 0.55)} L${f(c * 0.4)} ${f(c * 0.1)}`);
      parts.label = "ŽAL";
    } else if (item.variant === "button") {
      // Tlačítko: soustředné kroužky, se signální doutnavkou křížek
      parts.circles.push({ cx: 0, cy: 0, r: c }, { cx: 0, cy: 0, r: c * 0.55 });
      if (led) cross(c * 0.55);
      parts.label = no === "1/0+1/0" ? "2× tlačítko" : "tlačítko";
    } else if (item.wiringCategory === "WD_DIMMER") {
      parts.circles.push({ cx: 0, cy: 0, r: c });
      // Stmívač: čára spínače zakončená klínkem
      const rad = (70 * Math.PI) / 180;
      const end = { x: Math.cos(rad) * (c + length), y: -Math.sin(rad) * (c + length) };
      parts.paths.push(`M${f(Math.cos(rad) * c)} ${f(-Math.sin(rad) * c)} L${f(end.x)} ${f(end.y)}`);
      parts.fills.push(`M${f(end.x)} ${f(end.y)} L${f(end.x + flag * 0.9)} ${f(end.y + flag * 0.15)} L${f(end.x + flag * 0.25)} ${f(end.y + flag * 0.85)} Z`);
      parts.label = "STM";
    } else {
      parts.circles.push({ cx: 0, cy: 0, r: c });
      if (led) cross(c);
      // Řazení dle ČSN: 1 = jedna čára, 5 / 1+1 = dvě čáry do V, 6 = na obě strany, 7 a 6+6 = čtyři čáry
      const angles = no.startsWith("7") || no.startsWith("6+6") ? [70, 110, 250, 290] : no.startsWith("6") ? [70, 250] : no.startsWith("5") || no.startsWith("1+1") ? [70, 110] : [70];
      for (const angle of angles) parts.paths.push(lever(c, length, flag, angle));
      parts.label = `${options.switchNo ?? item.fixedSwitchNo ?? item.switchNo ?? "1"}${item.ip44 ? " IP44" : ""}`;
    }
    // Hybridní retrofit: modul pod vypínač (štítek M)
    if (options.level === "smart_retrofit" && (item.control ?? "light") === "light") {
      const m = c * 0.9;
      parts.paths.push(`M${f(c * 0.9)} ${f(c * 0.9)} h${f(m)} v${f(m)} h${f(-m)} Z`);
      parts.texts.push({ x: c * 0.9 + m / 2, y: c * 0.9 + m / 2, size: m * 0.85, value: "M" });
    }
    return parts;
  }

  // --- Spotřebiče: vývod se zkratkou, bojler = ohřívač vody (kruh se šrafou) ---
  const box = size * 0.32;
  if (item.tag === "boiler") {
    parts.circles.push({ cx: 0, cy: 0, r: box });
    for (const dx of [-0.5, 0, 0.5]) parts.paths.push(`M${f(dx * box)} ${f(-Math.sqrt(1 - dx * dx) * box)} V${f(Math.sqrt(1 - dx * dx) * box)}`);
    parts.label = item.symbol;
    return parts;
  }
  parts.paths.push(`M${f(-box)} ${f(-box)} H${f(box)} V${f(box)} H${f(-box)} Z`);
  parts.texts.push({ x: 0, y: 0, size: size * (item.symbol.length > 2 ? 0.2 : 0.28), value: item.symbol });
  return parts;
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
