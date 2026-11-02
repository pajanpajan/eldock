// Vzorové závody v metrové architektuře Studia (fáze 40): rozvržení všech pater (`studioLayoutJson`,
// místnosti pokrývající celou plochu, 7 typů zón, vrata), rozmístění zařízení v metrech a bohaté
// vybavení spotřebiči a nářadím. Použije ho plný seed i přírůstkový `npm run db:demo-plant`
// (docker-entrypoint.sh při startu kontejneru) – ten proběhne jen jednou (značka v TenantSetting)
// a patra upravená uživatelem ve Studiu nepřepisuje.
import type { PrismaClient } from "../src/generated/prisma/client";
import type { EquipmentType } from "../src/generated/prisma/enums";
import { gridFromMeters, metersToPercent, planFrame, renderGridFloorplanSvg, roomAnchor, type GridGate, type GridSpec, type GridZone, type MeterPoint, type ZoneKind } from "../src/lib/cad-grid";
import { inspectionRuleFor, isPortable } from "../src/lib/inspection-rules";
import { newQrToken } from "../src/lib/qr-label";
import { parseLayout } from "../src/lib/studio-layout";
import { refreshFloorInventory } from "../src/server/services/studio";
import { INSPECTORS } from "./seed-compliance";
import { INSPECTOR_APPLIANCES, addInspection } from "./seed-demo-docs";

/** Verze vzorového rozvržení – zvýšení znovu povolí jednorázové doplnění. */
export const DEMO_PLANT_VERSION = 40;
export const DEMO_PLANT_MARKER = "demo.plant-layout";

type Zone = [name: string, kind: ZoneKind, x: number, y: number, w: number, h: number];

export interface DemoFloorLayout {
  floorId: string;
  /** Kód závodu (zóny „Kuchyňka – Energetika 1. NP“ apod. se skládají z názvu místnosti a patra). */
  zoneSuffix: string;
  widthM: number;
  depthM: number;
  stepMeters: number;
  zones: Zone[];
  gates: [at: string, label: string][];
  /** Pevná zařízení v jemném rastru (tag → poloha v metrech od osy A1). */
  grid: Record<string, [number, number]>;
  /** Spotřebiče a nářadí po místnostech (pořadí = kotvy v místnosti). */
  rooms: Record<string, string[]>;
}

