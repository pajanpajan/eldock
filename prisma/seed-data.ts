// Demo data pro seed (specifikace: docs/PLAN.md, sekce C). Čistá data bez I/O.
import type {
  AttachmentType,
  BuildingType,
  ChangeRequestEventType,
  ChangeRequestPriority,
  ChangeRequestStatus,
  EquipmentStatus,
  EquipmentType,
  RevisionStatus,
  UserRole,
} from "../src/generated/prisma/enums";
import type { FloorplanGate, FloorplanRoom } from "../src/lib/mock-graphics/floorplan";
import type { PartOverrides } from "../src/lib/mock-graphics/parts";

// ---------------------------------------------------------------------------
//  Pomocné funkce pro data
// ---------------------------------------------------------------------------

/** Datum z řetězce YYYY-MM-DD (poledne UTC, ať nepřeskočí den při převodu časových pásem). */
export const day = (iso: string, hour = 10): Date => new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00.000Z`);

/** Datum „před N dny“ vůči okamžiku spuštění seedu – otevřené tickety tak vždy působí čerstvě. */
export const daysAgo = (days: number, hour = 10): Date => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

/** Bod půdorysu v pixelech viewBoxu 1200×800 → procenta 0–100. */
const pin = (x: number, y: number): { pinX: number; pinY: number } => ({
  pinX: Math.round((x / 1200) * 1000) / 10,
  pinY: Math.round((y / 800) * 1000) / 10,
});

/** Polygon v pixelech viewBoxu areálu 1000×700 → "x,y x,y …" v procentech. */
const poly = (points: [number, number][]): string =>
  points.map(([x, y]) => `${Math.round((x / 1000) * 1000) / 10},${Math.round((y / 700) * 1000) / 10}`).join(" ");

// ---------------------------------------------------------------------------
//  Uživatelé
// ---------------------------------------------------------------------------

export type UserKey = "novak" | "dvorakova" | "kral" | "markova";

export const USERS: { key: UserKey; id: string; name: string; email: string; role: UserRole; company: string; phone: string }[] = [
  { key: "novak", id: "user-novak", name: "Petr Novák", email: "petr.novak@jbl-automotive.example", role: "MAINTENANCE", company: "Závod Jablonec – Údržba, směna A", phone: "+420 777 100 201" },
  { key: "dvorakova", id: "user-dvorakova", name: "Jana Dvořáková", email: "jana.dvorakova@jbl-automotive.example", role: "MAINTENANCE", company: "Závod Jablonec – Údržba, směna B", phone: "+420 777 100 202" },
  { key: "kral", id: "user-kral", name: "Ing. Tomáš Král", email: "tomas.kral@digitry.example", role: "CAE_ENGINEER", company: "Digitry CAE", phone: "+420 603 200 301" },
  { key: "markova", id: "user-markova", name: "Ing. Lucie Marková", email: "lucie.markova@digitry.example", role: "CAE_ENGINEER", company: "Digitry CAE", phone: "+420 603 200 302" },
];

// ---------------------------------------------------------------------------
//  Závody, budovy, patra
// ---------------------------------------------------------------------------

export const PLANTS = [
  {
    id: "plant-jbc",
    code: "JBC",
    name: "Závod Jablonec",
    customerName: "JBL Automotive Components s.r.o.",
    address: "Průmyslová 1280",
    city: "Jablonec nad Nisou",
  },
  {
    id: "plant-lbc",
    code: "LBC",
    name: "Závod Liberec",
    customerName: "JBL Automotive Components s.r.o.",
    address: "Textilní 45",
    city: "Liberec",
  },
];

export const BUILDINGS: {
  id: string;
  plantId: string;
  code: string;
  name: string;
  shortName: string;
  type: BuildingType;
  description: string;
  mapPolygon: string;
  labelX: number;
  labelY: number;
  sortOrder: number;
}[] = [
  { id: "bld-jbc-a", plantId: "plant-jbc", code: "A", name: "Hala A - Lisovna", shortName: "Lisovna", type: "PRODUCTION", description: "Lisování a obrábění dílů, největší hala areálu.", mapPolygon: poly([[260, 110], [640, 110], [640, 300], [260, 300]]), labelX: 45, labelY: 29, sortOrder: 1 },
  { id: "bld-jbc-b", plantId: "plant-jbc", code: "B", name: "Hala B - Montáž", shortName: "Montáž", type: "ASSEMBLY", description: "Montážní linky dveřních modulů a sedadel.", mapPolygon: poly([[260, 370], [600, 370], [600, 540], [260, 540]]), labelX: 43, labelY: 65, sortOrder: 2 },
  { id: "bld-jbc-e", plantId: "plant-jbc", code: "E", name: "Energetika", shortName: "Energetika", type: "ENERGY", description: "Trafostanice, hlavní rozvodna nn a kompresorovna.", mapPolygon: poly([[700, 110], [840, 110], [840, 250], [770, 250], [770, 200], [700, 200]]), labelX: 78, labelY: 21, sortOrder: 3 },
  { id: "bld-jbc-s", plantId: "plant-jbc", code: "S", name: "Sklad", shortName: "Sklad", type: "WAREHOUSE", description: "Expediční sklad a nabíjení vysokozdvižných vozíků.", mapPolygon: poly([[680, 340], [900, 340], [900, 500], [680, 500]]), labelX: 79, labelY: 60, sortOrder: 4 },
  { id: "bld-jbc-k", plantId: "plant-jbc", code: "K", name: "Administrativa", shortName: "Administrativa", type: "OFFICE", description: "Kanceláře, projekce a zázemí.", mapPolygon: poly([[60, 200], [190, 200], [190, 340], [60, 340]]), labelX: 12.5, labelY: 38.5, sortOrder: 5 },
  { id: "bld-lbc-1", plantId: "plant-lbc", code: "1", name: "Hala 1 - Lakovna", shortName: "Lakovna", type: "PRODUCTION", description: "Lakovací linka a související technologie.", mapPolygon: poly([[250, 200], [650, 200], [650, 450], [250, 450]]), labelX: 45, labelY: 46.5, sortOrder: 1 },
];

export type FloorKey =
  | "e-1pp" | "e-1np" | "a-1np" | "a-2np" | "b-1np" | "s-1np" | "k-1np" | "k-2np" | "lbc-1np";

interface FloorSeed {
  key: FloorKey;
  id: string;
  buildingId: string;
  level: number;
  code: string;
  name: string;
  description: string;
  rooms: FloorplanRoom[];
  gates: FloorplanGate[];
}

const room = (label: string, x: number, y: number, w: number, h: number, kind: FloorplanRoom["kind"] = "room"): FloorplanRoom => ({ label, x, y, w, h, kind });

export const FLOORS: FloorSeed[] = [
  {
    key: "e-1pp", id: "floor-jbc-e-1pp", buildingId: "bld-jbc-e", level: -1, code: "1PP", name: "1. PP - Rozvodny",
    description: "Hlavní rozvodna nn, kompenzace a záložní napájení.",
    rooms: [
      room("Rozvodna nn", 90, 100, 470, 320, "electrical"), room("Kompenzace jalového výkonu", 580, 100, 280, 320, "electrical"),
      room("UPS a baterie", 880, 100, 220, 320, "electrical"), room("Kabelová chodba", 90, 440, 1010, 110),
      room("Schodiště", 90, 570, 130, 170, "stairs"), room("Sklad náhradních dílů", 240, 570, 320, 170),
      room("Dílna údržby", 580, 570, 300, 170), room("Šatna", 900, 570, 200, 170),
    ],
    gates: [{ x: 1120, y: 480, length: 70, orient: "v", label: "Vrata - kabely" }],
  },
  {
    key: "e-1np", id: "floor-jbc-e-1np", buildingId: "bld-jbc-e", level: 0, code: "1NP", name: "1. NP - Trafostanice a kompresorovna",
    description: "Transformátor 22/0,4 kV a stanice stlačeného vzduchu.",
    rooms: [
      room("Trafostanice", 90, 100, 430, 350, "electrical"), room("Kompresorovna", 540, 100, 560, 350, "zone"),
      room("Chodba", 90, 470, 1010, 80), room("Schodiště", 90, 570, 130, 170, "stairs"),
      room("Dílna", 240, 570, 500, 170), room("Zázemí", 760, 570, 340, 170),
    ],
    gates: [{ x: 1120, y: 200, length: 90, orient: "v", label: "Vrata - kompresory" }],
  },
  {
    key: "a-1np", id: "floor-jbc-a-1np", buildingId: "bld-jbc-a", level: 0, code: "1NP", name: "1. NP - Hlavní výroba",
    description: "Lisovací linky, obrábění a robotická pracoviště.",
    rooms: [
      room("Lisovací linka 1", 90, 100, 520, 330, "zone"), room("Obrábění - CNC", 640, 100, 460, 330, "zone"),
      room("Robotická buňka odebírání", 90, 460, 470, 280, "zone"), room("Expedice výlisků", 590, 460, 200, 280), room("Dílna údržby", 810, 460, 170, 280),
      room("Schodiště", 1000, 460, 100, 200, "stairs"),
    ],
    gates: [{ x: 300, y: 760, length: 120, orient: "h", label: "Vrata - zásobování" }, { x: 1120, y: 300, length: 120, orient: "v", label: "Vrata - expedice" }],
  },
  {
    key: "a-2np", id: "floor-jbc-a-2np", buildingId: "bld-jbc-a", level: 1, code: "2NP", name: "2. NP - Vzduchotechnika",
    description: "Strojovna vzduchotechniky haly A.",
    rooms: [
      room("Strojovna VZT", 90, 100, 700, 400, "zone"), room("Rozvodna VZT", 820, 100, 280, 230, "electrical"),
      room("Technické prostory", 820, 350, 280, 150), room("Schodiště", 90, 540, 130, 200, "stairs"),
      room("Střešní výstup", 240, 540, 860, 200),
    ],
    gates: [],
  },
  {
    key: "b-1np", id: "floor-jbc-b-1np", buildingId: "bld-jbc-b", level: 0, code: "1NP", name: "1. NP - Montážní linky",
    description: "Montážní linky dveřních modulů a sedadel, svařovna.",
    rooms: [
      room("Montážní linka 1 - dveřní moduly", 90, 100, 1010, 200, "zone"), room("Montážní linka 2 - sedadla", 90, 320, 1010, 200, "zone"),
      room("Svařovna", 90, 540, 470, 200, "zone"), room("Sklad komponent", 580, 540, 520, 200),
    ],
    gates: [{ x: 1120, y: 600, length: 110, orient: "v", label: "Vrata - expedice" }],
  },
  {
    key: "s-1np", id: "floor-jbc-s-1np", buildingId: "bld-jbc-s", level: 0, code: "1NP", name: "1. NP - Expediční sklad",
    description: "Expediční sklad a nabíjení VZV.",
    rooms: [
      room("Nabíjení VZV", 90, 100, 300, 220, "electrical"), room("Příjem zboží", 410, 100, 690, 220),
      room("Skladové uličky", 90, 340, 1010, 400, "zone"),
    ],
    gates: [{ x: 200, y: 760, length: 140, orient: "h", label: "Rampa 1" }, { x: 500, y: 760, length: 140, orient: "h", label: "Rampa 2" }],
  },
  {
    key: "k-1np", id: "floor-jbc-k-1np", buildingId: "bld-jbc-k", level: 0, code: "1NP", name: "1. NP",
    description: "Recepce, kanceláře a technická místnost.",
    rooms: [
      room("Recepce", 90, 100, 300, 200), room("Kanceláře", 410, 100, 690, 300),
      room("Technická místnost", 90, 320, 200, 150, "electrical"), room("Zasedací místnost", 310, 420, 500, 320),
      room("Schodiště", 90, 500, 130, 240, "stairs"),
    ],
    gates: [],
  },
  {
    key: "k-2np", id: "floor-jbc-k-2np", buildingId: "bld-jbc-k", level: 1, code: "2NP", name: "2. NP - Kanceláře",
    description: "Kanceláře projekce a open space.",
    rooms: [
      room("Kanceláře projekce", 90, 100, 600, 300), room("Open space", 710, 100, 390, 300),
      room("Technická místnost", 90, 420, 200, 150, "electrical"), room("Zasedací místnost", 310, 420, 500, 320),
      room("Schodiště", 90, 600, 130, 140, "stairs"),
    ],
    gates: [],
  },
  {
    key: "lbc-1np", id: "floor-lbc-1-1np", buildingId: "bld-lbc-1", level: 0, code: "1NP", name: "1. NP - Lakovna",
    description: "Lakovací linka, sušicí pec a rozvodna.",
    rooms: [
      room("Lakovací linka", 90, 100, 720, 360, "zone"), room("Rozvodna lakovny", 830, 100, 270, 200, "electrical"),
      room("Sušicí pec", 830, 320, 270, 140, "zone"), room("Příprava", 90, 480, 700, 260),
    ],
    gates: [{ x: 1120, y: 500, length: 110, orient: "v", label: "Vrata - výjezd" }],
  },
];

// ---------------------------------------------------------------------------
//  Zařízení
// ---------------------------------------------------------------------------

export interface EquipmentSeed {
  tag: string;
  name: string;
  type: EquipmentType;
  floor: FloorKey;
  pinX: number;
  pinY: number;
  description: string;
  manufacturer: string;
  model: string;
  yearInstalled: number;
  ratedVoltage: string;
  ratedCurrent: string;
  ipRating: string;
  status: EquipmentStatus;
  // Spotřebiče a nářadí (ČSN 33 1600 ed. 2)
  usageGroup?: string;
  protectionClass?: string;
  inventoryNumber?: string;
  assignedZone?: string;
}

type EquipmentInput = Omit<EquipmentSeed, "pinX" | "pinY" | "status"> & { at: [number, number] };

const equipmentInputs: EquipmentInput[] = [
  { tag: "RM1", name: "RM1 - Hlavní rozváděč nn", type: "SWITCHBOARD", floor: "e-1pp", at: [300, 260], description: "Hlavní rozváděč nn závodu, napájení všech hal.", manufacturer: "Siemens", model: "SIVACON S8", yearInstalled: 2019, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "1600 A", ipRating: "IP31" },
  { tag: "RC1", name: "RC1 - Rozváděč kompenzace jalového výkonu", type: "SWITCHBOARD", floor: "e-1pp", at: [720, 260], description: "Automatická kompenzace účiníku, 6 stupňů.", manufacturer: "Schneider Electric", model: "Varset", yearInstalled: 2019, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "400 A", ipRating: "IP31" },
  { tag: "RZ1", name: "RZ1 - Rozváděč zálohovaného napájení (UPS)", type: "SWITCHBOARD", floor: "e-1pp", at: [990, 260], description: "Zálohované napájení řídicích systémů, UPS s bateriemi.", manufacturer: "Eaton", model: "93PM", yearInstalled: 2020, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "160 A", ipRating: "IP20" },
  { tag: "TR1", name: "TR1 - Transformátor 22/0,4 kV, 1000 kVA", type: "TRANSFORMER", floor: "e-1np", at: [300, 270], description: "Olejový distribuční transformátor, vývod do RM1.", manufacturer: "ABB", model: "RESIBLOC 1000", yearInstalled: 2019, ratedVoltage: "22 kV / 0,4 kV", ratedCurrent: "1443 A", ipRating: "IP21" },
  { tag: "KS1", name: "KS1 - Kompresorová stanice", type: "COMPRESSOR", floor: "e-1np", at: [820, 270], description: "Šroubový kompresor 90 kW s frekvenčním měničem.", manufacturer: "Atlas Copco", model: "GA 90 VSD", yearInstalled: 2020, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "160 A", ipRating: "IP54" },
  { tag: "R-LIS-01", name: "R-LIS-01 - Rozváděč lisovací linky 1", type: "SWITCHBOARD", floor: "a-1np", at: [350, 370], description: "Silový a řídicí rozváděč lisovací linky 1.", manufacturer: "Rittal", model: "TS 8", yearInstalled: 2019, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "250 A", ipRating: "IP54" },
  { tag: "LIS-01", name: "LIS-01 - Hydraulický lis 400 t", type: "PRODUCTION_LINE", floor: "a-1np", at: [230, 230], description: "Hydraulický lis 400 t, zdvih 800 mm.", manufacturer: "Schuler", model: "HPH 400", yearInstalled: 2019, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "315 A", ipRating: "IP54" },
  { tag: "LIS-02", name: "LIS-02 - Hydraulický lis 250 t", type: "PRODUCTION_LINE", floor: "a-1np", at: [470, 230], description: "Hydraulický lis 250 t.", manufacturer: "Schuler", model: "HPH 250", yearInstalled: 2019, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "250 A", ipRating: "IP54" },
  { tag: "CNC-04", name: "CNC-04 - CNC obráběcí centrum 04", type: "CNC_MACHINE", floor: "a-1np", at: [760, 250], description: "5osé obráběcí centrum pro kovací formy.", manufacturer: "DMG MORI", model: "DMU 65 monoBLOCK", yearInstalled: 2021, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "63 A", ipRating: "IP54" },
  { tag: "R-CNC-04", name: "R-CNC-04 - Rozváděč CNC centra 04", type: "SWITCHBOARD", floor: "a-1np", at: [900, 340], description: "Rozváděč CNC centra 04, řídicí obvody 24 V DC.", manufacturer: "Rittal", model: "TS 8", yearInstalled: 2021, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "63 A", ipRating: "IP54" },
  { tag: "ROB-03", name: "ROB-03 - Robotická buňka odebírání výlisků", type: "ROBOT_CELL", floor: "a-1np", at: [330, 590], description: "Robot odebírá výlisky z lisu LIS-02.", manufacturer: "KUKA", model: "KR 210 R2700", yearInstalled: 2022, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "32 A", ipRating: "IP54" },
  { tag: "VZT-01", name: "VZT-01 - Vzduchotechnická jednotka haly A", type: "HVAC_UNIT", floor: "a-2np", at: [420, 300], description: "Přívodní a odtahová jednotka, rekuperace.", manufacturer: "Remak", model: "RPS 80", yearInstalled: 2018, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "100 A", ipRating: "IP44" },
  { tag: "R-VZT-01", name: "R-VZT-01 - Rozváděč vzduchotechniky", type: "SWITCHBOARD", floor: "a-2np", at: [950, 210], description: "Silové a regulační obvody vzduchotechniky haly A.", manufacturer: "Rittal", model: "TS 8", yearInstalled: 2018, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "125 A", ipRating: "IP54" },
  { tag: "ML-01", name: "ML-01 - Montážní linka dveřních modulů", type: "PRODUCTION_LINE", floor: "b-1np", at: [400, 200], description: "Dopravníková montážní linka dveřních modulů.", manufacturer: "Bosch Rexroth", model: "TS 2plus", yearInstalled: 2020, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "100 A", ipRating: "IP54" },
  { tag: "ML-02", name: "ML-02 - Montážní linka sedadel", type: "PRODUCTION_LINE", floor: "b-1np", at: [400, 420], description: "Montážní linka sedadel s nastavováním momentů.", manufacturer: "Bosch Rexroth", model: "TS 2plus", yearInstalled: 2020, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "63 A", ipRating: "IP54" },
  { tag: "R-ML-01", name: "R-ML-01 - Rozváděč montážní linky 1", type: "SWITCHBOARD", floor: "b-1np", at: [1000, 200], description: "Rozváděč montážní linky dveřních modulů.", manufacturer: "Rittal", model: "TS 8", yearInstalled: 2020, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "160 A", ipRating: "IP54" },
  { tag: "ROB-07", name: "ROB-07 - Svařovací robotické pracoviště", type: "ROBOT_CELL", floor: "b-1np", at: [330, 650], description: "Robotické svařování MAG, jednotka s polohovadlem.", manufacturer: "Fanuc", model: "ARC Mate 120iD", yearInstalled: 2023, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "32 A", ipRating: "IP54" },
  { tag: "R-SKL", name: "R-SKL - Rozváděč skladu a nabíjení VZV", type: "SWITCHBOARD", floor: "s-1np", at: [240, 210], description: "Napájení nabíjecích stanic VZV a osvětlení skladu.", manufacturer: "Eaton", model: "xEnergy", yearInstalled: 2017, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "125 A", ipRating: "IP44" },
  { tag: "RP-ADM1", name: "RP-ADM1 - Patrový rozváděč 1. NP", type: "SWITCHBOARD", floor: "k-1np", at: [190, 395], description: "Patrový rozváděč administrativní budovy, 1. NP.", manufacturer: "ABB", model: "ArTu K", yearInstalled: 2016, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "63 A", ipRating: "IP30" },
  { tag: "RP-ADM2", name: "RP-ADM2 - Patrový rozváděč 2. NP", type: "SWITCHBOARD", floor: "k-2np", at: [190, 495], description: "Patrový rozváděč administrativní budovy, 2. NP.", manufacturer: "ABB", model: "ArTu K", yearInstalled: 2016, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "63 A", ipRating: "IP30" },
  { tag: "R-LAK-01", name: "R-LAK-01 - Rozváděč lakovací linky", type: "SWITCHBOARD", floor: "lbc-1np", at: [950, 200], description: "Silový a řídicí rozváděč lakovací linky.", manufacturer: "Rittal", model: "TS 8", yearInstalled: 2020, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "250 A", ipRating: "IP54" },
  { tag: "LAK-01", name: "LAK-01 - Lakovací linka", type: "PRODUCTION_LINE", floor: "lbc-1np", at: [450, 280], description: "Automatická lakovací linka s dopravníkem.", manufacturer: "Dürr", model: "EcoPaint", yearInstalled: 2020, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "315 A", ipRating: "IP54" },
  { tag: "VZT-LAK", name: "VZT-LAK - Vzduchotechnika lakovny", type: "HVAC_UNIT", floor: "lbc-1np", at: [960, 390], description: "Přívod a odtah vzduchu pro sušicí pec a lakovnu.", manufacturer: "Remak", model: "RPS 120", yearInstalled: 2020, ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "160 A", ipRating: "IP44" },
];

/** Stavy zařízení odpovídají otevřeným požadavkům (invariant ze sekce B plánu). */
const OPEN_STATUS: Record<string, EquipmentStatus> = {
  RM1: "WAITING_APPROVAL",
  "R-CNC-04": "PENDING_UPDATE",
};

export const EQUIPMENT: EquipmentSeed[] = equipmentInputs.map(({ at, ...rest }) => ({
  ...rest,
  ...pin(at[0], at[1]),
  status: OPEN_STATUS[rest.tag] ?? "ACTIVE",
}));

// ---------------------------------------------------------------------------
//  Revize
// ---------------------------------------------------------------------------

export interface RevisionSeed {
  major: number;
  minor: number;
  status: RevisionStatus;
  date: Date;
  author: UserKey;
  approver?: UserKey;
  approvedAt?: Date;
  summary: string;
  /** Číslo požadavku na změnu, ze kterého revize vznikla. */
  crNumber?: string;
  /** Změny dílů oproti předchozím revizím (kumulativně se sčítají). */
  overrides?: PartOverrides;
  changed?: string[];
  a2Terminal?: string;
  rejectionComment?: string;
}

const INITIAL = "Výchozí digitalizace dokumentace.";

const initial = (year: number, author: UserKey = "kral", status: RevisionStatus = "ACTIVE"): RevisionSeed => ({
  major: 1,
  minor: 0,
  status,
  date: day(`${year}-06-15`),
  author,
  approver: "novak",
  approvedAt: day(`${year}-06-22`),
  summary: INITIAL,
});

/** Zvláštní historie revizí; ostatní zařízení mají jen v1.0 (digitalizace). */
export const REVISION_HISTORY: Record<string, RevisionSeed[]> = {
  RM1: [
    { ...initial(2019, "kral", "ARCHIVED"), date: day("2019-09-10"), approvedAt: day("2019-09-20") },
    {
      major: 1, minor: 1, status: "ARCHIVED", date: day("2022-04-12"), author: "markova", approver: "novak", approvedAt: day("2022-04-20"),
      summary: "Výměna jističe F1 za typ s vyšší zkratovou odolností (36 kA).",
      overrides: { F1: { description: "Jistič vývodu 3P C63 A, 36 kA", manufacturer: "ABB", partNumber: "S803N-C63" } },
      changed: ["F1"],
    },
    {
      major: 1, minor: 2, status: "ACTIVE", date: day("2025-03-18"), author: "markova", approver: "novak", approvedAt: day("2025-03-21"),
      summary: "Přečíslování svorek X1 a doplnění dvou rezervních svorek po rozšíření rozváděče.",
      crNumber: "ZM-2025-0033",
      overrides: { X1: { quantity: 16, note: "Doplněny 2 rezervní svorky" } },
      changed: ["X1"],
    },
    {
      major: 1, minor: 3, status: "PENDING_APPROVAL", date: daysAgo(1, 13), author: "markova",
      summary: "Zdroj T1 nahrazen typem 24 V DC / 20 A (původní byl trvale přetížený), jistič F6 zvětšen na C4 A. Změny vyznačeny revizním obláčkem.",
      crNumber: "ZM-2026-0042",
      overrides: {
        T1: { description: "Spínaný zdroj 3× 400 V AC / 24 V DC, 20 A", partNumber: "QUINT4-PS/3AC/24DC/20" },
        F6: { description: "Jistič 1P C4 A, 24 V DC", partNumber: "S201-C4" },
      },
      changed: ["T1", "F6"],
    },
  ],
  "R-CNC-04": [
    { ...initial(2021, "kral", "ARCHIVED"), date: day("2021-02-08"), approvedAt: day("2021-02-15") },
    {
      major: 1, minor: 1, status: "ACTIVE", date: day("2025-02-20"), author: "kral", approver: "novak", approvedAt: day("2025-02-24"),
      summary: "Zvětšen jistič F3 na C20 A (nový vřeteník).",
      crNumber: "ZM-2025-0007",
      overrides: { F3: { description: "Jistič 3P C20 A, 10 kA", partNumber: "5SY4320-7" } },
      changed: ["F3"],
    },
  ],
  "R-LIS-01": [
    { ...initial(2019, "kral", "ARCHIVED"), date: day("2019-11-04"), approvedAt: day("2019-11-12") },
    {
      major: 2, minor: 0, status: "ACTIVE", date: day("2024-02-15"), author: "markova", approver: "novak", approvedAt: day("2024-02-19"),
      summary: "Rekonstrukce lisovací linky 1: nové PLC S7-1500F a výkonnější zdroj 24 V DC.",
      crNumber: "ZM-2024-0011",
      overrides: {
        A1: { description: "Řídicí jednotka PLC S7-1500F, 32 DI / 32 DO", partNumber: "6ES7516-3AN02-0AB0" },
        T1: { description: "Spínaný zdroj 3× 400 V AC / 24 V DC, 20 A", partNumber: "QUINT4-PS/3AC/24DC/20" },
      },
      changed: ["A1", "T1"],
    },
  ],
  "R-ML-01": [
    { ...initial(2020, "kral", "ARCHIVED"), date: day("2020-05-18"), approvedAt: day("2020-05-25") },
    {
      major: 1, minor: 1, status: "REJECTED", date: day("2026-04-14"), author: "kral", approver: "novak",
      summary: "Výměna stykače K2 za typ Siemens SIRIUS.",
      crNumber: "ZM-2026-0019",
      overrides: { K2: { manufacturer: "Siemens", description: "Stykač 3P 25 A, cívka 24 V DC", partNumber: "3RT2026-1BB40" } },
      changed: ["K2"],
      rejectionComment: "Chybí přečíslování svorek X2 po výměně stykače K2.",
    },
    {
      major: 1, minor: 2, status: "ACTIVE", date: day("2026-04-22"), author: "kral", approver: "novak", approvedAt: day("2026-04-24"),
      summary: "Výměna stykače K2 za Siemens SIRIUS, přečíslovány svorky X2.",
      crNumber: "ZM-2026-0019",
      overrides: { X2: { note: "Přečíslovány svorky X2 po výměně K2" } },
      changed: ["K2", "X2"],
    },
  ],
  "R-LAK-01": [
    { ...initial(2020, "markova", "ARCHIVED"), date: day("2020-08-03"), approvedAt: day("2020-08-10") },
    {
      major: 1, minor: 1, status: "ACTIVE", date: day("2026-02-10"), author: "markova", approver: "novak", approvedAt: day("2026-02-12"),
      summary: "Zvětšen jistič F5 na C20 A (nový ohřev sušicí pece).",
      crNumber: "ZM-2026-0008",
      overrides: { F5: { description: "Jistič 3P C20 A, 10 kA", partNumber: "5SY4320-7" } },
      changed: ["F5"],
    },
  ],
};

export function revisionsFor(tag: string, yearInstalled: number, index: number): RevisionSeed[] {
  return REVISION_HISTORY[tag] ?? [initial(yearInstalled, index % 2 === 0 ? "kral" : "markova")];
}

// ---------------------------------------------------------------------------
//  Požadavky na změnu
// ---------------------------------------------------------------------------

export interface EventSeed {
  type: ChangeRequestEventType;
  actor: UserKey;
  at: Date;
  from?: ChangeRequestStatus;
  to?: ChangeRequestStatus;
  comment?: string;
  /** Revize [major, minor], které se událost týká. */
  revision?: [number, number];
}

export interface AttachmentSeed {
  type: AttachmentType;
  /** Soubor ve storage/uploads/photos/seed/. */
  file: string;
  caption: string;
  uploadedBy: UserKey;
  at: Date;
}

export interface ChangeRequestSeed {
  number: string;
  tag: string;
  status: ChangeRequestStatus;
  priority: ChangeRequestPriority;
  reporter: UserKey;
  assignee: UserKey;
  baseRevision: [number, number];
  /** Zákres: kolem kterého prvku schématu technik kroužkoval. */
  markupAround?: string;
  voiceTranscript?: string;
  note?: string;
  engineerSummary?: string;
  submittedAt: Date;
  assignedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  attachments: AttachmentSeed[];
  events: EventSeed[];
}

/** Standardní průběh uzavřeného požadavku: odeslání → převzetí → revize → schválení. */
function closed(args: {
  number: string;
  tag: string;
  reporter: UserKey;
  assignee: UserKey;
  base: [number, number];
  result: [number, number];
  note: string;
  summary: string;
  submitted: string;
  assigned: string;
  resolved: string;
  closed: string;
  priority?: ChangeRequestPriority;
  markupAround?: string;
}): ChangeRequestSeed {
  const submittedAt = day(args.submitted);
  const assignedAt = day(args.assigned);
  const resolvedAt = day(args.resolved, 14);
  const closedAt = day(args.closed, 9);
  return {
    number: args.number,
    tag: args.tag,
    status: "APPROVED",
    priority: args.priority ?? "NORMAL",
    reporter: args.reporter,
    assignee: args.assignee,
    baseRevision: args.base,
    markupAround: args.markupAround,
    note: args.note,
    engineerSummary: args.summary,
    submittedAt,
    assignedAt,
    resolvedAt,
    closedAt,
    attachments: [],
    events: [
      { type: "SUBMITTED", actor: args.reporter, at: submittedAt, to: "SUBMITTED" },
      { type: "ASSIGNED", actor: args.assignee, at: assignedAt, from: "SUBMITTED", to: "IN_PROGRESS" },
      { type: "REVISION_UPLOADED", actor: args.assignee, at: resolvedAt, from: "IN_PROGRESS", to: "WAITING_APPROVAL", revision: args.result, comment: args.summary },
      { type: "APPROVED", actor: "novak", at: closedAt, from: "WAITING_APPROVAL", to: "APPROVED", revision: args.result, comment: "Zkontrolováno v rozváděči, dokumentace odpovídá skutečnosti." },
    ],
  };
}

const rm1Submitted = daysAgo(4, 6);
const rm1Assigned = daysAgo(4, 9);
const rm1Uploaded = daysAgo(1, 13);
const cncSubmitted = daysAgo(5, 14);
const cncAssigned = daysAgo(4, 8);

export const CHANGE_REQUESTS: ChangeRequestSeed[] = [
  closed({ number: "ZM-2024-0011", tag: "R-LIS-01", reporter: "novak", assignee: "markova", base: [1, 0], result: [2, 0], note: "Po rekonstrukci linky 1 nesedí PLC a zdroj 24 V DC s dokumentací.", summary: "Rekonstrukce lisovací linky 1: nové PLC S7-1500F a výkonnější zdroj 24 V DC.", submitted: "2024-01-22", assigned: "2024-01-23", resolved: "2024-02-15", closed: "2024-02-19", markupAround: "A1" }),
  closed({ number: "ZM-2025-0007", tag: "R-CNC-04", reporter: "novak", assignee: "kral", base: [1, 0], result: [1, 1], note: "Nový vřeteník – nutný větší jistič F3.", summary: "Zvětšen jistič F3 na C20 A (nový vřeteník).", submitted: "2025-01-27", assigned: "2025-01-28", resolved: "2025-02-20", closed: "2025-02-24", markupAround: "F3" }),
  closed({ number: "ZM-2025-0033", tag: "RM1", reporter: "dvorakova", assignee: "markova", base: [1, 1], result: [1, 2], note: "Při rozšíření rozváděče přečíslovány svorky X1.", summary: "Přečíslování svorek X1 a doplnění dvou rezervních svorek po rozšíření rozváděče.", submitted: "2025-03-03", assigned: "2025-03-04", resolved: "2025-03-18", closed: "2025-03-21", markupAround: "X1" }),
  {
    number: "ZM-2026-0019",
    tag: "R-ML-01",
    status: "APPROVED",
    priority: "NORMAL",
    reporter: "dvorakova",
    assignee: "kral",
    baseRevision: [1, 0],
    markupAround: "K2",
    note: "Vyměněn stykač K2 za Siemens SIRIUS 3RT2026.",
    engineerSummary: "Výměna stykače K2 za Siemens SIRIUS, přečíslovány svorky X2.",
    submittedAt: day("2026-03-30"),
    assignedAt: day("2026-03-31"),
    resolvedAt: day("2026-04-22", 11),
    closedAt: day("2026-04-24", 9),
    attachments: [],
    events: [
      { type: "SUBMITTED", actor: "dvorakova", at: day("2026-03-30"), to: "SUBMITTED" },
      { type: "ASSIGNED", actor: "kral", at: day("2026-03-31"), from: "SUBMITTED", to: "IN_PROGRESS" },
      { type: "REVISION_UPLOADED", actor: "kral", at: day("2026-04-14", 14), from: "IN_PROGRESS", to: "WAITING_APPROVAL", revision: [1, 1], comment: "Výměna stykače K2 za Siemens SIRIUS." },
      { type: "REJECTED", actor: "novak", at: day("2026-04-16", 8), from: "WAITING_APPROVAL", to: "IN_PROGRESS", revision: [1, 1], comment: "Chybí přečíslování svorek X2 po výměně stykače K2." },
      { type: "COMMENT", actor: "kral", at: day("2026-04-20", 12), comment: "Svorky X2 doplněny, nahrávám opravenou revizi." },
      { type: "REVISION_UPLOADED", actor: "kral", at: day("2026-04-22", 11), from: "IN_PROGRESS", to: "WAITING_APPROVAL", revision: [1, 2], comment: "Výměna stykače K2 za Siemens SIRIUS, přečíslovány svorky X2." },
      { type: "APPROVED", actor: "novak", at: day("2026-04-24", 9), from: "WAITING_APPROVAL", to: "APPROVED", revision: [1, 2], comment: "Ověřeno v rozváděči, souhlasí." },
    ],
  },
  closed({ number: "ZM-2026-0008", tag: "R-LAK-01", reporter: "novak", assignee: "markova", base: [1, 0], result: [1, 1], note: "Nový ohřev sušicí pece – větší jistič F5.", summary: "Zvětšen jistič F5 na C20 A (nový ohřev sušicí pece).", submitted: "2026-01-26", assigned: "2026-01-27", resolved: "2026-02-10", closed: "2026-02-12", markupAround: "F5" }),
  {
    number: "ZM-2026-0041",
    tag: "R-CNC-04",
    status: "IN_PROGRESS",
    priority: "HIGH",
    reporter: "dvorakova",
    assignee: "kral",
    baseRevision: [1, 1],
    markupAround: "K4",
    voiceTranscript: "Vyměněn stykač K4 za jiný typ, přepojena svorka A2.",
    submittedAt: cncSubmitted,
    assignedAt: cncAssigned,
    attachments: [
      { type: "PHOTO", file: "R-CNC-04-wiring.svg", caption: "Zapojení po výměně stykače K4", uploadedBy: "dvorakova", at: cncSubmitted },
      { type: "PHOTO", file: "R-CNC-04-label.svg", caption: "Štítek nového stykače K4", uploadedBy: "dvorakova", at: cncSubmitted },
    ],
    events: [
      { type: "SUBMITTED", actor: "dvorakova", at: cncSubmitted, to: "SUBMITTED" },
      { type: "ASSIGNED", actor: "kral", at: cncAssigned, from: "SUBMITTED", to: "IN_PROGRESS" },
      { type: "COMMENT", actor: "kral", at: daysAgo(3, 10), comment: "Převzato. Čekám na údaje o novém stykači K4 od dodavatele." },
    ],
  },
  {
    number: "ZM-2026-0042",
    tag: "RM1",
    status: "WAITING_APPROVAL",
    priority: "NORMAL",
    reporter: "novak",
    assignee: "markova",
    baseRevision: [1, 2],
    markupAround: "T1",
    voiceTranscript: "Vyměněn zdroj T1 za výkonnější 24 V DC, 20 A. Původní byl trvale přetížený. Zvětšen jistič F6.",
    engineerSummary: "Zdroj T1 nahrazen typem 24 V DC / 20 A, jistič F6 zvětšen na C4 A. Změny vyznačeny revizním obláčkem.",
    submittedAt: rm1Submitted,
    assignedAt: rm1Assigned,
    resolvedAt: rm1Uploaded,
    attachments: [{ type: "PHOTO", file: "RM1-label.svg", caption: "Štítek nového zdroje T1", uploadedBy: "novak", at: rm1Submitted }],
    events: [
      { type: "SUBMITTED", actor: "novak", at: rm1Submitted, to: "SUBMITTED" },
      { type: "ASSIGNED", actor: "markova", at: rm1Assigned, from: "SUBMITTED", to: "IN_PROGRESS" },
      { type: "REVISION_UPLOADED", actor: "markova", at: rm1Uploaded, from: "IN_PROGRESS", to: "WAITING_APPROVAL", revision: [1, 3], comment: "Zdroj T1 nahrazen typem 24 V DC / 20 A, jistič F6 zvětšen na C4 A." },
    ],
  },
];

/** „Fotky“ z haly pro otevřené požadavky. */
export const SEED_PHOTOS: Record<string, { tag: string; kind: "wiring" | "label"; plate?: { manufacturer: string; type: string; lines: string[] } }> = {
  "R-CNC-04-wiring.svg": { tag: "R-CNC-04", kind: "wiring" },
  "R-CNC-04-label.svg": {
    tag: "K4", kind: "label",
    plate: { manufacturer: "SIEMENS", type: "SIRIUS 3RT2026-1BB40", lines: ["Ue 690 V   Ith 40 A", "AC-3: 11 kW / 400 V", "Uc 24 V DC", "IEC/EN 60947-4-1", "S/N: VPG3 4471 02"] },
  },
  "RM1-label.svg": {
    tag: "T1", kind: "label",
    plate: { manufacturer: "PHOENIX CONTACT", type: "QUINT4-PS/3AC/24DC/20", lines: ["IN: 3× 400–500 V AC", "OUT: 24 V DC / 20 A", "Art.-Nr. 2904602", "IP20   -25…+70 °C", "S/N: 2204 B 0873"] },
  },
};
