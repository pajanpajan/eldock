// Fáze 92: tréninkové zakázky AI Panel Builderu (TRENAŽÉR – 0 kreditů). Každá zakázka je skutečný projekt rozváděče
// vygenerovaný z nákresu 2D půdorysu stejným generátorem jako vlastní zakázky – byt 3+kk (klasická instalace TN-S),
// velikost skříně v názvu = skříň, kterou generátor s rezervou 25 % (ČSN EN 61439) vybere (test ji hlídá);
// rodinný dům s FVE, wallboxem a tepelným čerpadlem (záměrná normová chyba pro Elektro-linter) a chytrý dům
// ABB-free@home. Kroky taháku odkazují na skutečné kroky projektu (`STEPS` v `PanelSteps.tsx`). Čisté funkce.

import { convertForLevel, emptyDraft, paletteItem, wallRotation, type EditorElement, type EditorRoom, type FloorplanDraft } from "./floorplan-editor";
import { SANDBOX_TRAINER_PRESET, sandboxDraft } from "./floorplan-sandbox-preset";

export const TRAINER_PRESETS = ["byt-3kk", "rd-fve", "chytry-dum"] as const;
export type TrainerPresetId = (typeof TRAINER_PRESETS)[number];
export const isTrainerPreset = (value: unknown): value is TrainerPresetId => TRAINER_PRESETS.includes(value as TrainerPresetId);

/** Krok taháku rozváděče: klíč kroku projektu a co v něm elektrikář udělá. */
export interface TrainerStep {
  key: "recognition" | "tree" | "enclosure" | "thermal" | "documentation";
  text: string;
}

export interface TrainerJob {
  id: TrainerPresetId;
  icon: string;
  title: string;
  /** Název projektu rozváděče („Trenažér – …“) – v seznamu projektů je hned poznat. */
  projectName: string;
  customerName: string;
  installationSite: string;
  pitch: string;
  /** Normová chyba, kterou zakázka záměrně obsahuje (Elektro-linter ji najde a opraví jedním klikem). */
  defect: string | null;
  steps: readonly TrainerStep[];
}

export const TRAINER_JOBS: readonly TrainerJob[] = [
  {
    id: "byt-3kk",
    icon: "🏠",
    title: "Bytová rozvodnice 48M (Klasická instalace TN-S)",
    projectName: "Trenažér – Bytová rozvodnice 3+kk",
    customerName: "Cvičná zakázka – byt 3+kk",
    installationSite: "Byt 3+kk, předsíň",
    pitch: "Vyvážení fází L1 / L2 / L3, N-můstky za chrániči a bleskový tisk elaborátu a štítků.",
    defect: null,
    steps: [
      { key: "recognition", text: "Prohlédněte osazení DIN lišt – Elektro-linter hlídá chrániče, póly a rezervu." },
      { key: "tree", text: "Zkontrolujte vyvážení fází L1 / L2 / L3 a N-můstky za chrániči." },
      { key: "enclosure", text: "Ověřte skříň rozvodnice a rezervu modulů." },
      { key: "thermal", text: "Zkontrolujte oteplení skříně a bilanci ztrát." },
      { key: "documentation", text: "Vytiskněte PDF elaborát a štítky rozvodnice." },
    ],
  },
  {
    id: "rd-fve",
    icon: "☀️",
    title: "Rodinný dům + FVE a Wallbox 96M (s úkolem v Elektro-linteru)",
    projectName: "Trenažér – RD s FVE a wallboxem",
    customerName: "Cvičná zakázka – rodinný dům",
    installationSite: "Bungalov 4+kk, technická místnost",
    pitch: "Rozváděč má záměrně jednu normovou chybu – najděte ji v Elektro-linteru a opravte jedním klikem.",
    defect: "Wallbox je za proudovým chráničem typu A – dle ČSN 33 2130 ed. 4 musí být okruh s výkonovou elektronikou (EV, FVE, TČ) za chráničem typu B nebo F.",
    steps: [
      { key: "recognition", text: "Klikněte v části 1a v Elektro-linteru na [Opravit 1 klikem] – chránič wallboxu musí být typ B." },
      { key: "tree", text: "Projděte zapojení a hierarchii – FVE, wallbox a TČ mají vlastní chrániče." },
      { key: "enclosure", text: "Zkontrolujte skříň rozváděče a rezervu modulů." },
      { key: "thermal", text: "Zkontrolujte oteplení skříně ve fázi 3." },
      { key: "documentation", text: "Vytiskněte PDF elaborát ve fázi 4." },
    ],
  },
  {
    id: "chytry-dum",
    icon: "🏡",
    title: "Chytrý dům ABB-free@home® 120M",
    projectName: "Trenažér – Chytrý dům ABB-free@home",
    customerName: "Cvičná zakázka – chytrý dům",
    installationSite: "Bungalov 4+kk, technická místnost",
    pitch: "Silnoproudé jističe a DIN akční členy ABB-free@home (SA-M, DA/M, BA-M, HA-M, napájecí zdroj) s výpočtem oteplení skříně.",
    defect: null,
    steps: [
      { key: "recognition", text: "Najděte na DIN lištách akční členy ABB-free@home (spínací SA-M, stmívací DA/M, žaluziový BA-M, topení HA-M)." },
      { key: "tree", text: "Zkontrolujte, které jističe napájejí akční členy a zdroj sběrnice." },
      { key: "enclosure", text: "Ověřte skříň – akční členy zaberou víc modulů než klasické jističe." },
      { key: "thermal", text: "Zkontrolujte oteplení skříně se ztrátami akčních členů (IEC TR 60890)." },
      { key: "documentation", text: "Vytiskněte PDF elaborát se seznamem přístrojů." },
    ],
  },
];