export const DEMO_FLOOR_LAYOUTS: DemoFloorLayout[] = [
  {
    floorId: "floor-jbc-e-1pp",
    zoneSuffix: "Energetika 1. PP",
    widthM: 56,
    depthM: 36,
    stepMeters: 6,
    zones: [
      ["Rozvodna nn", "ELECTRICAL", 0, 0, 24, 22],
      ["Kompenzace", "ELECTRICAL", 24, 0, 16, 22],
      ["UPS a baterie", "ELECTRICAL", 40, 0, 16, 22],
      ["Kabelová chodba", "CORRIDOR", 0, 22, 56, 4],
      ["Schodiště", "FACILITIES", 0, 26, 6, 10],
      ["Sklad náhradních dílů", "STORAGE", 6, 26, 18, 10],
      ["Dílna údržby", "WORKSHOP", 24, 26, 18, 10],
      ["Šatna", "FACILITIES", 42, 26, 14, 10],
    ],
    gates: [["E11", "Vrata – kabely"]],
    grid: { RM1: [10, 10], RC1: [32, 10], RZ1: [48, 10], "NO-E": [28, 24] },
    rooms: { "Dílna údržby": ["NR-0120", "NR-0121"] },
  },
  {
    floorId: "floor-jbc-e-1np",
    zoneSuffix: "Energetika 1. NP",
    widthM: 56,
    depthM: 36,
    stepMeters: 6,
    zones: [
      ["Trafostanice", "ELECTRICAL", 0, 0, 20, 22],
      ["Kompresorovna", "FACILITIES", 20, 0, 36, 22],
      ["Chodba", "CORRIDOR", 0, 22, 56, 4],
      ["Schodiště", "FACILITIES", 0, 26, 6, 10],
      ["Velín", "OFFICE", 6, 26, 18, 10],
      ["Dílna", "WORKSHOP", 24, 26, 16, 10],
      ["Kuchyňka", "FACILITIES", 40, 26, 16, 10],
    ],
    gates: [
      ["C11", "Vrata – kompresory"],
      ["C1", "Vrata – trafostanice"],
    ],
    grid: { TR1: [8, 10], RH1: [16, 18], KS1: [38, 10] },
    rooms: {
      Kuchyňka: ["SP-0204", "SP-0205", "SP-0203", "SP-0202", "SP-0201", "PP-0047", "PP-0048"],
      Velín: ["SP-0206", "SP-0207", "SP-0208", "PP-0045", "PP-0046"],
      Dílna: ["NR-0122", "NR-0123", "NR-0124"],
    },
  },
  {
    floorId: "floor-jbc-a-1np",
    zoneSuffix: "Hala A",
    widthM: 152,
    depthM: 76,
    stepMeters: 12,
    zones: [
      ["Lisovna – lisovací linky", "PRODUCTION", 0, 0, 72, 44],
      ["Obrábění CNC", "PRODUCTION", 72, 0, 56, 44],
      ["Rozvodna haly A", "ELECTRICAL", 128, 0, 24, 20],
      ["Sklad nástrojů", "STORAGE", 128, 20, 24, 24],
      ["Hlavní komunikace", "CORRIDOR", 0, 44, 152, 6],
      ["Robotická pracoviště", "PRODUCTION", 0, 50, 60, 26],
      ["Expedice výlisků", "STORAGE", 60, 50, 36, 26],
      ["Dílna údržby", "WORKSHOP", 96, 50, 28, 26],
      ["Mistrová", "OFFICE", 124, 50, 16, 26],
      ["Šatny a WC", "FACILITIES", 140, 50, 12, 26],
    ],
    gates: [
      ["C1", "Vrata – zásobování"],
      ["H7", "Vrata – expedice"],
    ],
    grid: {
      "R-LIS-01": [132, 4],
      "LIS-01": [18, 22],
      "LIS-02": [48, 22],
      "CNC-01": [80, 12],
      "CNC-02": [96, 12],
      "CNC-03": [112, 12],
      "CNC-04": [96, 30],
      "R-CNC-04": [124, 40],
      "ROB-01": [10, 62],
      "ROB-02": [28, 62],
      "ROB-03": [46, 62],
      "NO-A": [76, 47],
    },
    rooms: {
      "Dílna údržby": [
        "NR-0112", "NR-0113", "NR-0114", "NR-0115",
        "NR-0087", "NR-0088", "NR-0089",
        "SV-0004", "SV-0005",
        "SP-0401", "SP-0402",
        "PP-0031", "PP-0050", "PP-0032", "PP-0033", "PP-0034", "PP-0035",
      ],
      Mistrová: ["SP-0403", "SP-0404"],
    },
  },
  {
    floorId: "floor-jbc-a-2np",
    zoneSuffix: "Hala A 2. NP",
    widthM: 152,
    depthM: 76,
    stepMeters: 12,
    zones: [
      ["Strojovna VZT", "FACILITIES", 0, 0, 96, 48],
      ["Rozvodna VZT", "ELECTRICAL", 96, 0, 28, 24],
      ["Sklad filtrů", "STORAGE", 124, 0, 28, 24],
      ["Technické prostory", "FACILITIES", 96, 24, 56, 24],
      ["Obslužná lávka", "CORRIDOR", 0, 48, 152, 6],
      ["Střešní výstup", "FACILITIES", 0, 54, 24, 22],
      ["Údržba VZT", "WORKSHOP", 24, 54, 48, 22],
      ["Kancelář energetika", "OFFICE", 72, 54, 32, 22],
      ["Strojovna chlazení", "FACILITIES", 104, 54, 48, 22],
    ],
    gates: [["D14", "Vrata – montážní otvor"]],
    grid: { "VZT-01": [24, 20], "VZT-02": [60, 20], "R-VZT-01": [100, 4], "LPS-A": [12, 64] },
    rooms: { "Kancelář energetika": ["SP-0405", "PP-0036"] },
  },
  {
    floorId: "floor-jbc-b-1np",
    zoneSuffix: "Hala B",
    widthM: 136,
    depthM: 68,
    stepMeters: 12,
    zones: [
      ["Montážní linka 1 – dveřní moduly", "PRODUCTION", 0, 0, 100, 22],
      ["Montážní linka 2 – sedadla", "PRODUCTION", 0, 22, 100, 22],
      ["Rozvodna haly B", "ELECTRICAL", 100, 0, 36, 14],
      ["Kontrola kvality", "OFFICE", 100, 14, 36, 14],
      ["Sklad komponent", "STORAGE", 100, 28, 36, 16],
      ["Hlavní komunikace", "CORRIDOR", 0, 44, 136, 6],
      ["Svařovna", "PRODUCTION", 0, 50, 48, 18],
      ["Dílna údržby", "WORKSHOP", 48, 50, 28, 18],
      ["Zázemí a kuchyňka", "FACILITIES", 76, 50, 24, 18],
      ["Expedice", "STORAGE", 100, 50, 36, 18],
    ],
    gates: [
      ["F13", "Vrata – expedice"],
      ["G3", "Vrata – svařovna"],
    ],
    grid: { "R-ML-01": [104, 4], "R-PLC-ML1": [94, 10], "ML-01": [40, 10], "ML-02": [40, 32], "ROB-07": [14, 58], "ROB-08": [34, 58], "LPS-B": [120, 64] },
    rooms: {
      "Montážní linka 1 – dveřní moduly": ["NR-0130", "NR-0131", "NR-0132"],
      "Montážní linka 2 – sedadla": ["PP-0060", "PP-0061"],
      Svařovna: ["SV-0007"],
      "Dílna údržby": ["NR-0133", "NR-0134", "NR-0135", "NR-0136", "SP-0410"],
      "Zázemí a kuchyňka": ["PP-0062", "PP-0063"],
    },
  },
  {
    floorId: "floor-jbc-s-1np",
    zoneSuffix: "Sklad",
    widthM: 88,
    depthM: 64,
    stepMeters: 8,
    zones: [
      ["Nabíjení VZV", "ELECTRICAL", 0, 0, 24, 16],
      ["Příjem zboží", "STORAGE", 24, 0, 40, 16],
      ["Kancelář skladu", "OFFICE", 64, 0, 24, 16],
      ["Regálové uličky", "STORAGE", 0, 16, 64, 32],
      ["Balicí linka", "PRODUCTION", 64, 16, 24, 32],
      ["Expedice", "STORAGE", 0, 48, 64, 16],
      ["Zázemí", "FACILITIES", 64, 48, 24, 16],
    ],
    gates: [
      ["A5", "Vrata – příjem"],
      ["I3", "Rampa 1"],
      ["I6", "Rampa 2"],
    ],
    grid: { "R-SKL": [4, 4], "NAB-VZV1": [14, 8], "BAL-01": [76, 30], "PV-M1": [40, 62] },
    rooms: { Expedice: ["SP-0420", "SP-0421", "SP-0422", "NR-0140", "NR-0141", "PP-0070", "PP-0071", "PP-0072", "PP-0073"] },
  },
  {
    floorId: "floor-jbc-k-1np",
    zoneSuffix: "Administrativa 1. NP",
    widthM: 52,
    depthM: 56,
    stepMeters: 6,
    zones: [
      ["Recepce", "OFFICE", 0, 0, 16, 14],
      ["Kanceláře mistrů", "OFFICE", 16, 0, 36, 24],
      ["Technická místnost", "ELECTRICAL", 0, 14, 16, 10],
      ["Chodba", "CORRIDOR", 0, 24, 52, 4],
      ["Zasedací místnost", "OFFICE", 0, 28, 24, 16],
      ["Kuchyňka", "FACILITIES", 24, 28, 14, 16],
      ["Schodiště a WC", "FACILITIES", 38, 28, 14, 16],
      ["Kancelář údržby", "OFFICE", 0, 44, 52, 12],
    ],
    gates: [["K5", "Hlavní vstup"]],
    grid: { "RP-ADM1": [4, 18] },
    rooms: {
      "Kanceláře mistrů": ["SP-0310", "SP-0501", "SP-0502", "SP-0503", "SP-0510", "PP-0044", "PP-0080", "PP-0081"],
      "Kancelář údržby": ["SP-0504", "SP-0505"],
      "Zasedací místnost": ["PP-0082"],
      Kuchyňka: ["SP-0520", "SP-0522", "SP-0523", "PP-0083"],
    },
  },
  {
    floorId: "floor-jbc-k-2np",
    zoneSuffix: "Administrativa 2. NP",
    widthM: 52,
    depthM: 56,
    stepMeters: 6,
    zones: [
      ["Kanceláře projekce", "OFFICE", 0, 0, 30, 24],
      ["Open space", "OFFICE", 30, 0, 22, 24],
      ["Chodba", "CORRIDOR", 0, 24, 52, 4],
      ["Technická místnost", "ELECTRICAL", 0, 28, 12, 12],
      ["Zasedací místnost", "OFFICE", 12, 28, 26, 16],
      ["Schodiště a WC", "FACILITIES", 38, 28, 14, 16],
      ["Archiv", "STORAGE", 0, 40, 12, 16],
      ["Kuchyňka", "FACILITIES", 12, 44, 20, 12],
      ["Serverovna", "ELECTRICAL", 32, 44, 20, 12],
    ],
    gates: [],
    grid: { "RP-ADM2": [4, 32] },
    rooms: {
      "Kanceláře projekce": ["SP-0506", "SP-0507", "SP-0508", "SP-0509", "SP-0511", "PP-0084", "PP-0085"],
      "Open space": ["SP-0512", "SP-0513", "SP-0322", "PP-0086"],
      "Zasedací místnost": ["PP-0087"],
      Kuchyňka: ["SP-0521", "SP-0330", "SP-0524", "PP-0088"],
    },
  },
  {
    floorId: "floor-lbc-1-1np",
    zoneSuffix: "Lakovna",
    widthM: 160,
    depthM: 100,
    stepMeters: 12,
    zones: [
      ["Lakovací linka", "PRODUCTION", 0, 0, 108, 60],
      ["Rozvodna lakovny", "ELECTRICAL", 108, 0, 52, 24],
      ["Sušicí pec", "PRODUCTION", 108, 24, 52, 36],
      ["Hlavní komunikace", "CORRIDOR", 0, 60, 160, 6],
      ["Příprava dílů", "PRODUCTION", 0, 66, 60, 34],
      ["Míchárna barev", "STORAGE", 60, 66, 36, 34],
      ["Dílna údržby", "WORKSHOP", 96, 66, 32, 34],
      ["Zázemí", "FACILITIES", 128, 66, 32, 34],
    ],
    gates: [
      ["F15", "Vrata – výjezd"],
      ["J3", "Vrata – příprava"],
    ],
    grid: { "R-LAK-01": [112, 4], "LAK-01": [50, 30], "VZT-LAK": [134, 40] },
    rooms: {
      "Dílna údržby": ["NR-0601", "NR-0602", "PP-0601"],
      Zázemí: ["SP-0601", "SP-0602", "PP-0602"],
    },
  },
];

