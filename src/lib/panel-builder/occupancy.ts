// Fáze 93: typ objektu a normativní režim (specializace prostoru) – 🏠 bytová / domovní instalace (ČSN 33 2130 ed. 4,
// BD1), 🛍️ obchodní centrum / prostor pro veřejnost (ČSN 33 2000-7-718, BD3 / BD4, vyhláška č. 23/2008 Sb.) a
// 🏥 zdravotnický prostor Skupiny 1 (ČSN 33 2000-7-710 ed. 2). Režim platí pro 2D půdorys (`FloorplanDraft.occupancy`)
// i projekt AI Panel Builderu (`PanelBoardProject.occupancy`): bezhalogenové kabely B2ca a krabice HF v BD4, vypínací
// spoušť CENTRAL STOP a podružný elektroměr MID nájemní jednotky, zásuvky zdravotnického prostoru ve 2 okruzích A / B
// pod nezávislými ochranami 30 mA, doplňující ochranné pospojování EKV a protokol o určení vnějších vlivů. Čisté funkce.

import type { ItemConfig } from "./configurator";

export type OccupancyId = "RESIDENTIAL" | "COMMERCIAL_BD4" | "MEDICAL_G1";

export const DEFAULT_OCCUPANCY: OccupancyId = "RESIDENTIAL";

export interface OccupancyMode {
  id: OccupancyId;
  icon: string;
  /** Celý popis do výběru („🏠 Bytová / Domovní instalace (ČSN 33 2130 ed. 4 – BD1, běžné kabely CYKY)“ bez ikony). */
  label: string;
  /** Krátký štítek do lišty a hlavičky projektu. */
  short: string;
  /** Rozhodující norma režimu. */
  norm: string;
  hint: string;
}

export const OCCUPANCIES: readonly OccupancyMode[] = [
  {
    id: "RESIDENTIAL",
    icon: "🏠",
    label: "Bytová / Domovní instalace (ČSN 33 2130 ed. 4 – BD1, běžné kabely CYKY)",
    short: "Byt / dům · BD1",
    norm: "ČSN 33 2130 ed. 4",
    hint: "Běžné kabely CYKY-J / CYKY-O, krabice podle konstrukce stěny, chrániče 30 mA typ A.",
  },
  {
    id: "COMMERCIAL_BD4",
    icon: "🛍️",
    label: "Obchodní centrum / Prostor pro veřejnost (ČSN 33 2000-7-718 · BD3/BD4 · Bezhalogenové kabely B2ca)",
    short: "Obchodní centrum · BD4",
    norm: "ČSN 33 2000-7-718",
    hint: "Všechny kabely bezhalogenové B2ca-s1,d1,a1, krabice HF, nouzová úniková svítidla, vypínací spoušť CENTRAL STOP a podružný elektroměr MID nájemní jednotky.",
  },
  {
    id: "MEDICAL_G1",
    icon: "🏥",
    label: "Zdravotnický prostor – Skupina 1: Ordinace, vyšetřovny a lůžka (ČSN 33 2000-7-710 ed. 2)",
    short: "Zdravotnictví · Skupina 1",
    norm: "ČSN 33 2000-7-710 ed. 2",
    hint: "Zásuvky lůžka / vyšetřovny ve 2 okruzích A / B pod nezávislými chrániči ≤ 30 mA typ A nebo B, doplňující ochranné pospojování EKV.",
  },
];

export const isOccupancyId = (value: unknown): value is OccupancyId => OCCUPANCIES.some((mode) => mode.id === value);
export const occupancyOf = (value: unknown): OccupancyMode => OCCUPANCIES.find((mode) => mode.id === value) ?? OCCUPANCIES[0];
export const isCommercial = (value: unknown) => value === "COMMERCIAL_BD4";
export const isMedical = (value: unknown) => value === "MEDICAL_G1";
/** „🛍️ Obchodní centrum · BD4“ */
export const occupancyBadge = (value: unknown) => {
  const mode = occupancyOf(value);
  return `${mode.icon} ${mode.short}`;
};

// ---------------------------------------------------------------------------
//  Bezhalogenové kabely a krabice (BD4)
// ---------------------------------------------------------------------------

/** Třída reakce na oheň kabelů v BD4 (CPR, ČSN 73 0848 a ČSN 33 2000-7-718). */
export const HF_CLASS = "B2ca-s1,d1,a1";
/** Sběrnicový a datový kabel v bezhalogenovém provedení. */
export const HF_BUS_CABLE = "J-H(St)H 2×2×0,8 B2ca";
export const HF_DATA_CABLE = "U/FTP CAT6A LSOH B2ca-s1,d1,a1";

