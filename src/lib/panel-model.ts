import { seededRandom } from "./mock-graphics/svg";

// Deterministický model rozváděče pro vícelistovou dokumentaci (styl PCSCHEMATIC Automation)
// a diagnostiku údržby. Označování dle ISO/IEC 81346 (=systém +místo -výrobek), seznam spojů
// FROM → TO dle IEC 62491, PLC I/O, ztrátový výkon a oteplení dle IEC 60890 / EN 61439.
// Čistá data, stejná pro vykreslení listů (`mock-graphics/pcschematic.ts`) i pro nástroje údržby.

export type Potential = "L1" | "L2" | "L3" | "N" | "PE" | "L1/L2/L3" | "+24V" | "0V" | "230V";
export type Phase = "L1" | "L2" | "L3";

export interface PanelInput {
  tag: string;
  name: string;
  type?: string;
  ratedCurrent?: string | null;
  ratedVoltage?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  ipRating?: string | null;
  yearInstalled?: number | null;
  plantCode: string;
  plantName?: string;
  customerName?: string;
  buildingCode: string;
  floorCode: string;
  /** Zařízení napájená z tohoto rozváděče (vývody). */
  feeds?: { tag: string; name: string; type: string; circuit?: string | null }[];
  revision?: { version: string; date: string; author: string };
}

export interface SheetMeta {
  number: number;
  title: string;
  /** Kód listu v obsahu (PCSCHEMATIC „Page ref.“). */
  pageRef: string;
  scale: "1:1" | "1:5";
}

export interface PanelDevice {
  /** „-Q1“ */
  tag: string;
  description: string;
  manufacturer: string;
  partNumber: string;
  ratedA?: number;
  /** Ztrátový výkon při jmenovitém proudu (Pn) [W]. */
  lossW: number;
  /** Provozní proud (Imax) [A] pro výpočet ztrát. */
  operatingA?: number;
  sheet: number;
  column: number;
  /** Pozice na montážní desce (rastr 1–8 / A–F), např. „3B“. */
  mount: string;
  /** Rozměr na montážní desce v mm (šířka × výška). */
  size: [number, number];
}

export interface Feeder {
  device: string;
  label: string;
  phases: Phase[];
  ratedA: number;
  /** Proud ve fázi [A]. */
  loadA: number;
  target?: { tag: string; name: string };
  cable: string;
  column: number;
}

export interface WireEnd {
  device: string;
  pin: string;
}

export interface Wire {
  /** Číslo vodiče („18“). */
  number: string;
  from: WireEnd;
  to: WireEnd;
  potential: Potential;
  color: string;
  crossSection: string;
  cable?: { tag: string; core: string };
  sheet: number;
  column: number;
}

export interface PlcIo {
  address: string;
  channel: string;
  slot: string;
  card: string;
  terminal: string;
  signal: string;
  description: string;
  kind: "Sink" | "Relay" | "4-20mA";
  endDevice: string;
  sheet: number;
  column: number;
}

export interface PanelModel {
  refs: { system: string; location: string; panel: string; full: string };
  title: string;
  customer: string;
  fileName: string;
  revision: { version: string; date: string; author: string };
  mainRatedA: number;
  voltage: string;
  ipRating: string;
  manufacturer: string;
  year: number;
  enclosure: { widthMm: number; heightMm: number; depthMm: number };
  sheets: SheetMeta[];
  devices: PanelDevice[];
  feeders: Feeder[];
  wires: Wire[];
  plc: PlcIo[];
  phaseLoad: Record<Phase | "N", number>;
  /** Oteplení: `maxC` = nejvyšší dovolená vnitřní teplota pro přístroje (derating jističů). */
  thermal: { simultaneity: number; totalLossW: number; ambientC: number; internalC: number; maxC: number; surfaceM2: number };
}

/** Křížový odkaz PCSCHEMATIC: list 4, sloupec 6 → „/4.6“. */
export const xref = (sheet: number, column: number) => `/${sheet}.${column}`;

/** „/4.6“ → { sheet: 4, column: 6 }. */
export function parseXref(value: string): { sheet: number; column: number } | null {
  const match = /^\/?(\d+)\.(\d)$/.exec(value.trim());
  if (!match) return null;
  return { sheet: Number(match[1]), column: Number(match[2]) };
}