// ---------------------------------------------------------------------------
//  Nová zařízení vzorových závodů
// ---------------------------------------------------------------------------

interface Kind {
  name: string;
  type: EquipmentType;
  manufacturer: string;
  model: string;
  ratedVoltage: string;
  ratedCurrent: string;
  ipRating: string;
  usageGroup?: string;
  protectionClass?: string;
  description: string;
}

const KINDS = {
  pc: { name: "PC sestava", type: "APPLIANCE", manufacturer: "Dell", model: "OptiPlex 7010 + P2423", ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "1,5 A", ipRating: "IP20", usageGroup: "E", protectionClass: "I", description: "Počítač s monitorem." },
  printer: { name: "Tiskárna", type: "APPLIANCE", manufacturer: "HP", model: "LaserJet Pro 4002", ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "4 A", ipRating: "IP20", usageGroup: "E", protectionClass: "I", description: "Síťová laserová tiskárna." },
  coffee: { name: "Kávovar", type: "APPLIANCE", manufacturer: "De'Longhi", model: "Magnifica S ECAM22.110", ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "6,5 A (1 450 W)", ipRating: "IPX0", usageGroup: "E", protectionClass: "I", description: "Automatický kávovar." },
  kettle: { name: "Rychlovarná konvice", type: "APPLIANCE", manufacturer: "ETA", model: "Storio 8599", ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "9,6 A (2 200 W)", ipRating: "IPX0", usageGroup: "E", protectionClass: "I", description: "Rychlovarná konvice 1,7 l." },
  fridge: { name: "Chladnička", type: "APPLIANCE", manufacturer: "Gorenje", model: "RK4182PW4", ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "0,8 A", ipRating: "IPX0", usageGroup: "E", protectionClass: "I", description: "Chladnička s mrazákem." },
  cord: { name: "Prodlužovací přívod", type: "EXTENSION_CORD", manufacturer: "Emos", model: "P1415 4z 5 m", ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "10 A", ipRating: "IP20", usageGroup: "E", protectionClass: "I", description: "Prodlužovací přívod se 4 zásuvkami a vypínačem." },
  drum: { name: "Prodlužovací buben", type: "EXTENSION_CORD", manufacturer: "PCE", model: "H07RN-F 3G2,5 / 25 m", ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "16 A", ipRating: "IP44", usageGroup: "C", protectionClass: "I", description: "Kabelový buben 25 m se 4 zásuvkami a tepelnou ochranou." },
  grinder: { name: "Úhlová bruska", type: "POWER_TOOL", manufacturer: "Hilti", model: "AG 125-13S", ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "6,1 A (1 400 W)", ipRating: "IP20", usageGroup: "C", protectionClass: "II", description: "Úhlová bruska 125 mm, dvojitá izolace." },
  drill: { name: "Vrtačka", type: "POWER_TOOL", manufacturer: "Hilti", model: "SF 6H-22", ratedVoltage: "230 V AC / 22 V DC", ratedCurrent: "1,2 A (nabíječka)", ipRating: "IP20", usageGroup: "C", protectionClass: "II", description: "Aku vrtací šroubovák s nabíječkou." },
  screwdriver: { name: "Elektrický šroubovák", type: "POWER_TOOL", manufacturer: "Bosch", model: "GSR 6-25 TE", ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "3,2 A (701 W)", ipRating: "IP20", usageGroup: "C", protectionClass: "II", description: "Síťový šroubovák pro montáž modulů." },
  heatgun: { name: "Horkovzdušná pistole", type: "POWER_TOOL", manufacturer: "Steinel", model: "HG 2620 E", ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "10 A (2 300 W)", ipRating: "IP20", usageGroup: "C", protectionClass: "II", description: "Horkovzdušná pistole pro smršťovací bužírky a fólie." },
  vacuum: { name: "Průmyslový vysavač", type: "APPLIANCE", manufacturer: "Kärcher", model: "NT 30/1 Tact L", ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "6,5 A (1 380 W)", ipRating: "IPX4", usageGroup: "C", protectionClass: "I", description: "Průmyslový vysavač na prach a třísky." },
  welder: { name: "Svářečka", type: "WELDER", manufacturer: "Fronius", model: "TransPocket 180", ratedVoltage: "230 V AC / 50 Hz", ratedCurrent: "16 A", ipRating: "IP23", usageGroup: "C", protectionClass: "I", description: "Invertorová svářečka MMA/TIG 180 A." },
  meter: { name: "Měřicí přístroj", type: "POWER_TOOL", manufacturer: "Metrel", model: "MI 3152 EurotestXC", ratedVoltage: "230 V AC / 50 Hz (nabíječka)", ratedCurrent: "0,5 A", ipRating: "IP40", usageGroup: "C", protectionClass: "II", description: "Revizní měřicí přístroj pro instalace a stroje." },
} satisfies Record<string, Kind>;
type KindKey = keyof typeof KINDS;

