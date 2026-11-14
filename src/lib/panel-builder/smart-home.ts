// Fáze 61: chytrá domácnost (sběrnicová úroveň instalace) – volba systému a výrobce, výpočet spínacích, stmívacích,
// žaluziových a topných akčních členů s rezervou kanálů, napájecí zdroj, systémový modul / rozhraní, kontrola
// sběrnice (počet prvků, proud zdroje) a přiřazení kanálů světlům, žaluziím a topným zónám. Čisté funkce.
//
// Zdroje: ABB-free@home – Katalog ABB „Domovní elektroinstalační materiál 2026“ (únor 2026), str. 252–277;
// ABB i-bus KNX – databáze prvků Eldocku (ABB), stmívač UD/S 4.210.2.1 a DALI brána DG/S 1.64.1.1 podle knx.org;
// Loxone – databáze prvků (Miniserver, Relay / Tree Extension) a produktový list Dimmer Extension (100029).
// Údaj bez ověřeného objednacího čísla má `verified: false` (kusovník ho vede jako „ověřte“).
// Fáze 81: úplná nabídka akčních členů na DIN lištu všech čtyř systémů (TapHome už s moduly) s ověřením proti katalogu
// výrobců (`docs/archiv/ZADANI-faze-81.md`), ztrátový výkon Pv pro oteplení rozváděče (`lossW` – z katalogu výrobců,
// jinak orientačně ze zadání fáze 81), alternativní typy jen pro ruční volbu (`manualOnly`) a SysAP na DIN liště
// (`replaces`). Stejná data plní katalog prvků AI Panel Builderu (`smart-din-catalog.ts` → `CatalogComponent`).

import type { LightLoad, LightSpec } from "./floorplan-editor";

export type SmartSystemId = "abb_freeathome" | "abb_knx" | "loxone" | "taphome";
/** Fáze 77: `pwm` = řadič LED 24 V DC (kanály stmívání / CCT / RGBW), `input` = binární vstupy (čidla), `psu_led` = zdroj LED 24 V. */
export type SmartRole = "switch" | "dim" | "dali" | "blind" | "heating" | "pwm" | "input" | "psu" | "psu_led" | "interface" | "system";
/** Fáze 77: druhy kanálů akčních členů (zátěže). */
export type ChannelRole = "switch" | "dim" | "dali" | "blind" | "heating" | "pwm" | "input";
export const CHANNEL_ROLES: readonly ChannelRole[] = ["switch", "dim", "dali", "blind", "heating", "pwm", "input"];

/** Fáze 77: řadiče a vstupy mimo databázi prvků (obecné, objednací číslo doplní projektant podle nabídky výrobce). */
const GENERIC = "obecný modul – ověřte nabídku výrobce a šířku v datasheetu";
const genericPwm = (prefix: string): SmartModule => ({ id: `${prefix}-pwm`, role: "pwm", label: "Řadič LED 24 V DC PWM, 4 kanály (stmívání / CCT / RGBW)", typeCode: "PWM 4× 24 V DC", articleNumber: null, verified: false, channels: 4, modules: 2, source: GENERIC });
// Fáze 81: obecné binární vstupy už nejsou potřeba – každý systém má vlastní modul vstupů (BI-M, BE/S, DI Extension, 12UI)

/**
 * Fáze 77: napájecí zdroje 24 V DC na DIN lištu pro LED pásky (řada MEAN WELL HDR – šířky 52,5 / 70 / 105 mm) – vybírá se
 * nejmenší, který pokryje příkon pásků + 20 %; nad 150 W víc zdrojů.
 */
export const LED_SUPPLIES: readonly SmartModule[] = [
  { id: "led-psu-60", role: "psu_led", label: "Napájecí zdroj 24 V DC / 60 W na DIN lištu (LED)", typeCode: "HDR-60-24", articleNumber: null, verified: false, channels: 60, modules: 3, source: "MEAN WELL HDR-60-24 (ověřte dostupnost)" },
  { id: "led-psu-100", role: "psu_led", label: "Napájecí zdroj 24 V DC / 100 W na DIN lištu (LED)", typeCode: "HDR-100-24", articleNumber: null, verified: false, channels: 100, modules: 4, source: "MEAN WELL HDR-100-24 (ověřte dostupnost)" },
  { id: "led-psu-150", role: "psu_led", label: "Napájecí zdroj 24 V DC / 150 W na DIN lištu (LED)", typeCode: "HDR-150-24", articleNumber: null, verified: false, channels: 150, modules: 6, source: "MEAN WELL HDR-150-24 (ověřte dostupnost)" },
];

/** Zdroje LED 24 V pro příkon `watts` (s rezervou už započtenou): nejmenší dostačující, jinak víc největších. */
export function ledSupplies(watts: number): SmartModule[] {
  if (watts <= 0) return [];
  const single = LED_SUPPLIES.find((unit) => unit.channels >= watts);
  if (single) return [single];
  const largest = LED_SUPPLIES[LED_SUPPLIES.length - 1];
  return Array.from({ length: Math.ceil(watts / largest.channels) }, () => largest);
}

