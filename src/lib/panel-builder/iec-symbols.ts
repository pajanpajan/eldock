// Fáze 58: značky modulárních přístrojů pro jednopólové schéma (SVG řetězce, čisté funkce) podle ČSN EN 60617.
// Tvary ověřené proti galerii ProfiCAD (značky s čísly EN 60617-7): spínací kontakt se značkou funkce na pevném
// kontaktu – jistič křížek, odpojovač čárka, odpínač čárka + kroužek, stykač půlkroužek; jistič s tepelnou
// a elektromagnetickou spouští v sérii, chránič se spouští IΔ a součtovým transformátorem (toroid), cívky relé
// s kvalifikátory (s mechanickým přidržením, zpožděný přítah / odpad), měřicí relé, elektroměr Wh, měnič AC/DC,
// transformátor, svorka a svodič přepětí jako napěťově závislý rezistor (varistor) s uzemněním.

import type { ComponentCategory } from "@/generated/prisma/enums";

export type SymbolKind =
  | "MCB"
  | "RCD"
  | "RCBO"
  | "SWITCH_DISCONNECTOR"
  | "DISCONNECTOR"
  | "FUSE_DISCONNECTOR"
  | "SPD"
  | "CONTACTOR"
  | "RELAY"
  | "RELAY_IMPULSE"
  | "RELAY_TIMER"
  | "RELAY_STAIRCASE"
  | "RELAY_MONITORING"
  | "RELAY_LEVEL"
  | "RELAY_THERMOSTAT"
  | "PSU"
  | "TRANSFORMER"
  | "METER"
  | "TERMINAL"
  | "PLC"
  | "GENERIC";

export interface SymbolInfo {
  /** Český název značky. */
  label: string;
  /** Co značka v kresbě obsahuje (pro legendu a knihovnu značek). */
  description: string;
  /** Díl normy ČSN EN 60617, ze kterého značka vychází. */
  norm: string;
}

