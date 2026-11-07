// Fáze 61: chytrá domácnost (sběrnicová úroveň instalace) – volba systému a výrobce, výpočet spínacích, stmívacích,
// žaluziových a topných akčních členů s rezervou kanálů, napájecí zdroj, systémový modul / rozhraní, kontrola
// sběrnice (počet prvků, proud zdroje) a přiřazení kanálů světlům, žaluziím a topným zónám. Čisté funkce.
//
// Zdroje: ABB-free@home – Katalog ABB „Domovní elektroinstalační materiál 2026“ (únor 2026), str. 252–277;
// ABB i-bus KNX – databáze prvků Eldocku (ABB), stmívač UD/S 4.210.2.1 a DALI brána DG/S 1.64.1.1 podle knx.org;
// Loxone – databáze prvků (Miniserver, Relay / Tree Extension) a produktový list Dimmer Extension (100029).
// Údaj bez ověřeného objednacího čísla má `verified: false` (kusovník ho vede jako „ověřte“).

import type { LightLoad, LightSpec } from "./floorplan-editor";

export type SmartSystemId = "abb_freeathome" | "abb_knx" | "loxone" | "taphome";
export type SmartRole = "switch" | "dim" | "dali" | "blind" | "heating" | "psu" | "interface" | "system";

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
const KNX = "ABB i-bus KNX – databáze prvků Eldocku";

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
      { id: "fah-sap", role: "system", label: "Systémový modul SysAP 3.0 (sběrnicový + bezdrátový, nástěnný)", typeCode: "SAP.3", articleNumber: "2CKA006200A0871", verified: true, channels: 150, modules: 0, source: `${FAH}, str. 271` },
      { id: "fah-psu", role: "psu", label: "Zdroj napájecí sběrnicový s tlumivkou 640 mA", typeCode: "PS-M-64.1.1", articleNumber: "2CDG510001R0011", verified: true, channels: 0, modules: 4, busMa: 640, source: `${FAH}, str. 273` },
      { id: "fah-sa4", role: "switch", label: "Člen akční spínací 4násobný, 16 A", typeCode: "SA-M-4.16.2.2", articleNumber: "2CDG510025R0011", verified: true, channels: 4, modules: 4, ratedA: 16, source: `${FAH}, str. 274` },
      { id: "fah-sa8", role: "switch", label: "Člen akční spínací 8násobný, 16 A", typeCode: "SA-M-8.16.2.2", articleNumber: "2CDG510026R0011", verified: true, channels: 8, modules: 8, ratedA: 16, source: `${FAH}, str. 274` },
      { id: "fah-sa12", role: "switch", label: "Člen akční spínací 12násobný, 16 A", typeCode: "SA-M-12.16.2.2", articleNumber: "2CDG510027R0011", verified: true, channels: 12, modules: 12, ratedA: 16, source: `${FAH}, str. 274` },
      { id: "fah-da4", role: "dim", label: "Člen akční stmívací 4násobný, 4× 210 W (LED na sestupné hraně)", typeCode: "DA/M.4.210.2.1", articleNumber: "2CKA006220A0729", verified: true, channels: 4, modules: 6, maxW: 210, source: `${FAH}, str. 275` },
      { id: "fah-da6", role: "dim", label: "Člen akční stmívací 6násobný, 6× 210 W (LED na sestupné hraně)", typeCode: "DA/M.6.210.2.1", articleNumber: "2CKA006220A0731", verified: true, channels: 6, modules: 8, maxW: 210, source: `${FAH}, str. 275` },
      { id: "fah-dali", role: "dali", label: "Rozhraní DALI / free@home, max. 16 účastníků", typeCode: "DG-M-1.16.1", articleNumber: "2CDG510012R0011", verified: true, channels: 16, modules: 4, source: `${FAH}, str. 275` },
      { id: "fah-ba4", role: "blind", label: "Člen akční žaluziový 4násobný, 6 A", typeCode: "BA-M-4.230.1.1", articleNumber: "2CDG510028R0011", verified: true, channels: 4, modules: 4, source: `${FAH}, str. 276` },
      { id: "fah-ba8", role: "blind", label: "Člen akční žaluziový 8násobný, 6 A", typeCode: "BA-M-8.230.1.1", articleNumber: "2CDG510029R0011", verified: true, channels: 8, modules: 8, source: `${FAH}, str. 276` },
      { id: "fah-ha6", role: "heating", label: "Člen akční topení 6násobný (termoelektrické hlavice)", typeCode: "HA-M-0.6.1", articleNumber: "2CDG510008R0011", verified: true, channels: 6, modules: 4, source: `${FAH}, str. 276 (v roce 2026 produktová obměna)` },
      { id: "fah-ha12", role: "heating", label: "Člen akční topení 12násobný (termoelektrické hlavice)", typeCode: "HA-M-0.12.1", articleNumber: "2CDG510009R0011", verified: true, channels: 12, modules: 8, source: `${FAH}, str. 276 (v roce 2026 produktová obměna)` },
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
      { id: "knx-ip", role: "interface", label: "IP rozhraní KNX Secure (programování ETS, vizualizace)", typeCode: "IPS/S 3.5.1", articleNumber: "2CDG110204R0011", verified: false, channels: 0, modules: 2, source: "distributor (ověřte v katalogu ABB KNX)" },
      { id: "knx-sa4", role: "switch", label: "Spínací akční člen 4násobný, 16 A", typeCode: "SA/S 4.16.2.2", articleNumber: "2CDG110262R0011", verified: true, channels: 4, modules: 4, ratedA: 16, source: KNX },
      { id: "knx-sa8", role: "switch", label: "Spínací akční člen 8násobný, 16 A", typeCode: "SA/S 8.16.2.2", articleNumber: "2CDG110263R0011", verified: true, channels: 8, modules: 8, ratedA: 16, source: KNX },
      { id: "knx-sa12", role: "switch", label: "Spínací akční člen 12násobný, 16 A", typeCode: "SA/S 12.16.2.2", articleNumber: "2CDG110264R0011", verified: true, channels: 12, modules: 12, ratedA: 16, source: KNX },
      { id: "knx-ud4", role: "dim", label: "Univerzální stmívací akční člen 4× 210 W (LED)", typeCode: "UD/S 4.210.2.1", articleNumber: "2CKA006197A0047", verified: true, channels: 4, modules: 4, maxW: 210, source: "knx.org (UD/S4.210.2.1 LED Dimmer 4x210W); šířku 4 M ověřte v datasheetu" },
      { id: "knx-dali", role: "dali", label: "DALI brána Basic, 1 kanál, max. 64 účastníků", typeCode: "DG/S 1.64.1.1", articleNumber: "2CDG110198R0011", verified: true, channels: 64, modules: 4, source: "knx.org (DG/S1.64.1.1 DALI Gateway)" },
      { id: "knx-jra4", role: "blind", label: "Žaluziový akční člen 4násobný 230 V", typeCode: "JRA/S 4.230.5.1", articleNumber: "2CDG110125R0011", verified: true, channels: 4, modules: 4, source: KNX },
      { id: "knx-jra8", role: "blind", label: "Žaluziový akční člen 8násobný 230 V", typeCode: "JRA/S 8.230.5.1", articleNumber: "2CDG110126R0011", verified: true, channels: 8, modules: 8, source: KNX },
      { id: "knx-es4", role: "heating", label: "Elektronický spínací akční člen 4násobný (termoelektrické hlavice)", typeCode: "ES/S 4.1.2.1", articleNumber: "2CDG110058R0011", verified: true, channels: 4, modules: 4, source: KNX },
      { id: "knx-es8", role: "heating", label: "Elektronický spínací akční člen 8násobný (termoelektrické hlavice)", typeCode: "ES/S 8.1.2.1", articleNumber: "2CDG110059R0011", verified: true, channels: 8, modules: 8, source: KNX },
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
      { id: "lox-mini", role: "system", label: "Miniserver (8 reléových výstupů, 8 vstupů)", typeCode: "Miniserver", articleNumber: "100335", verified: true, channels: 8, modules: 9, ratedA: 16, source: "databáze prvků Eldocku (Loxone)" },
      { id: "lox-relay", role: "switch", label: "Relay Extension (14 reléových výstupů)", typeCode: "Relay Extension", articleNumber: "100038", verified: true, channels: 14, modules: 9, ratedA: 16, source: "databáze prvků Eldocku (Loxone)" },
      { id: "lox-dim", role: "dim", label: "Dimmer Extension (4 stmívací kanály 230 V)", typeCode: "Dimmer Extension", articleNumber: "100029", verified: true, channels: 4, modules: 9, maxW: null, source: "Loxone – produktový list 100029 (zatížení kanálu ověřte)" },
      { id: "lox-tree", role: "interface", label: "Tree Extension (2 větve Tree, 50 prvků na větev)", typeCode: "Tree Extension", articleNumber: "100218", verified: true, channels: 100, modules: 2, source: "databáze prvků Eldocku (Loxone)" },
      { id: "lox-psu", role: "psu", label: "Napájecí zdroj 24 V DC pro Miniserver a Tree", typeCode: "24 V DC / 2,5 A", articleNumber: null, verified: false, channels: 0, modules: 3, busMa: 2500, source: "obecný zdroj 24 V DC" },
    ],
  },
  {
    // Fáze 63: TapHome – v databázi zatím jen řídicí jednotka Core (akční členy doplní projektant podle nabídky TapHome)
    id: "taphome",
    label: "TapHome (Core + sběrnice)",
    manufacturer: "TapHome",
    description: "Řídicí jednotka Core, tlačítka 2T / 4T / 6T a UI termostat na sběrnici; akční členy zatím nejsou v databázi prvků – doplňte je podle nabídky TapHome.",
    maxDevices: 999,
    deviceMa: 0,
    devicesPerLine: 999,
    maxLineM: 500,
    reserve: 0.2,
    modules: [{ id: "tap-core", role: "system", label: "Řídicí jednotka TapHome Core", typeCode: "Core", articleNumber: null, verified: false, channels: 0, modules: 0, source: "TapHome (objednací číslo ověřte u výrobce)" }],
  },
];