export interface SmartModule {
  id: string;
  role: SmartRole;
  label: string;
  typeCode: string;
  articleNumber: string | null;
  verified: boolean;
  /** Počet kanálů (výstupů / účastníků DALI). */
  channels: number;
  /** Šířka na DIN liště [M]; 0 = mimo lištu (nástěnný systémový modul). */
  modules: number;
  /** Spínací kanál: jmenovitý proud AC-1 [A]. */
  ratedA?: number;
  /** Stmívací kanál: max. výkon LED / žárovky na kanál [W] (null = ověřte v datasheetu). */
  maxW?: number | null;
  /** Napájecí zdroj: proud sběrnice [mA]. */
  busMa?: number;
  source: string;
  /** Fáze 81: ztrátový výkon Pv [W] pro oteplení rozváděče; null = výrobce neuvádí (odhad dle IEC). */
  lossW?: number | null;
  /**
   * Původ Pv: katalog výrobců, `manufacturer` = ověřeno na produktové stránce / v datasheetu výrobce (fáze 115, bez
   * „odhad dle IEC“), orientačně ze zadání fáze 81, nebo odvozeno ze shodné platformy (sourozenec free@home).
   */
  lossFrom?: "katalog" | "manufacturer" | "zadání" | "odvozeno";
  /** Fáze 81: alternativní typ jen pro ruční volbu v katalogu – výpočet ho sám nevybere. */
  manualOnly?: boolean;
  /** Fáze 81: ručně přidaný kus nahradí výchozí modul s tímto id (SysAP na DIN liště místo nástěnného). */
  replaces?: string;
  /** Fáze 81: příslušenství kusu do kusovníku (adaptér SysAP na DIN lištu). */
  accessory?: { typeCode: string; articleNumber: string; label: string };
  /** Fáze 81: odkaz na datasheet / produktovou stránku výrobce. */
  datasheetUrl?: string;
  /** Fáze 114: EAN (GTIN) z oficiálních dat výrobce. */
  ean?: string;
}

export interface SmartSystem {
  id: SmartSystemId;
  label: string;
  manufacturer: string;
  description: string;
  /** Nejvýš prvků na systém (SysAP / linie). */
  maxDevices: number;
  /** Odběr jednoho sběrnicového prvku ze zdroje [mA] (orientačně pro kontrolu zdroje). */
  deviceMa: number;
  /** Nejvýš prvků na jednu linii / zdroj. */
  devicesPerLine: number;
  /** Nejvýš délka kabelu sběrnice v linii [m]. */
  maxLineM: number;
  /** Rezerva kanálů akčních členů (podíl). */
  reserve: number;
  modules: SmartModule[];
}

const FAH = "Katalog ABB 2026 (Domovní elektroinstalační materiál), ABB-free@home";
/** Fáze 114: ověření na produktové stránce ABB (šířka v modulech, Pv, EAN). */
const ABB_PAGE_SRC = "ABB new.abb.com – šířka, Pv a EAN ověřeny 2026-11-14";
/** Fáze 115: celá řada free@home na DIN lištu – typ a EAN z ABB ETIM 9.0, šířka a Pv („Power Loss“) z new.abb.com. */
const ABB_PAGE_115 = "ABB ETIM 9.0 (typ, EAN) a new.abb.com (šířka, Power Loss) – ověřeno 2026-11-14";
const abbPage = (id: string) => `https://new.abb.com/products/${id}`;
const KNX = "ABB i-bus KNX – databáze prvků Eldocku";
const TAP = "TapHome – zadání fáze 81 (objednací číslo, šířku a Pv ověřte u výrobce)";