export const SYMBOLS: Record<SymbolKind, SymbolInfo> = {
  MCB: { label: "Jistič", description: "Spínací kontakt s funkcí jističe (křížek na pevném kontaktu), v sérii tepelná (nadproudová) a elektromagnetická (zkratová) spoušť.", norm: "ČSN EN 60617-7" },
  RCD: { label: "Proudový chránič", description: "Spínací kontakt ovládaný spouští reziduálního proudu IΔ (čárkovaná mechanická vazba) se součtovým transformátorem (toroid) na vodičích.", norm: "ČSN EN 60617-7" },
  RCBO: { label: "Jističochránič", description: "Jistič (křížek na pevném kontaktu) se spouští reziduálního proudu IΔ a součtovým transformátorem.", norm: "ČSN EN 60617-7" },
  SWITCH_DISCONNECTOR: { label: "Odpínač (hlavní vypínač)", description: "Spínací kontakt s funkcí odpojovače (čárka) a vypínače (kroužek) na pevném kontaktu – spíná i pod zatížením.", norm: "ČSN EN 60617-7" },
  DISCONNECTOR: { label: "Odpojovač", description: "Spínací kontakt s funkcí odpojovače (čárka na pevném kontaktu) – zajišťuje odpojovací vzdálenost.", norm: "ČSN EN 60617-7" },
  FUSE_DISCONNECTOR: { label: "Pojistkový odpojovač", description: "Pojistka v pohyblivém kontaktu (nože) s funkcí odpojovače (čárka) na pevném kontaktu.", norm: "ČSN EN 60617-7" },
  SPD: { label: "Přepěťová ochrana (svodič přepětí)", description: "Napěťově závislý rezistor (varistor) mezi vodičem a ochranným uzemněním.", norm: "ČSN EN 60617-4 a -2 (uzemnění)" },
  CONTACTOR: { label: "Stykač", description: "Hlavní spínací kontakt s funkcí stykače (půlkroužek na pevném kontaktu), cívka ovládá kontakt čárkovanou vazbou.", norm: "ČSN EN 60617-7" },
  RELAY: { label: "Relé (pomocné)", description: "Cívka relé – obecná značka – a spínací kontakt spojené čárkovanou mechanickou vazbou.", norm: "ČSN EN 60617-7" },
  RELAY_IMPULSE: { label: "Impulzní (paměťové) relé", description: "Cívka relé s mechanickým přidržením (trojúhelník v poli cívky) a spínací kontakt.", norm: "ČSN EN 60617-7" },
  RELAY_TIMER: { label: "Časové relé (zpožděný přítah)", description: "Cívka relé se zpožděným přítahem (křížek v poli cívky) a spínací kontakt.", norm: "ČSN EN 60617-7" },
  RELAY_STAIRCASE: { label: "Schodišťový automat (zpožděný odpad)", description: "Cívka relé se zpožděným odpadem (vyplněné pole cívky) a spínací kontakt.", norm: "ČSN EN 60617-7" },
  RELAY_MONITORING: { label: "Hlídací relé napětí", description: "Měřicí relé – obdélník s měřenou veličinou a směrem působení (U < >) – a spínací kontakt.", norm: "ČSN EN 60617-7" },
  RELAY_LEVEL: { label: "Hladinové relé", description: "Měřicí relé hladiny (obdélník s kvalifikátorem) a spínací kontakt.", norm: "ČSN EN 60617-7" },
  RELAY_THERMOSTAT: { label: "Termostat (teplotní relé)", description: "Měřicí relé teploty θ a spínací kontakt.", norm: "ČSN EN 60617-7" },
  PSU: { label: "Napájecí zdroj (měnič AC/DC)", description: "Měnič – obdélník s úhlopříčkou, střídavá (~) a stejnosměrná (=) strana.", norm: "ČSN EN 60617-6" },
  TRANSFORMER: { label: "Transformátor (zvonkový / ovládací)", description: "Transformátor se dvěma vinutími – dva překrývající se kruhy.", norm: "ČSN EN 60617-6" },
  METER: { label: "Elektroměr", description: "Měřicí přístroj integrační – elektroměr činné energie (Wh).", norm: "ČSN EN 60617-8" },
  TERMINAL: { label: "Svorka / svorkovnice", description: "Svorka – kroužek na vodiči.", norm: "ČSN EN 60617-3" },
  PLC: { label: "Programovatelný automat (PLC)", description: "Obecná značka přístroje (obdélník) s označením funkce.", norm: "ČSN EN 60617-2" },
  GENERIC: { label: "Jiný přístroj", description: "Obecná značka přístroje (obdélník) – přesný typ doplňte v katalogu.", norm: "ČSN EN 60617-2" },
};

export const SYMBOL_KINDS = Object.keys(SYMBOLS) as SymbolKind[];

export interface SymbolSource {
  category: ComponentCategory | null;
  relaySubtype?: string | null;
  moduleSubtype?: string | null;
  description?: string | null;
  typeCode?: string | null;
  series?: string | null;
}

/** Druh značky podle kategorie a podtypu přístroje z katalogu (neznámý přístroj = obecná značka, nikdy jistič). */
export function symbolKindOf(source: SymbolSource | null | undefined): SymbolKind {
  if (!source) return "GENERIC";
  const text = `${source.typeCode ?? ""} ${source.series ?? ""} ${source.description ?? ""}`;
  const subtype = source.moduleSubtype ?? "";
  if (subtype === "FUSE_DISCONNECTOR") return "FUSE_DISCONNECTOR";
  if (subtype === "METER") return "METER";
  if (subtype === "BELL_TRANSFORMER") return "TRANSFORMER";
  if (subtype === "MAIN_TERMINAL") return "TERMINAL";
  switch (source.category) {
    case "MCB":
      return "MCB";
    case "RCD":
      return "RCD";
    case "RCBO":
      return "RCBO";
    case "SPD":
      return "SPD";
    case "CONTACTOR":
      return "CONTACTOR";
    case "MAIN_SWITCH":
      if (/pojistkov|fuse/i.test(text)) return "FUSE_DISCONNECTOR";
      // Odpojovač jen výslovně (bez spínání pod zatížením); modulární hlavní vypínače jsou odpínače
      if (/odpojova|\bisolator\b|disconnector/i.test(text) && !/odpína|switch-disconnector|load/i.test(text)) return "DISCONNECTOR";
      return "SWITCH_DISCONNECTOR";
    case "RELAY":
      switch (source.relaySubtype) {
        case "IMPULSE":
          return "RELAY_IMPULSE";
        case "TIMER":
          return "RELAY_TIMER";
        case "STAIRCASE":
          return "RELAY_STAIRCASE";
        case "MONITORING":
          return "RELAY_MONITORING";
        case "LEVEL":
          return "RELAY_LEVEL";
        case "THERMOSTAT":
          return "RELAY_THERMOSTAT";
        default:
          return "RELAY";
      }
    case "PSU":
      return "PSU";
    case "PLC":
      return "PLC";
    case "TERMINAL":
      return "TERMINAL";
    default:
      return "GENERIC";
  }
}

