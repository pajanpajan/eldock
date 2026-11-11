// Fáze 92: průvodce výrobním závodem (ELDOCK Průmysl) – jen pro vedoucí údržby, technické ředitele a průmyslové revizní
// techniky (žádné bytové přístroje ani domovní půdorysy). Režim A založí skutečnou halu s hlavním rozváděčem / trafostanicí
// (stejně jako Studio výstavby) a první zdokumentovaný stroj; režim B je 90s mise nad vzorovým závodem se skutečnými
// výpočty (simulátor přívodu `simulateAddedLoad`, klasifikace zásahu dle Nařízení (EU) 2023/1230, kniha PCSCHEMATIC).
// Čisté funkce.

import type { EquipmentType } from "@/generated/prisma/enums";

import { DEFAULT_GRID } from "./cad-grid";
import { kwToAmps, simulateAddedLoad, type PowerCableNode, type SimulationRow } from "./cable-sizing";
import { polygonBounds } from "./campus-layout";
import { SAFETY_IMPACT } from "./legislation-2027";
import type { PanelInput } from "./panel-model";
import type { StudioDraft } from "./studio-draft";

export type OnboardingMode = "build" | "mission";

/** Hlavní zdroj haly: hlavní rozváděč (jmenovitý proud) nebo trafostanice (výkon kVA → proud na straně 400 V). */
export type MainSourceKind = "SWITCHBOARD" | "TRANSFORMER";

export interface HallInput {
  hallName: string;
  boardTag: string;
  sourceKind: MainSourceKind;
  /** Jmenovitý proud [A] (rozváděč) nebo výkon [kVA] (trafostanice). */
  rating: number;
}

export interface MachineInput {
  buildingId: string;
  name: string;
  tag: string;
  type: Extract<EquipmentType, "MACHINE" | "CNC_MACHINE" | "PRODUCTION_LINE" | "SWITCHBOARD">;
  powerKw: number;
}

export const MACHINE_TYPES: readonly { id: MachineInput["type"]; label: string }[] = [
  { id: "CNC_MACHINE", label: "CNC stroj" },
  { id: "MACHINE", label: "Stroj" },
  { id: "PRODUCTION_LINE", label: "Výrobní linka" },
  { id: "SWITCHBOARD", label: "Podružný rozváděč" },
];

/** Vzorové průmyslové schéma na 1 klik (PDF ve `public/demo-docs`, sdílený vzorový soubor). */
export const SAMPLE_SCHEMATIC = { url: "/demo-docs/plc-rozvadec-linka.pdf", name: "Vzorové schéma – PLC rozváděč linky.pdf" } as const;

/** Proud na straně 400 V ze zdánlivého výkonu transformátoru: I = S / (√3 · 400 V). */
export const transformerCurrentA = (kva: number) => Math.round((kva * 1000) / (Math.sqrt(3) * 400));

/** Jmenovitý proud hlavního zdroje haly [A]. */
export const sourceCurrentA = (input: Pick<HallInput, "sourceKind" | "rating">) => (input.sourceKind === "TRANSFORMER" ? transformerCurrentA(input.rating) : Math.round(input.rating));

/** Tag zařízení z textu: velká písmena, číslice a „-“ („hr 1“ → „HR-1“), nejvýš 16 znaků. */
export function cleanTag(value: string, fallback: string): string {
  const tag = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 16);
  return tag || fallback;
}

/** Tag, který v závodě ještě není („CNC-1“, jinak „CNC-1-2“ …). */
export function uniqueTag(tag: string, used: ReadonlySet<string>): string {
  if (!used.has(tag)) return tag;
  for (let index = 2; ; index++) if (!used.has(`${tag}-${index}`)) return `${tag}-${index}`;
}

/** První volný kód budovy A–Z (pak H1–H99). */
export function nextBuildingCode(codes: readonly string[]): string {
  const used = new Set(codes.map((code) => code.toUpperCase()));
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (!used.has(letter)) return letter;
  for (let index = 1; index < 100; index++) if (!used.has(`H${index}`)) return `H${index}`;
  return "HX";
}

