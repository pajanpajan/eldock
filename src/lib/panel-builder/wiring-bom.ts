// Fáze 55: kusovník domovní instalace z 2D půdorysu s objednacími čísly (Katalog ABB 2026, str. 26 „Sestavování přístrojů“):
// stavebnicový vypínač = přístroj (strojek) + kryt v barvě + rámeček 1R–5R, jednozásuvka = přístroj s krytem + rámeček,
// dvojzásuvka = kompletní přístroj. K tomu instalační krabice KOPOS a kabely CYKY po metrech.
// Objednací čísla: přímo ze zadání (matice ABB 2026) jsou `verified`; odvozená varianta stejné matice (dělený / žaluziový kryt
// u řady, kde zadání uvádí jen jednoduchý kryt, dvoubarevný kód) má `verified: false`; bez podkladu je MPN null (doplnit).
// Čisté funkce.

import { allElements, effectiveSwitchNo, floorsOf, isWiredSwitch, paletteItem, type EditorElement, type FloorplanDraft, type FrameGroup } from "./floorplan-editor";
import { gangsOf } from "./floorplan-frames";
import { appearanceLabel, designSeriesOf } from "./wiring-designs";

export type BomCategory = "Přístroje spínačů" | "Kryty spínačů" | "Sběrnicové prvky" | "Chytré moduly" | "Zásuvky" | "Rámečky" | "Ostatní přístroje" | "Instalační krabice" | "Kabely";
export const BOM_CATEGORIES: readonly BomCategory[] = ["Přístroje spínačů", "Kryty spínačů", "Sběrnicové prvky", "Chytré moduly", "Zásuvky", "Rámečky", "Ostatní přístroje", "Instalační krabice", "Kabely"];

export interface WiringBomRow {
  category: BomCategory;
  /** Objednací číslo; null = v podkladech chybí, doplnit z katalogu výrobce. */
  mpn: string | null;
  /** false = odvozeno z matice katalogu – ověřit před objednáním. */
  verified: boolean;
  name: string;
  appearance: string;
  quantity: number;
  unit: "ks" | "m";
}

/** Strojky spínačů pod omítku ABB (nezávislé na řadě). */
export const ABB_MECHANISMS: Record<string, string> = {
  "1": "3559-A01345",
  "5": "3559-A05345",
  "6": "3559-A06345",
  "7": "3559-A07345",
  "6+6": "3559-A52345",
  "1/0+1/0": "3559-A87345",
  blind: "3559-A89345",
};

type CoverKind = "single" | "divided" | "blind";
interface SeriesMatrix {
  cover: (kind: CoverKind) => { base: string; verified: boolean } | null;
  socket1: string | null;
  socket2: string | null;
  frame: (units: number) => string | null;
}

/** Matice objednacích čísel řad ABB ze zadání (Katalog ABB 2026); kód barvy se připojuje za mezeru. */
const ABB_MATRIX: Record<string, SeriesMatrix> = {
  Zoni: {
    cover: (kind) => ({ base: { single: "3559T-A00651", divided: "3559T-A00652", blind: "3559T-A00662" }[kind], verified: true }),
    socket1: "6619T-A06657",
    socket2: "5513T-C02157",
    frame: (units) => `3901T-A000${units}0`,
  },
  Tango: {
    cover: (kind) => (kind === "single" ? { base: "3558A-A651", verified: true } : { base: kind === "divided" ? "3558A-A652" : "3558A-A662", verified: false }),
    socket1: "6619A-A06357",
    socket2: "5513A-C02357",
    frame: (units) => `3901A-B${units}0`,
  },
  Levit: {
    cover: (kind) => (kind === "single" ? { base: "3559H-A00651", verified: true } : { base: kind === "divided" ? "3559H-A00652" : "3559H-A00662", verified: false }),
    socket1: "6619H-A06357",
    socket2: "5513H-C02357",
    frame: (units) => `3901H-A050${units}0`,
  },
  Time: {
    cover: (kind) => (kind === "single" ? { base: "3558E-A00651", verified: true } : { base: kind === "divided" ? "3558E-A00652" : "3558E-A00662", verified: false }),
    socket1: null,
    socket2: null,
    // Fáze 61: rámečky Time podle katalogu 2026 (3901F-A00110 … A00150 + kód barvy)
    frame: (units) => `3901F-A001${units}0`,
  },
  // Fáze 61: rámečky Swing / Swing L (3901G / 3901J-A000.0 + kód barvy, katalog 2026), kryty a zásuvky doplnit
  Swing: { cover: () => null, socket1: null, socket2: null, frame: (units) => `3901G-A000${units}0` },
  "Swing L": { cover: () => null, socket1: null, socket2: null, frame: (units) => `3901J-A000${units}0` },
};
// Levit M sdílí přístroje i rámečky s řadou Levit (kódy barev 63 / 68 / 69 / 70)
ABB_MATRIX["Levit M"] = ABB_MATRIX.Levit;

