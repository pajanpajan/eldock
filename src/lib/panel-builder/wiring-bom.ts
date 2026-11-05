// Fáze 55: kusovník domovní instalace z 2D půdorysu s objednacími čísly (Katalog ABB 2026, str. 26 „Sestavování přístrojů“):
// stavebnicový vypínač = přístroj (strojek) + kryt v barvě + rámeček 1R–5R, jednozásuvka = přístroj s krytem + rámeček,
// dvojzásuvka = kompletní přístroj. K tomu instalační krabice KOPOS a kabely CYKY po metrech.
// Objednací čísla: přímo ze zadání (matice ABB 2026) jsou `verified`; odvozená varianta stejné matice (dělený / žaluziový kryt
// u řady, kde zadání uvádí jen jednoduchý kryt, dvoubarevný kód) má `verified: false`; bez podkladu je MPN null (doplnit).
// Čisté funkce.

import { paletteItem, type FloorplanDraft } from "./floorplan-editor";
import { appearanceLabel, designSeriesOf } from "./wiring-designs";

export type BomCategory = "Přístroje spínačů" | "Kryty spínačů" | "Zásuvky" | "Rámečky" | "Ostatní přístroje" | "Instalační krabice" | "Kabely";
export const BOM_CATEGORIES: readonly BomCategory[] = ["Přístroje spínačů", "Kryty spínačů", "Zásuvky", "Rámečky", "Ostatní přístroje", "Instalační krabice", "Kabely"];

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
    frame: () => null,
  },
};

const DIVIDED = new Set(["5", "6+6", "1/0+1/0", "1+1", "6+6/0"]);

/** Řazení vypínače: pevné (S5, S6+6, tlačítka) nebo z párování se světlem (1 místo = 1, 2 = 6, další 7). */
function switchNumberOf(draft: Pick<FloorplanDraft, "elements">, elementId: string, fixed: string | undefined): string {
  if (fixed) return fixed;
  const light = draft.elements.find((candidate) => draft.elements.some((element) => element.id === elementId && element.controls.includes(candidate.id)));
  if (!light) return "1";
  const controllers = draft.elements.filter((element) => element.controls.includes(light.id));
  const index = controllers.findIndex((element) => element.id === elementId);
  return controllers.length === 1 ? "1" : index < 2 ? "6" : "7";
}

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
  for (const element of draft.elements) {
    const item = paletteItem(element.item);
    if (!item || item.kind === "panel" || item.kind === "light" || item.kind === "appliance") continue;
    const seriesKey = element.series ?? draft.series;
    const colorId = element.color ?? draft.color;
    const found = designSeriesOf(seriesKey);
    const isAbb = found?.brand.manufacturer === "ABB";
    const matrix = isAbb ? ABB_MATRIX[found!.series.name] : undefined;
    const code = found?.series.colors?.find((color) => color.id === colorId)?.code ?? null;
    const appearance = appearanceLabel(seriesKey, colorId);
    const units = Math.max(1, element.frameUnits);
    boxes += units;
    const frame = () => {
      const frameMpn = withColor(matrix?.frame(units) ?? null, code, true);
      add({ category: "Rámečky", ...frameMpn, name: `Rámeček ${units}násobný (${units}R)`, appearance, unit: "ks" }, 1);
    };

    if (item.kind === "switch") {
      if (item.wiringCategory && item.control !== "blind") {
        add({ category: "Ostatní přístroje", mpn: null, verified: false, name: item.label, appearance, unit: "ks" }, units);
        frame();
        continue;
      }
      const blind = item.control === "blind";
      const switchNo = blind ? "blind" : switchNumberOf(draft, element.id, item.fixedSwitchNo);
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
      add({ category: "Zásuvky", ...withColor(matrix?.socket2 ?? null, code, true), name: "Dvojzásuvka 2N – kompletní přístroj", appearance, unit: "ks" }, units);
      continue;
    }
    if (item.kind === "data_socket") {
      add({ category: "Ostatní přístroje", mpn: null, verified: false, name: "Datová zásuvka RJ45 (Cat6)", appearance, unit: "ks" }, units);
      frame();
    }
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