const HALL_MAP = { w: 28, h: 20 };

/** Volné místo pro novou halu v areálu (procenta mapy) – první pozice bez překryvu se stávajícími budovami. */
export function freeHallSpot(polygons: readonly string[]): { x: number; y: number; w: number; h: number } {
  const taken = polygons.map((polygon) => polygonBounds(polygon));
  const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w + 2 && b.x < a.x + a.w + 2 && a.y < b.y + b.h + 2 && b.y < a.y + a.h + 2;
  for (const y of [10, 40, 70]) {
    for (const x of [8, 40, 70]) {
      const spot = { x, y, ...HALL_MAP };
      if (!taken.some((rect) => overlaps(spot, rect))) return spot;
    }
  }
  return { x: 8, y: 10, ...HALL_MAP };
}

/** Rozvržení haly 54 × 30 m: výroba a rozvodna s hlavním rozváděčem / trafostanicí (koncept Studia výstavby). */
export function hallDraft(plantId: string, input: HallInput, existing: { codes: readonly string[]; polygons: readonly string[] }): StudioDraft {
  const floor = { kind: "draft", key: "1np" } as const;
  const transformer = input.sourceKind === "TRANSFORMER";
  return {
    plantId,
    grid: { ...DEFAULT_GRID, cols: 10, rows: 6 },
    building: { mode: "new", code: nextBuildingCode(existing.codes), name: input.hallName.trim(), type: "PRODUCTION", map: freeHallSpot(existing.polygons) },
    floors: [
      {
        key: "1np",
        level: 0,
        usage: "Výroba",
        zones: [
          { key: "vyroba", x: 0, y: 0, w: 36, h: 30, name: "Výroba", kind: "PRODUCTION" },
          { key: "rozvodna", x: 42, y: 0, w: 12, h: 12, name: transformer ? "Trafostanice a rozvodna" : "Rozvodna", kind: "ELECTRICAL" },
        ],
        gates: [{ at: "C10", label: "Vrata" }],
      },
    ],
    equipment: [
      { key: "zdroj", floor, pos: { x: 48, y: 6 }, roomKey: null, tag: input.boardTag, name: transformer ? `Trafostanice ${Math.round(input.rating)} kVA` : "Hlavní rozváděč haly", type: transformer ? "TRANSFORMER" : "SWITCHBOARD", parent: null, circuit: null, zone: null, isRoot: true },
    ],
  };
}

// ---------------------------------------------------------------------------
//  Režim B – 90s mise „Noční porucha linky“ nad vzorovým závodem
// ---------------------------------------------------------------------------

export type MissionTaskId = "locate" | "redline" | "backup" | "simulate";

export interface MissionTask {
  id: MissionTaskId;
  step: 1 | 2 | 3 | 4;
  time: string;
  title: string;
  instruction: string;
}

export const MISSION_TASKS: readonly MissionTask[] = [
  { id: "locate", step: 1, time: "02:15", title: "Výpadek stroje", instruction: "Na lisovně vypadl stroj. Klikněte na zvýrazněný rozváděč / stroj na 2D mapě závodu (nebo simulujte načtení jeho QR kódu mobilem)." },
  { id: "redline", step: 2, time: "02:24", title: "Diagnostika ve schématu a elektronická Červenka", instruction: "Vyměnili jste stykač a přepojili svorku. Klikněte v prohlížeči schématu na ✏️ Červenka a zakreslete červenou poznámku do výkresu, aby o změně věděla ranní směna i CAE projektant." },
  { id: "backup", step: 3, time: "02:41", title: "Záloha PLC a hlídač legislativy EU 2023/1230", instruction: "Zkontrolujte záložku Zálohy SW (PLC/HMI) a podívejte se, jak systém vyhodnotil, zda zásah představuje podstatnou změnu stroje dle Nařízení EU 2023/1230." },
  { id: "simulate", step: 4, time: "02:55", title: "Simulátor připojení nového stroje a Kniha revizí", instruction: "Na závěr jedním klikem vyzkoušejte Simulátor zátěže (zda stávající trasa unese nový 60kW stroj) a otevřete Knihu revizí připravenou pro kontrolu TIČR / SÚIP." },
];