export const trainerJob = (id: string | null | undefined): TrainerJob | null => TRAINER_JOBS.find((job) => job.id === id) ?? null;

/** Rozváděč z trenažéru 2D půdorysu (cvičný bungalov) – tahák s krokem generování z půdorysu. */
export const SANDBOX_JOB: Omit<TrainerJob, "id"> & { id: typeof SANDBOX_TRAINER_PRESET } = {
  id: SANDBOX_TRAINER_PRESET,
  icon: "🎯",
  title: "Rozváděč z cvičného bungalovu (trenažér 2D půdorysu)",
  projectName: "Trenažér – rozváděč z bungalovu 4+kk",
  customerName: "Cvičná zakázka – bungalov 4+kk",
  installationSite: "Bungalov 4+kk, technická místnost",
  pitch: "Rozváděč vygenerovaný z půdorysu – projděte kroky a vytiskněte elaborát.",
  defect: null,
  steps: [
    { key: "recognition", text: "Prohlédněte jističe, chrániče a akční členy ABB-free@home vygenerované z půdorysu." },
    { key: "tree", text: "Zkontrolujte strom zapojení a vyvážení fází." },
    { key: "enclosure", text: "Ověřte skříň a rezervu modulů." },
    { key: "thermal", text: "Zkontrolujte oteplení skříně." },
    { key: "documentation", text: "Vytiskněte PDF elaborát s půdorysem." },
  ],
};

/** Tahák projektu z trenažéru (tréninková zakázka nebo cvičný bungalov), null = vlastní zakázka. */
export const trainerOf = (preset: string | null | undefined) => (preset === SANDBOX_TRAINER_PRESET ? SANDBOX_JOB : trainerJob(preset));

// ---------------------------------------------------------------------------
//  Nákresy tréninkových zakázek
// ---------------------------------------------------------------------------

function element(rooms: readonly EditorRoom[], id: string, item: string, x: number, y: number, room: string, patch: Partial<EditorElement> = {}): EditorElement {
  const palette = paletteItem(item);
  const wall = palette?.kind === "single_socket" || palette?.kind === "double_socket" || palette?.kind === "data_socket";
  const target = rooms.find((candidate) => candidate.name === room) ?? null;
  return { id, item, x, y, room, mountHeightMm: null, frameUnits: palette?.kind === "double_socket" ? 2 : 1, series: null, color: null, controls: [], rotation: wall ? wallRotation(target, x, y) : 0, scale: null, ...patch };
}