/** Pevná zařízení (stroje, roboti, VZT) – vlastní popis. */
const FIXED: Record<string, Kind & { parent: string; circuit: string }> = {
  "CNC-01": { name: "CNC obráběcí centrum 01", type: "CNC_MACHINE", manufacturer: "DMG MORI", model: "DMU 50 3rd Generation", ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "50 A", ipRating: "IP54", description: "5osé obráběcí centrum pro přípravky.", parent: "R-LIS-01", circuit: "Vývod Q5" },
  "CNC-02": { name: "CNC obráběcí centrum 02", type: "CNC_MACHINE", manufacturer: "DMG MORI", model: "DMU 50 3rd Generation", ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "50 A", ipRating: "IP54", description: "5osé obráběcí centrum pro střižné nástroje.", parent: "R-LIS-01", circuit: "Vývod Q6" },
  "CNC-03": { name: "CNC soustružnické centrum 03", type: "CNC_MACHINE", manufacturer: "Okuma", model: "Genos L3000-e", ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "40 A", ipRating: "IP54", description: "CNC soustruh pro hřídele a čepy.", parent: "R-LIS-01", circuit: "Vývod Q7" },
  "ROB-01": { name: "Robotická buňka zakládání plechů", type: "ROBOT_CELL", manufacturer: "KUKA", model: "KR 120 R2700", ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "32 A", ipRating: "IP54", description: "Robot zakládá přístřihy do lisu LIS-01.", parent: "R-LIS-01", circuit: "Vývod Q8" },
  "ROB-02": { name: "Robotická buňka paletizace", type: "ROBOT_CELL", manufacturer: "KUKA", model: "KR 180 R3200 PA", ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "32 A", ipRating: "IP54", description: "Paletizace výlisků do přepravek.", parent: "R-LIS-01", circuit: "Vývod Q9" },
  "VZT-02": { name: "Vzduchotechnická jednotka odsávání lisovny", type: "HVAC_UNIT", manufacturer: "Remak", model: "AeroMaster XP 10", ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "63 A", ipRating: "IP44", description: "Odsávání olejové mlhy nad lisy.", parent: "R-VZT-01", circuit: "Vývod Q3" },
  "ROB-08": { name: "Svařovací robotické pracoviště 2", type: "ROBOT_CELL", manufacturer: "Fanuc", model: "ARC Mate 100iD", ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "32 A", ipRating: "IP54", description: "Robotické svařování MAG rámů sedadel.", parent: "R-ML-01", circuit: "Vývod Q5" },
  "NAB-VZV1": { name: "Nabíjecí stanice VZV", type: "MACHINE", manufacturer: "Fronius", model: "Selectiva 4.0 8kW", ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "16 A", ipRating: "IP21", description: "Nabíječe trakčních baterií vysokozdvižných vozíků (4 stanoviště).", parent: "R-SKL", circuit: "Vývod QF2" },
  "BAL-01": { name: "Balicí linka", type: "PRODUCTION_LINE", manufacturer: "Robopac", model: "Robot S7 + Rotoplat", ratedVoltage: "400 V AC / 50 Hz", ratedCurrent: "25 A", ipRating: "IP54", description: "Ovinovací a balicí linka expedičních palet.", parent: "R-SKL", circuit: "Vývod QF3" },
};

