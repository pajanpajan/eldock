// Fáze 55: kusovník domovní instalace z 2D půdorysu s objednacími čísly (Katalog ABB 2026, str. 26 „Sestavování přístrojů“):
// stavebnicový vypínač = přístroj (strojek) + kryt v barvě + rámeček 1R–5R, jednozásuvka = přístroj s krytem + rámeček,
// dvojzásuvka = kompletní přístroj. K tomu instalační krabice KOPOS a kabely CYKY po metrech.
// Objednací čísla: přímo ze zadání (matice ABB 2026) jsou `verified`; odvozená varianta stejné matice (dělený / žaluziový kryt
// u řady, kde zadání uvádí jen jednoduchý kryt, dvoubarevný kód) má `verified: false`; bez podkladu je MPN null.
// Fáze 101: číslo, které v datech výrobce není, se nevymýšlí – kusovník u něj místo „doplnit“ uvede, odkud položka přijde
// (`bomOrderLabel`: kabel podle typového označení, prvek podle projektu, přístroj podle katalogu výrobce).
// Fáze 81: panel chytré domácnosti (IP TOUCH, SmartTouch, Trevion …) v barvě varianty s vlastní montážní krabicí místo
// přístrojové a s mezirámečkem podle řady (Trevion v Zoni); systémový modul mimo DIN lištu (nástěnný SysAP) do kusovníku.
// Fáze 91: víceramček, který řada nevyrábí, se rozdělí na skutečné rámečky (Time Arbo 5R → 4R + 1R, Classic po 1R);
// Decento = kompletní přístroje s kulatým rámečkem (str. 145–147, bez rámečků a krytů), kryty řad Busch-Jaeger ze společné
// kapitoly (str. 170); instalační krabice podle výrobce, konstrukce stěny a hloubky přístroje (`mounting-boxes-catalog.ts`)
// v samostatné tabulce. Čisté funkce.
// Fáze 94: objednací číslo, které je v oficiálních datech výrobce ABB ETIM 9.0, má EAN (GTIN) a platí za ověřené.

import { allElements, effectiveSwitchNo, floorsOf, frameColorOf, isWiredSwitch, paletteItem, type EditorElement, type FloorplanDraft, type FrameGroup } from "./floorplan-editor";
import { gangsOf } from "./floorplan-frames";
import { productById } from "./smart-catalog";
import { smartPlanOf } from "./smart-home-plan";
import { panelBomRows, variantOf } from "./smart-panels";
import { boxMakerLabel, compileBoxUsage, wallTypeOf } from "./mounting-boxes-catalog";
import { EKV_CONDUCTOR } from "./occupancy";
import { frameRulesOf, maxFrameGang, splitFrameGangs, splitLabel } from "./residential-series-catalog";
import { appearanceLabel, colorCodeFor, colorForSeries, designSeriesOf, frameColorForSeries, hasFrameChoice, isMonoblockSeries, resolveFrameColor } from "./wiring-designs";

export type BomCategory = "Přístroje spínačů" | "Kryty spínačů" | "Sběrnicové prvky" | "Chytré moduly" | "Zásuvky" | "Rámečky" | "Ostatní přístroje" | "Bezpečnostní a zdravotnické prvky" | "Instalační krabice" | "Kabely";
export const BOM_CATEGORIES: readonly BomCategory[] = ["Přístroje spínačů", "Kryty spínačů", "Sběrnicové prvky", "Chytré moduly", "Zásuvky", "Rámečky", "Ostatní přístroje", "Bezpečnostní a zdravotnické prvky", "Instalační krabice", "Kabely"];

/** Fáze 93: odhad vodiče doplňujícího ochranného pospojování na jednu přípojku EKV (k přípojnici EKV místnosti) [m]. */
export const EKV_CONDUCTOR_M = 3;

export interface WiringBomRow {
  category: BomCategory;
  /** Objednací číslo; null = v datech výrobce není (popis původu položky `bomOrderLabel`). */
  mpn: string | null;
  /** false = odvozeno z matice katalogu – ověřit před objednáním. */
  verified: boolean;
  name: string;
  appearance: string;
  quantity: number;
  unit: "ks" | "m";
  /** Fáze 91: instalační krabice – řádek tabulky doporučených krabic (výrobce, typ, hloubka, určení). */
  box?: BomBoxInfo;
  /** Fáze 94: EAN (GTIN) z oficiálních dat výrobce ABB ETIM 9.0 – objednací číslo výrobce zná. */
  ean?: string;
}

