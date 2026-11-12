// Fáze 98: ELDOCK Průmysl ve stejné fázové filozofii jako 2D půdorys a AI Panel Builder – správa výrobního závodu
// (`/plant/[id]`, rozcestník `/app`) má nad pracovní plochou přepínač 4 agend a stránka ukazuje vždy jen jednu:
//   1 Mapa závodu & BIM (.ifc) – 2D mapa areálu s vrstvami napájení Síť / DA / UPS, souhrn, import modelu BIM;
//   2 Rozváděče, Stroje & QR štítky – seznam a karty rozváděčů a strojů se stavem dokumentace, tisk QR štítků;
//   3 Schémata, Červenka & Zálohy PLC – platná schémata, otevřené červené zákresy změn, verzované zálohy řídicího SW;
//   4 Kniha revizí, Legislativa & Simulátor – lhůty revizí, podstatné změny dle Nařízení (EU) 2023/1230 a What-If
//     simulátor zátěže napájení.
// Fáze je v adrese (`?faze=2`) – jde sdílet, Zpět v prohlížeči vrací předchozí agendu. Čisté funkce.

import type { EquipmentType } from "@/generated/prisma/enums";
import { formatCount } from "@/lib/format";

export type PlantPhaseId = 1 | 2 | 3 | 4;

export interface PlantPhaseInfo {
  id: PlantPhaseId;
  /** „2. Rozváděče, Stroje & QR štítky“. */
  label: string;
  hint: string;
}

export const PLANT_PHASES: readonly PlantPhaseInfo[] = [
  { id: 1, label: "1. Mapa závodu & BIM (.ifc)", hint: "2D mapa areálu s vrstvami napájení Síť / DA / UPS, budovy a patra, souhrn stavů a import modelu BIM (.ifc)." },
  { id: 2, label: "2. Rozváděče, Stroje & QR štítky", hint: "Seznam a karty rozváděčů a strojů závodu se stavem dokumentace a tisk QR štítků na dveře rozváděčů a stroje." },
  { id: 3, label: "3. Schémata, Červenka & Zálohy PLC", hint: "Platná schémata (prohlížeč výkresů), otevřené červené zákresy změn z haly a verzované zálohy řídicího SW (PLC, měniče)." },
  { id: 4, label: "4. Kniha revizí, Legislativa & Simulátor", hint: "Lhůty elektrorevizí, podstatné změny strojů dle Nařízení (EU) 2023/1230 a What-If simulátor zátěže napájení." },
];

/** Parametr adresy s agendou závodu. */
export const PLANT_PHASE_PARAM = "faze";

export const plantPhase = (id: PlantPhaseId): PlantPhaseInfo => PLANT_PHASES[id - 1];

/** `?faze=` → fáze (cokoli jiného = 1, mapa závodu). */
export function plantPhaseOf(value: unknown): PlantPhaseId {
  const number = Number(Array.isArray(value) ? value[0] : value);
  return number === 2 || number === 3 || number === 4 ? number : 1;
}

export const plantPhaseHref = (plantId: string, phase: PlantPhaseId): string => (phase === 1 ? `/plant/${plantId}` : `/plant/${plantId}?${PLANT_PHASE_PARAM}=${phase}`);

/** Skupiny zařízení v agendě 2. */
export type EquipmentGroup = "boards" | "machines" | "devices";

export const EQUIPMENT_GROUPS: readonly { id: EquipmentGroup; label: string }[] = [
  { id: "boards", label: "⚡ Rozváděče a zdroje" },
  { id: "machines", label: "🏭 Stroje a výrobní linky" },
  { id: "devices", label: "🔌 Spotřebiče, nářadí a ostatní revidovaná zařízení" },
];

const BOARDS: readonly EquipmentType[] = ["SWITCHBOARD", "TRANSFORMER"];
const MACHINES: readonly EquipmentType[] = ["PRODUCTION_LINE", "MACHINE", "CNC_MACHINE", "ROBOT_CELL", "HVAC_UNIT", "COMPRESSOR"];

export const equipmentGroupOf = (type: EquipmentType): EquipmentGroup => (BOARDS.includes(type) ? "boards" : MACHINES.includes(type) ? "machines" : "devices");

/** Nařízení (EU) 2023/1230 o strojních zařízeních se použije od 20. ledna 2027 (nahrazuje směrnici 2006/42/ES). */
export const MACHINERY_REGULATION_FROM = "2027-01-20";

/** Celé dny do data (záporné = po něm). */
export function daysUntil(isoDate: string, now: Date): number {
  const target = Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10)));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export interface PlantPhaseCounts {
  buildings: number;
  boards: number;
  machines: number;
  devices: number;
  /** Zařízení s platným schématem. */
  drawings: number;
  /** Otevřené změny s červeným zákresem (Červenka). */
  redlines: number;
  /** Aktivní zálohy řídicího SW. */
  backups: number;
  /** Revize po termínu nebo končící do 30 dnů. */
  inspectionsDue: number;
  /** Otevřené podstatné změny bezpečnostních obvodů (čl. 18 Nařízení (EU) 2023/1230). */
  substantial: number;
}

export interface PlantPhaseStatus {
  id: PlantPhaseId;
  done: boolean;
  subtitle: string;
}

/** Živý podtitul a fajfka karet agend (fajfka = v agendě nic nečeká). */
export function plantPhaseStatus(counts: PlantPhaseCounts): PlantPhaseStatus[] {
  const equipment = counts.boards + counts.machines + counts.devices;
  return [
    { id: 1, done: counts.buildings > 0, subtitle: counts.buildings ? `${formatCount(counts.buildings, ["budova", "budovy", "budov"])} · ${formatCount(equipment, ["zařízení", "zařízení", "zařízení"])}` : "areál zatím bez budov" },
    { id: 2, done: equipment > 0, subtitle: `${formatCount(counts.boards, ["rozváděč", "rozváděče", "rozváděčů"])} · ${formatCount(counts.machines, ["stroj", "stroje", "strojů"])}` },
    { id: 3, done: counts.drawings > 0 && counts.redlines === 0, subtitle: `${formatCount(counts.drawings, ["schéma", "schémata", "schémat"])} · ${formatCount(counts.redlines, ["zákres", "zákresy", "zákresů"])} · ${formatCount(counts.backups, ["záloha PLC", "zálohy PLC", "záloh PLC"])}` },
    { id: 4, done: counts.inspectionsDue === 0 && counts.substantial === 0, subtitle: counts.inspectionsDue || counts.substantial ? `${formatCount(counts.inspectionsDue, ["revize k řešení", "revize k řešení", "revizí k řešení"])} · ${formatCount(counts.substantial, ["podstatná změna", "podstatné změny", "podstatných změn"])}` : "revize v termínu · bez podstatných změn" },
  ];
}