/** Limit mise [s]. */
export const MISSION_SECONDS = 90;

/** Vzorový areál pro minimapu (procenta mapy) – lisovna s vypadlým strojem je zvýrazněná. */
export const MISSION_BUILDINGS = [
  { id: "a", code: "A", name: "Hala A – Lisovna", x: 6, y: 12, w: 40, h: 34, alarm: true },
  { id: "b", code: "B", name: "Hala B – Svařovna", x: 52, y: 12, w: 40, h: 34, alarm: false },
  { id: "c", code: "C", name: "Sklad hotových výrobků", x: 6, y: 56, w: 34, h: 30, alarm: false },
  { id: "ts", code: "TS", name: "Trafostanice TS-1 (1000 kVA)", x: 70, y: 62, w: 20, h: 20, alarm: false },
] as const;

/** Stroj a rozváděč z mise (karta stroje). */
export const MISSION_MACHINE = { tag: "LIS-2", name: "Hydraulický lis 250 t", board: "RM-L2", building: "Hala A – Lisovna", fault: "Výpadek -Q3 · stykač -K3 pohonu hydraulického agregátu (M2, 30 kW)" } as const;

/** Vstup knihy PCSCHEMATIC rozváděče lisu (vykreslí `renderPanelSheetSvg`). */
export const MISSION_PANEL: PanelInput = {
  tag: "RM-L2",
  name: "Rozváděč lisovací linky L2",
  type: "SWITCHBOARD",
  ratedCurrent: "250 A",
  ratedVoltage: "3 × 400 V / 50 Hz",
  manufacturer: "Rittal",
  model: "VX25",
  ipRating: "IP54",
  yearInstalled: 2019,
  plantCode: "VZOR",
  plantName: "Vzorový závod",
  customerName: "Vzorový závod",
  buildingCode: "A",
  floorCode: "1NP",
  feeds: [
    { tag: "LIS-2", name: "Hydraulický lis 250 t", type: "MACHINE", circuit: "-Q3" },
    { tag: "DOP-2", name: "Dopravník L2", type: "MACHINE", circuit: "-Q4" },
    { tag: "CHL-1", name: "Chladicí jednotka oleje", type: "HVAC_UNIT", circuit: "-Q5" },
  ],
  revision: { version: "v2.4", date: "11. 11. 2026", author: "Eldock CAE" },
};

/** Zálohy řídicího SW lisu (záložka 💾 Software & Zálohy PLC) – poslední verze po nočním zásahu. */
export const MISSION_BACKUPS = [
  { version: "v2.4", unit: "PLC -A1 (S7-1500F)", platform: "TIA Portal V19", date: "dnes 02:38", author: "Směnový údržbář", summary: "Výměna stykače -K3 1:1, přepojení svorky -X1:14 → -X1:15 (vadný můstek)", safety: false, checksum: "F-Signature: 3A7C-91E2" },
  { version: "v2.3", unit: "PLC -A1 (S7-1500F)", platform: "TIA Portal V19", date: "12. 9. 2026", author: "CAE projektant", summary: "Úprava rampy hydraulického čerpadla", safety: false, checksum: "F-Signature: 3A7C-91E2" },
  { version: "v1.8", unit: "HMI -A2 (Comfort Panel)", platform: "WinCC Unified", date: "3. 2. 2026", author: "CAE projektant", summary: "Nová obrazovka alarmů tlaku", safety: false, checksum: null },
] as const;

