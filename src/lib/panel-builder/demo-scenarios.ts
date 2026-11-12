// Fáze 99: „🎯 Demo scénáře (Prezentace)“ – kompletní, vizuálně působivé nákresy 2D půdorysu na 1 klik pro živou ukázku.
// Každý scénář je běžný půdorys firmy (uloží se jako nový půdorys, nic nepřepíše) – prezentující projde fáze 1–5,
// ukáže trasy kabelů, kusovník s krabičkami KOPOS a jedním klikem vygeneruje rozváděč:
//   1 Rodinný dům 4+kk + FVE & Smart Home (ABB Levit / free@home) – spotřebiče indukce, TČ, FVE, wallbox, stmívaná
//     světla, žaluzie, hluboké krabice KOPOS KPR 68;
//   2 Zdravotnická ordinace – Skupina 1 (ČSN 33 2000-7-710 ed. 2) – lůžková rampa LUZ, EKV, zásuvky vyšetřovny ve
//     2 okruzích A / B pod 2 chrániči 30 mA typu A (generátor rozváděče);
//   3 Obchodní centrum – nájemní jednotka (BD4, ČSN 33 2000-7-718) – bezhalogenové kabely B2ca, nouzová úniková svítidla,
//     vypínací spoušť CENTRAL STOP a podružný elektroměr MID (generátor rozváděče).
// Čisté funkce.

import { emptyDraft, paletteItem, wallRotation, type EditorElement, type EditorRoom, type FloorplanDraft, type LightSpec } from "./floorplan-editor";
import { SANDBOX_BATH_LIGHT_ID, SANDBOX_ROOMS, sandboxElements } from "./floorplan-sandbox-preset";

export type DemoScenarioId = "rd-4kk" | "ordinace" | "oc-jednotka";

export interface DemoScenario {
  id: DemoScenarioId;
  icon: string;
  /** Položka nabídky „🎯 Demo scénáře“. */
  label: string;
  /** Co scénář ukáže (podtitul v nabídce). */
  hint: string;
  /** Název uloženého půdorysu. */
  name: string;
  customer: string;
  site: string;
}

export const DEMO_SCENARIOS: readonly DemoScenario[] = [
  {
    id: "rd-4kk",
    icon: "🏠",
    label: "Rodinný dům 4+kk + FVE & Smart Home (ABB Levit M / free@home)",
    hint: "Indukce, TČ, FVE a wallbox, stmívaná světla, žaluzie, krabice KOPOS KPR 68 – fáze 1–5 a 3f rozváděč na 1 klik",
    name: "DEMO – Rodinný dům 4+kk + FVE & Smart Home",
    customer: "Ukázkový investor – rodinný dům",
    site: "Jablonec nad Nisou",
  },
  {
    id: "ordinace",
    icon: "🏥",
    label: "Zdravotnická ordinace – Skupina 1 (ČSN 33 2000-7-710 ed. 2)",
    hint: "Lůžková rampa LUZ a EKV; zásuvky vyšetřovny ve 2 okruzích A / B pod 2 chrániči 30 mA typu A",
    name: "DEMO – Zdravotnická ordinace (Skupina 1)",
    customer: "Ukázková ordinace praktického lékaře",
    site: "Liberec",
  },
  {
    id: "oc-jednotka",
    icon: "🛍️",
    label: "Obchodní centrum – Nájemní jednotka (BD4 · Bezhalogenové B2ca)",
    hint: "Kabely 1-CHKE-R (N2XH-J) B2ca-s1,d1,a1, nouzová úniková svítidla, CENTRAL STOP a podružný elektroměr MID",
    name: "DEMO – Obchodní centrum, nájemní jednotka (BD4)",
    customer: "Ukázkový nájemce – obchodní centrum",
    site: "Praha",
  },
];

export const isDemoScenarioId = (value: unknown): value is DemoScenarioId => DEMO_SCENARIOS.some((scenario) => scenario.id === value);
export const demoScenario = (id: DemoScenarioId): DemoScenario => DEMO_SCENARIOS.find((scenario) => scenario.id === id)!;

const LED: LightSpec = { dimmable: false, powerW: 18, load: "led" };
const DIM: LightSpec = { dimmable: true, powerW: 24, load: "led" };