const FLAT_ROOMS: readonly EditorRoom[] = [
  { id: "b-obyvak", name: "Obývací pokoj s kuchyní", x: 1000, y: 1000, w: 5000, h: 4500 },
  { id: "b-loznice", name: "Ložnice", x: 6000, y: 1000, w: 3800, h: 4500 },
  { id: "b-predsin", name: "Předsíň", x: 1000, y: 5500, w: 2500, h: 3500 },
  { id: "b-koupelna", name: "Koupelna", x: 3500, y: 5500, w: 2500, h: 3500 },
  { id: "b-wc", name: "WC", x: 6000, y: 5500, w: 1200, h: 3500 },
  { id: "b-detsky", name: "Dětský pokoj", x: 7200, y: 5500, w: 2600, h: 3500 },
];

/** Byt 3+kk: klasická instalace, ABB Levit, soustava TN-S, bytová rozvodnice v předsíni. */
export function trainerFlatDraft(): FloorplanDraft {
  const at = (id: string, item: string, x: number, y: number, room: string, patch: Partial<EditorElement> = {}) => element(FLAT_ROOMS, id, item, x, y, room, patch);
  const fixture = (id: string, item: string, x: number, y: number, room: string, rotation: number) => ({ ...at(id, item, x, y, room), rotation });
  const OB = "Obývací pokoj s kuchyní";
  return {
    ...emptyDraft(),
    rooms: FLAT_ROOMS.map((room) => ({ ...room })),
    environment: "INDOOR_DRY",
    installation: "classic",
    supplySystem: "3F_TNS",
    series: "ABB|Levit",
    elements: [
      at("rh", "panel", 1300, 7000, "Předsíň"),
      at("pr-z1", "socket", 2200, 9000, "Předsíň"),
      at("pr-l1", "ceiling-light", 2250, 7200, "Předsíň"),
      at("pr-s1", "switch-1", 3300, 5800, "Předsíň", { controls: ["pr-l1"] }),
      fixture("ob-linka", "arch-kitchen", 2300, 1300, OB, 0),
      fixture("ob-gauc", "arch-sofa", 4400, 4200, OB, 180),
      at("ob-vd", "cooktop", 2300, 1350, OB),
      at("ob-tr", "oven", 3000, 1350, OB),
      at("ob-my", "dishwasher", 1500, 1350, OB),
      at("ob-ch", "fridge", 3800, 1350, OB),
      at("ob-zl1", "worktop-socket", 1800, 1000, OB),
      at("ob-zl2", "worktop-socket", 2900, 1000, OB),
      at("ob-z1", "double-socket", 1000, 3500, OB),
      at("ob-z2", "double-socket", 4400, 5500, OB),
      at("ob-z3", "double-socket", 6000, 3000, OB),
      at("ob-l1", "ceiling-light", 2300, 2600, OB),
      at("ob-l2", "ceiling-light", 4200, 3000, OB),
      at("ob-s1", "switch-5", 1300, 5300, OB, { controls: ["ob-l1", "ob-l2"] }),
      fixture("lo-postel", "arch-bed-double", 7900, 2000, "Ložnice", 0),
      at("lo-z1", "double-socket", 6600, 1000, "Ložnice"),
      at("lo-z2", "double-socket", 9200, 1000, "Ložnice"),
      at("lo-z3", "double-socket", 9800, 4200, "Ložnice"),
      at("lo-l1", "ceiling-light", 7900, 3800, "Ložnice"),
      at("lo-s1", "switch-1", 6300, 5250, "Ložnice", { controls: ["lo-l1"] }),
      fixture("ko-vana", "bath", 4750, 8625, "Koupelna", 180),
      fixture("ko-umyvadlo", "basin", 5775, 6600, "Koupelna", 90),
      at("ko-z1", "ip44-socket", 3500, 6400, "Koupelna"),
      at("ko-pr", "washer", 3900, 6000, "Koupelna"),
      at("ko-l1", "ceiling-light", 4750, 6800, "Koupelna"),
      at("ko-s1", "switch-1", 3250, 5900, "Předsíň", { controls: ["ko-l1"] }),
      fixture("wc-misa", "arch-wc", 6600, 8675, "WC", 180),
      at("wc-l1", "ceiling-light", 6600, 7000, "WC"),
      at("wc-s1", "switch-1", 3300, 6100, "Předsíň", { controls: ["wc-l1"] }),
      fixture("dp-postel", "arch-bed-single", 8250, 8000, "Dětský pokoj", 180),
      at("dp-z1", "double-socket", 9800, 6400, "Dětský pokoj"),
      at("dp-z2", "double-socket", 7200, 8300, "Dětský pokoj"),
      at("dp-l1", "ceiling-light", 8500, 6800, "Dětský pokoj"),
      at("dp-s1", "switch-1", 7450, 5750, "Dětský pokoj", { controls: ["dp-l1"] }),
    ],
    updatedAt: 0,
  };
}