export const SMART_SYSTEMS: SmartSystem[] = [
  {
    id: "abb_freeathome",
    label: "ABB-free@home (sběrnice 24 V DC)",
    manufacturer: "ABB",
    description: "Systémový modul SysAP 3.0 (až 150 prvků, aplikace a hlasové ovládání), tlačítková rozhraní v designu řad Zoni / Tango / Levit, akční členy na DIN liště v rozváděči.",
    maxDevices: 150,
    deviceMa: 10,
    devicesPerLine: 64,
    maxLineM: 1000,
    reserve: 0.2,
    modules: [
      // Fáze 115: celá řada ABB-free@home na DIN lištu s Pv z produktových stránek ABB (`lossFrom: "manufacturer"`). Typy
      // a EAN ze zadání fáze 115, které ABB nevede (DA/M.6.315.2.1, BI-M-2/4/8.24.1, SU-M-4.2.1 / 4.4.1, SAP/S.3 + MDRC-A,
      // EAN SA-M-12 …323, DA/M …2024 / …2048, PS-M …0166), nahrazují skutečné kusy ABB; 2CDG510006R0011 (SA-M-0.4.1)
      // a 2CDG510004R0011 (BI-M-4.0.1) ABB nahradil SA-M-4.16.2.2 a BI-M-4.230.1.1.
      { id: "fah-sap", role: "system", label: "Systémový modul SysAP 3.0 (sběrnicový + bezdrátový, nástěnný)", typeCode: "SAP.3", articleNumber: "2CKA006200A0871", ean: "4011395346075", verified: true, channels: 150, modules: 0, lossW: 3.5, lossFrom: "zadání", source: `${FAH}, str. 271 (Pv výrobce neuvádí)`, datasheetUrl: abbPage("2CKA006200A0871") },
      // Fáze 81 / 115: SysAP s adaptérem SAP-A1.1 na DIN lištu místo nástěnné montáže – šířka SAP.3 107,2 mm = 6 M
      { id: "fah-sap-din", role: "system", label: "Systémový modul SysAP 3.0 s adaptérem SAP-A1.1 na DIN lištu (6 M)", typeCode: "SAP.3 + SAP-A1.1", articleNumber: "2CKA006200A0871", ean: "4011395346075", verified: true, channels: 150, modules: 6, lossW: 3.5, lossFrom: "zadání", manualOnly: true, replaces: "fah-sap", accessory: { typeCode: "SAP-A1.1", articleNumber: "2CKA006200A0158", label: "Adaptér na DIN lištu pro systémový modul" }, source: `${ABB_PAGE_115}: SAP.3 šířka 107,2 mm (6 M), adaptér SAP-A1.1 80,6 × 88,7 mm; Pv výrobce neuvádí`, datasheetUrl: abbPage("2CKA006200A0158") },
      { id: "fah-psu", role: "psu", label: "Zdroj napájecí sběrnicový s tlumivkou 640 mA (4 M)", typeCode: "PS-M-64.1.1", articleNumber: "2CDG510001R0011", ean: "4016779941839", verified: true, channels: 0, modules: 4, busMa: 640, lossW: 9, lossFrom: "manufacturer", source: `${FAH}, str. 273; ${ABB_PAGE_115}`, datasheetUrl: abbPage("2CDG510001R0011") },
      { id: "fah-sa4", role: "switch", label: "Člen akční spínací 4násobný, 16 A (4 M)", typeCode: "SA-M-4.16.2.2", articleNumber: "2CDG510025R0011", ean: "4053546111309", verified: true, channels: 4, modules: 4, ratedA: 16, lossW: 4, lossFrom: "manufacturer", source: `${FAH}, str. 274; ${ABB_PAGE_115}`, datasheetUrl: abbPage("2CDG510025R0011") },
      { id: "fah-sa8", role: "switch", label: "Člen akční spínací 8násobný, 16 A (8 M)", typeCode: "SA-M-8.16.2.2", articleNumber: "2CDG510026R0011", ean: "4053546111316", verified: true, channels: 8, modules: 8, ratedA: 16, lossW: 8, lossFrom: "manufacturer", source: `${FAH}, str. 274; ${ABB_PAGE_115}`, datasheetUrl: abbPage("2CDG510026R0011") },
      { id: "fah-sa12", role: "switch", label: "Člen akční spínací 12násobný, 16 A (12 M)", typeCode: "SA-M-12.16.2.2", articleNumber: "2CDG510027R0011", ean: "4053546111330", verified: true, channels: 12, modules: 12, ratedA: 16, lossW: 12, lossFrom: "manufacturer", source: `${FAH}, str. 274; ${ABB_PAGE_115}`, datasheetUrl: abbPage("2CDG510027R0011") },
      // Fáze 115: spínací člen s binárními vstupy (8 vstupů + 8 relé 6 A) – alternativa jen pro ruční volbu
      { id: "fah-sa8io", role: "switch", label: "Člen akční spínací 8násobný 6 A s 8 binárními vstupy (8 M)", typeCode: "SA-M-8.8.1", articleNumber: "2CDG510007R0011", ean: "4016779945561", verified: true, channels: 8, modules: 8, ratedA: 6, lossW: 2, lossFrom: "manufacturer", manualOnly: true, source: `${FAH}, str. 277; ${ABB_PAGE_115}`, datasheetUrl: abbPage("2CDG510007R0011") },
      { id: "fah-da4", role: "dim", label: "Člen akční stmívací 4násobný, 4× 210 W (LED na sestupné hraně, 6 M)", typeCode: "DA/M.4.210.2.1", articleNumber: "2CKA006220A0729", ean: "4011395251799", verified: true, channels: 4, modules: 6, maxW: 210, lossW: 2.3, lossFrom: "manufacturer", source: `${FAH}, str. 275; ${ABB_PAGE_115}`, datasheetUrl: abbPage("2CKA006220A0729") },
      { id: "fah-da6", role: "dim", label: "Člen akční stmívací 6násobný, 6× 210 W (LED na sestupné hraně, 8 M)", typeCode: "DA/M.6.210.2.1", articleNumber: "2CKA006220A0731", ean: "4011395252031", verified: true, channels: 6, modules: 8, maxW: 210, lossW: 3.3, lossFrom: "manufacturer", source: `${FAH}, str. 275; ${ABB_PAGE_115}`, datasheetUrl: abbPage("2CKA006220A0731") },
      { id: "fah-dali", role: "dali", label: "Rozhraní DALI / free@home, max. 16 účastníků (4 M)", typeCode: "DG-M-1.16.1", articleNumber: "2CDG510012R0011", ean: "4016779067409", verified: true, channels: 16, modules: 4, lossW: 2, lossFrom: "manufacturer", source: `${FAH}, str. 275; ${ABB_PAGE_115}`, datasheetUrl: abbPage("2CDG510012R0011") },
      // Fáze 114: žaluzie i topení ve 4M i 8M – typ, šířka, Pv a EAN z produktových stránek ABB a ABB ETIM 9.0 (zadání fáze 114
      // i 115 uvádí typy „BA-M-x.230.2.1“ a jiné EAN – výrobce je nevede; Pv 8M / 12× podle ABB 3 W / 4 W, ne 2,5 W / 3,5 W)
      { id: "fah-ba4", role: "blind", label: "Člen akční žaluziový 4násobný, 6 A (4 M)", typeCode: "BA-M-4.230.1.1", articleNumber: "2CDG510028R0011", ean: "4053546111347", verified: true, channels: 4, modules: 4, lossW: 1.5, lossFrom: "manufacturer", source: `${FAH}, str. 276; ${ABB_PAGE_SRC}`, datasheetUrl: abbPage("2CDG510028R0011") },
      { id: "fah-ba8", role: "blind", label: "Člen akční žaluziový 8násobný, 6 A (8 M)", typeCode: "BA-M-8.230.1.1", articleNumber: "2CDG510029R0011", ean: "4053546111354", verified: true, channels: 8, modules: 8, lossW: 3, lossFrom: "manufacturer", source: `${FAH}, str. 276; ${ABB_PAGE_SRC}`, datasheetUrl: abbPage("2CDG510029R0011") },
      { id: "fah-ha6", role: "heating", label: "Člen akční topení 6násobný, termoelektrické hlavice (4 M)", typeCode: "HA-M-0.6.1", articleNumber: "2CDG510008R0011", ean: "4016779941815", verified: true, channels: 6, modules: 4, lossW: 2, lossFrom: "manufacturer", source: `${FAH}, str. 276; ${ABB_PAGE_SRC}`, datasheetUrl: abbPage("2CDG510008R0011") },
      { id: "fah-ha12", role: "heating", label: "Člen akční topení 12násobný, termoelektrické hlavice (8 M)", typeCode: "HA-M-0.12.1", articleNumber: "2CDG510009R0011", ean: "4016779941808", verified: true, channels: 12, modules: 8, lossW: 4, lossFrom: "manufacturer", source: `${FAH}, str. 276; ${ABB_PAGE_SRC}`, datasheetUrl: abbPage("2CDG510009R0011") },
      // Fáze 81 / 115: binární vstupy čidel – BI-M-4.20.1.1 (2 M) a BI-M-10.20.1.1 (4 M) pro bezpotenciálové kontakty,
      // varianty 10–230 V jen pro ruční volbu
      { id: "fah-bi4", role: "input", label: "Modul binárních vstupů 4násobný s testovacím napětím (bezpotenciálové kontakty, 2 M)", typeCode: "BI-M-4.20.1.1", articleNumber: "2CDG510014R0011", ean: "4053546111132", verified: true, channels: 4, modules: 2, lossW: 0.25, lossFrom: "manufacturer", source: `${FAH}, str. 277; ${ABB_PAGE_115}`, datasheetUrl: abbPage("2CDG510014R0011") },
      { id: "fah-bi10", role: "input", label: "Modul binárních vstupů 10násobný s testovacím napětím (bezpotenciálové kontakty, 4 M)", typeCode: "BI-M-10.20.1.1", articleNumber: "2CDG510015R0011", ean: "4053546111156", verified: true, channels: 10, modules: 4, lossW: 0.25, lossFrom: "manufacturer", source: ABB_PAGE_115, datasheetUrl: abbPage("2CDG510015R0011") },
      { id: "fah-bi4v", role: "input", label: "Modul binárních vstupů 4násobný 10–230 V AC/DC s ručním ovládáním (2 M)", typeCode: "BI-M-4.230.1.1", articleNumber: "2CDG510016R0011", ean: "4053546111170", verified: true, channels: 4, modules: 2, lossW: 0.25, lossFrom: "manufacturer", manualOnly: true, source: `${FAH}, str. 277; ${ABB_PAGE_115}`, datasheetUrl: abbPage("2CDG510016R0011") },
      { id: "fah-bi10v", role: "input", label: "Modul binárních vstupů 10násobný 10–230 V AC/DC s ručním ovládáním (4 M)", typeCode: "BI-M-10.230.1.1", articleNumber: "2CDG510017R0011", ean: "4053546111194", verified: true, channels: 10, modules: 4, lossW: 0.25, lossFrom: "manufacturer", manualOnly: true, source: ABB_PAGE_115, datasheetUrl: abbPage("2CDG510017R0011") },
      // Fáze 77: LED 24 V PWM – v katalogu free@home na DIN liště není, obecný modul
      genericPwm("fah"),
    ],
  },
  {
    id: "abb_knx",
    label: "ABB i-bus KNX (sběrnice KNX TP)",
    manufacturer: "ABB",
    description: "Otevřený standard KNX (ČSN EN 50090) – zdroj 640 mA na linii, IP rozhraní pro programování (ETS) a vizualizaci, akční členy ABB i-bus na DIN liště.",
    maxDevices: 256,
    deviceMa: 10,
    devicesPerLine: 64,
    maxLineM: 1000,
    reserve: 0.2,
    modules: [
      { id: "knx-psu", role: "psu", label: "Napájecí zdroj KNX 640 mA s diagnostikou", typeCode: "SV/S 30.640.5.1", articleNumber: "2CDG110146R0011", verified: true, channels: 0, modules: 4, busMa: 640, source: KNX },
      // Fáze 81: zdroj KNX 640 mA bez diagnostiky (ruční volba)
      { id: "knx-psu3", role: "psu", label: "Napájecí zdroj KNX 640 mA", typeCode: "SV/S 30.640.3.1", articleNumber: "2CDG110167R0011", verified: true, channels: 0, modules: 4, busMa: 640, lossW: 5, lossFrom: "zadání", manualOnly: true, source: "katalog výrobců (ABB i-bus KNX)" },
      { id: "knx-ip", role: "interface", label: "IP rozhraní KNX Secure (programování ETS, vizualizace)", typeCode: "IPS/S 3.5.1", articleNumber: "2CDG110204R0011", verified: false, channels: 0, modules: 2, source: "distributor (ověřte v katalogu ABB KNX)" },
      { id: "knx-sa4", role: "switch", label: "Spínací akční člen 4násobný, 16 A", typeCode: "SA/S 4.16.2.2", articleNumber: "2CDG110262R0011", verified: true, channels: 4, modules: 4, ratedA: 16, lossW: 4, lossFrom: "katalog", source: `${KNX}; Pv z datasheetu ABB`, datasheetUrl: "https://blob-cdn.bankoflamps.com/ff/ffd152f64af71058a0e6bcbbf7fa336855f8ea80.pdf" },
      { id: "knx-sa8", role: "switch", label: "Spínací akční člen 8násobný, 16 A", typeCode: "SA/S 8.16.2.2", articleNumber: "2CDG110263R0011", verified: true, channels: 8, modules: 8, ratedA: 16, lossW: 7.5, lossFrom: "odvozeno", source: `${KNX} (Pv orientačně podle shodné platformy SA-M-8.16.2.2)`, datasheetUrl: "https://aleta.hr/en/products/1858749" },
      { id: "knx-sa12", role: "switch", label: "Spínací akční člen 12násobný, 16 A", typeCode: "SA/S 12.16.2.2", articleNumber: "2CDG110264R0011", verified: true, channels: 12, modules: 12, ratedA: 16, lossW: 12, lossFrom: "odvozeno", source: `${KNX} (Pv orientačně podle shodné platformy SA-M-12.16.2.2)`, datasheetUrl: "https://vypinace.sk.abb.com/sk/product/detail/18830/18907?mime=pdf" },
      // Fáze 81: šířka 6 M podle zadání a shodné platformy free@home DA/M.4.210.2.1 (katalog výrobců šířku neuvádí)
      { id: "knx-ud4", role: "dim", label: "Univerzální stmívací akční člen 4× 210 W (LED)", typeCode: "UD/S 4.210.2.1", articleNumber: "2CKA006197A0047", verified: true, channels: 4, modules: 6, maxW: 210, lossW: 6.5, lossFrom: "odvozeno", source: "knx.org (UD/S4.210.2.1 LED Dimmer 4x210W); šířka 6 M podle zadání a shodné platformy DA/M.4.210.2.1 – ověřte v datasheetu" },
      { id: "knx-dali", role: "dali", label: "DALI brána Basic, 1 kanál, max. 64 účastníků", typeCode: "DG/S 1.64.1.1", articleNumber: "2CDG110198R0011", verified: true, channels: 64, modules: 4, source: "knx.org (DG/S1.64.1.1 DALI Gateway)" },
      { id: "knx-jra4", role: "blind", label: "Žaluziový akční člen 4násobný 230 V", typeCode: "JRA/S 4.230.5.1", articleNumber: "2CDG110125R0011", verified: true, channels: 4, modules: 4, source: KNX },
      { id: "knx-jra8", role: "blind", label: "Žaluziový akční člen 8násobný 230 V", typeCode: "JRA/S 8.230.5.1", articleNumber: "2CDG110126R0011", verified: true, channels: 8, modules: 8, source: KNX },
      // Fáze 81: žaluziové členy JRA/S x.230.2.1 (ruční volba – výpočet bere řadu .5.1)
      { id: "knx-jra4b", role: "blind", label: "Žaluziový akční člen 4násobný 230 V (řada .2.1)", typeCode: "JRA/S 4.230.2.1", articleNumber: "2CDG110121R0011", verified: true, channels: 4, modules: 4, manualOnly: true, source: "katalog výrobců (ABB i-bus KNX)" },
      { id: "knx-jra8b", role: "blind", label: "Žaluziový akční člen 8násobný 230 V (řada .2.1)", typeCode: "JRA/S 8.230.2.1", articleNumber: "2CDG110122R0011", verified: true, channels: 8, modules: 8, manualOnly: true, source: "katalog výrobců (ABB i-bus KNX)" },
      { id: "knx-es4", role: "heating", label: "Elektronický spínací akční člen 4násobný (termoelektrické hlavice)", typeCode: "ES/S 4.1.2.1", articleNumber: "2CDG110058R0011", verified: true, channels: 4, modules: 4, source: KNX },
      { id: "knx-es8", role: "heating", label: "Elektronický spínací akční člen 8násobný (termoelektrické hlavice)", typeCode: "ES/S 8.1.2.1", articleNumber: "2CDG110059R0011", verified: true, channels: 8, modules: 8, source: KNX },
      // Fáze 81: ventilový akční člen 4násobný (ruční volba, 8 M podle katalogu výrobců)
      { id: "knx-vc4", role: "heating", label: "Ventilový akční člen 4násobný (termoelektrické pohony ventilů)", typeCode: "VC/S 4.1.1", articleNumber: "2CDG110216R0011", verified: true, channels: 4, modules: 8, manualOnly: true, source: "katalog výrobců (ABB i-bus KNX)" },
      // Fáze 77: binární vstupy čidel oken a vody (fáze 81: objednací číslo a šířka z katalogu výrobců), LED 24 V PWM
      { id: "knx-be8", role: "input", label: "Binární vstup 8násobný, snímání kontaktů", typeCode: "BE/S 8.20.2.1", articleNumber: "2CDG110092R0011", verified: true, channels: 8, modules: 4, lossW: 1.5, lossFrom: "zadání", source: "katalog výrobců (ABB i-bus KNX)" },
      genericPwm("knx"),
    ],
  },
  {
    id: "loxone",
    label: "Loxone (Miniserver + Tree)",
    manufacturer: "Loxone",
    description: "Centrální Miniserver s 8 reléovými výstupy, rozšíření Relay / Dimmer / Tree Extension na DIN liště, tlačítka a čidla na sběrnici Tree.",
    maxDevices: 300,
    deviceMa: 0,
    devicesPerLine: 50,
    maxLineM: 500,
    reserve: 0.2,
    modules: [
      { id: "lox-mini", role: "system", label: "Miniserver (8 reléových výstupů, 8 vstupů)", typeCode: "Miniserver", articleNumber: "100335", verified: true, channels: 8, modules: 9, ratedA: 16, lossW: 6.7, lossFrom: "katalog", source: "databáze prvků Eldocku (Loxone)" },
      // Fáze 81: Miniserver Compact (bez reléových výstupů) – ruční volba
      { id: "lox-mini-compact", role: "system", label: "Miniserver Compact (Air, Tree a Link, 4 vstupy)", typeCode: "Miniserver Compact", articleNumber: "100512", verified: true, channels: 0, modules: 6, lossW: 8.4, lossFrom: "katalog", manualOnly: true, source: "katalog výrobců (Loxone 100512)" },
      { id: "lox-relay", role: "switch", label: "Relay Extension (14 reléových výstupů)", typeCode: "Relay Extension", articleNumber: "100038", verified: true, channels: 14, modules: 9, ratedA: 16, lossW: 11, lossFrom: "katalog", source: "databáze prvků Eldocku (Loxone)" },
      { id: "lox-dim", role: "dim", label: "Dimmer Extension (4 stmívací kanály 230 V)", typeCode: "Dimmer Extension", articleNumber: "100029", verified: true, channels: 4, modules: 9, maxW: null, lossW: 8, lossFrom: "zadání", source: "Loxone – produktový list 100029 (zatížení kanálu ověřte)", datasheetUrl: "https://www.loxone.com/wp-content/uploads/datasheets/Datasheet_DimmerExtension.pdf" },
      // Fáze 81: DALI Extension (objednací číslo ze zadání – v katalogu výrobců není)
      { id: "lox-dali", role: "dali", label: "DALI Extension (1 linka DALI, max. 64 předřadníků)", typeCode: "DALI Extension", articleNumber: "100200", verified: false, channels: 64, modules: 2, lossW: 2, lossFrom: "zadání", source: "zadání fáze 81 – objednací číslo a údaje ověřte u výrobce" },
      { id: "lox-tree", role: "interface", label: "Tree Extension (2 větve Tree, 50 prvků na větev)", typeCode: "Tree Extension", articleNumber: "100218", verified: true, channels: 100, modules: 2, lossW: 0.12, lossFrom: "katalog", source: "databáze prvků Eldocku (Loxone)" },
      // Fáze 81: Multi Extension Air (brána Air, 12 vstupů) – ruční volba
      { id: "lox-multi-air", role: "interface", label: "Multi Extension Air (brána Loxone Air, 12 digitálních vstupů)", typeCode: "Multi Extension Air", articleNumber: "100116", verified: true, channels: 0, modules: 9, lossW: 8.7, lossFrom: "katalog", manualOnly: true, source: "katalog výrobců (Loxone 100116)" },
      { id: "lox-psu", role: "psu", label: "Napájecí zdroj 24 V DC pro Miniserver a Tree", typeCode: "24 V DC / 2,5 A", articleNumber: null, verified: false, channels: 0, modules: 3, busMa: 2500, source: "obecný zdroj 24 V DC" },
      // Fáze 81: větší zdroj 24 V DC a Power Supply & Backup (ruční volba)
      { id: "lox-psu42", role: "psu", label: "Napájecí zdroj 24 V DC / 4,2 A pro Miniserver a Tree", typeCode: "24 V DC / 4,2 A", articleNumber: null, verified: false, channels: 0, modules: 4, busMa: 4200, manualOnly: true, source: "obecný zdroj 24 V DC (zadání fáze 81)" },
      { id: "lox-psb", role: "psu", label: "Power Supply & Backup (napájení 24 V DC se zálohou)", typeCode: "Power Supply & Backup", articleNumber: "100401", verified: true, channels: 0, modules: 18, manualOnly: true, source: "katalog výrobců (Loxone 100401, šířka 18 M)" },
      // Fáze 77: LED 24 V PWM a digitální vstupy čidel (fáze 81: objednací čísla, šířka a Pv z katalogu výrobců)
      { id: "lox-rgbw", role: "pwm", label: "RGBW 24V Dimmer Tree (4 kanály PWM)", typeCode: "RGBW 24V Dimmer Tree", articleNumber: "100239", verified: true, channels: 4, modules: 2, lossW: 3, lossFrom: "katalog", source: "katalog výrobců (Loxone 100239)" },
      { id: "lox-di", role: "input", label: "DI Extension (20 digitálních vstupů)", typeCode: "DI Extension", articleNumber: "100283", verified: true, channels: 20, modules: 2, lossW: 0.5, lossFrom: "katalog", source: "katalog výrobců (Loxone 100283)" },
    ],
  },
  {
    // Fáze 63: TapHome – řídicí jednotka Core; fáze 81: moduly na DIN lištu podle zadání (objednací čísla ověřte u výrobce)
    id: "taphome",
    label: "TapHome (Core + sběrnice)",
    manufacturer: "TapHome",
    description: "Řídicí jednotka Core, tlačítka 2T / 4T / 6T, ovladače s displejem a UI termostat na sběrnici; moduly na DIN lištu – relé 6DO, výstupy 4DO, stmívač 4CH, vstupy 12UI a zdroj 24 V DC.",
    maxDevices: 999,
    deviceMa: 0,
    devicesPerLine: 999,
    maxLineM: 500,
    reserve: 0.2,
    modules: [
      { id: "tap-core", role: "system", label: "Řídicí jednotka TapHome Core (DIN lišta)", typeCode: "Core", articleNumber: null, verified: false, channels: 0, modules: 4, lossW: 3, lossFrom: "zadání", source: TAP },
      { id: "tap-6do", role: "switch", label: "TapHome 6DO – 6× relé 16 A na DIN lištu", typeCode: "6DO", articleNumber: null, verified: false, channels: 6, modules: 6, ratedA: 16, lossW: 4.5, lossFrom: "zadání", source: TAP },
      { id: "tap-4do", role: "blind", label: "TapHome 4DO – 4 výstupy (2 motory žaluzií nebo 4 spínané okruhy)", typeCode: "4DO", articleNumber: null, verified: false, channels: 2, modules: 4, lossW: 3.5, lossFrom: "zadání", source: TAP },
      { id: "tap-dim4", role: "dim", label: "TapHome Dimmer 4CH – 4 stmívací kanály na DIN lištu", typeCode: "Dimmer 4CH", articleNumber: null, verified: false, channels: 4, modules: 6, maxW: null, lossW: 6, lossFrom: "zadání", source: TAP },
      { id: "tap-12ui", role: "input", label: "TapHome 12UI – 12 univerzálních vstupů na DIN lištu", typeCode: "12UI", articleNumber: null, verified: false, channels: 12, modules: 4, lossW: 1.5, lossFrom: "zadání", source: TAP },
      { id: "tap-psu", role: "psu", label: "TapHome zdroj 24 V DC / 60 W", typeCode: "PSU 24 V DC / 60 W", articleNumber: null, verified: false, channels: 0, modules: 3, busMa: 2500, lossW: 4, lossFrom: "zadání", source: TAP },
    ],
  },
];