/** Spotřebiče a nářadí: tag → druh, napájení a vývod. */
const LIGHT: Record<string, { kind: KindKey; parent: string; circuit: string }> = {};
const add = (kind: KindKey, parent: string, circuit: string, tags: string[]) => tags.forEach((tag) => (LIGHT[tag] = { kind, parent, circuit }));
// Energetika
add("coffee", "RM1", "Pole 5 / Zásuvkový okruh ZS-E1", ["SP-0205"]);
add("pc", "RZ1", "Zálohovaný okruh ZS-UPS1", ["SP-0206", "SP-0207", "SP-0208"]);
add("cord", "RZ1", "Zálohovaný okruh ZS-UPS1", ["PP-0045", "PP-0046"]);
add("cord", "RM1", "Pole 5 / Zásuvkový okruh ZS-E1", ["PP-0047", "PP-0048"]);
add("meter", "RM1", "Pole 5 / Zásuvkový okruh ZS-E2", ["NR-0120", "NR-0121", "NR-0122"]);
add("drill", "RM1", "Pole 5 / Zásuvkový okruh ZS-E2", ["NR-0123"]);
add("grinder", "RM1", "Pole 5 / Zásuvkový okruh ZS-E2", ["NR-0124"]);
// Hala A
add("grinder", "R-LIS-01", "Zásuvkový okruh ZS1", ["NR-0113", "NR-0114", "NR-0115"]);
add("drill", "R-LIS-01", "Zásuvkový okruh ZS1", ["NR-0088", "NR-0089"]);
add("welder", "R-LIS-01", "Zásuvka 400 V / XS3", ["SV-0005"]);
add("vacuum", "R-LIS-01", "Zásuvkový okruh ZS1", ["SP-0401", "SP-0402"]);
add("drum", "R-LIS-01", "Zásuvka 400 V / XS3", ["PP-0032", "PP-0033", "PP-0034", "PP-0035"]);
add("pc", "R-LIS-01", "Zásuvkový okruh ZS2", ["SP-0403", "SP-0404"]);
add("pc", "R-VZT-01", "Zásuvkový okruh ZS1", ["SP-0405"]);
add("cord", "R-VZT-01", "Zásuvkový okruh ZS1", ["PP-0036"]);
// Hala B
add("screwdriver", "R-ML-01", "Zásuvkový okruh ZS3", ["NR-0130", "NR-0131", "NR-0132", "NR-0133", "NR-0134"]);
add("heatgun", "R-ML-01", "Zásuvkový okruh ZS2", ["NR-0135", "NR-0136"]);
add("vacuum", "R-ML-01", "Zásuvkový okruh ZS2", ["SP-0410"]);
add("cord", "R-ML-01", "Zásuvkový okruh ZS3", ["PP-0060", "PP-0061", "PP-0062", "PP-0063"]);
// Sklad
add("pc", "R-SKL", "Zásuvkový okruh ZS1", ["SP-0420", "SP-0421", "SP-0422"]);
add("heatgun", "R-SKL", "Zásuvkový okruh ZS1", ["NR-0140", "NR-0141"]);
add("cord", "R-SKL", "Zásuvkový okruh ZS1", ["PP-0070", "PP-0071", "PP-0072", "PP-0073"]);
// Administrativa
add("pc", "RP-ADM1", "Zásuvkový okruh ZS3", ["SP-0501", "SP-0502", "SP-0503", "SP-0504", "SP-0505"]);
add("printer", "RP-ADM1", "Zásuvkový okruh ZS3", ["SP-0510"]);
add("cord", "RP-ADM1", "Zásuvkový okruh ZS3", ["PP-0080", "PP-0081", "PP-0082"]);
add("coffee", "RP-ADM1", "Zásuvkový okruh ZS4 – kuchyňka", ["SP-0520"]);
add("kettle", "RP-ADM1", "Zásuvkový okruh ZS4 – kuchyňka", ["SP-0522"]);
add("fridge", "RP-ADM1", "Zásuvkový okruh ZS4 – kuchyňka", ["SP-0523"]);
add("cord", "RP-ADM1", "Zásuvkový okruh ZS4 – kuchyňka", ["PP-0083"]);
add("pc", "RP-ADM2", "Zásuvkový okruh ZS1", ["SP-0506", "SP-0507", "SP-0508", "SP-0509", "SP-0512", "SP-0513"]);
add("printer", "RP-ADM2", "Zásuvkový okruh ZS1", ["SP-0511"]);
add("cord", "RP-ADM2", "Zásuvkový okruh ZS1", ["PP-0084", "PP-0085", "PP-0086", "PP-0087"]);
add("coffee", "RP-ADM2", "Zásuvkový okruh ZS2 – kuchyňka", ["SP-0521"]);
add("fridge", "RP-ADM2", "Zásuvkový okruh ZS2 – kuchyňka", ["SP-0524"]);
add("cord", "RP-ADM2", "Zásuvkový okruh ZS2 – kuchyňka", ["PP-0088"]);
// Liberec – lakovna
add("grinder", "R-LAK-01", "Zásuvkový okruh ZS1", ["NR-0601"]);
add("drill", "R-LAK-01", "Zásuvkový okruh ZS1", ["NR-0602"]);
add("drum", "R-LAK-01", "Zásuvkový okruh ZS1", ["PP-0601"]);
add("coffee", "R-LAK-01", "Zásuvkový okruh ZS2", ["SP-0601"]);
add("pc", "R-LAK-01", "Zásuvkový okruh ZS2", ["SP-0602"]);
add("cord", "R-LAK-01", "Zásuvkový okruh ZS2", ["PP-0602"]);