const INK = "#111";
const f = (value: number) => Math.round(value * 100) / 100;
const line = (x1: number, y1: number, x2: number, y2: number, width = 1.4, extra = "") => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${INK}" stroke-width="${width}"${extra}/>`;
const path = (d: string, width = 1.2, fill = "none") => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${width}" stroke-linejoin="round"/>`;
const dashed = ` stroke-dasharray="2.2 1.8"`;
const text = (x: number, y: number, value: string, size = 6, anchor = "middle") => `<text x="${f(x)}" y="${f(y)}" font-size="${size}" text-anchor="${anchor}" fill="${INK}" stroke="none">${value}</text>`;

/** Výška značky ve schématu (od přívodu po vývod) [px]. */
export const SYMBOL_HEIGHT = 44;

/**
 * Značka přístroje ve svislém vedení: vstup nahoře v `top`, výstup dole v `top + 44`, osa `cx`. Doplňkové části
 * (spouště, cívky) leží vlevo od osy – vpravo je popis přístroje.
 */
export function drawSymbol(kind: SymbolKind, cx: number, top: number): string {
  const bottom = top + SYMBOL_HEIGHT;
  const fixed = top + 12;
  const pivot = top + 30;
  /** Spínací kontakt: pevný kontakt shora, pohyblivý (šikmý) nůž, výstup dolů. */
  const contact = (fixedEnd = fixed) => `${line(cx, top, cx, fixedEnd)}${line(cx, pivot, cx - 10, top + 13)}`;
  const cross = `${line(cx - 4, fixed - 4, cx + 4, fixed + 4, 1.2)}${line(cx + 4, fixed - 4, cx - 4, fixed + 4, 1.2)}`;
  const dash = (y = fixed) => line(cx - 5, y, cx + 5, y);
  const out = (from = pivot) => line(cx, from, cx, bottom);
  /** Čárkovaná mechanická vazba od nože k přístroji vlevo. */
  const link = (toX: number, toY: number) => `<polyline points="${f(cx - 5)},${f(top + 21)} ${f(toX)},${f(toY)}" fill="none" stroke="${INK}" stroke-width="0.8"${dashed}/>`;
  /** Cívka relé / stykače vlevo od osy (x0…x0 + 15) s volitelným polem kvalifikátoru. */
  const coil = (qualifier: "none" | "latched" | "slow-operate" | "slow-release" = "none") => {
    const x0 = cx - 33;
    const y0 = top + 15;
    const w = 16;
    const h = 11;
    const parts = [`<rect x="${f(x0)}" y="${f(y0)}" width="${w}" height="${h}" fill="#fff" stroke="${INK}" stroke-width="1"/>`];
    if (qualifier !== "none") {
      parts.push(line(x0 + 5, y0, x0 + 5, y0 + h, 0.9));
      if (qualifier === "latched") parts.push(path(`M${f(x0 + 5)} ${f(y0 + 1)} L${f(x0 + 1)} ${f(y0 + h / 2)} L${f(x0 + 5)} ${f(y0 + h - 1)}`, 0.8));
      if (qualifier === "slow-operate") parts.push(path(`M${f(x0)} ${f(y0)} L${f(x0 + 5)} ${f(y0 + h)} M${f(x0 + 5)} ${f(y0)} L${f(x0)} ${f(y0 + h)}`, 0.8));
      if (qualifier === "slow-release") parts.push(`<rect x="${f(x0)}" y="${f(y0)}" width="5" height="${h}" fill="${INK}"/>`);
    }
    parts.push(line(x0 + w / 2, y0, x0 + w / 2, y0 - 5, 0.8), line(x0 + w / 2, y0 + h, x0 + w / 2, y0 + h + 5, 0.8));
    return `${parts.join("")}${link(x0 + w, y0 + h / 2)}`;
  };
  /** Měřicí relé: obdélník s veličinou. */
  const measuring = (quantity: string, chars = quantity.length) => {
    const w = Math.max(18, chars * 3.6 + 5);
    const x0 = cx - 15 - w;
    return `<rect x="${f(x0)}" y="${f(top + 15)}" width="${f(w)}" height="11" fill="#fff" stroke="${INK}" stroke-width="1"/>${text(x0 + w / 2, top + 22.6, quantity, 6)}${link(cx - 15, top + 20.5)}`;
  };
  /** Spoušť reziduálního proudu IΔ se součtovým transformátorem (toroid) na vedení. */
  const residual = () => {
    const x0 = cx - 31;
    return `<rect x="${f(x0)}" y="${f(top + 15)}" width="14" height="11" fill="#fff" stroke="${INK}" stroke-width="1"/>${text(x0 + 7, top + 22.6, "IΔ", 6)}${link(x0 + 14, top + 20.5)}<ellipse cx="${f(cx)}" cy="${f(top + 38)}" rx="6" ry="2.6" fill="none" stroke="${INK}" stroke-width="1"/><polyline points="${f(cx - 6)},${f(top + 38)} ${f(x0 + 7)},${f(top + 38)} ${f(x0 + 7)},${f(top + 26)}" fill="none" stroke="${INK}" stroke-width="0.8"${dashed}/>`;
  };
  const box = (label: string, size = 6.5) => `${line(cx, top, cx, top + 8)}<rect x="${f(cx - 10)}" y="${f(top + 8)}" width="20" height="26" fill="#fff" stroke="${INK}" stroke-width="1.2"/>${text(cx, top + 23.5, label, size)}${line(cx, top + 34, cx, bottom)}`;

  switch (kind) {
    case "MCB":
      // Tepelná spoušť (lomená čára) a elektromagnetická spoušť (oblouk) v sérii pod nožem
      return `${contact()}${cross}${path(`M${f(cx)} ${f(pivot)} V${f(top + 31)} h4.5 v4.5 h-4.5 V${f(top + 37)} a3 3 0 0 1 0 6 V${f(bottom)}`)}`;
    case "RCD":
      return `${contact()}${residual()}${out()}`;
    case "RCBO":
      return `${contact()}${cross}${residual()}${out()}`;
    case "SWITCH_DISCONNECTOR":
      return `${contact(top + 9)}${dash(top + 9)}<circle cx="${f(cx)}" cy="${f(top + 11.4)}" r="2.3" fill="#fff" stroke="${INK}" stroke-width="1"/>${out()}`;
    case "DISCONNECTOR":
      return `${contact()}${dash()}${out()}`;
    case "FUSE_DISCONNECTOR": {
      // Pojistka (obdélník s průchozí čarou) v noži
      const ux = -10 / Math.hypot(10, 17);
      const uy = -17 / Math.hypot(10, 17);
      const nx = -uy;
      const ny = ux;
      const c = { x: cx - 5, y: top + 21.5 };
      const corner = (a: number, b: number) => `${f(c.x + ux * a + nx * b)} ${f(c.y + uy * a + ny * b)}`;
      return `${contact()}${dash()}${path(`M${corner(-5.5, -2.6)} L${corner(5.5, -2.6)} L${corner(5.5, 2.6)} L${corner(-5.5, 2.6)} Z`, 1, "#fff")}${line(cx, pivot, cx - 10, top + 13, 1.1)}${out()}`;
    }
    case "SPD":
      // Varistor (obdélník s lomenou šikmou čarou) a ochranné uzemnění
      return `${line(cx, top, cx, top + 8)}<rect x="${f(cx - 5)}" y="${f(top + 8)}" width="10" height="20" fill="#fff" stroke="${INK}" stroke-width="1.2"/>${path(`M${f(cx - 9)} ${f(top + 30)} h3 L${f(cx + 8)} ${f(top + 6)}`, 1)}${text(cx + 9, top + 31, "U", 5.5, "start")}${line(cx, top + 28, cx, top + 35)}${line(cx - 7, top + 35, cx + 7, top + 35, 1.2)}${line(cx - 4.5, top + 38, cx + 4.5, top + 38, 1.2)}${line(cx - 2, top + 41, cx + 2, top + 41, 1.2)}`;
    case "CONTACTOR":
      return `${contact()}${path(`M${f(cx)} ${f(fixed - 4)} A4 4 0 0 0 ${f(cx)} ${f(fixed + 4)}`)}${coil()}${out()}`;
    case "RELAY":
      return `${contact()}${coil()}${out()}`;
    case "RELAY_IMPULSE":
      return `${contact()}${coil("latched")}${out()}`;
    case "RELAY_TIMER":
      return `${contact()}${coil("slow-operate")}${out()}`;
    case "RELAY_STAIRCASE":
      return `${contact()}${coil("slow-release")}${out()}`;
    case "RELAY_MONITORING":
      return `${contact()}${measuring("U&lt;&gt;", 3)}${out()}`;
    case "RELAY_LEVEL":
      return `${contact()}${measuring("hladina")}${out()}`;
    case "RELAY_THERMOSTAT":
      return `${contact()}${measuring("θ")}${out()}`;
    case "PSU":
      return `${line(cx, top, cx, top + 6)}<rect x="${f(cx - 10)}" y="${f(top + 6)}" width="20" height="26" fill="#fff" stroke="${INK}" stroke-width="1.2"/>${line(cx - 10, top + 32, cx + 10, top + 6, 1)}${text(cx - 4.5, top + 15, "~", 8)}${text(cx + 4.5, top + 29, "=", 8)}${line(cx, top + 32, cx, bottom)}`;
    case "TRANSFORMER":
      return `${line(cx, top, cx, top + 9)}<circle cx="${f(cx)}" cy="${f(top + 16)}" r="7" fill="none" stroke="${INK}" stroke-width="1.2"/><circle cx="${f(cx)}" cy="${f(top + 26)}" r="7" fill="none" stroke="${INK}" stroke-width="1.2"/>${line(cx, top + 33, cx, bottom)}`;
    case "METER":
      return `${line(cx, top, cx, top + 8)}<rect x="${f(cx - 10)}" y="${f(top + 8)}" width="20" height="26" fill="#fff" stroke="${INK}" stroke-width="1.2"/>${line(cx - 10, top + 14, cx + 10, top + 14, 0.8)}${path(`M${f(cx - 5)} ${f(top + 11)} h9 m-2.5 -1.6 l2.5 1.6 l-2.5 1.6`, 0.8)}${text(cx, top + 26.5, "Wh", 7.5)}${line(cx, top + 34, cx, bottom)}`;
    case "TERMINAL":
      return `${line(cx, top, cx, top + 19)}<circle cx="${f(cx)}" cy="${f(top + 22)}" r="3" fill="#fff" stroke="${INK}" stroke-width="1.2"/>${line(cx, top + 25, cx, bottom)}`;
    case "PLC":
      return box("PLC", 6);
    default:
      return box("?", 8);
  }
}

/** Samostatná značka s přívodem a vývodem (legenda, knihovna značek, náhled datasheetu). */
export function symbolPreviewSvg(kind: SymbolKind, size = 64): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-48 -6 70 56" width="${size}" height="${Math.round((size * 56) / 70)}" font-family="Arial, Helvetica, sans-serif"><rect x="-48" y="-6" width="70" height="56" fill="#fff"/>${line(0, -6, 0, 0)}${drawSymbol(kind, 0, 0)}${kind === "SPD" ? "" : line(0, SYMBOL_HEIGHT, 0, 50)}</svg>`;
}

/** Legenda značek použitých ve schématu (v pořadí knihovny). */
export function symbolLegend(kinds: Iterable<SymbolKind>): { kind: SymbolKind; info: SymbolInfo; svg: string }[] {
  const used = new Set(kinds);
  return SYMBOL_KINDS.filter((kind) => used.has(kind)).map((kind) => ({ kind, info: SYMBOLS[kind], svg: symbolPreviewSvg(kind, 56) }));
}