function builder(rooms: readonly EditorRoom[]) {
  const roomOf = (name: string) => rooms.find((room) => room.name === name)!;
  /** Prvek palety; zásuvky a nástěnná svítidla „nožičkou“ ke stěně (stejně jako při vkládání v editoru). */
  const el = (id: string, item: string, x: number, y: number, room: string, patch: Partial<EditorElement> = {}): EditorElement => {
    const palette = paletteItem(item);
    if (!palette) throw new Error(`Neznámá položka palety ${item}`);
    const wall = palette.kind === "single_socket" || palette.kind === "double_socket" || palette.kind === "data_socket" || (palette.kind === "light" && palette.variant === "wall");
    return { id, item, x, y, room, mountHeightMm: null, frameUnits: palette.kind === "double_socket" ? 2 : 1, series: null, color: null, controls: [], rotation: wall ? wallRotation(roomOf(room), x, y) : 0, scale: null, ...patch };
  };
  /** Zařizovací předmět, nábytek, okno nebo dveře: střed a natočení (0 = u horní stěny, 90 vpravo, 180 dole, 270 vlevo). */
  const fixture = (id: string, item: string, x: number, y: number, room: string, rotation: number): EditorElement => ({ ...el(id, item, x, y, room), rotation });
  return { el, fixture };
}

// ---------------------------------------------------------------------------
//  1 Rodinný dům 4+kk + FVE & Smart Home (dokončený cvičný bungalov fáze 92)
// ---------------------------------------------------------------------------

function houseDraft(): FloorplanDraft {
  const { el, fixture } = builder(SANDBOX_ROOMS);
  const OK = "Obývací pokoj s kuchyní";
  const LO = "Ložnice";
  const KO = "Koupelna";
  const CH = "Chodba";
  const TE = "Technická místnost";
  const DP = "Dětský pokoj";
  const PR = "Pracovna";
  // Stmívaná světla obýváku a koupelny; zásuvky a sběrnicová tlačítka v hlubokých krabicích KPR 68 (WAGO, elektronika)
  const dimmed = new Set(["ok-l1", "ok-l2", "ok-l3", "lo-l1", SANDBOX_BATH_LIGHT_ID]);
  const base = sandboxElements().map((element): EditorElement => {
    const kind = paletteItem(element.item)?.kind;
    const light = kind === "light" ? (dimmed.has(element.id) ? DIM : LED) : undefined;
    const deep = kind === "single_socket" || kind === "double_socket" || kind === "switch" || element.item.startsWith("bus-");
    return { ...element, ...(light ? { light } : {}), ...(deep ? { box: "deep" as const } : {}) };
  });
  const extra: EditorElement[] = [
    // Zásuvka u postele (úkol trenažéru je tu hotový)
    el("lo-z3", "double-socket", 11400, 1000, LO, { box: "deep" }),
    // Koupelna: sprchový kout v pravém dolním rohu
    fixture("ko-sprcha", "shower", 14300, 5000, KO, 180),
    // Technická místnost: tepelné čerpadlo a střídač FVE u rozváděče RH
    el("te-tc", "heat-pump", 2550, 9300, TE),
    el("te-fve", "pv-inverter", 1350, 7800, TE),
    // Chodba: vstupní dveře a wallbox na vnější stěně u vjezdu
    fixture("ch-dvere", "arch-door-1", 1400, 6300, CH, 270),
    el("ch-ev", "wallbox", 1000, 5800, CH),
    // Obývák: dveře do chodby, okno s motorem žaluzie a sběrnicové žaluziové tlačítko
    fixture("ok-dvere", "arch-door-1", 4500, 5100, OK, 180),
    fixture("ok-okno", "arch-window-2", 6200, 1000, OK, 0),
    el("ok-m1", "blind-motor", 6950, 1000, OK, { rotation: 0 }),
    el("ok-zal", "bus-blind", 7300, 5300, OK, { controls: ["ok-m1"], box: "deep" }),
    // Dětský pokoj a pracovna: okna nad stoly, motory žaluzií a žaluziová tlačítka u dveří
    fixture("dp-okno", "arch-window-1", 7300, 10600, DP, 180),
    el("dp-m1", "blind-motor", 7950, 10600, DP, { rotation: 180 }),
    el("dp-zal", "bus-blind", 5100, 7350, DP, { controls: ["dp-m1"], box: "deep" }),
    fixture("pr-okno", "arch-window-1", 11000, 10600, PR, 180),
    el("pr-m1", "blind-motor", 11650, 10600, PR, { rotation: 180 }),
    el("pr-zal", "bus-blind", 9100, 7350, PR, { controls: ["pr-m1"], box: "deep" }),
  ];
  return {
    ...emptyDraft(),
    rooms: SANDBOX_ROOMS.map((room) => ({ ...room })),
    elements: [...base, ...extra],
    environment: "INDOOR_DRY",
    installation: "bus_loxone",
    smartSystem: "abb_freeathome",
    series: "ABB|Levit",
    routeStyle: "walls",
    occupancy: "RESIDENTIAL",
    updatedAt: 0,
  };
}