/**
 * Fáze 101: řádek bez objednacího čísla v datech výrobce – odkud položka přijde (nic se nevymýšlí): kabel se objednává podle
 * typového označení (výrobce dle nabídky velkoobchodu), bezpečnostní a zdravotnické prvky podle projektu a dodavatele,
 * přístroj a krabice podle katalogu svého výrobce.
 */
export function bomOrderLabel(row: Pick<WiringBomRow, "category" | "mpn">): string {
  if (row.mpn) return row.mpn;
  if (row.category === "Kabely") return "typové označení – výrobce dle nabídky";
  if (row.category === "Bezpečnostní a zdravotnické prvky") return "dle projektu a dodavatele";
  return "dle katalogu výrobce";
}

/** Fáze 94: EAN objednacího čísla z dat ABB ETIM 9.0 (null = číslo v datech výrobce není nebo nemá EAN). */

export interface BomBoxInfo {
  maker: string;
  type: string;
  depthMm: number | null;
  purpose: string;
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
  /** Fáze 91: kód barvy za základ bez mezery (Busch-Jaeger: 3559B-A00651 + 84 = 3559B-A0065184). */
  join?: string;
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
// Fáze 91: kryty společné kapitoly future linear / solo / solo carat / Busch-axcent (str. 170) – rámečky z `frameMpn`
const BUSCH_JAEGER: SeriesMatrix = {
  cover: (kind) => (kind === "blind" ? null : { base: kind === "divided" ? "3559B-A00652" : "3559B-A00651", verified: true }),
  socket1: null,
  socket2: null,
  frame: () => null,
  join: "",
};
for (const name of ["future linear", "solo", "solo carat", "Busch-axcent"]) ABB_MATRIX[name] = BUSCH_JAEGER;

/**
 * Fáze 91: Decento – kompletní přístroje s kulatým rámečkem (Katalog ABB 2026, str. 145–147); přípona barvy: bílá bez
 * přípony, 50 bílá / přírodní buk, 52 bílá / třešeň, N černá. Řazení 1 = přepínač střídavý „6 (1)“, 1/0 = ovládač „6/0 (1/0)“.
 */
const DECENTO_SWITCH: Record<string, string> = { "1": "3559K-C06345", "6": "3559K-C06345", "5": "3559K-C05345", "7": "3559K-C07345", "6+6": "3559K-C52345", "1/0": "3559K-C86345", blind: "3559K-C88345" };
const DECENTO_SOCKET = "6619K-C06347";
const DECENTO_DATA = "5014K-C01018";
/** Nabíjecí přístroj USB-A / USB-C Decento jen bílý a černý. */
const DECENTO_USB = "5014K-C00399";

function decentoMpn(base: string | null, code: string | null | undefined, only?: readonly string[]): { mpn: string | null; verified: boolean } {
  if (!base) return { mpn: null, verified: false };
  const suffix = code ?? "";
  if (only && !only.includes(suffix)) return { mpn: null, verified: false };
  return { mpn: suffix ? `${base} ${suffix}` : base, verified: true };
}

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

/**
 * Objednací číslo s kódem barvy dílu; barva bez kódu → chybí. Fáze 74: dvoubarevný kód („241/141“) se rozdělí na
 * rámeček / kryt (klapku) – objednací číslo z rozděleného kódu je neověřené.
 */
function withColor(base: string | null, code: string | null | undefined, verified: boolean, part: "frame" | "insert" = "insert", join = " "): { mpn: string | null; verified: boolean } {
  if (!base) return { mpn: null, verified: false };
  const own = colorCodeFor(code, part);
  if (!own.code) return { mpn: null, verified: false };
  return { mpn: `${base}${join}${own.code}`, verified: verified && !own.split };
}

export interface BomOptions {
  /** Úroveň instalace: chytrá / retrofit → hluboké krabice KPR 68. */
  installation?: string;
  /** Rozpis kabelů z výkazu kabeláže (typ → metry). */
  cables?: readonly { cable: string; meters: number }[];
  /** Fáze 91: počet kabelů v krabici prvku (úseky tras) – rozbočovací zásuvka dostane hlubokou krabici. */
  cableEnds?: Readonly<Record<string, number>>;
  /**
   * Fáze 104: EAN objednacího čísla (přístroje ABB ETIM 9.0, krabice KOPOS) – předá jen server (`catalogEan`); prohlížeč
   * kusovník počítá bez EAN a doplní je serverovou akcí (`useCatalogEans`).
   */
  ean?: (code: string, kind: "device" | "box") => string | null;
}

/** Objednací číslo rámečku NR: řady Busch-Jaeger mají číslo pro každou barvu (`frameMpn`), ostatní matice + kód barvy rámečku. */
function frameNumber(style: { matrix?: SeriesMatrix; frameCode: string | null; frameMpn?: (string | null)[] }, units: number): { mpn: string | null; verified: boolean } {
  const own = style.frameMpn?.[units - 1];
  if (own) return { mpn: own, verified: true };
  return withColor(style.matrix?.frame(units) ?? null, style.frameCode, true, "frame");
}

/** Kompletní kusovník domovní instalace (součty kusů podle objednacího čísla a popisu). */
export function compileFloorplanBom(draft: FloorplanDraft, options: BomOptions = {}): WiringBomRow[] {
  const rows = new Map<string, WiringBomRow>();
  const add = (row: Omit<WiringBomRow, "quantity">, quantity: number) => {
    if (quantity <= 0) return;
    const key = `${row.category}|${row.mpn ?? row.name}|${row.appearance}`;
    const current = rows.get(key);
    if (current) current.quantity = Math.round((current.quantity + quantity) * 10) / 10;
    else {
      // Fáze 94: číslo v datech výrobce (ETIM 9.0) = ověřené, s EAN pro objednávku u velkoobchodu; fáze 97: EAN krabice
      // KOPOS ze stránky výrobku; fáze 104: EAN jen přes resolver serveru
      const ean = row.mpn && options.ean ? options.ean(row.mpn, row.box ? "box" : "device") : null;
      rows.set(key, { ...row, ...(ean ? { ean, ...(row.box ? {} : { verified: true }) } : {}), quantity });
    }
  };
  // Fáze 59: víceramečky všech podlaží – člen rámečku nemá vlastní rámeček, za skupinu jeden rámeček NR
  const frameOf = new Map<string, FrameGroup>();
  for (const floor of floorsOf(draft)) for (const group of floor.frames) for (const id of group.members) frameOf.set(id, group);
  // Fáze 74: barva klapky / krytu (`color`) a barva rámečku (`frameColor`) zvlášť – kód barvy dílu do objednacího čísla
  const look = (element: Pick<EditorElement, "series" | "color" | "frameColor">) => {
    const seriesKey = element.series ?? draft.series;
    // Fáze 101: obecná barva nákresu („Bílá / Alpská bílá“) = barva řady ze stejné skupiny (ABB Levit → kód 03) – bez kódu
    // barvy by objednací čísla krytů, zásuvek, datových zásuvek a rámečků chyběla
    const colorId = colorForSeries(seriesKey, element.color ?? draft.color);
    // Fáze 90: monobloky a Decento – barva rámečku = barva provedení
    // Fáze 101: i obecná barva rámečku = barva rámečku řady (u samostatné palety rámečků výchozí rámeček ke krytu)
    const frameId = hasFrameChoice(seriesKey) ? (frameColorForSeries(seriesKey, frameColorOf(draft, element)) ?? colorId) : colorId;
    const found = designSeriesOf(seriesKey);
    const isAbb = found?.brand.manufacturer === "ABB";
    const seriesColor = found?.series.colors?.find((color) => color.id === colorId);
    // Fáze 91: Busch-axcent / solo carat – rámeček ze samostatné palety (jinak barvy řady)
    const frameColor = resolveFrameColor(seriesKey, frameId, colorId) ?? seriesColor;
    const rules = frameRulesOf(seriesKey);
    return {
      seriesKey,
      colorId,
      found,
      isAbb,
      matrix: isAbb ? ABB_MATRIX[found!.series.name] : undefined,
      code: seriesColor?.code ?? null,
      frameCode: frameColor?.code ?? null,
      frameMpn: frameColor?.frameMpn,
      appearance: appearanceLabel(seriesKey, colorId, frameId),
      monoblock: isMonoblockSeries(seriesKey),
      ip: found?.series.ip ?? "IP44",
      maxGang: maxFrameGang(seriesKey, { color: colorId, frameColor: frameColor?.id ?? frameId }),
      separate: Boolean(rules.separateDevices),
      decento: isAbb && found!.series.name === "Decento",
    };
  };
  const everything = allElements(draft);
  // Fáze 93: přípojky doplňujícího ochranného pospojování (EKV a svorka PE lůžkové rampy) po místnostech
  const bonding: EditorElement[] = [];
  for (const element of everything) {
    const item = paletteItem(element.item);
    // Fáze 93: nouzové únikové svítidlo, přípojka EKV a lůžková rampa LUZ (kompletní těleso se zásuvkami okruhů A a B)
    if (item?.emergency) {
      add({ category: "Bezpečnostní a zdravotnické prvky", mpn: null, verified: false, name: "Nouzové únikové svítidlo s piktogramem (1 h / 3 h, SE / SA, ČSN EN 1838) – typ dle projektu nouzového osvětlení", appearance: "–", unit: "ks" }, 1);
      continue;
    }
    if (item?.kind === "bonding") {
      add({ category: "Bezpečnostní a zdravotnické prvky", mpn: null, verified: false, name: `Přípojka doplňujícího ochranného pospojování EKV (svorka PE, ${EKV_CONDUCTOR})`, appearance: "–", unit: "ks" }, 1);
      bonding.push(element);
      continue;
    }
    if (item?.ramp) {
      add({ category: "Bezpečnostní a zdravotnické prvky", mpn: null, verified: false, name: "Lůžková rampa / vyšetřovací pracoviště – 2× zásuvka Okruh A (zelená / bílá), 2× zásuvka Okruh B (oranžová / zálohovaná), svorka PE / EKV, RJ45", appearance: "–", unit: "ks" }, 1);
      bonding.push(element);
      continue;
    }
    if (!item || item.kind === "panel" || item.kind === "riser" || item.kind === "fixture" || item.kind === "light" || item.kind === "appliance") continue;
    const style = look(element);
    const { found, isAbb, matrix, code, appearance, monoblock, ip, decento } = style;
    const units = Math.max(1, element.frameUnits);
    const inFrame = frameOf.has(element.id);
    // Fáze 90: nástěnný monoblok (Garant, Praktik, Variant+) – kompletní přístroj na povrch, bez rámečku; fáze 91 – Decento
    // má kulatý rámeček v přístroji, N kusů v rámečku víc, než řada vyrábí, se rozdělí na skutečné rámečky
    const frame = () => {
      if (inFrame || monoblock || style.separate) return;
      const parts = splitFrameGangs(units, style.maxGang);
      for (const part of parts) add({ category: "Rámečky", ...frameNumber(style, part), name: parts.length > 1 ? `Rámeček ${part}násobný (${part}R) – ${units}R rozdělený podle řady (${splitLabel(parts)})` : `Rámeček ${part}násobný (${part}R)`, appearance, unit: "ks" }, 1);
    };

    // Fáze 57: sběrnicové prvky; fáze 61 – u ABB-free@home objednací čísla tlačítkových rozhraní z katalogu 2026
    if (item.bus) {
      // Fáze 81: panel ve zvolené barvě, jeho montážní krabice (místo přístrojové) a mezirámeček podle řady
      const product = productById(element.product);
      if (product?.panel) {
        const variantLabel = variantOf(product, element.productVariant)?.label ?? "–";
        for (const row of panelBomRows(product, { variant: element.productVariant, box: element.productBox, seriesName: found?.series.name ?? null })) {
          add(
            {
              category: row.part === "box" ? "Instalační krabice" : row.part === "adapter" ? "Rámečky" : "Sběrnicové prvky",
              mpn: row.mpn,
              verified: row.verified,
              name: row.name,
              appearance: row.part === "adapter" ? appearance : variantLabel,
              unit: "ks",
              // Fáze 91: originální montážní krabice panelu do tabulky krabic
              ...(row.part === "box" ? { box: { maker: product.catalog?.manufacturer ?? "výrobce panelu", type: row.name, depthMm: null, purpose: "originální montážní krabice panelu chytré domácnosti" } } : {}),
            },
            units,
          );
        }
        if (product.frame === "series") frame();
        continue;
      }
      const known = draft.smartSystem === "abb_freeathome" ? FREEATHOME_BUS[item.id] : undefined;
      if (known) add({ category: "Sběrnicové prvky", mpn: known.mpn, verified: true, name: known.name, appearance, unit: "ks" }, units);
      else add({ category: "Sběrnicové prvky", mpn: null, verified: false, name: `${item.label} – dle zvoleného systému (${draft.smartSystem === "abb_knx" ? "ABB i-bus KNX" : draft.smartSystem === "loxone" ? "Loxone Tree" : "ABB-free@home"})`, appearance: item.bus.role === "presence" ? "–" : appearance, unit: "ks" }, units);
      if (item.bus.role !== "presence") frame();
      continue;
    }
    // Bezdrátové tlačítko / čidlo: na baterii, bez krabice a bez kabelu
    if (item.wireless) {
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
      if (monoblock) {
        add({ category: "Přístroje spínačů", mpn: null, verified: false, name: blind ? `Žaluziový spínač nástěnný ${ip} – kompletní přístroj` : `Spínač řazení ${switchNo} nástěnný ${ip} – kompletní přístroj (bez rámečku)`, appearance, unit: "ks" }, units);
        continue;
      }
      if (decento) {
        add({ category: "Přístroje spínačů", ...decentoMpn(DECENTO_SWITCH[switchNo] ?? null, code), name: blind ? "Ovládač žaluziový Decento – kompletní přístroj s kulatým rámečkem" : `Spínač řazení ${switchNo} Decento – kompletní přístroj s kulatým rámečkem`, appearance, unit: "ks" }, units);
        continue;
      }
      const mechanism = isAbb && !item.led && !item.ip44 ? (ABB_MECHANISMS[switchNo] ?? null) : null;
      add({ category: "Přístroje spínačů", mpn: mechanism, verified: Boolean(mechanism), name: blind ? "Žaluziový spínač – přístroj" : `Spínač řazení ${switchNo} – přístroj pod omítku`, appearance: found ? found.brand.label : "–", unit: "ks" }, units);
      const kind: CoverKind = blind ? "blind" : DIVIDED.has(switchNo) ? "divided" : "single";
      const cover = matrix?.cover(kind) ?? null;
      add({ category: "Kryty spínačů", ...withColor(cover?.base ?? null, code, cover?.verified ?? false, "insert", matrix?.join), name: blind ? "Kryt žaluziového spínače" : kind === "divided" ? "Kryt spínače dělený" : "Kryt spínače jednoduchý", appearance, unit: "ks" }, units);
      frame();
      continue;
    }
    if (monoblock && (item.kind === "single_socket" || item.kind === "double_socket")) {
      add({ category: "Zásuvky", mpn: null, verified: false, name: `${item.kind === "double_socket" ? "Dvojzásuvka 2N" : "Zásuvka 1N"} nástěnná ${ip} s odklápěcím víčkem – kompletní přístroj`, appearance, unit: "ks" }, units);
      continue;
    }
    // Fáze 91: Decento – zásuvka jednonásobná, dvojzásuvka jako 2 samostatné přístroje (dvojzásuvku řada nemá)
    if (decento && (item.kind === "single_socket" || item.kind === "double_socket")) {
      const usb = item.variant === "usb";
      const name = usb ? "Přístroj nabíjecí USB-A, USB-C Decento – kompletní přístroj" : item.variant === "surge" ? "Zásuvka 1N s přepěťovou ochranou T3 – Decento ji v katalogu nevede" : item.kind === "double_socket" ? "Zásuvka 1N Decento – dvojzásuvka jako 2 samostatné přístroje (rozteč krabic min. 90 mm)" : "Zásuvka 1N Decento – kompletní přístroj s kulatým rámečkem";
      const mpn = usb ? decentoMpn(DECENTO_USB, code, ["", "N"]) : item.variant === "surge" || item.variant === "ip44" ? { mpn: null, verified: false } : decentoMpn(DECENTO_SOCKET, code);
      add({ category: "Zásuvky", ...mpn, name, appearance, unit: "ks" }, units * (item.kind === "double_socket" ? 2 : 1));
      continue;
    }
    if (item.kind === "single_socket") {
      const socket = item.variant === "ip44" || item.variant === "usb" || item.variant === "surge" ? null : (matrix?.socket1 ?? null);
      const name = item.variant === "ip44" ? "Zásuvka 1N IP44" : item.variant === "usb" ? "Zásuvka 1N s USB-A / USB-C nabíječkou (přístroj + kryt)" : item.variant === "surge" ? "Zásuvka 1N s přepěťovou ochranou T3 (přístroj + kryt)" : "Zásuvka 1N s krytem (přístroj + kryt)";
      add({ category: "Zásuvky", ...withColor(socket, code, true), name, appearance, unit: "ks" }, units);
      frame();
      continue;
    }
    if (item.kind === "double_socket") {
      // Ve víceramečku = 2 jednozásuvky s krytem vedle sebe (dvojzásuvka je jinak kompletní přístroj s rámečkem)
      if (inFrame) add({ category: "Zásuvky", ...withColor(matrix?.socket1 ?? null, code, true), name: "Zásuvka 1N s krytem (přístroj + kryt) – ve víceramečku", appearance, unit: "ks" }, units * 2);
      else add({ category: "Zásuvky", ...withColor(matrix?.socket2 ?? null, code, true), name: "Dvojzásuvka 2N – kompletní přístroj", appearance, unit: "ks" }, units);
      continue;
    }
    if (item.kind === "data_socket" && item.variant === "tv") {
      // Fáze 101: anténní zásuvka TV / SAT – koncová / průběžná podle rozvodu antény, typ podle katalogu výrobce řady
      add({ category: "Ostatní přístroje", mpn: null, verified: false, name: "Anténní zásuvka TV / SAT (koaxiální, 75 Ω)", appearance, unit: "ks" }, units);
      frame();
    } else if (item.kind === "data_socket") {
      add({ category: "Ostatní přístroje", ...(decento ? decentoMpn(DECENTO_DATA, code) : { mpn: null, verified: false }), name: decento ? "Zásuvka komunikační Decento (pro 2× keystone RJ45) – kompletní přístroj" : "Datová zásuvka RJ45 (Cat6)", appearance, unit: "ks" }, units);
      frame();
    }
  }
  // Víceramečky: jeden rámeček NR za skupinu v řadě a barvě kotvy (první přístroj rámečku)
  for (const group of new Set(frameOf.values())) {
    const members = group.members.map((id) => everything.find((element) => element.id === id)).filter((element): element is EditorElement => Boolean(element));
    if (members.length < 2) continue;
    const gangs = Math.min(5, members.reduce((sum, element) => sum + gangsOf(element), 0));
    const style = look(members[0]);
    // Fáze 91: nástěnné řady a Decento bez víceramečku; víceramček nad limit řady = skutečně vyráběné rámečky
    if (style.monoblock || style.separate) continue;
    const parts = splitFrameGangs(gangs, style.maxGang);
    for (const part of parts) {
      add({ category: "Rámečky", ...frameNumber(style, part), name: parts.length > 1 ? `Rámeček ${part}násobný (${part}R) – víceramček ${gangs}R rozdělený podle řady (${splitLabel(parts)})` : `Rámeček ${gangs}násobný (${gangs}R) – víceramček`, appearance: style.appearance, unit: "ks" }, 1);
    }
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
  // Fáze 81: systémový modul chytré domácnosti mimo DIN lištu (nástěnný SysAP) a příslušenství kusů na liště (adaptér
  // SysAP na DIN lištu) – do kusovníku domovní instalace
  const smartModules = smartPlanOf(draft)?.modules ?? [];
  for (const unit of smartModules.filter((module) => module.modules === 0)) {
    add({ category: "Chytré moduly", mpn: unit.articleNumber, verified: unit.verified, name: `${unit.label} (${unit.typeCode}) – nástěnná montáž`, appearance: "–", unit: "ks" }, 1);
  }
  for (const unit of smartModules) {
    if (unit.accessory) add({ category: "Chytré moduly", mpn: unit.accessory.articleNumber, verified: true, name: `${unit.accessory.label} (${unit.accessory.typeCode}) – k ${unit.typeCode.split(" + ")[0]}`, appearance: "–", unit: "ks" }, 1);
  }
  // Fáze 91: instalační krabice podle výrobce, konstrukce stěny a hloubky přístroje (tabulka doporučených krabic)
  for (const line of compileBoxUsage(draft, options.cableEnds)) {
    const maker = boxMakerLabel(line.maker);
    const wall = wallTypeOf(line.wall).short;
    add(
      {
        category: "Instalační krabice",
        mpn: line.box?.code ?? null,
        verified: Boolean(line.box?.code),
        name: line.box ? `${line.box.type} – ${line.box.purpose}` : `${line.missing ?? "Instalační krabice"} – ${maker} tento typ nevede (zvolte krabici jiného výrobce)`,
        appearance: line.box ? boxMakerLabel(line.box.maker) : maker,
        unit: "ks",
        box: { maker: line.box ? boxMakerLabel(line.box.maker) : maker, type: line.box?.type ?? "–", depthMm: line.box?.depthMm ?? null, purpose: line.box ? line.box.purpose : `${line.missing ?? "Instalační krabice"} (${wall})` },
      },
      line.quantity,
    );
  }
  for (const cable of options.cables ?? []) add({ category: "Kabely", mpn: null, verified: true, name: cable.cable, appearance: "–", unit: "m" }, Math.ceil(cable.meters));
  // Fáze 93: místní přípojnice EKV každé místnosti s přípojkami a vodič doplňujícího pospojování (odhad 3 m na přípojku)
  if (bonding.length) {
    add({ category: "Bezpečnostní a zdravotnické prvky", mpn: null, verified: false, name: "Přípojnice EKV místnosti (místní ekvipotenciální přípojnice zdravotnického prostoru)", appearance: "–", unit: "ks" }, new Set(bonding.map((element) => element.room)).size);
    add({ category: "Kabely", mpn: null, verified: false, name: `${EKV_CONDUCTOR} – doplňující ochranné pospojování (odhad ${EKV_CONDUCTOR_M} m na přípojku EKV)`, appearance: "–", unit: "m" }, bonding.length * EKV_CONDUCTOR_M);
  }
  const order = (row: WiringBomRow) => BOM_CATEGORIES.indexOf(row.category);
  return [...rows.values()].sort((a, b) => order(a) - order(b) || a.appearance.localeCompare(b.appearance, "cs") || (a.mpn ?? a.name).localeCompare(b.mpn ?? b.name, "cs"));
}

/** Fáze 91: nadpis samostatné tabulky krabic (kusovník, PDF, CSV / XLSX). */
export const BOX_TABLE_TITLE = "📦 Doporučené instalační krabičky a montážní příslušenství (dle prostředí a hloubky)";

/** Fáze 91: řádky kusovníku bez instalačních krabic (ty jsou v samostatné tabulce). */
export const bomMainRows = (rows: readonly WiringBomRow[]) => rows.filter((row) => !row.box);
export const bomBoxRows = (rows: readonly WiringBomRow[]) => rows.filter((row): row is WiringBomRow & { box: BomBoxInfo } => Boolean(row.box));

/** Fáze 91: tabulka doporučených krabic (hlavička + data). */
export function boxTable(rows: readonly WiringBomRow[]): (string | number)[][] {
  return [["Výrobce", "Typové označení", "Objednací kód / katalogové číslo", "EAN (GTIN)", "Hloubka (mm)", "Určení / prostředí", "Počet ks"], ...bomBoxRows(rows).map((row) => [row.box.maker, row.box.type, bomOrderLabel(row), row.ean ?? "", row.box.depthMm ?? "–", row.box.purpose, row.quantity])];
}

/** Řádky tabulky pro CSV / XLSX (hlavička + data); fáze 91 – krabice v samostatné tabulce na konci. */
export function bomTable(rows: readonly WiringBomRow[]): (string | number)[][] {
  const main = [["Kategorie", "Objednací číslo (MPN)", "EAN (GTIN)", "Název a specifikace", "Řada a barva", "Počet", "Jednotka", "Ověření"], ...bomMainRows(rows).map((row) => [row.category, bomOrderLabel(row), row.ean ?? "", row.name, row.appearance, row.quantity, row.unit, row.mpn ? (row.ean ? "data výrobce ETIM 9.0" : row.verified ? "katalog" : "ověřit") : "dle výrobce / projektu"])];
  const boxes = boxTable(rows);
  return boxes.length > 1 ? [...main, [], [BOX_TABLE_TITLE], ...boxes] : main;
}