/**
 * Fáze 61: sběrnicové prvky ABB-free@home podle katalogu 2026 (str. 252): tlačítková rozhraní pod designový kryt
 * a prostorový termostat; ostatní systémy / prvky bez objednacího čísla (dle zvoleného výrobce).
 */
const FREEATHOME_BUS: Record<string, { mpn: string; name: string }> = {
  "bus-1": { mpn: "2CKA006220A0117", name: "Rozhraní tlačítkové 1násobné ABB-free@home (SU-F-1.0.1) – pod designový kryt" },
  "bus-2": { mpn: "2CKA006220A0118", name: "Rozhraní tlačítkové 2násobné ABB-free@home (SU-F-2.0.1) – pod designový kryt" },
  "bus-blind": { mpn: "2CKA006220A0118", name: "Rozhraní tlačítkové 2násobné ABB-free@home (SU-F-2.0.1) – kryt se symbolem žaluzie" },
  "bus-room": { mpn: "2CKA006220A0122", name: "Termostat prostorový sběrnicový ABB-free@home – pod designový kryt" },
};

const DIVIDED = new Set(["5", "6+6", "1/0+1/0", "1+1", "6+6/0"]);

/** Objednací číslo s kódem barvy; dvoubarevný kód („241/141“) nebo barva bez kódu → neověřeno / chybí. */
function withColor(base: string | null, code: string | null | undefined, verified: boolean): { mpn: string | null; verified: boolean } {
  if (!base) return { mpn: null, verified: false };
  if (!code) return { mpn: null, verified: false };
  if (code.includes("/")) return { mpn: `${base} ${code.split("/")[0]}`, verified: false };
  return { mpn: `${base} ${code}`, verified };
}

export interface BomOptions {
  /** Úroveň instalace: chytrá / retrofit → hluboké krabice KPR 68. */
  installation?: string;
  /** Rozpis kabelů z výkazu kabeláže (typ → metry). */
  cables?: readonly { cable: string; meters: number }[];
}

/** Objednací číslo rámečku NR: řady Busch-Jaeger mají číslo pro každou barvu (`frameMpn`), ostatní matice + kód barvy. */
function frameNumber(style: { matrix?: SeriesMatrix; code: string | null; frameMpn?: (string | null)[] }, units: number): { mpn: string | null; verified: boolean } {
  const own = style.frameMpn?.[units - 1];
  if (own) return { mpn: own, verified: true };
  return withColor(style.matrix?.frame(units) ?? null, style.code, true);
}