/** Rodinný dům s FVE, wallboxem a tepelným čerpadlem – cvičný bungalov převedený na klasickou instalaci (TN-C-S). */
export function trainerPvHouseDraft(): FloorplanDraft {
  const base = convertForLevel({ ...sandboxDraft(), supplySystem: "3F_TNCS" }, "classic").draft;
  const rooms = base.rooms;
  const extras = [
    element(rooms, "te-fve", "pv-inverter", 1400, 7600, "Technická místnost"),
    element(rooms, "te-tc", "heat-pump", 2500, 9600, "Technická místnost"),
    element(rooms, "te-ev", "wallbox", 1200, 10300, "Technická místnost"),
  ];
  return { ...base, elements: [...base.elements, ...extras] };
}

/** Stmívaná svítidla chytrého domu (kuchyň, obývák, ložnice, koupelna). */
const SMART_DIMMED = new Set(["ok-l1", "ok-l3", "lo-l1", "ko-l1"]);

/** Chytrý dům ABB-free@home – cvičný bungalov s žaluziemi, topnými zónami (prostorové jednotky) a stmíváním. */
export function trainerSmartHouseDraft(): FloorplanDraft {
  const base = sandboxDraft();
  const rooms = base.rooms;
  const extras = [
    element(rooms, "ok-zal1", "bus-blind", 1300, 4900, "Obývací pokoj s kuchyní"),
    element(rooms, "ok-zal2", "bus-blind", 7700, 4700, "Obývací pokoj s kuchyní"),
    element(rooms, "lo-zal1", "bus-blind", 8350, 4700, "Ložnice"),
    element(rooms, "dp-zal1", "bus-blind", 4700, 7900, "Dětský pokoj"),
    element(rooms, "pr-zal1", "bus-blind", 8700, 7900, "Pracovna"),
    element(rooms, "ok-pj", "bus-room", 7700, 4100, "Obývací pokoj s kuchyní"),
    element(rooms, "lo-pj", "bus-room", 8350, 4100, "Ložnice"),
    element(rooms, "ko-pj", "bus-room", 12350, 4700, "Koupelna"),
    element(rooms, "dp-pj", "bus-room", 4700, 8500, "Dětský pokoj"),
    element(rooms, "pr-pj", "bus-room", 8700, 8500, "Pracovna"),
  ];
  return {
    ...base,
    elements: [...base.elements.map((item) => (SMART_DIMMED.has(item.id) ? { ...item, light: { dimmable: true, powerW: 20, load: "led" as const } } : item)), ...extras],
  };
}

/** Nákres tréninkové zakázky. */
export function trainerDraft(id: TrainerPresetId): FloorplanDraft {
  if (id === "byt-3kk") return trainerFlatDraft();
  if (id === "rd-fve") return trainerPvHouseDraft();
  return trainerSmartHouseDraft();
}