/** Původní názvy spotřebičů a nářadí ze seedu → obecné názvy (seskupené štítky „☕ 2× Kávovar“). */
export const DEMO_RENAMES: Record<string, { from: string; to: string }> = {
  "SP-0201": { from: "SP-0201 - Rychlovarná konvice Eta", to: "SP-0201 - Rychlovarná konvice" },
  "SP-0202": { from: "SP-0202 - Mikrovlnná trouba Bosch", to: "SP-0202 - Mikrovlnná trouba" },
  "SP-0203": { from: "SP-0203 - Chladnička Gorenje", to: "SP-0203 - Chladnička" },
  "SP-0204": { from: "SP-0204 - Kávovar De'Longhi", to: "SP-0204 - Kávovar" },
  "NR-0112": { from: "NR-0112 - Úhlová bruska Hilti AG 125", to: "NR-0112 - Úhlová bruska" },
  "NR-0087": { from: "NR-0087 - Aku/síťová vrtačka Hilti", to: "NR-0087 - Vrtačka" },
  "PP-0031": { from: "PP-0031 - Prodlužovací buben 25 m 400 V", to: "PP-0031 - Prodlužovací buben" },
  "PP-0050": { from: "PP-0050 - Prodlužovací přívod 230 V / 25 m na bubnu", to: "PP-0050 - Prodlužovací buben" },
  "SV-0004": { from: "SV-0004 - Invertorová svářečka Fronius TransPocket", to: "SV-0004 - Svářečka" },
  "SV-0007": { from: "SV-0007 - Svářečka MIG/MAG Kemppi X5", to: "SV-0007 - Svářečka" },
  "SP-0310": { from: "SP-0310 - PC sestava Dell OptiPlex", to: "SP-0310 - PC sestava" },
  "PP-0044": { from: "PP-0044 - Prodlužovací přívod 230 V 5 m", to: "PP-0044 - Prodlužovací přívod" },
  "SP-0322": { from: "SP-0322 - Laserová tiskárna HP", to: "SP-0322 - Tiskárna" },
  "SP-0330": { from: "SP-0330 - Rychlovarná konvice Bosch", to: "SP-0330 - Rychlovarná konvice" },
};