export const isSmartSystem = (value: unknown): value is SmartSystemId => SMART_SYSTEMS.some((system) => system.id === value);
export const smartSystemOf = (id: SmartSystemId | null | undefined) => SMART_SYSTEMS.find((system) => system.id === id) ?? SMART_SYSTEMS[0];

/** Zátěž připojená k akčnímu členu (světlo, žaluzie, topná zóna). */
export interface SmartLoad {
  id: string;
  room: string;
  role: ChannelRole;
  powerW: number;
  load?: LightLoad;
  label: string;
  /** Fáze 77: kanály PWM řadiče na zátěž (stmívání 1, CCT 2, RGB 3, RGBW 4, RGB + CCT 5); jinak 1 kanál. */
  channels?: number;
}

/** Druh kanálu světla podle zátěže: DALI předřadník → DALI, stmívané → stmívací kanál, jinak spínací. */
export const lightRole = (spec: LightSpec): SmartLoad["role"] => (spec.load === "dali" ? "dali" : spec.dimmable ? "dim" : "switch");

export interface PlannedModule extends SmartModule {
  /** Pořadí kusu stejného typu (-A1, -A2 …). */
  index: number;
  /** Obsazené kanály: číslo kanálu → zátěž. */
  assigned: { channel: number; load: SmartLoad }[];
  /** Fáze 65: ručně přidaný kus nad výpočet (rezerva, rozšíření). */
  manual?: boolean;
}