const decimal = (value: string) => value.replace(".", ",");
/** Poznámka v závorce na konci označení („… (sběrnice 24 V DC)“). */
const noteOf = (cable: string) => /\s(\([^()]*\))$/.exec(cable)?.[1] ?? "";

/** Kabel je už bezhalogenový (B2ca, N2XH, J-H(St)H, LSOH). */
export const isHalogenFreeCable = (cable: string) => /B2ca|N2XH|CHKE|J-H\(St\)H|LSOH|LSZH/i.test(cable);

/**
 * Bezhalogenová náhrada kabelu pro BD4: „CYKY-J 3×1,5“ → „1-CHKE-R (N2XH-J) 3×1,5 B2ca-s1,d1,a1“, CYKY-O → N2XH-O,
 * ovládací CYSY → N2XH-O (min. 1,5 mm²), sběrnice / signál (KNX J-Y(St)Y, CAT7, SYKFY) → J-H(St)H …×2×0,8 B2ca,
 * data UTP Cat6 → U/FTP CAT6A LSOH B2ca-s1,d1,a1. Poznámka v závorce zůstane; jiné kabely beze změny.
 */
export function halogenFreeCable(cable: string): string {
  const text = cable.trim();
  if (!text || isHalogenFreeCable(text) || text === "v rozváděči") return cable;
  const power = /^CYKY-([JO])\s+(\d+)\s*[x×]\s*(\d+(?:[,.]\d+)?)(.*)$/i.exec(text);
  if (power) return `1-CHKE-R (N2XH-${power[1].toUpperCase()}) ${power[2]}×${decimal(power[3])} ${HF_CLASS}${power[4]}`;
  const cord = /^CYSY\s+(\d+)\s*[x×]\s*(\d+(?:[,.]\d+)?)(.*)$/i.exec(text);
  if (cord) {
    const section = Math.max(1.5, Number(cord[2].replace(",", ".")));
    return `1-CHKE-R (N2XH-O) ${cord[1]}×${decimal(String(section))} ${HF_CLASS}${cord[3]}`;
  }
  const note = noteOf(text);
  if (/KNX|J-Y\(St\)Y|CAT7|SYKFY/i.test(text)) {
    // Počet párů: SYKFY 3×2×0,5 → J-H(St)H 4×2×0,8 (řada 1, 2, 4, 6, 10 párů), sběrnice 2×2×0,8
    const pairs = Number(/(\d+)\s*[x×]\s*2\s*[x×]/i.exec(text)?.[1] ?? 2);
    const hf = [1, 2, 4, 6, 10].find((value) => value >= pairs) ?? 10;
    return `J-H(St)H ${hf}×2×0,8 B2ca${note ? ` ${note}` : ""}`;
  }
  if (/^U\/?UTP|^UTP|\bCat\s?6|\bCAT6/i.test(text)) return `${HF_DATA_CABLE}${note ? ` ${note}` : ""}`;
  return cable;
}

/** Režim objektu → převod označení kabelu (BD4 bezhalogenový, ostatní beze změny). */
export const cableFor = (occupancy: unknown) => (cable: string) => (isCommercial(occupancy) ? halogenFreeCable(cable) : cable);

/** Položky kusovníku domovní instalace v BD4 (krabice HF a sběrnicový / datový kabel bezhalogenový). */
const HF_BOM: Readonly<Record<string, string>> = {
  "Přístrojová krabice KU 68 (standardní)": "Bezhalogenová přístrojová krabice HF do zdiva 45 mm (KOPOS KU 68-45/HF_HA)",
  "Hluboká přístrojová krabice KPR 68 / KU 68 hluboká (min. 65 mm)": "Bezhalogenová hluboká přístrojová krabice HF 70 mm (KOPOS KPR 68-70/HF_HA)",
  "Sběrnicový kabel 24 V DC (CAT7 / KNX TP J-Y(St)Y 2×2×0,8)": `Sběrnicový kabel 24 V DC bezhalogenový (${HF_BUS_CABLE})`,
  "Datová zásuvka RJ45 (UTP Cat6)": `Datová zásuvka RJ45 (${HF_DATA_CABLE})`,
};

export function halogenFreeBomItem(item: string): string {
  if (HF_BOM[item]) return HF_BOM[item];
  return item.replace(/CYKY-([JO])\s+(\d+)\s*[x×]\s*(\d+(?:,\d+)?)/g, (match) => halogenFreeCable(match));
}

// ---------------------------------------------------------------------------
//  Obchodní centrum – nájemní jednotka (CENTRAL STOP, podružný elektroměr MID)
// ---------------------------------------------------------------------------