// ---------------------------------------------------------------------------
//  Rozvržení → JSON a SVG
// ---------------------------------------------------------------------------

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function demoGrid(layout: DemoFloorLayout): GridSpec {
  return gridFromMeters(layout.widthM, layout.depthM, layout.stepMeters, "1:500");
}

export function demoZones(layout: DemoFloorLayout): GridZone[] {
  return layout.zones.map(([name, kind, x, y, w, h]) => ({ key: `z-${slug(name)}`, name, kind, x, y, w, h }));
}

export const demoGates = (layout: DemoFloorLayout): GridGate[] => layout.gates.map(([at, label]) => ({ at, label }));

/** `studioLayoutJson` vzorového patra (s příznakem `demo`, který Studio při uložení vlastních úprav odstraní). */
export const demoLayoutJson = (layout: DemoFloorLayout) => JSON.stringify({ version: 1, grid: demoGrid(layout), zones: demoZones(layout), gates: demoGates(layout), demo: DEMO_PLANT_VERSION });

/** Půdorys vzorového patra (bez štítků inventáře – ty doplní `refreshFloorInventory`). */
export const demoFloorSvg = (layout: DemoFloorLayout, floorName: string) =>
  renderGridFloorplanSvg({ floorName, spec: demoGrid(layout), zones: demoZones(layout), gates: demoGates(layout) });

export const demoLayoutOf = (floorId: string) => DEMO_FLOOR_LAYOUTS.find((layout) => layout.floorId === floorId);

/** Poloha zařízení vzorového patra v metrech (pevná v rastru, spotřebiče na kotvách místnosti). */
export function demoPositions(layout: DemoFloorLayout): Map<string, { pos: MeterPoint; room: string | null }> {
  const result = new Map<string, { pos: MeterPoint; room: string | null }>();
  for (const [tag, [x, y]] of Object.entries(layout.grid)) result.set(tag, { pos: { x, y }, room: null });
  const zones = demoZones(layout);
  for (const [room, tags] of Object.entries(layout.rooms)) {
    const zone = zones.find((entry) => entry.name === room);
    if (!zone) throw new Error(`Vzorové patro ${layout.floorId}: neznámá místnost ${room}.`);
    tags.forEach((tag, index) => result.set(tag, { pos: roomAnchor(zone, index), room }));
  }
  return result;
}

/** Definice nového zařízení vzorového závodu (pevné i spotřebiče / nářadí). */
export function demoNewEquipment(tag: string): (Kind & { parent: string; circuit: string }) | null {
  if (FIXED[tag]) return FIXED[tag];
  const light = LIGHT[tag];
  return light ? { ...KINDS[light.kind], parent: light.parent, circuit: light.circuit } : null;
}

export const DEMO_NEW_TAGS = [...Object.keys(FIXED), ...Object.keys(LIGHT)];