export interface SmartPlan {
  system: SmartSystem;
  modules: PlannedModule[];
  /** Kanály podle druhu: potřeba (včetně rezervy) a k dispozici. */
  channels: Record<ChannelRole, { needed: number; available: number }>;
  /** Fáze 77: příkon zdrojů LED 24 V DC (pásky + 20 %) [W]. */
  ledSupplyW: number;
  /** Sběrnicové prvky v místnostech + akční členy (kontrola zdroje a systémového modulu). */
  busDevices: number;
  busMa: number;
  psuMa: number;
  widthModules: number;
  warnings: string[];
}

/**
 * Nejmenší sestava akčních členů pro `needed` kanálů: nejméně modulů na liště, při shodě nejméně kusů. Dynamické
 * programování přes počet kanálů (velikosti 4 / 6 / 8 / 12 …).
 */
export function chooseModules(options: readonly SmartModule[], needed: number): SmartModule[] {
  if (needed <= 0 || !options.length) return [];
  const max = needed + Math.max(...options.map((option) => option.channels));
  const best: ({ width: number; count: number; pick: SmartModule[] } | null)[] = Array.from({ length: max + 1 }, () => null);
  best[0] = { width: 0, count: 0, pick: [] };
  for (let channels = 0; channels <= max; channels++) {
    const current = best[channels];
    if (!current) continue;
    for (const option of options) {
      const next = Math.min(max, channels + option.channels);
      const candidate = { width: current.width + option.modules, count: current.count + 1, pick: [...current.pick, option] };
      const existing = best[next];
      if (!existing || candidate.width < existing.width || (candidate.width === existing.width && candidate.count < existing.count)) best[next] = candidate;
    }
  }
  let winner: { width: number; count: number; pick: SmartModule[] } | null = null;
  for (let channels = needed; channels <= max; channels++) {
    const candidate = best[channels];
    if (candidate && (!winner || candidate.width < winner.width || (candidate.width === winner.width && candidate.count < winner.count))) winner = candidate;
  }
  return [...(winner?.pick ?? [])].sort((a, b) => b.channels - a.channels);
}