/** Kompletní kusovník domovní instalace (součty kusů podle objednacího čísla a popisu). */
export function compileFloorplanBom(draft: FloorplanDraft, options: BomOptions = {}): WiringBomRow[] {
  const rows = new Map<string, WiringBomRow>();
  const add = (row: Omit<WiringBomRow, "quantity">, quantity: number) => {
    if (quantity <= 0) return;
    const key = `${row.category}|${row.mpn ?? row.name}|${row.appearance}`;
    const current = rows.get(key);
    if (current) current.quantity = Math.round((current.quantity + quantity) * 10) / 10;
    else rows.set(key, { ...row, quantity });
  };
  let boxes = 0;
  // Fáze 59: víceramečky všech podlaží – člen rámečku nemá vlastní rámeček, za skupinu jeden rámeček NR
  const frameOf = new Map<string, FrameGroup>();
  for (const floor of floorsOf(draft)) for (const group of floor.frames) for (const id of group.members) frameOf.set(id, group);
  const look = (element: Pick<EditorElement, "series" | "color">) => {
    const seriesKey = element.series ?? draft.series;
    const colorId = element.color ?? draft.color;
    const found = designSeriesOf(seriesKey);
    const isAbb = found?.brand.manufacturer === "ABB";
    const seriesColor = found?.series.colors?.find((color) => color.id === colorId);
    return { seriesKey, colorId, found, isAbb, matrix: isAbb ? ABB_MATRIX[found!.series.name] : undefined, code: seriesColor?.code ?? null, frameMpn: seriesColor?.frameMpn, appearance: appearanceLabel(seriesKey, colorId) };
  };
  const everything = allElements(draft);
  for (const element of everything) {
    const item = paletteItem(element.item);
    if (!item || item.kind === "panel" || item.kind === "riser" || item.kind === "fixture" || item.kind === "light" || item.kind === "appliance") continue;
    const { found, isAbb, matrix, code, appearance } = look(element);
    const units = Math.max(1, element.frameUnits);
    const inFrame = frameOf.has(element.id);
    boxes += inFrame ? gangsOf(element) : units;
    const frame = () => {
      if (inFrame) return;
      add({ category: "Rámečky", ...frameNumber(look(element), units), name: `Rámeček ${units}násobný (${units}R)`, appearance, unit: "ks" }, 1);
    };

    // Fáze 57: sběrnicové prvky; fáze 61 – u ABB-free@home objednací čísla tlačítkových rozhraní z katalogu 2026
    if (item.bus) {
      const known = draft.smartSystem === "abb_freeathome" ? FREEATHOME_BUS[item.id] : undefined;
      if (known) add({ category: "Sběrnicové prvky", mpn: known.mpn, verified: true, name: known.name, appearance, unit: "ks" }, units);
      else add({ category: "Sběrnicové prvky", mpn: null, verified: false, name: `${item.label} – dle zvoleného systému (${draft.smartSystem === "abb_knx" ? "ABB i-bus KNX" : draft.smartSystem === "loxone" ? "Loxone Tree" : "ABB-free@home"})`, appearance: item.bus.role === "presence" ? "–" : appearance, unit: "ks" }, units);
      if (item.bus.role !== "presence") frame();
      continue;
    }
    // Bezdrátové tlačítko / čidlo: na baterii, bez krabice a bez kabelu
    if (item.wireless) {
      boxes -= units;
      add({ category: "Chytré moduly", mpn: null, verified: false, name: `${item.label.replace(/ \(.*\)$/, "")} (Zigbee / Matter, baterie)`, appearance, unit: "ks" }, units);
      continue;
    }
    if (item.kind === "switch") {
      if (item.wiringCategory && item.control !== "blind") {
        add({ category: "Ostatní přístroje", mpn: null, verified: false, name: item.label, appearance, unit: "ks" }, units);
        frame();
        continue;
      }
      const blind = item.control === "blind";
      const switchNo = blind ? "blind" : effectiveSwitchNo(draft, element).replace(/S+o?$/, "");
      const mechanism = isAbb && !item.led && !item.ip44 ? (ABB_MECHANISMS[switchNo] ?? null) : null;
      add({ category: "Přístroje spínačů", mpn: mechanism, verified: Boolean(mechanism), name: blind ? "Žaluziový spínač – přístroj" : `Spínač řazení ${switchNo} – přístroj pod omítku`, appearance: found ? found.brand.label : "–", unit: "ks" }, units);
      const kind: CoverKind = blind ? "blind" : DIVIDED.has(switchNo) ? "divided" : "single";
      const cover = matrix?.cover(kind) ?? null;
      add({ category: "Kryty spínačů", ...withColor(cover?.base ?? null, code, cover?.verified ?? false), name: blind ? "Kryt žaluziového spínače" : kind === "divided" ? "Kryt spínače dělený" : "Kryt spínače jednoduchý", appearance, unit: "ks" }, units);
      frame();
      continue;
    }
    if (item.kind === "single_socket") {
      const socket = item.variant === "ip44" ? null : (matrix?.socket1 ?? null);
      add({ category: "Zásuvky", ...withColor(socket, code, true), name: item.variant === "ip44" ? "Zásuvka 1N IP44" : "Zásuvka 1N s krytem (přístroj + kryt)", appearance, unit: "ks" }, units);
      frame();
      continue;
    }
    if (item.kind === "double_socket") {
      // Ve víceramečku = 2 jednozásuvky s krytem vedle sebe (dvojzásuvka je jinak kompletní přístroj s rámečkem)
      if (inFrame) add({ category: "Zásuvky", ...withColor(matrix?.socket1 ?? null, code, true), name: "Zásuvka 1N s krytem (přístroj + kryt) – ve víceramečku", appearance, unit: "ks" }, units * 2);
      else add({ category: "Zásuvky", ...withColor(matrix?.socket2 ?? null, code, true), name: "Dvojzásuvka 2N – kompletní přístroj", appearance, unit: "ks" }, units);
      continue;
    }
    if (item.kind === "data_socket") {
      add({ category: "Ostatní přístroje", mpn: null, verified: false, name: "Datová zásuvka RJ45 (Cat6)", appearance, unit: "ks" }, units);
      frame();
    }
  }
  // Víceramečky: jeden rámeček NR za skupinu v řadě a barvě kotvy (první přístroj rámečku)
  for (const group of new Set(frameOf.values())) {
    const members = group.members.map((id) => everything.find((element) => element.id === id)).filter((element): element is EditorElement => Boolean(element));
    if (members.length < 2) continue;
    const gangs = Math.min(5, members.reduce((sum, element) => sum + gangsOf(element), 0));
    const style = look(members[0]);
    add({ category: "Rámečky", ...frameNumber(style, gangs), name: `Rámeček ${gangs}násobný (${gangs}R) – víceramček`, appearance: style.appearance, unit: "ks" }, 1);
  }
  // Retrofit: modul pod vypínač na každou spínanou větev (světlo s kabelovým ovladačem) a žaluzii, spínací modul
  // do krabice svítidla, které ovládá jen bezdrátové tlačítko
  if (options.installation === "smart_retrofit") {
    const wiredLights = new Set<string>();
    const wirelessLights = new Set<string>();
    let blindModules = 0;
    for (const element of everything) {
      const item = paletteItem(element.item);
      if (item?.control === "blind" && isWiredSwitch(item)) blindModules += Math.max(1, element.frameUnits);
      const target = item && (item.control ?? "light") === "light" ? (isWiredSwitch(item) ? wiredLights : item.wireless ? wirelessLights : null) : null;
      for (const lightId of element.controls) target?.add(lightId);
    }
    for (const id of wiredLights) wirelessLights.delete(id);
    add({ category: "Chytré moduly", mpn: null, verified: false, name: "Chytrý modul pod vypínač (Zigbee / Matter, s nulovým vodičem N)", appearance: "–", unit: "ks" }, wiredLights.size);
    add({ category: "Chytré moduly", mpn: null, verified: false, name: "Žaluziový modul pod vypínač (Zigbee / Matter)", appearance: "–", unit: "ks" }, blindModules);
    add({ category: "Chytré moduly", mpn: null, verified: false, name: "Spínací modul do krabice svítidla (Zigbee / Matter) – pro bezdrátové tlačítko", appearance: "–", unit: "ks" }, wirelessLights.size);
  }
  const deep = options.installation === "bus_loxone" || options.installation === "smart_retrofit";
  add({ category: "Instalační krabice", mpn: deep ? "KPR 68" : "KU 68-1901", verified: true, name: deep ? "Přístrojová krabice hluboká KOPOS (chytrá / retrofit instalace)" : "Přístrojová krabice KOPOS pod omítku", appearance: "KOPOS", unit: "ks" }, boxes);
  for (const cable of options.cables ?? []) add({ category: "Kabely", mpn: null, verified: true, name: cable.cable, appearance: "–", unit: "m" }, Math.ceil(cable.meters));
  const order = (row: WiringBomRow) => BOM_CATEGORIES.indexOf(row.category);
  return [...rows.values()].sort((a, b) => order(a) - order(b) || a.appearance.localeCompare(b.appearance, "cs") || (a.mpn ?? a.name).localeCompare(b.mpn ?? b.name, "cs"));
}

/** Řádky tabulky pro CSV / XLSX (hlavička + data). */
export function bomTable(rows: readonly WiringBomRow[]): (string | number)[][] {
  return [["Kategorie", "Objednací číslo (MPN)", "Název a specifikace", "Řada a barva", "Počet", "Jednotka", "Ověření"], ...rows.map((row) => [row.category, row.mpn ?? "doplnit", row.name, row.appearance, row.quantity, row.unit, row.mpn ? (row.verified ? "katalog" : "ověřit") : "chybí"])];
}