// ---------------------------------------------------------------------------
//  Doplnění do databáze (plný seed i přírůstkově na produkci)
// ---------------------------------------------------------------------------

export interface DemoPlantResult {
  skipped: boolean;
  floors: number;
  keptFloors: number;
  created: number;
  moved: number;
  renamed: number;
}

/**
 * Vzorové závody na metrovou architekturu Studia. Jednorázové (značka `demo.plant-layout`); patro, které
 * uživatel ve Studiu už upravil (JSON bez příznaku `demo`), zůstane beze změny včetně zařízení. Nic nemaže.
 */
export async function seedDemoPlant(prisma: PrismaClient, options: { force?: boolean } = {}): Promise<DemoPlantResult> {
  const result: DemoPlantResult = { skipped: false, floors: 0, keptFloors: 0, created: 0, moved: 0, renamed: 0 };
  const marker = await prisma.tenantSetting.findUnique({ where: { key: DEMO_PLANT_MARKER }, select: { value: true } });
  if (!options.force && Number(marker?.value ?? 0) >= DEMO_PLANT_VERSION) return { ...result, skipped: true };

  for (const layout of DEMO_FLOOR_LAYOUTS) {
    const floor = await prisma.floor.findUnique({ where: { id: layout.floorId }, select: { id: true, name: true, studioLayoutJson: true, building: { select: { name: true, plantId: true } } } });
    if (!floor) continue;
    const isDemo = !floor.studioLayoutJson || !parseLayout(floor.studioLayoutJson) || /"demo":\s*\d+/.test(floor.studioLayoutJson);
    if (!isDemo) {
      result.keptFloors++;
      continue;
    }
    const frame = planFrame(demoGrid(layout));
    await prisma.floor.update({ where: { id: floor.id }, data: { studioLayoutJson: demoLayoutJson(layout), floorplanSvg: demoFloorSvg(layout, floor.name) } });
    result.floors++;

    for (const [tag, { pos, room }] of demoPositions(layout)) {
      const pin = metersToPercent(frame, pos);
      const existing = await prisma.equipment.findFirst({ where: { tag, floor: { building: { plantId: floor.building.plantId } } }, select: { id: true, floorId: true, name: true } });
      if (existing) {
        if (existing.floorId !== floor.id) continue;
        const rename = DEMO_RENAMES[tag];
        const name = rename && existing.name === rename.from ? rename.to : undefined;
        await prisma.equipment.update({ where: { id: existing.id }, data: { ...pin, ...(name ? { name } : {}) } });
        result.moved++;
        if (name) result.renamed++;
        continue;
      }
      const def = demoNewEquipment(tag);
      if (!def) continue;
      const parent = await prisma.equipment.findFirst({ where: { tag: def.parent, floor: { building: { plantId: floor.building.plantId } } }, select: { id: true } });
      const id = `eq-${tag.toLowerCase()}`;
      if (await prisma.equipment.findUnique({ where: { id }, select: { id: true } })) continue;
      const portable = isPortable(def.type);
      await prisma.equipment.create({
        data: {
          id,
          floorId: floor.id,
          tag,
          name: `${tag} - ${def.name}`,
          type: def.type,
          status: "ACTIVE",
          description: def.description,
          manufacturer: def.manufacturer,
          model: def.model,
          yearInstalled: 2024,
          ratedVoltage: def.ratedVoltage,
          ratedCurrent: def.ratedCurrent,
          ipRating: def.ipRating,
          serialNumber: `SN-2024-${tag.replace(/[^A-Z0-9]/gi, "")}`,
          usageGroup: def.usageGroup ?? null,
          protectionClass: def.protectionClass ?? null,
          inventoryNumber: portable ? `INV-${tag}` : null,
          assignedZone: room ? `${room} – ${layout.zoneSuffix}` : null,
          inspectionIntervalMonths: inspectionRuleFor({ type: def.type, usageGroup: def.usageGroup ?? null }).months,
          qrToken: newQrToken(),
          fedFromEquipmentId: parent?.id ?? null,
          fedFromCircuit: parent ? def.circuit : null,
          ...pin,
        },
      });
      // Platná poslední revize (měření u spotřebičů a nářadí), ať lhůtník nehlásí nové kusy jako nerevidované
      await addInspection(prisma, id, {
        daysAgo: 12 + ((result.created * 17) % 110),
        inspector: portable ? INSPECTOR_APPLIANCES : INSPECTORS.horak,
        measurements: portable ? { rpe: def.protectionClass === "II" ? null : 0.11, riso: 210 + ((result.created * 37) % 300), leakage: 0.2 } : undefined,
      });
      result.created++;
    }
    await refreshFloorInventory(prisma, floor.id);
  }

  await prisma.tenantSetting.upsert({ where: { key: DEMO_PLANT_MARKER }, create: { key: DEMO_PLANT_MARKER, value: String(DEMO_PLANT_VERSION) }, update: { value: String(DEMO_PLANT_VERSION) } });
  return result;
}