/**
 * Výpočet chytré domácnosti: kanály podle zátěží (+ rezerva systému, min. 1 volný kanál od každého druhu), výběr
 * akčních členů, rozdělení zátěží na kanály (po místnostech), zdroj a systémový modul, kontrola sběrnice a stmívačů.
 */
export function planSmartHome(input: { system: SmartSystemId; loads: readonly SmartLoad[]; busDevices: number; extras?: Readonly<Record<string, number>> }): SmartPlan {
  const system = smartSystemOf(input.system);
  const warnings: string[] = [];
  const modules: PlannedModule[] = [];
  const counts = new Map<string, number>();
  const add = (unit: SmartModule, assigned: PlannedModule["assigned"] = [], manual = false) => {
    const index = (counts.get(unit.id) ?? 0) + 1;
    counts.set(unit.id, index);
    modules.push({ ...unit, index, assigned, ...(manual ? { manual: true } : {}) });
  };
  /** Fáze 65: ručně přidané kusy modulů (nejvýš 20 od typu); akční členy zatíží sběrnici, zdroje a rozhraní ne. */
  const central = (unit: SmartModule) => unit.role === "psu" || unit.role === "interface" || unit.role === "system";
  const addExtras = (pick: (unit: SmartModule) => boolean) => {
    let added = 0;
    for (const unit of system.modules.filter(pick)) {
      const extra = Math.max(0, Math.min(20, Math.floor(input.extras?.[unit.id] ?? 0)));
      for (let index = 0; index < extra; index++) add(unit, [], true);
      added += extra;
    }
    return added;
  };
  // Fáze 81: alternativní typy (`manualOnly`) výpočet sám nevybírá – jen ručně přidané kusy
  const byRole = (role: SmartRole) => system.modules.filter((unit) => unit.role === role && !unit.manualOnly);
  const channels = Object.fromEntries(CHANNEL_ROLES.map((role) => [role, { needed: 0, available: 0 }])) as Record<ChannelRole, { needed: number; available: number }>;
  const sortLoads = (loads: SmartLoad[]) => [...loads].sort((a, b) => a.room.localeCompare(b.room, "cs") || a.label.localeCompare(b.label, "cs") || a.id.localeCompare(b.id));

  // Systém: Loxone Miniserver nese 8 reléových výstupů – spínací kanály se nejdřív obsadí na něm
  const systemModule = byRole("system")[0];
  const miniserver = system.id === "loxone" ? systemModule : null;
  // Fáze 81: ručně přidaný SysAP na DIN liště nahradí nástěnný (přidá se mezi ručními kusy)
  const replaced = systemModule ? system.modules.some((unit) => unit.replaces === systemModule.id && (input.extras?.[unit.id] ?? 0) > 0) : false;
  if (systemModule && !replaced) add(systemModule);

  for (const role of CHANNEL_ROLES) {
    const loads = sortLoads(input.loads.filter((load) => load.role === role));
    if (!loads.length) continue;
    const options = byRole(role);
    // Stmívání: zátěž nad výkon kanálu zabere víc paralelně propojených kanálů; fáze 77 – PWM: kanály podle barvy svítidla
    const perChannel = role === "dim" ? (options.find((option) => option.maxW)?.maxW ?? null) : null;
    const slots = loads.flatMap((load) => {
      if (role === "pwm") return Array.from({ length: Math.max(1, load.channels ?? 1) }, () => load);
      const parallel = perChannel && load.powerW > perChannel ? Math.ceil(load.powerW / perChannel) : 1;
      if (parallel > 1) warnings.push(`${load.label} (${load.room}): ${load.powerW} W překračuje ${perChannel} W na kanál – ${parallel} kanály stmívače paralelně.`);
      return Array.from({ length: parallel }, () => load);
    });
    const used = role === "dali" ? loads.length : slots.length;
    // Fáze 114: ABB-free@home – žaluzie a topné okruhy mají kanál na motor / zónu, bez rezervy navíc: 1–4 žaluzie = BA-M 4M (4×),
    // 5–8 = 8M (8×), 1–6 topných okruhů = HA-M 4M (6×), 7–12 = 8M (12×). Ostatní kanály a systémy (Loxone, KNX, TapHome)
    // dál s rezervou systému podle fáze 77 (min. 1 volný kanál).
    const exact = role === "dali" || (system.id === "abb_freeathome" && (role === "blind" || role === "heating"));
    const needed = exact ? used : Math.max(used + 1, Math.ceil(used * (1 + system.reserve)));
    channels[role].needed = needed;
    if (!options.length) {
      warnings.push(`${system.label} nemá v databázi akční člen pro ${ROLE_LABEL[role]} – doplňte ručně.`);
      continue;
    }
    let pool = role === "switch" && miniserver ? Math.max(0, needed - miniserver.channels) : needed;
    const queue = role === "dali" ? [] : [...slots];
    if (role === "switch" && miniserver) {
      const onMini = queue.splice(0, miniserver.channels);
      modules[0].assigned.push(...onMini.map((load, index) => ({ channel: index + 1, load })));
      channels.switch.available += miniserver.channels;
    }
    if (role === "dali") {
      // DALI: účastníci na bránách (1 kanál brány = až N předřadníků)
      const gateway = options[0];
      for (let start = 0; start < loads.length; start += gateway.channels) add(gateway, loads.slice(start, start + gateway.channels).map((load, index) => ({ channel: index + 1, load })));
      channels.dali.available = Math.ceil(loads.length / gateway.channels) * gateway.channels;
      continue;
    }
    pool = Math.max(0, pool);
    for (const unit of chooseModules(options, pool)) {
      const taken = queue.splice(0, unit.channels);
      add(unit, taken.map((load, index) => ({ channel: index + 1, load })));
      channels[role].available += unit.channels;
    }
    if (queue.length) warnings.push(`Nepřiřazeno ${queue.length} zátěží (${ROLE_LABEL[role]}).`);
  }

  // Fáze 77: napájecí zdroj LED 24 V DC – příkon pásků + 20 % rezerva
  const ledW = Math.ceil(input.loads.filter((load) => load.role === "pwm").reduce((sum, load) => sum + load.powerW, 0) * 1.2);
  for (const unit of ledSupplies(ledW)) add(unit);
  if (ledW > LED_SUPPLIES[LED_SUPPLIES.length - 1].channels) warnings.push(`LED 24 V: ${ledW} W (vč. rezervy 20 %) – víc zdrojů; rozdělte pásky na zdroje a dbejte na úbytek napětí 24 V (krátké přívody, větší průřez).`);

  addExtras((unit) => !central(unit));
  // Zdroj sběrnice a rozhraní
  const actuators = modules.filter((unit) => unit.role !== "system").length;
  const busDevices = input.busDevices + actuators + (system.id === "loxone" ? 0 : 1);
  const busMa = busDevices * system.deviceMa;
  const psu = byRole("psu")[0];
  const lines = system.id === "loxone" ? 1 : Math.max(1, Math.ceil(busDevices / system.devicesPerLine), psu?.busMa && system.deviceMa ? Math.ceil(busMa / (psu.busMa * 0.8)) : 1);
  if (psu) for (let line = 0; line < lines; line++) add(psu);
  for (const unit of byRole("interface")) if (system.id !== "loxone" || input.busDevices > 50) add(unit);
  addExtras(central);
  const manualPsu = modules.filter((unit) => unit.manual && unit.role === "psu").length;
  if (busDevices > system.maxDevices) warnings.push(`${busDevices} prvků překračuje limit systému ${system.maxDevices} – rozdělte instalaci nebo zvolte větší systém.`);
  if (lines > 1) warnings.push(`${busDevices} sběrnicových prvků → ${lines} linie (zdroje); nejvýš ${system.devicesPerLine} prvků na linii a délka kabelu linie do ${system.maxLineM} m.`);
  if (system.id === "loxone" && input.busDevices > 50) warnings.push("Více než 50 prvků Tree – druhá větev Tree Extension (každá větev max. 50 prvků).");
  return {
    system,
    modules,
    channels,
    busDevices,
    busMa,
    psuMa: (psu?.busMa ?? 0) * (psu ? lines + manualPsu : 0),
    widthModules: modules.reduce((sum, unit) => sum + unit.modules, 0),
    ledSupplyW: ledW,
    warnings,
  };
}

export const ROLE_LABEL: Record<ChannelRole, string> = { switch: "spínání", dim: "stmívání", dali: "DALI", blind: "žaluzie", heating: "topení", pwm: "LED 24 V PWM", input: "binární vstupy" };