/** Štítky přístrojů (funkce obvodu – nejvýš 80 znaků); příklady typů jsou v textech nálezů linteru. */
export const CENTRAL_STOP_LABEL = "Vypínací spoušť CENTRAL STOP / TOTAL STOP";
export const MID_METER_LABEL = "Podružný elektroměr MID (Modbus / M-Bus)";
export const CENTRAL_STOP_EXAMPLES = "ABB S2C-A2 / Eaton FAZ-XAA / OEZ SV-LT / Schneider iMX+OF";
export const MID_METER_EXAMPLES = "ABB B23 312-100 / Schneider iEM3155 / Finder 7M.38";
export const BD4_FIX_LABEL = "+ Doplnit vypínací spoušť CENTRAL STOP a podružný MID elektroměr (1-klik)";
/** Vypínací spoušť hlavního vypínače (příslušenství 1 M – ABB S2C-A2 a obdobné). */
export const shuntTripConfig = (manufacturer: string | null): ItemConfig => ({ category: "ACCESSORY", manufacturer, poles: "1P", modules: 1, ratedCurrentA: null, moduleSubtype: "SHUNT_TRIP" });
/** Podružný elektroměr MID s komunikací (3f 4 M, 1f 2 M). */
export const midMeterConfig = (manufacturer: string | null, phases: 1 | 3 = 3): ItemConfig => ({ category: "OTHER", manufacturer, poles: phases === 1 ? "1P+N" : "3P+N", modules: phases === 1 ? 2 : 4, ratedCurrentA: null, moduleSubtype: "METER", power: "MID Modbus" });
/** Vypínací spoušť (štítek, typ nebo podtyp příslušenství SHUNT_TRIP). */
export const SHUNT_TRIP_TEXT = /spoušť|spoust|central stop|total stop|S2C-A|FAZ-XA|SV-LT|iMX/i;
/** Podružný elektroměr s MID (štítek, typ nebo podtyp modulu METER). */
export const MID_METER_TEXT = /\bMID\b|podružn\S* elektroměr|B23 \d|iEM3\d|7M\.38/i;

// ---------------------------------------------------------------------------
//  Zdravotnický prostor Skupiny 1 (ČSN 33 2000-7-710 ed. 2)
// ---------------------------------------------------------------------------

/** Lékařské místnosti podle názvu (ordinace, vyšetřovna, lůžkový pokoj, zákrokový sál, stomatologie …). */
export const MEDICAL_ROOM = /ordinac|vyšetř|vysetr|lůžk|luzk|pokoj pacient|nemocni\S* pokoj|zákrok|zakrok|ošetř|osetr|ambulanc|stomatolog|zubn|rehabilit|fyzioterap|odběr|odber|dialýz|dialyz|\bJIP\b|\bARO\b|lékař|lekar/i;
/** Místnosti, kde hlídač žádá přípojku doplňujícího ochranného pospojování EKV (ordinace, vyšetřovna, koupelna). */
export const EKV_ROOM = /ordinac|vyšetř|vysetr|koupel|sprch|lůžk|luzk|zákrok|zakrok|ošetř|osetr|stomatolog|zubn/i;
export const isMedicalRoom = (name: string) => MEDICAL_ROOM.test(name);

export const MEDICAL_CIRCUIT = {
  A: { label: "Okruh A", colors: "zelené / bílé zásuvky", short: "A" },
  B: { label: "Okruh B", colors: "oranžové / zálohované zásuvky", short: "B" },
} as const;
export type MedicalCircuit = keyof typeof MEDICAL_CIRCUIT;

/** Přesný text chyby Elektro-linteru (ČSN 33 2000-7-710 ed. 2, čl. 710.53 / 710.55). */
export const MEDICAL_SPLIT_MESSAGE =
  "⚠️ ČSN 33 2000-7-710 ed. 2 (čl. 710.53 / 710.55): V zdravotnickém prostoru Skupiny 1 musí být zásuvky lůžka/vyšetřovny napájeny alespoň ze 2 samostatných obvodů pod 2 nezávislými chrániči ≤ 30 mA (typ A nebo B)!";
export const MEDICAL_SPLIT_FIX = "Opravit: Rozdělit zásuvky na 2 nezávislé RCBO/RCD okruhy (1-klik)";
/** Doplňující ochranné pospojování – vodič k přípojnici EKV. */
export const EKV_CONDUCTOR = "CYA 6 mm² ZŽ (H07V-K)";
/** Odpor ochranných vodičů mezi svorkou PE zásuvky / cizí vodivou částí a přípojnicí EKV (Skupina 1 / Skupina 2) [Ω]. */
export const EKV_MAX_OHM = { group1: 0.7, group2: 0.2 } as const;

// ---------------------------------------------------------------------------
//  Protokol o určení vnějších vlivů a legislativní rámec
// ---------------------------------------------------------------------------

export interface OccupancyInfluence {
  value: string;
  description: string;
  measure: string;
}