// ---------------------------------------------------------------------------
//  2 Zdravotnická ordinace – Skupina 1
// ---------------------------------------------------------------------------

const CLINIC_ROOMS: readonly EditorRoom[] = [
  { id: "m-vysetrovna", name: "Vyšetřovna", x: 1000, y: 1000, w: 5000, h: 4000 },
  { id: "m-ordinace", name: "Ordinace lékaře", x: 6000, y: 1000, w: 4000, h: 4000 },
  { id: "m-technicka", name: "Technická místnost", x: 10000, y: 1000, w: 2000, h: 3000 },
  { id: "m-cekarna", name: "Čekárna", x: 1000, y: 5000, w: 5000, h: 3000 },
  { id: "m-sesterna", name: "Sesterna", x: 6000, y: 5000, w: 2500, h: 3000 },
  { id: "m-wc", name: "WC", x: 8500, y: 5000, w: 1500, h: 3000 },
];

function clinicDraft(): FloorplanDraft {
  const { el, fixture } = builder(CLINIC_ROOMS);
  const VY = "Vyšetřovna";
  const OR = "Ordinace lékaře";
  const TE = "Technická místnost";
  const CE = "Čekárna";
  const SE = "Sesterna";
  const elements: EditorElement[] = [
    el("rh", "panel", 10400, 2500, TE),
    el("te-l1", "ceiling-light", 11000, 2500, TE, { light: LED }),
    // Vyšetřovna: lehátko, lůžková rampa LUZ nad ním, EKV, umyvadlo a zásuvky (2 okruhy A / B dělí generátor)
    fixture("vy-lehatko", "arch-exam-bed", 3500, 1700, VY, 0),
    el("vy-luz", "bed-ramp", 3500, 1000, VY),
    el("vy-ekv", "ekv", 1000, 2000, VY),
    fixture("vy-umyvadlo", "basin", 1225, 3900, VY, 270),
    el("vy-z1", "double-socket", 5300, 1000, VY),
    el("vy-z2", "double-socket", 6000, 3000, VY),
    el("vy-z3", "double-socket", 3000, 5000, VY),
    el("vy-z4", "socket", 1000, 3000, VY),
    el("vy-l1", "ceiling-light", 2500, 3000, VY, { light: LED }),
    el("vy-l2", "ceiling-light", 4500, 3000, VY, { light: LED }),
    el("vy-s1", "switch-1", 5650, 4750, VY, { controls: ["vy-l1", "vy-l2"] }),
    // Ordinace lékaře: stůl pod oknem, zásuvky a data
    fixture("or-okno", "arch-window-1", 8000, 1000, OR, 0),
    fixture("or-stul", "arch-desk", 8000, 1300, OR, 0),
    el("or-z1", "double-socket", 7000, 1000, OR),
    el("or-d1", "data-socket", 9000, 1000, OR),
    el("or-z2", "double-socket", 10000, 3000, OR),
    el("or-l1", "ceiling-light", 8000, 3000, OR, { light: LED }),
    el("or-s1", "switch-1", 6350, 4750, OR, { controls: ["or-l1"] }),
    // Čekárna: sedačka, zásuvka, světla a nouzové únikové svítidlo u východu
    fixture("ce-dvere", "arch-door-2", 1400, 6500, CE, 270),
    fixture("ce-sedacka", "arch-sofa", 3500, 7600, CE, 180),
    el("ce-z1", "double-socket", 6000, 6500, CE),
    el("ce-l1", "ceiling-light", 2500, 6500, CE, { light: LED }),
    el("ce-l2", "ceiling-light", 4500, 6500, CE, { light: LED }),
    el("ce-nouz", "emergency-light", 1300, 5300, CE),
    el("ce-s1", "switch-1", 1300, 7750, CE, { controls: ["ce-l1", "ce-l2"] }),
    // Sesterna a WC
    fixture("se-stul", "arch-desk", 7250, 7700, SE, 180),
    el("se-z1", "double-socket", 6000, 7000, SE),
    el("se-d1", "data-socket", 8500, 7000, SE),
    el("se-l1", "ceiling-light", 7250, 6500, SE, { light: LED }),
    el("se-s1", "switch-1", 6300, 5250, SE, { controls: ["se-l1"] }),
    fixture("wc-misa", "arch-wc", 9250, 7675, "WC", 180),
    el("wc-l1", "ceiling-light", 9250, 6200, "WC", { light: LED }),
    el("wc-s1", "switch-1", 8750, 5250, "WC", { controls: ["wc-l1"] }),
  ];
  return {
    ...emptyDraft(),
    rooms: CLINIC_ROOMS.map((room) => ({ ...room })),
    elements,
    environment: "INDOOR_DRY",
    installation: "classic",
    routeStyle: "walls",
    occupancy: "MEDICAL_G1",
    updatedAt: 0,
  };
}