const SERIES = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500];
/** Nejbližší nižší (nebo rovná) normalizovaná hodnota jističe. */
const seriesAtMost = (amps: number) => [...SERIES].reverse().find((value) => value <= amps) ?? SERIES[0];

function crossSection(amps: number): string {
  const table: [number, string][] = [
    [16, "1,5"],
    [20, "2,5"],
    [32, "4"],
    [40, "6"],
    [63, "10"],
    [80, "16"],
    [100, "25"],
    [125, "35"],
    [160, "50"],
    [200, "70"],
    [250, "95"],
    [315, "120"],
    [400, "185"],
    [630, "2× 150"],
  ];
  return `${table.find(([limit]) => amps <= limit)?.[1] ?? "4× 240"} mm²`;
}

function ampsOf(ratedCurrent: string | null | undefined): number {
  const match = ratedCurrent?.match(/\d+/);
  return match ? Number(match[0]) : 63;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export const SHEET_TITLES = [
  "Titulní list a obsah",
  "Liniové schéma – přehled vývodů",
  "Silové schéma – motorový vývod -M1",
  "Ovládací obvod a PLC I/O",
  "Dispozice rozváděče",
  "Ztrátový výkon, zatížení fází a CE štítek",
] as const;

/** Sestaví model rozváděče; stejný vstup = stejný výstup (seed podle tagu). */
export function buildPanelModel(input: PanelInput): PanelModel {
  const random = seededRandom(`panel:${input.tag}`);
  const mainRatedA = ampsOf(input.ratedCurrent);
  const panelTag = `-${input.tag.replace(/^-/, "")}`;
  const refs = {
    system: `=${input.plantCode}`,
    location: `+${input.buildingCode}${input.floorCode}`,
    panel: panelTag,
    full: `=${input.plantCode}+${input.buildingCode}${input.floorCode}${panelTag}`,
  };
  const sheets: SheetMeta[] = SHEET_TITLES.map((title, i) => ({ number: i + 1, title, pageRef: `${refs.system}/${refs.location}/${refs.panel}/${i + 1}`, scale: i === 4 ? "1:5" : "1:1" }));

  // Vývody -F3 … -F12: nejprve zařízení napájená z rozváděče (3f), pak zásuvky, osvětlení, ovládání a rezervy (1f).
  const threePhaseA = Math.max(16, seriesAtMost(mainRatedA / 4));
  const feeds = (input.feeds ?? []).slice(0, 6);
  const singlePhase: { label: string; ratedA: number }[] = [
    { label: "Zásuvkový okruh 230 V – hala", ratedA: 16 },
    { label: "Osvětlení – sekce 1", ratedA: 10 },
    { label: "Ovládání 24 VDC (-T1)", ratedA: 6 },
    { label: "Zásuvkový okruh 230 V – zázemí", ratedA: 16 },
    { label: "Osvětlení – sekce 2", ratedA: 10 },
    { label: "Rezerva", ratedA: 16 },
    { label: "Rezerva", ratedA: 10 },
    { label: "Nouzové osvětlení", ratedA: 6 },
    { label: "Rezerva", ratedA: 16 },
    { label: "Rezerva", ratedA: 10 },
  ];
  // Jednofázové okruhy na fáze L1 → L2 → L1 → L2 …; L3 vychází záměrně nejméně zatížená (rezerva pro nové okruhy).
  const phaseCycle: Phase[] = ["L1", "L2", "L1", "L2", "L3", "L1", "L2", "L3", "L1", "L2"];
  const feeders: Feeder[] = [];
  for (let i = 0; i < 10; i++) {
    const device = `-F${i + 3}`;
    const column = 2 + Math.floor((i * 6) / 10);
    const feed = feeds[i];
    if (feed) {
      const ratedA = feed.type === "SWITCHBOARD" ? threePhaseA : Math.max(16, seriesAtMost(threePhaseA * 0.6));
      feeders.push({
        device,
        label: feed.name.replace(/^[^ ]+ - /, ""),
        phases: ["L1", "L2", "L3"],
        ratedA,
        loadA: round1(ratedA * (0.35 + random() * 0.3)),
        target: { tag: feed.tag, name: feed.name },
        cable: `-W${i + 3}`,
        column,
      });
    } else {
      const single = singlePhase[i - feeds.length] ?? singlePhase[singlePhase.length - 1];
      const reserve = single.label === "Rezerva";
      feeders.push({
        device,
        label: single.label,
        phases: [phaseCycle[i]],
        ratedA: single.ratedA,
        loadA: reserve ? 0 : round1(single.ratedA * (0.3 + random() * 0.35)),
        cable: `-W${i + 3}`,
        column,
      });
    }
  }
  // Motorový vývod -M1 (silové schéma) zatěžuje všechny fáze.
  const motorKw = [4, 5.5, 7.5, 11][Math.floor(random() * 4)];
  const motorA = round1((motorKw * 1000) / (Math.sqrt(3) * 400 * 0.85 * 0.9));
  const motorBreaker = motorA <= 10 ? "6,3–10 A" : motorA <= 16 ? "10–16 A" : "17–23 A";
  const motorBreakerA = motorA <= 10 ? 10 : motorA <= 16 ? 16 : 23;

  const phaseLoad: Record<Phase | "N", number> = { L1: motorA, L2: motorA, L3: motorA, N: 0 };
  for (const feeder of feeders) for (const phase of feeder.phases) phaseLoad[phase] = round1(phaseLoad[phase] + feeder.loadA);
  const { L1, L2, L3 } = phaseLoad;
  phaseLoad.N = round1(Math.sqrt(Math.max(0, L1 * L1 + L2 * L2 + L3 * L3 - L1 * L2 - L2 * L3 - L3 * L1)));
  const mainOperatingA = round1(Math.max(L1, L2, L3));

  const mainLoss = mainRatedA >= 630 ? 95 : mainRatedA >= 160 ? 38 : 9;
  const devices: PanelDevice[] = [
    { tag: "-Q1", description: `Hlavní vypínač ${mainRatedA} A, 4P, pomocný kontakt 13-14`, manufacturer: mainRatedA > 100 ? "Siemens" : "Eaton", partNumber: mainRatedA > 630 ? "3WL1116-2BB32-4GA2" : mainRatedA > 100 ? "3VA2463-5HL32-0AA0" : "P3-63/EA/SVB", ratedA: mainRatedA, operatingA: mainOperatingA, lossW: mainLoss, sheet: 3, column: 1, mount: "1A", size: mainRatedA > 100 ? [210, 280] : [90, 120] },
    { tag: "-F1", description: "Svodič přepětí T1+T2, 3+1, 12,5 kA", manufacturer: "DEHN", partNumber: "DEHNventil DV M TNS 255", lossW: 0.5, sheet: 2, column: 1, mount: "2A", size: [144, 90] },
    { tag: "-F2", description: "Proudový chránič 40 A / 30 mA, typ A, 4P", manufacturer: "ABB", partNumber: "F204 A-40/0,03", ratedA: 40, operatingA: round1(Math.min(40, feeders.filter((f) => f.label.startsWith("Zásuvkový")).reduce((sum, f) => sum + f.loadA, 0))), lossW: 4.4, sheet: 3, column: 6, mount: "3A", size: [72, 90] },
    { tag: "-Q2", description: `Motorový spouštěč ${motorBreaker}`, manufacturer: "Siemens", partNumber: motorA <= 16 ? "3RV2011-1KA10" : "3RV2021-4BA10", ratedA: motorBreakerA, operatingA: motorA, lossW: 7.5, sheet: 3, column: 2, mount: "5A", size: [45, 97] },
    { tag: "-Q3", description: `Stykač ${motorKw} kW AC-3, cívka 24 VDC`, manufacturer: "Siemens", partNumber: "3RT2025-1BB40", ratedA: 17, operatingA: motorA, lossW: 3.6, sheet: 3, column: 3, mount: "6A", size: [45, 85] },
    { tag: "-T1", description: "Napájecí zdroj 230 VAC / 24 VDC, 5 A", manufacturer: "Phoenix Contact", partNumber: "QUINT4-PS/1AC/24DC/5", ratedA: 5, operatingA: 3.2, lossW: 11, sheet: 4, column: 1, mount: "2C", size: [60, 130] },
    { tag: "-K1", description: "PLC CPU, 8 DI / 4 DO relé / 1 AI 4–20 mA", manufacturer: "Siemens", partNumber: "6ES7212-1HE40-0XB0", lossW: 9, sheet: 4, column: 4, mount: "4C", size: [110, 100] },
    { tag: "-X1", description: "Řadové svorky – silové vývody (U, V, W, PE)", manufacturer: "Phoenix Contact", partNumber: "UT 6 / UT 6-PE", lossW: 1.2, sheet: 3, column: 4, mount: "3F", size: [120, 50] },
    { tag: "-X2", description: "Řadové svorky – ovládání 24 VDC a zásuvky 230 V", manufacturer: "Phoenix Contact", partNumber: "PT 2,5", lossW: 0.8, sheet: 4, column: 2, mount: "5F", size: [180, 50] },
    ...feeders.map(
      (feeder, i): PanelDevice => ({
        tag: feeder.device,
        description: `Jistič ${feeder.phases.length === 3 ? "3P" : "1P"} ${feeder.ratedA <= 63 ? "B" : ""}${feeder.ratedA} A – ${feeder.label}`,
        manufacturer: feeder.ratedA > 125 ? "Siemens" : "ABB",
        partNumber: feeder.ratedA > 125 ? "3VA1125-5EF36-0AA0" : `S20${feeder.phases.length} -B${feeder.ratedA}`,
        ratedA: feeder.ratedA,
        operatingA: feeder.loadA,
        lossW: round1((feeder.phases.length === 3 ? 3 : 1) * (feeder.ratedA > 63 ? 6 : 2.2)),
        sheet: 2,
        column: feeder.column,
        mount: `${1 + (i % 8)}${i < 8 ? "B" : "D"}`,
        size: feeder.phases.length === 3 ? [54, 90] : [18, 90],
      }),
    ),
  ];

  // Seznam spojů (IEC 62491) – číslování vodičů průběžně přes silové a ovládací listy.
  const wires: Wire[] = [];
  const add = (from: WireEnd, to: WireEnd, potential: Potential, sheet: number, column: number, cs: string, cable?: Wire["cable"]) => {
    const color =
      potential === "PE" ? "GNYE" : potential === "N" ? "BU" : potential === "+24V" ? "DBU" : potential === "0V" ? "DBU/WH" : potential === "230V" ? "BK" : potential === "L1" ? "BK" : potential === "L2" ? "BN" : potential === "L3" ? "GY" : "BK";
    wires.push({ number: String(wires.length + 1), from, to, potential, color: cable?.core ?? color, crossSection: cs, cable, sheet, column });
  };
  const mainCs = crossSection(mainRatedA);
  const motorCs = crossSection(motorBreakerA);
  // List 3 – silové schéma
  (["L1", "L2", "L3"] as const).forEach((phase, i) => add({ device: "-Q1", pin: String(2 * i + 2) }, { device: "-Q2", pin: String(2 * i + 1) }, phase, 3, 2, motorCs));
  (["L1", "L2", "L3"] as const).forEach((phase, i) => add({ device: "-Q2", pin: String(2 * i + 2) }, { device: "-Q3", pin: String(2 * i + 1) }, phase, 3, 3, motorCs));
  (["U", "V", "W"] as const).forEach((pin, i) => add({ device: "-Q3", pin: String(2 * i + 2) }, { device: "-X1", pin }, (["L1", "L2", "L3"] as const)[i], 3, 4, motorCs));
  add({ device: "PE", pin: "PE" }, { device: "-X1", pin: "PE" }, "PE", 3, 4, motorCs);
  (["U", "V", "W", "PE"] as const).forEach((pin, i) =>
    add({ device: "-X1", pin }, { device: "-M1", pin: pin === "PE" ? "PE" : `${pin}1` }, pin === "PE" ? "PE" : (["L1", "L2", "L3"] as const)[i], 3, 5, motorCs, { tag: "-W1", core: ["BK", "BN", "GY", "GNYE"][i] }),
  );
  add({ device: "-Q1", pin: "2" }, { device: "-F2", pin: "1" }, "L1", 3, 6, "6 mm²");
  add({ device: "-Q1", pin: "N" }, { device: "-F2", pin: "N" }, "N", 3, 6, "6 mm²");
  add({ device: "-F2", pin: "2" }, { device: "-X2", pin: "1" }, "L1", 3, 7, "2,5 mm²");
  add({ device: "-F2", pin: "N'" }, { device: "-X2", pin: "2" }, "N", 3, 7, "2,5 mm²");
  add({ device: "PE", pin: "PE" }, { device: "-X2", pin: "3" }, "PE", 3, 7, "2,5 mm²");
  // List 4 – ovládání 24 VDC a PLC
  add({ device: "-T1", pin: "+" }, { device: "-X2", pin: "4" }, "+24V", 4, 1, "1,5 mm²");
  add({ device: "-X2", pin: "5" }, { device: "-K1", pin: "DI0" }, "+24V", 4, 2, "0,75 mm²");
  add({ device: "-X2", pin: "6" }, { device: "-K1", pin: "DI1" }, "+24V", 4, 2, "0,75 mm²");
  add({ device: "-X2", pin: "7" }, { device: "-K1", pin: "DI2" }, "+24V", 4, 2, "0,75 mm²");
  add({ device: "-Q1", pin: "13" }, { device: "-T1", pin: "+" }, "+24V", 4, 3, "0,75 mm²");
  add({ device: "-Q1", pin: "14" }, { device: "-K1", pin: "DI3" }, "+24V", 4, 3, "0,75 mm²");
  add({ device: "-Q2", pin: "13" }, { device: "-T1", pin: "+" }, "+24V", 4, 3, "0,75 mm²");
  add({ device: "-Q2", pin: "14" }, { device: "-K1", pin: "DI4" }, "+24V", 4, 3, "0,75 mm²");
  add({ device: "-K1", pin: "DO0" }, { device: "-Q3", pin: "A1" }, "+24V", 4, 6, "0,75 mm²");
  add({ device: "-Q3", pin: "A2" }, { device: "-T1", pin: "-" }, "0V", 4, 6, "0,75 mm²");
  add({ device: "-K1", pin: "DO1" }, { device: "-P1", pin: "X1" }, "+24V", 4, 7, "0,75 mm²");
  add({ device: "-K1", pin: "DO2" }, { device: "-P2", pin: "X1" }, "+24V", 4, 7, "0,75 mm²");
  add({ device: "-K1", pin: "DO3" }, { device: "-P3", pin: "X1" }, "+24V", 4, 8, "0,75 mm²");
  add({ device: "-T1", pin: "-" }, { device: "-X2", pin: "8" }, "0V", 4, 8, "1,5 mm²");
  add({ device: "-X2", pin: "9" }, { device: "-K1", pin: "AI0" }, "+24V", 4, 5, "0,75 mm²", { tag: "-W2", core: "WH" });
  // Polní kabel -W2 k tlačítkům a koncovým spínačům
  add({ device: "-X2", pin: "4" }, { device: "-S1", pin: "13" }, "+24V", 4, 2, "0,75 mm²", { tag: "-W2", core: "1" });
  add({ device: "-S1", pin: "14" }, { device: "-X2", pin: "5" }, "+24V", 4, 2, "0,75 mm²", { tag: "-W2", core: "2" });
  add({ device: "-S2", pin: "12" }, { device: "-X2", pin: "6" }, "+24V", 4, 2, "0,75 mm²", { tag: "-W2", core: "3" });
  add({ device: "-S3", pin: "12" }, { device: "-X2", pin: "7" }, "+24V", 4, 2, "0,75 mm²", { tag: "-W2", core: "4" });
  // Přívod rozváděče
  add({ device: "-W0", pin: "L1/L2/L3" }, { device: "-Q1", pin: "1/3/5" }, "L1/L2/L3", 2, 1, mainCs);

  const plc: PlcIo[] = [
    { channel: "DI0", signal: "ENDSTOP_UP", description: "Endstop UP – horní koncová poloha", endDevice: ">+1.10.3/>-S1", column: 2 },
    { channel: "DI1", signal: "STOP_OK", description: "Tlačítko STOP (rozpínací)", endDevice: ">+DOOR/>-S2", column: 2 },
    { channel: "DI2", signal: "ESTOP_OK", description: "Nouzové zastavení – kanál 1", endDevice: ">+1.10.4/>-S3", column: 2 },
    { channel: "DI3", signal: "Q1_ON", description: "Hlavní vypínač -Q1 zapnut (13-14)", endDevice: ">-Q1:13", column: 3 },
    { channel: "DI4", signal: "Q2_TRIP", description: "Motorový spouštěč -Q2 vybaven", endDevice: ">-Q2:13", column: 3 },
    { channel: "DI5", signal: "DOOR_CLOSED", description: "Dveře rozváděče zavřeny", endDevice: ">+DOOR/>-B2", column: 3 },
    { channel: "DI6", signal: "SPARE_DI6", description: "Rezerva", endDevice: "—", column: 3 },
    { channel: "DI7", signal: "SPARE_DI7", description: "Rezerva", endDevice: "—", column: 3 },
  ].map((io, i) => ({ ...io, address: `0.0${i}`, slot: "001.001.001.001", card: "-K1", terminal: `X0.${i}`, kind: "Sink" as const, sheet: 4 }));
  plc.push(
    ...[
      { channel: "DO0", signal: "M1_RUN", description: "Stykač -Q3 – chod motoru -M1", endDevice: ">-Q3:A1", column: 6 },
      { channel: "DO1", signal: "LAMP_RUN", description: "Kontrolka CHOD (zelená)", endDevice: ">+DOOR/>-P1", column: 7 },
      { channel: "DO2", signal: "ALARM_ON_1", description: "Kontrolka PORUCHA (červená)", endDevice: ">+DOOR/>-P2", column: 7 },
      { channel: "DO3", signal: "LAMP_WARN", description: "Kontrolka VÝSTRAHA (žlutá)", endDevice: ">+DOOR/>-P3", column: 8 },
    ].map((io, i) => ({ ...io, address: `1.0${i}`, slot: "001.001.001.002", card: "-K1", terminal: `X1.${i}`, kind: "Relay" as const, sheet: 4 })),
    { channel: "AI0", signal: "PANEL_TEMP", description: "Teplota uvnitř rozváděče (-B1, 0–100 °C)", endDevice: ">-X2:9/>-B1", column: 5, address: "2.00", slot: "001.001.001.003", card: "-K1", terminal: "X2.0", kind: "4-20mA", sheet: 4 },
  );

  // Ztrátový výkon a oteplení (IEC 60890): P = Σ Pn · (Ib / In)² · SF; ΔT = P / (k · A)
  const simultaneity = 0.5;
  const enclosure = mainRatedA > 630 ? { widthMm: 1200, heightMm: 2000, depthMm: 600 } : mainRatedA > 100 ? { widthMm: 800, heightMm: 2000, depthMm: 500 } : { widthMm: 600, heightMm: 1200, depthMm: 300 };
  const totalLossW = round1(
    devices.reduce((sum, device) => {
      const ratio = device.ratedA && device.operatingA !== undefined ? Math.min(1, device.operatingA / device.ratedA) : 1;
      return sum + device.lossW * Math.max(0.25, ratio * ratio) * simultaneity;
    }, 0),
  );
  const surfaceM2 = round1((enclosure.widthMm * enclosure.heightMm + 2 * enclosure.heightMm * enclosure.depthMm + enclosure.widthMm * enclosure.depthMm) / 1_000_000);
  const ambientC = 25 + Math.round(random() * 10);
  const internalC = round1(ambientC + totalLossW / (5.5 * surfaceM2));

  return {
    refs,
    title: input.name,
    customer: input.customerName ?? input.plantName ?? input.plantCode,
    fileName: `${input.plantCode}_${input.tag}_${(input.revision?.version ?? "v1.0").replace(/\./g, "_")}.pro`,
    revision: input.revision ?? { version: "v1.0", date: "2025-01-01", author: "Eldock CAE" },
    mainRatedA,
    voltage: input.ratedVoltage ?? "400/230 V AC, 50 Hz, TN-S",
    ipRating: input.ipRating ?? "IP54",
    manufacturer: input.manufacturer ?? "Eldock Panel Shop",
    year: input.yearInstalled ?? 2024,
    enclosure,
    sheets,
    devices,
    feeders,
    wires,
    plc,
    phaseLoad,
    thermal: { simultaneity, totalLossW, ambientC, internalC, maxC: 45, surfaceM2 },
  };
}