export interface OccupancyProtocol {
  /** Přepsané třídy vnějších vlivů (BD, BE …). */
  overrides: Partial<Record<"BA" | "BC" | "BD" | "BE", OccupancyInfluence>>;
  /** Kódy do souhrnu protokolu („BD4“, „BE2“). */
  codes: string[];
  /** Normy a předpisy navíc (do protokolu i legislativního rámce technické zprávy). */
  norms: string[];
  /** Zvláštní opatření režimu (odrážky protokolu). */
  measures: string[];
}

const BD4_PROTOCOL: OccupancyProtocol = {
  overrides: {
    BD: {
      value: "BD4",
      description: "obtížný a pomalý únik osob, vysoká hustota osob",
      measure: `Kabely bezhalogenové ${HF_CLASS}, krabice HF, nouzové únikové osvětlení (ČSN EN 1838), vypínací spoušť CENTRAL STOP`,
    },
    BE: {
      value: "BE2",
      description: "nebezpečí požáru",
      measure: "Ochrana před požárem dle ČSN 33 2000-4-42, materiály se zkouškou žhavou smyčkou, bezhalogenová vedení",
    },
  },
  codes: ["BD4", "BE2"],
  norms: ["ČSN 33 2000-7-718 – prostory pro veřejnost a pracoviště (BD3 / BD4)", "Vyhláška č. 23/2008 Sb., o technických podmínkách požární ochrany staveb"],
  measures: [
    "BD4 (obtížný a pomalý únik osob, vysoká hustota osob) a BE2 (nebezpečí požáru) – ČSN 33 2000-7-718 a vyhláška č. 23/2008 Sb.",
    `Všechna vedení bezhalogenová s třídou reakce na oheň ${HF_CLASS} (1-CHKE-R / N2XH, ${HF_BUS_CABLE}, ${HF_DATA_CABLE}); krabice v provedení HF.`,
    "Nouzové únikové osvětlení s piktogramem (1 h / 3 h, SE / SA) podle ČSN EN 1838 a ČSN EN 50172 – zkouška funkce 1× měsíčně, plné doby 1× ročně.",
    "Hlavní vypínač nájemní jednotky s vypínací spouští CENTRAL STOP / TOTAL STOP (vazba na EPS), podružný elektroměr MID s komunikací Modbus / M-Bus.",
  ],
};

const MEDICAL_PROTOCOL: OccupancyProtocol = {
  overrides: {
    BC: {
      value: "BC3",
      description: "častý dotyk osob (pacienti) s potenciálem země",
      measure: `Doplňující ochranné pospojování EKV vodičem ${EKV_CONDUCTOR}, odpor k přípojnici EKV nejvýš ${String(EKV_MAX_OHM.group1).replace(".", ",")} Ω (Skupina 1)`,
    },
  },
  codes: ["Skupina 1"],
  norms: ["ČSN 33 2000-7-710 ed. 2 (Zdravotnické prostory – Skupina 1)", "ČSN EN 62353 ed. 2 – opakované zkoušky zdravotnických elektrických přístrojů"],
  measures: [
    "ČSN 33 2000-7-710 ed. 2 (Zdravotnické prostory – Skupina 1): zásuvky lůžka / vyšetřovny alespoň ze 2 samostatných obvodů (Okruh A a Okruh B) pod 2 nezávislými chrániči ≤ 30 mA typ A nebo B; chrániče typu AC jsou zakázané.",
    `Doplňující ochranné pospojování: přípojka EKV (PE) v ordinaci, vyšetřovně a koupelně vodičem ${EKV_CONDUCTOR}, odpor nejvýš ${String(EKV_MAX_OHM.group1).replace(".", ",")} Ω (Skupina 2: ${String(EKV_MAX_OHM.group2).replace(".", ",")} Ω).`,
    "Kontrola izolačního stavu a impedance smyčky, zkouška vybavení chráničů a měření odporu pospojování při výchozí i pravidelné revizi (Skupina 1: 36 měsíců).",
    "Osvětlení lékařské místnosti ze 2 okruhů nebo s nouzovým svítidlem, aby výpadek jednoho okruhu nezpůsobil úplnou tmu.",
  ],
};

/** Protokol a předpisy režimu objektu; bytová instalace nic nepřidává (null). */
export function occupancyProtocol(value: unknown): OccupancyProtocol | null {
  if (isCommercial(value)) return BD4_PROTOCOL;
  if (isMedical(value)) return MEDICAL_PROTOCOL;
  return null;
}

/** Legislativní rámec technické zprávy doplněný o normy režimu (bez duplicit). */
export function legalFrameworkFor(base: readonly string[], value: unknown): string[] {
  const extra = occupancyProtocol(value)?.norms ?? [];
  return [...base, ...extra.filter((norm) => !base.includes(norm))];
}