// ---------------------------------------------------------------------------
//  3 Obchodní centrum – nájemní jednotka (BD4)
// ---------------------------------------------------------------------------

const SHOP_ROOMS: readonly EditorRoom[] = [
  { id: "o-prodejna", name: "Prodejna", x: 1000, y: 1000, w: 9000, h: 6000 },
  { id: "o-sklad", name: "Sklad", x: 10000, y: 1000, w: 4000, h: 3500 },
  { id: "o-zazemi", name: "Zázemí personálu", x: 10000, y: 4500, w: 2500, h: 2500 },
  { id: "o-wc", name: "WC", x: 12500, y: 4500, w: 1500, h: 2500 },
];

function shopDraft(): FloorplanDraft {
  const { el, fixture } = builder(SHOP_ROOMS);
  const PO = "Prodejna";
  const SK = "Sklad";
  const ZA = "Zázemí personálu";
  const lights = [2500, 5500, 8500].flatMap((x, column) => [2600, 5200].map((y, row) => el(`po-l${column * 2 + row + 1}`, "ceiling-light", x, y, PO, { light: { dimmable: false, powerW: 36, load: "led" } })));
  const elements: EditorElement[] = [
    el("rh", "panel", 13650, 2600, SK),
    // Prodejna: výloha a vstup z pasáže, pokladna, zásuvky po obvodu, světla po skupinách a nouzová svítidla
    fixture("po-vyloha", "arch-window-hs", 6500, 7000, PO, 180),
    fixture("po-vstup", "arch-door-2", 3000, 6600, PO, 180),
    ...lights,
    el("po-pasek", "led-strip", 6500, 6750, PO, { light: { dimmable: true, powerW: 40, load: "led" } }),
    el("po-nouz1", "emergency-light", 3000, 6800, PO),
    el("po-nouz2", "emergency-light", 9700, 6700, PO),
    el("po-nouz3", "emergency-light", 5500, 1300, PO),
    el("po-pokladna", "double-socket", 1800, 7000, PO),
    el("po-d1", "data-socket", 2300, 7000, PO),
    el("po-z1", "double-socket", 1000, 3000, PO),
    el("po-z2", "double-socket", 1000, 5500, PO),
    el("po-z3", "double-socket", 4000, 1000, PO),
    el("po-z4", "double-socket", 7000, 1000, PO),
    el("po-z5", "double-socket", 10000, 2500, PO),
    el("po-s1", "switch-1", 9650, 6750, PO, { controls: ["po-l1", "po-l2"] }),
    el("po-s2", "switch-1", 9650, 6500, PO, { controls: ["po-l3", "po-l4"] }),
    el("po-s3", "switch-1", 9650, 6250, PO, { controls: ["po-l5", "po-l6", "po-pasek"] }),
    // Sklad
    el("sk-l1", "ceiling-light", 11500, 2700, SK, { light: LED }),
    el("sk-l2", "ceiling-light", 12800, 3600, SK, { light: LED }),
    el("sk-z1", "double-socket", 10000, 3800, SK),
    el("sk-nouz", "emergency-light", 10400, 4250, SK),
    el("sk-s1", "switch-1", 10350, 1300, SK, { controls: ["sk-l1", "sk-l2"] }),
    // Zázemí personálu a WC
    fixture("za-linka", "arch-kitchen", 11250, 6600, ZA, 180),
    el("za-ch", "fridge", 10500, 6650, ZA),
    el("za-boiler", "boiler", 12200, 4800, ZA),
    el("za-z1", "worktop-socket", 11600, 7000, ZA),
    el("za-l1", "ceiling-light", 11250, 5500, ZA, { light: LED }),
    el("za-s1", "switch-1", 10300, 4800, ZA, { controls: ["za-l1"] }),
    fixture("wc-misa", "arch-wc", 13250, 6675, "WC", 180),
    el("wc-l1", "ceiling-light", 13250, 5300, "WC", { light: LED }),
    el("wc-s1", "switch-1", 12750, 4800, "WC", { controls: ["wc-l1"] }),
  ];
  return {
    ...emptyDraft(),
    rooms: SHOP_ROOMS.map((room) => ({ ...room })),
    elements,
    environment: "INDOOR_DRY",
    installation: "classic",
    routeStyle: "walls",
    occupancy: "COMMERCIAL_BD4",
    updatedAt: 0,
  };
}

/** Nákres demo scénáře (nový objekt při každém volání). */
export function demoDraft(id: DemoScenarioId): FloorplanDraft {
  return id === "rd-4kk" ? houseDraft() : id === "ordinace" ? clinicDraft() : shopDraft();
}