/**
 * Klasifikace nočního zásahu dle Nařízení (EU) 2023/1230: výměna stykače 1:1 a přepojení svorky ve výkonovém obvodu bez
 * zásahu do bezpečnostních funkcí = běžná údržba (🟢). F-Signature bezpečnostního programu se nezměnila, změna
 * bezpečnostního obvodu by byla podstatnou změnou (čl. 18).
 */
export function missionAssessment(): { level: keyof typeof SAFETY_IMPACT; label: string; substantial: boolean; reasons: string[] } {
  const [current, previous] = MISSION_BACKUPS;
  const signatureSame = current.checksum === previous.checksum;
  const substantial = !signatureSame || current.safety;
  const level = substantial ? "SUBSTANTIAL_SAFETY_MOD" : "NONE_1_TO_1";
  return {
    level,
    label: SAFETY_IMPACT[level].label,
    substantial,
    reasons: [
      "Stykač -K3 vyměněn za stejný typ (1:1), funkce ani parametry pohonu se nemění.",
      "Přepojení svorky -X1:14 → -X1:15 je ve výkonovém obvodu, ne v bezpečnostním (STO, nouzové zastavení).",
      signatureSame ? `F-Signature bezpečnostního programu beze změny (${current.checksum}).` : "F-Signature bezpečnostního programu se změnila – podstatná změna dle čl. 18.",
    ],
  };
}

/** Strom napájení vzorového závodu pro simulátor (transformátor → hlavní rozváděč → rozváděč lisovny). */
export const MISSION_POWER: readonly PowerCableNode[] = [
  { id: "ts1", tag: "TS-1", parentId: null, type: "TRANSFORMER", nominalCurrentA: null, measuredCurrentA: 820, ratedCurrentA: 1443, cable: null },
  { id: "rh1", tag: "RH1", parentId: "ts1", type: "SWITCHBOARD", nominalCurrentA: null, measuredCurrentA: 640, cable: { cableType: "NYY-J", material: "CU", crossSectionMm2: 240, parallelRuns: 2, lengthM: 35, method: "E", groupingCount: 1, ambientTempC: 30, upstreamBreakerA: 800 } },
  { id: "rml2", tag: "RM-L2", parentId: "rh1", type: "SWITCHBOARD", nominalCurrentA: null, measuredCurrentA: 168, cable: { cableType: "CYKY-J", material: "CU", crossSectionMm2: 95, parallelRuns: 1, lengthM: 62, method: "E", groupingCount: 3, ambientTempC: 35, upstreamBreakerA: 250 } },
];

/** Simulátor zátěže: nový stroj [kW] připojený do rozváděče lisovny – kaskáda kabel → hlavní rozváděč → transformátor. */
export function missionSimulation(addedKw = 60): { addedA: number; rows: SimulationRow[]; ok: boolean } {
  const addedA = kwToAmps(addedKw);
  const rows = simulateAddedLoad(MISSION_POWER, "rml2", addedA);
  return { addedA, rows, ok: rows.every((row) => row.status !== "CRITICAL") };
}

/** Kniha revizí vzorového závodu (výřez auditního reportu pro kontrolu TIČR / SÚIP). */
export const MISSION_LOGBOOK = [
  { tag: "TS-1", name: "Trafostanice 1000 kVA", kind: "Revize VTZ elektrické (NV 190/2022 Sb.)", last: "4. 3. 2026", next: "4. 3. 2029", state: "Platná" },
  { tag: "RH1", name: "Hlavní rozváděč", kind: "Periodická revize ČSN 33 1500", last: "4. 3. 2026", next: "4. 3. 2029", state: "Platná" },
  { tag: "RM-L2", name: "Rozváděč lisovací linky L2", kind: "Periodická revize ČSN 33 1500", last: "18. 5. 2025", next: "18. 5. 2028", state: "Platná" },
  { tag: "LIS-2", name: "Hydraulický lis 250 t", kind: "Revize el. zařízení stroje ČSN EN 60204-1", last: "18. 5. 2025", next: "18. 5. 2026", state: "Po lhůtě – naplánovat" },
] as const;