export const isSmartSystem = (value: unknown): value is SmartSystemId => SMART_SYSTEMS.some((system) => system.id === value);
export const smartSystemOf = (id: SmartSystemId | null | undefined) => SMART_SYSTEMS.find((system) => system.id === id) ?? SMART_SYSTEMS[0];

/** Zátěž připojená k akčnímu členu (světlo, žaluzie, topná zóna). */
export interface SmartLoad {
  id: string;
  room: string;
  role: "switch" | "dim" | "dali" | "blind" | "heating";
  powerW: number;
  load?: LightLoad;
  label: string;
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
  channels: Record<"switch" | "dim" | "dali" | "blind" | "heating", { needed: number; available: number }>;
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
  const byRole = (role: SmartRole) => system.modules.filter((unit) => unit.role === role);
  const channels = { switch: { needed: 0, available: 0 }, dim: { needed: 0, available: 0 }, dali: { needed: 0, available: 0 }, blind: { needed: 0, available: 0 }, heating: { needed: 0, available: 0 } };
  const sortLoads = (loads: SmartLoad[]) => [...loads].sort((a, b) => a.room.localeCompare(b.room, "cs") || a.label.localeCompare(b.label, "cs") || a.id.localeCompare(b.id));

  // Systém: Loxone Miniserver nese 8 reléových výstupů – spínací kanály se nejdřív obsadí na něm
  const systemModule = byRole("system")[0];
  const miniserver = system.id === "loxone" ? systemModule : null;
  if (systemModule) add(systemModule);

  for (const role of ["switch", "dim", "dali", "blind", "heating"] as const) {
    const loads = sortLoads(input.loads.filter((load) => load.role === role));
    if (!loads.length) continue;
    const options = byRole(role);
    // Stmívání: zátěž nad výkon kanálu zabere víc paralelně propojených kanálů
    const perChannel = role === "dim" ? (options.find((option) => option.maxW)?.maxW ?? null) : null;
    const slots = loads.flatMap((load) => {
      const parallel = perChannel && load.powerW > perChannel ? Math.ceil(load.powerW / perChannel) : 1;
      if (parallel > 1) warnings.push(`${load.label} (${load.room}): ${load.powerW} W překračuje ${perChannel} W na kanál – ${parallel} kanály stmívače paralelně.`);
      return Array.from({ length: parallel }, () => load);
    });
    const used = role === "dali" ? loads.length : slots.length;
    const needed = role === "dali" ? used : Math.max(used + 1, Math.ceil(used * (1 + system.reserve)));
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
    warnings,
  };
}

export const ROLE_LABEL: Record<SmartLoad["role"], string> = { switch: "spínání", dim: "stmívání", dali: "DALI", blind: "žaluzie", heating: "topení" };
