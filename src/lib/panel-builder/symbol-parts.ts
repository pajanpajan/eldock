// Fáze 57 / 63: tvar značek 2D půdorysu podle ČSN EN 60617-11 jako čisté cesty SVG (bez Reactu) – kreslí je plátno
// editoru (`FloorSymbol`), tiskový výkres i export DXF (`dxf-export.ts`). Počátek (0, 0) = bod u stěny / střed přístroje.

import type { InstallLevel } from "@/engine/floorplan-bridge";

import type { PaletteItem } from "./floorplan-editor";
import { FIXTURES } from "./fixtures";
export interface SymbolParts {
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

export function symbolParts(item: PaletteItem, size: number, options: { switchNo?: string; level?: InstallLevel } = {}): SymbolParts {
  const parts: SymbolParts = { kind: "appliance", paths: [], circles: [], fills: [], texts: [], label: null };
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

  // --- Fáze 61: zařizovací předměty – vana / sprchový kout ve skutečné velikosti (zóny 0–2 koupelny) ---
  if (item.kind === "fixture") {
    parts.kind = "fixture";
    const spec = FIXTURES[item.id];
    const size = spec ? { w: spec.w, h: spec.d } : { w: 900, h: 900 };
    const w = size.w / 2;
    const h = size.h / 2;
    parts.paths.push(`M${f(-w)} ${f(-h)} H${f(w)} V${f(h)} H${f(-w)} Z`);
    const r = h - 80;
    if (item.id === "bath") parts.paths.push(`M${f(-w + 80)} ${f(-r)} H${f(w - 80 - r)} A${f(r)} ${f(r)} 0 0 1 ${f(w - 80 - r)} ${f(r)} H${f(-w + 80)} Z`);
    else parts.paths.push(`M${f(-w)} ${f(-h)} L${f(w)} ${f(h)} M${f(w)} ${f(-h)} L${f(-w)} ${f(h)}`);
    parts.circles.push({ cx: item.id === "bath" ? -w + 220 : 0, cy: 0, r: 45 });
    parts.label = item.id === "bath" ? "vana · zóna 2 = +0,6 m" : "sprcha · zóna 2 = +0,6 m";
    return parts;
  }

  // --- Fáze 59: stoupací vedení (průchod kabelů mezi podlažími) – kroužek se šipkami nahoru / dolů ---
  if (item.kind === "riser") {
    parts.kind = "riser";
    const r = size * 0.32;
    parts.circles.push({ cx: 0, cy: 0, r });
    parts.paths.push(`M0 ${f(r * 0.7)} V${f(-r * 0.7)}`, `M${f(-r * 0.35)} ${f(-r * 0.35)} L0 ${f(-r * 0.7)} L${f(r * 0.35)} ${f(-r * 0.35)}`, `M${f(-r * 0.35)} ${f(r * 0.35)} L0 ${f(r * 0.7)} L${f(r * 0.35)} ${f(r * 0.35)}`);
    parts.label = "stoupačka";
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
