// Generovaný průmyslový katalog AI Panel Builderu (fáze 33): řady jističů, chráničů, jističochráničů,
// vypínačů, svodičů přepětí, stykačů, relé, zdrojů a měření hlavních značek na českém trhu.
//
// Objednací kód: kde výrobce používá veřejný vzor, je dopočítaný (ABB S200 / SD200, Schneider iC60N);
// u značek, kde objednací kód = typové označení (Hager, Finder, Elko EP, Mean Well, Saltek …) i tam,
// kde vzor neznáme, je objednacím kódem typové označení. Ztrátové výkony jsou typické hodnoty
// z katalogů (jističe dle In na pól, chrániče a vypínače škálované podle In) – orientační data,
// před objednáním ověřit u výrobce.

import type { ComponentCategory } from "../src/generated/prisma/enums";
import { estimatePowerLoss } from "../src/lib/panel-builder/catalog";

export interface SeedComponent {
  manufacturer: string;
  series: string;
  typeCode: string;
  articleNumber: string;
  category: ComponentCategory;
  poles: string;
  ratedCurrentA: number;
  trippingCurve?: string;
  breakingCapacityKa?: number;
  rcdSensitivityMa?: number;
  rcdType?: string;
  spdType?: string;
  surgeCurrentKa?: number;
  contactConfig?: string;
  coilVoltage?: string;
  relaySubtype?: string;
  moduleSubtype?: string;
  modulesCount: number;
  powerLossWatts: number;
  description: string;
  dims?: [number, number, number];
}

const pad = (value: number, length: number) => String(value).padStart(length, "0");
const width = (poles: string) => ({ "1P": 1, "1P+N": 2, "2P": 2, "3P": 3, "3P+N": 4, "4P": 4 })[poles] ?? 1;
const r2 = (value: number) => Math.round(value * 100) / 100;

const out: SeedComponent[] = [];

// ---------------------------------------------------------------------------
//  Jističe (MCB)
// ---------------------------------------------------------------------------

function mcbSeries(opts: {
  manufacturer: string;
  series: string;
  poles: string[];
  curves: string[];
  currents: number[];
  ka: number;
  type: (poles: string, curve: string, current: number) => string;
  article?: (poles: string, curve: string, current: number) => string;
}) {
  for (const poles of opts.poles)
    for (const curve of opts.curves)
      for (const current of opts.currents) {
        const typeCode = opts.type(poles, curve, current);
        out.push({
          manufacturer: opts.manufacturer,
          series: opts.series,
          typeCode,
          articleNumber: opts.article?.(poles, curve, current) ?? typeCode,
          category: "MCB",
          poles,
          ratedCurrentA: current,
          trippingCurve: curve,
          breakingCapacityKa: opts.ka,
          modulesCount: width(poles),
          powerLossWatts: estimatePowerLoss("MCB", poles, current),
          description: `Jistič ${poles}, ${current} A, char. ${curve}, ${opts.ka} kA`,
        });
      }
}

const abbPoles: Record<string, number> = { "1P": 1, "2P": 2, "3P": 3, "4P": 4 };
const abbCurve: Record<string, string> = { B: "5", C: "4", D: "1" };
const abbS200 = (poles: string, curve: string, current: number) => `2CDS25${abbPoles[poles]}001R0${pad(current, 2)}${abbCurve[curve]}`;
const abbType = (poles: string, curve: string, current: number) => `S20${abbPoles[poles]}-${curve}${current}`;
mcbSeries({ manufacturer: "ABB", series: "System pro M compact S200", poles: ["1P"], curves: ["B", "C"], currents: [2, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63], ka: 6, type: abbType, article: abbS200 });
mcbSeries({ manufacturer: "ABB", series: "System pro M compact S200", poles: ["1P"], curves: ["D"], currents: [6, 10, 16, 20, 25, 32], ka: 6, type: abbType, article: abbS200 });
mcbSeries({ manufacturer: "ABB", series: "System pro M compact S200", poles: ["2P"], curves: ["C"], currents: [10, 16, 20, 25], ka: 6, type: abbType, article: abbS200 });
mcbSeries({ manufacturer: "ABB", series: "System pro M compact S200", poles: ["3P"], curves: ["B", "C"], currents: [6, 10, 13, 16, 20, 25, 32, 40, 50, 63], ka: 6, type: abbType, article: abbS200 });
mcbSeries({ manufacturer: "ABB", series: "System pro M compact S200", poles: ["4P"], curves: ["C"], currents: [16, 25, 32, 40], ka: 6, type: abbType, article: abbS200 });

const eatonPoles: Record<string, string> = { "1P": "1", "3P": "3" };
mcbSeries({ manufacturer: "Eaton", series: "xPole PL7", poles: ["1P"], curves: ["B", "C"], currents: [6, 10, 13, 16, 20, 25, 32, 40], ka: 10, type: (p, c, i) => `PL7-${c}${i}/${eatonPoles[p]}` });
mcbSeries({ manufacturer: "Eaton", series: "xPole PL7", poles: ["3P"], curves: ["B", "C"], currents: [10, 16, 20, 25, 32], ka: 10, type: (p, c, i) => `PL7-${c}${i}/${eatonPoles[p]}` });
mcbSeries({ manufacturer: "Eaton", series: "xPole PL6", poles: ["1P"], curves: ["B"], currents: [10, 16], ka: 6, type: (p, c, i) => `PL6-${c}${i}/${eatonPoles[p]}` });

mcbSeries({ manufacturer: "OEZ", series: "Minia LTN", poles: ["1P"], curves: ["B", "C"], currents: [6, 10, 13, 16, 20, 25, 32], ka: 10, type: (p, c, i) => `LTN-${i}${c}-1` });
mcbSeries({ manufacturer: "OEZ", series: "Minia LTN", poles: ["3P"], curves: ["B", "C"], currents: [10, 16, 20, 25, 32], ka: 10, type: (p, c, i) => `LTN-${i}${c}-3` });

const seCurve: Record<string, string> = { B: "3", C: "4" };
const seType = (p: string, c: string, i: number) => `iC60N ${p} ${c}${i}`;
const seArticle = (p: string, c: string, i: number) => `A9F0${seCurve[c]}${p.charAt(0)}${pad(i, 2)}`;
mcbSeries({ manufacturer: "Schneider", series: "Acti9 iC60N", poles: ["1P"], curves: ["B", "C"], currents: [6, 10, 13, 16, 20, 25, 32, 40], ka: 6, type: seType, article: seArticle });
mcbSeries({ manufacturer: "Schneider", series: "Acti9 iC60N", poles: ["3P"], curves: ["C"], currents: [10, 16, 20, 25, 32, 40], ka: 6, type: seType, article: seArticle });

const hagerType = (p: string, c: string, i: number) => `M${c === "B" ? "B" : "C"}N${p.charAt(0)}${pad(i, 2)}`;
mcbSeries({ manufacturer: "Hager", series: "MBN / MCN", poles: ["1P"], curves: ["B", "C"], currents: [6, 10, 13, 16, 20, 25, 32], ka: 6, type: hagerType });
mcbSeries({ manufacturer: "Hager", series: "MBN / MCN", poles: ["3P"], curves: ["B", "C"], currents: [10, 16, 20, 25, 32], ka: 6, type: hagerType });

mcbSeries({ manufacturer: "Noark", series: "Ex9BN", poles: ["1P"], curves: ["B", "C"], currents: [6, 10, 16, 20, 25], ka: 6, type: (p, c, i) => `Ex9BN 1P ${c}${i}` });
mcbSeries({ manufacturer: "Noark", series: "Ex9BN", poles: ["3P"], curves: ["B"], currents: [16, 25], ka: 6, type: (p, c, i) => `Ex9BN 3P ${c}${i}` });
mcbSeries({ manufacturer: "Schrack", series: "BM", poles: ["1P"], curves: ["B", "C"], currents: [10, 16], ka: 10, type: (p, c, i) => `BM-${c}${i}/1` });

// ---------------------------------------------------------------------------
//  Proudové chrániče (RCD)
// ---------------------------------------------------------------------------

function rcd(manufacturer: string, series: string, typeCode: string, poles: "2P" | "4P", current: number, sensitivity: number, type: string) {
  out.push({
    manufacturer,
    series,
    typeCode,
    articleNumber: typeCode,
    category: "RCD",
    poles,
    ratedCurrentA: current,
    rcdSensitivityMa: sensitivity,
    rcdType: type,
    breakingCapacityKa: 10,
    modulesCount: width(poles),
    powerLossWatts: r2(estimatePowerLoss("RCD", poles, current) * (poles === "2P" ? 0.5 : 1)),
    description: `Proudový chránič ${poles}, ${current} A / ${sensitivity} mA, typ ${type}`,
  });
}
for (const type of ["AC", "A"]) {
  for (const current of [25, 40]) rcd("ABB", "System pro M compact F200", `F202 ${type}-${current}/0,03`, "2P", current, 30, type);
  for (const current of [25, 40, 63]) rcd("ABB", "System pro M compact F200", `F204 ${type}-${current}/0,03`, "4P", current, 30, type);
  for (const current of [25, 40, 63]) rcd("ABB", "System pro M compact F200", `FH204 ${type}-${current}/0,03`, "4P", current, 30, type);
}
rcd("ABB", "System pro M compact F200", "F204 A-40/0,3", "4P", 40, 300, "A");
rcd("ABB", "System pro M compact F200", "F204 A-63/0,1", "4P", 63, 100, "A");
rcd("ABB", "System pro M compact F200", "F204 B-40/0,03", "4P", 40, 30, "B");
rcd("ABB", "System pro M compact F200", "F204 A S-63/0,3", "4P", 63, 300, "S");
rcd("ABB", "System pro M compact F200", "F202 A-40/0,01", "2P", 40, 10, "A");
for (const [poles, current] of [["2", 25], ["2", 40], ["4", 25], ["4", 40], ["4", 63]] as const) {
  rcd("Eaton", "xPole PF7", `PF7-${current}/${poles}/003`, poles === "2" ? "2P" : "4P", current, 30, "AC");
  rcd("Eaton", "xPole PF7", `PF7-${current}/${poles}/003-A`, poles === "2" ? "2P" : "4P", current, 30, "A");
}
rcd("Eaton", "xPole PFIM", "PFIM-40/4/003-G/A", "4P", 40, 30, "G");
rcd("Eaton", "xPole PFIM", "PFIM-63/4/03-S/A", "4P", 63, 300, "S");
for (const [poles, current] of [["2", 25], ["2", 40], ["4", 25], ["4", 40], ["4", 63]] as const) rcd("OEZ", "Minia LFE", `LFE-${current}-${poles}-030AC`, poles === "2" ? "2P" : "4P", current, 30, "AC");
rcd("OEZ", "Minia LFE", "LFE-25-2-030A", "2P", 25, 30, "A");
rcd("OEZ", "Minia LFE", "LFE-63-4-030A", "4P", 63, 30, "A");
rcd("OEZ", "Minia OFI", "OFI-40-4-030F", "4P", 40, 30, "F");
for (const type of ["AC", "A"]) for (const [poles, current] of [["2P", 25], ["2P", 40], ["4P", 25], ["4P", 63]] as const) rcd("Schneider", "Acti9 iID", `iID ${poles} ${current}A 30mA ${type}`, poles, current, 30, type);
rcd("Schneider", "Acti9 iID", "iID 4P 40A 30mA AC", "4P", 40, 30, "AC");
rcd("Schneider", "Acti9 iID", "iID 4P 63A 300mA A-SI", "4P", 63, 300, "A");
for (const [prefix, type] of [["CDA", "A"], ["CDC", "AC"]] as const) for (const [poles, current] of [[2, 25], [2, 40], [4, 25], [4, 40], [4, 63]] as const) rcd("Hager", "CDA / CDC", `${prefix}${poles}${current}D`, poles === 2 ? "2P" : "4P", current, 30, type);
rcd("Noark", "Ex9L-N", "Ex9LN 4P 40A 30mA A", "4P", 40, 30, "A");
rcd("Noark", "Ex9L-N", "Ex9LN 4P 40A 30mA AC", "4P", 40, 30, "AC");

// ---------------------------------------------------------------------------
//  Jističochrániče (RCBO)
// ---------------------------------------------------------------------------

function rcbo(manufacturer: string, series: string, typeCode: string, curve: string, current: number, type: string, modules = 2) {
  out.push({
    manufacturer,
    series,
    typeCode,
    articleNumber: typeCode,
    category: "RCBO",
    poles: "1P+N",
    ratedCurrentA: current,
    trippingCurve: curve,
    breakingCapacityKa: 6,
    rcdSensitivityMa: 30,
    rcdType: type,
    modulesCount: modules,
    powerLossWatts: estimatePowerLoss("RCBO", "1P+N", current),
    description: `Jističochránič 1P+N, ${current} A, char. ${curve}, 30 mA, typ ${type}`,
  });
}
const RCBO_RATINGS: [string, number][] = [["B", 10], ["B", 16], ["C", 16], ["B", 20], ["C", 20]];
for (const [curve, current] of RCBO_RATINGS) {
  rcbo("ABB", "DS201", `DS201 ${curve}${current} A30`, curve, current, "A");
  rcbo("ABB", "DS201", `DS201 ${curve}${current} AC30`, curve, current, "AC");
  rcbo("Eaton", "PKN7 / PFL7", `PFL7-${current}/1N/${curve}/003-A`, curve, current, "A");
  rcbo("OEZ", "Minia OLE", `OLE-${current}${curve}-1N-030A`, curve, current, "A");
  rcbo("Schneider", "Acti9 iDPN N Vigi", `iDPN N Vigi ${curve}${current} 30mA A`, curve, current, "A");
  rcbo("Hager", "ADA", `ADA ${curve}${current} 30mA A`, curve, current, "A", 1);
}
rcbo("ABB", "DS203NC", "DS203NC C16 A30", "C", 16, "A", 2);

// ---------------------------------------------------------------------------
//  Vypínače / odpínače (MAIN_SWITCH)
// ---------------------------------------------------------------------------

function sw(manufacturer: string, series: string, typeCode: string, poles: string, current: number, article = typeCode) {
  out.push({
    manufacturer,
    series,
    typeCode,
    articleNumber: article,
    category: "MAIN_SWITCH",
    poles,
    ratedCurrentA: current,
    modulesCount: width(poles),
    powerLossWatts: r2(6.81 * (current / 40) * (width(poles) / 3)),
    description: `Vypínač ${poles}, ${current} A`,
  });
}
for (const [p, current] of [[1, 40], [3, 25], [3, 32], [3, 40], [3, 63], [3, 100], [4, 40], [4, 63], [4, 100]] as const) sw("ABB", "SD200", `SD20${p}/${current}`, p === 1 ? "1P" : `${p}P`, current, `2CDD28${p}101R0${pad(current, 3)}`);
for (const [p, current] of [[1, 40], [3, 40], [3, 63], [3, 100], [4, 63]] as const) sw("Eaton", "IS", `IS-${current}/${p}`, `${p}P`, current);
for (const [p, current] of [[3, 32], [3, 63], [3, 100], [4, 40], [4, 125]] as const) sw("OEZ", "Minia MSN", `MSN-${current}-${p}`, `${p}P`, current);
for (const [p, current] of [[3, 63], [3, 100], [4, 40], [4, 63], [1, 40]] as const) sw("Schneider", "Acti9 iSW", `iSW ${p}P ${current}A`, `${p}P`, current);
for (const [p, current] of [[3, 63], [3, 80], [4, 40], [4, 63], [3, 125]] as const) sw("Hager", "SBN", `SBN${p}${current}`, `${p}P`, current);
sw("Noark", "Ex9IP", "Ex9IP 3P 63A", "3P", 63);

// ---------------------------------------------------------------------------
//  Svodiče přepětí (SPD)
// ---------------------------------------------------------------------------

function spd(manufacturer: string, series: string, typeCode: string, spdType: string, poles: string, surgeKa: number, modules = width(poles)) {
  out.push({
    manufacturer,
    series,
    typeCode,
    articleNumber: typeCode,
    category: "SPD",
    poles,
    ratedCurrentA: 0,
    spdType,
    surgeCurrentKa: surgeKa,
    modulesCount: modules,
    powerLossWatts: 0.03,
    description: `Svodič přepětí ${spdType}, ${poles}, ${String(surgeKa).replace(".", ",")} kA`,
  });
}
spd("ABB", "OVR", "OVR T1-T2 3N 12.5-275s P QS", "T1+T2", "3P+N", 12.5);
spd("ABB", "OVR", "OVR T2 3N 40-275 P QS", "T2", "3P+N", 40);
spd("ABB", "OVR", "OVR T2 1N 40-275 P QS", "T2", "1P+N", 40);
spd("ABB", "OVR", "OVR T3 1N 10 275 P", "T3", "1P+N", 10, 1);
spd("Saltek", "FLP", "FLP-12,5 V/3+1", "T1+T2", "3P+N", 12.5);
spd("Saltek", "SLP", "SLP-275 V/1+1", "T2", "1P+N", 20);
spd("Saltek", "SLP", "SLP-275 V/3", "T2", "3P", 20);
spd("Saltek", "DA", "DA-275 DF", "T3", "1P+N", 10, 1);
spd("Eaton", "SPBT12", "SPBT12-280/4", "T1+T2", "4P", 12.5);
spd("Eaton", "SPCT2", "SPCT2-280/4", "T2", "4P", 20);
spd("Eaton", "SPCT2", "SPCT2-280/2", "T2", "1P+N", 20);
spd("OEZ", "SJB", "SJB-25E-3-MZS", "T1+T2", "3P", 25);
spd("OEZ", "SJC", "SJC-40-3N", "T2", "3P+N", 40);
spd("Hakel", "HLSA", "HLSA25-275/4", "T1+T2", "4P", 25);
spd("Schneider", "Acti9 iPRF1", "iPRF1 12.5r 3P+N", "T1+T2", "3P+N", 12.5);

// ---------------------------------------------------------------------------
//  Stykače (CONTACTOR)
// ---------------------------------------------------------------------------

function contactor(manufacturer: string, series: string, typeCode: string, current: number, contacts: string, modules: number, coil = "230V AC") {
  const poles = contacts === "2NO+2NC" ? "2P" : `${contacts.charAt(0)}P`;
  out.push({
    manufacturer,
    series,
    typeCode,
    articleNumber: typeCode,
    category: "CONTACTOR",
    poles,
    ratedCurrentA: current,
    contactConfig: contacts,
    coilVoltage: coil,
    modulesCount: modules,
    powerLossWatts: estimatePowerLoss("CONTACTOR", poles, current),
    description: `Instalační stykač ${current} A, ${contacts}, cívka ${coil}`,
  });
}
contactor("ABB", "ESB", "ESB20-20N-06", 20, "2NO", 1);
contactor("ABB", "ESB", "ESB25-20N-06", 25, "2NO", 1);
contactor("ABB", "ESB", "ESB25-20N-01", 25, "2NO", 1, "24V AC/DC");
contactor("ABB", "ESB", "ESB25-22N-06", 25, "2NO+2NC", 2);
contactor("ABB", "ESB", "ESB40-40N-06", 40, "4NO", 3);
contactor("ABB", "ESB", "ESB63-40N-06", 63, "4NO", 3);
contactor("Eaton", "Z-SCH", "Z-SCH230/16-20", 16, "2NO", 1);
contactor("Eaton", "Z-SCH", "Z-SCH230/25-20", 25, "2NO", 1);
contactor("Eaton", "Z-SCH", "Z-SCH24/25-40", 25, "4NO", 1, "24V AC/DC");
contactor("Eaton", "Z-SCH", "Z-SCH230/40-40", 40, "4NO", 3);
contactor("Eaton", "Z-SCH", "Z-SCH230/63-40", 63, "4NO", 3);
contactor("OEZ", "RSI", "RSI-20-20-A230", 20, "2NO", 1);
contactor("OEZ", "RSI", "RSI-25-40-A230", 25, "4NO", 2);
contactor("OEZ", "RSI", "RSI-40-40-A230", 40, "4NO", 3);
contactor("OEZ", "RSI", "RSI-63-40-A230", 63, "4NO", 3);
contactor("Schneider", "Acti9 iCT", "iCT 16A 2NO", 16, "2NO", 1);
contactor("Schneider", "Acti9 iCT", "iCT 25A 4NO", 25, "4NO", 2);
contactor("Schneider", "Acti9 iCT", "iCT 40A 4NO", 40, "4NO", 3);
contactor("Schneider", "Acti9 iCT", "iCT 63A 4NO", 63, "4NO", 3);
contactor("Schneider", "Acti9 iCT", "iCT 25A 3NO", 25, "3NO", 2);
contactor("Hager", "ESC", "ESC225", 25, "2NO", 1);
contactor("Hager", "ESC", "ESC440", 40, "4NO", 3);
contactor("Hager", "ESC", "ESC325", 25, "3NO", 2);
contactor("Hager", "ESC", "ESC226", 25, "2NO", 1, "12V DC");

// ---------------------------------------------------------------------------
//  Relé a automatizace (RELAY)
// ---------------------------------------------------------------------------

function relay(manufacturer: string, series: string, typeCode: string, subtype: string, current: number, modules: number, description: string, article = typeCode) {
  out.push({
    manufacturer,
    series,
    typeCode,
    articleNumber: article,
    category: "RELAY",
    poles: "1P",
    ratedCurrentA: current,
    relaySubtype: subtype,
    modulesCount: modules,
    powerLossWatts: modules > 1 ? 1.5 : 0.8,
    description,
  });
}
relay("Elko EP", "MR", "MR-41", "IMPULSE", 16, 1, "Impulzní relé, 1 přepínací kontakt 16 A");
relay("Elko EP", "MR", "MR-42", "IMPULSE", 8, 1, "Impulzní relé, 2 přepínací kontakty 8 A");
relay("Elko EP", "CRM", "CRM-91H", "TIMER", 16, 1, "Multifunkční časové relé, 10 funkcí");
relay("Elko EP", "CRM", "CRM-93H", "TIMER", 8, 1, "Multifunkční časové relé, 2 kontakty");
relay("Elko EP", "CRM", "CRM-4", "STAIRCASE", 16, 1, "Schodišťový automat");
relay("Elko EP", "HRH", "HRH-5", "LEVEL", 16, 1, "Hladinový spínač pro vodivé kapaliny");
relay("Elko EP", "HRN", "HRN-33", "MONITORING", 8, 1, "Hlídací relé napětí 3f, sled a výpadek fází");
relay("Elko EP", "HRN", "HRN-54", "MONITORING", 16, 2, "Hlídací relé napětí 3f, nadpětí / podpětí");
relay("Elko EP", "TER", "TER-3", "THERMOSTAT", 16, 1, "Termostat, externí čidlo");
relay("Elko EP", "SOU", "SOU-1", "THERMOSTAT", 16, 1, "Soumrakový spínač");
relay("Elko EP", "VS", "VS116K", "AUXILIARY", 16, 1, "Instalační relé 1 přepínací kontakt 16 A");
relay("Finder", "20", "20.21.8.230.0000", "IMPULSE", 16, 1, "Impulzní relé 1NO 16 A, 230 V AC", "202182300000");
relay("Finder", "80", "80.01.0.240.0000", "TIMER", 16, 1, "Multifunkční časové relé 16 A", "800102400000");
relay("Finder", "22", "22.23.8.230.4000", "AUXILIARY", 25, 1, "Instalační relé 2NO 25 A, 230 V AC", "222382304000");
relay("Finder", "14", "14.01.8.230.0000", "STAIRCASE", 16, 1, "Schodišťový automat 16 A", "140182300000");
relay("ABB", "E290", "E290-16-10", "IMPULSE", 16, 1, "Impulzní relé 1NO 16 A, 230 V AC", "2TAZ312000R2011");
relay("ABB", "E297", "E297-16-20/230", "AUXILIARY", 16, 1, "Instalační relé 2NO 16 A", "2TAZ312000R2012");

// ---------------------------------------------------------------------------
//  Zdroje, měření, svorky, pojistkové odpínače (PSU / OTHER / TERMINAL)
// ---------------------------------------------------------------------------

function other(manufacturer: string, series: string, typeCode: string, category: ComponentCategory, subtype: string, modules: number, loss: number, description: string, current = 0, article = typeCode, poles = "1P") {
  out.push({ manufacturer, series, typeCode, articleNumber: article, category, poles, ratedCurrentA: current, moduleSubtype: subtype, modulesCount: modules, powerLossWatts: loss, description });
}
other("Mean Well", "HDR", "HDR-15-24", "PSU", "PSU_DC", 1, 2, "Napájecí zdroj na DIN 15 W / 24 V DC");
other("Mean Well", "HDR", "HDR-30-24", "PSU", "PSU_DC", 2, 3.5, "Napájecí zdroj na DIN 30 W / 24 V DC");
other("Mean Well", "HDR", "HDR-60-24", "PSU", "PSU_DC", 3, 6, "Napájecí zdroj na DIN 60 W / 24 V DC");
other("Mean Well", "HDR", "HDR-100-24", "PSU", "PSU_DC", 4, 9, "Napájecí zdroj na DIN 100 W / 24 V DC");
other("Mean Well", "HDR", "HDR-30-12", "PSU", "PSU_DC", 2, 3.5, "Napájecí zdroj na DIN 30 W / 12 V DC");
other("ABB", "TS", "TS8/12", "PSU", "BELL_TRANSFORMER", 2, 1.5, "Zvonkový transformátor 8 VA, 12 V", 0, "2CSM228705R0802");
other("ABB", "TS", "TS16/24", "PSU", "BELL_TRANSFORMER", 2, 2.2, "Zvonkový transformátor 16 VA, 24 V", 0, "2CSM228715R0802");
other("ABB", "B23", "B23 112-100", "OTHER", "METER", 4, 1.5, "Elektroměr 3f přímé měření 65 A, MID", 63, "2CMA100155R1000", "3P+N");
other("ABB", "C11", "C11 110-101", "OTHER", "METER", 1, 0.8, "Elektroměr 1f 40 A, MID", 40, "2CMA103571R1000");
other("Orno", "OR-WE", "OR-WE-520", "OTHER", "METER", 1, 0.8, "Elektroměr 1f 45 A, MID", 40);
other("Pollock", "HLAK", "HLAK 25-4/5", "TERMINAL", "MAIN_TERMINAL", 4, 0.2, "Hlavní svorkovnice (HOP), 5 svorek 25 mm²", 80);
other("OEZ", "OPV", "OPV10-1", "OTHER", "FUSE_DISCONNECTOR", 1, 2.5, "Pojistkový odpínač 10×38, 1P, 32 A", 32);
other("OEZ", "OPV", "OPV10-3", "OTHER", "FUSE_DISCONNECTOR", 3, 7.5, "Pojistkový odpínač 10×38, 3P, 32 A", 32, "OPV10-3", "3P");
other("OEZ", "OPV", "OPV14-1", "OTHER", "FUSE_DISCONNECTOR", 1, 3.5, "Pojistkový odpínač 14×51, 1P, 50 A", 50);
other("Finder", "7S", "7S.12.9.024.5110", "PLC", "PLC", 1, 1, "Bezpečnostní relé / smart modul 24 V DC", 6, "7S129024511");

// ---------------------------------------------------------------------------
//  Kompaktní přístroje (póly ≠ šířka): 1P+N v 1M, 2×1P v 1M, 3P ve 2M (fáze 34)
// ---------------------------------------------------------------------------

function compact(opts: { manufacturer: string; series: string; typeCode: string; category: "MCB" | "RCBO"; poles: string; modules: number; curve: string; current: number; ka?: number; rcd?: { type: string; ma: number } }) {
  const loss = estimatePowerLoss(opts.category, opts.poles === "2x1P" ? "1P" : opts.poles, opts.current) * (opts.poles === "2x1P" ? 2 : 1);
  const kind = opts.category === "RCBO" ? "Jističochránič" : "Jistič";
  const poles = opts.poles === "2x1P" ? "2×1P" : opts.poles;
  out.push({
    manufacturer: opts.manufacturer,
    series: opts.series,
    typeCode: opts.typeCode,
    articleNumber: opts.typeCode,
    category: opts.category,
    poles: opts.poles,
    ratedCurrentA: opts.current,
    trippingCurve: opts.curve,
    breakingCapacityKa: opts.ka ?? 6,
    rcdSensitivityMa: opts.rcd?.ma,
    rcdType: opts.rcd?.type,
    modulesCount: opts.modules,
    powerLossWatts: r2(loss),
    description: `${kind} ${poles} kompakt (${String(opts.modules).replace(".", ",")}M), ${opts.current} A, char. ${opts.curve}${opts.rcd ? `, ${opts.rcd.ma} mA typ ${opts.rcd.type}` : ""}`,
  });
}
for (const [curve, current] of [["C", 10], ["C", 16], ["B", 16]] as const) compact({ manufacturer: "ABB", series: "SN201", typeCode: `SN201 L ${curve}${current}`, category: "MCB", poles: "1P+N", modules: 1, curve, current, ka: 4.5 });
for (const [curve, current] of [["B", 16], ["C", 16]] as const) compact({ manufacturer: "ABB", series: "DSN201", typeCode: `DSN201 M ${curve}${current} A30`, category: "RCBO", poles: "1P+N", modules: 1, curve, current, rcd: { type: "A", ma: 30 } });
for (const [curve, current] of [["B", 10], ["B", 16], ["C", 16]] as const) compact({ manufacturer: "Eaton", series: "PLN6", typeCode: `PLN6-${curve}${current}/1N`, category: "MCB", poles: "1P+N", modules: 1, curve, current });
for (const [curve, current] of [["B", 16], ["C", 16]] as const) compact({ manufacturer: "OEZ", series: "Minia OLI", typeCode: `OLI-${current}${curve}-1N-030A`, category: "RCBO", poles: "1P+N", modules: 1, curve, current, rcd: { type: "A", ma: 30 } });
for (const current of [10, 16]) {
  compact({ manufacturer: "Hager", series: "MBN kompakt", typeCode: `MBN 2x1P B${current} kompakt`, category: "MCB", poles: "2x1P", modules: 1, curve: "B", current });
  compact({ manufacturer: "Schrack", series: "BM kompakt", typeCode: `BM 2x1P B${current} kompakt`, category: "MCB", poles: "2x1P", modules: 1, curve: "B", current });
}
compact({ manufacturer: "Hager", series: "MBN kompakt", typeCode: "MBN 3P B16 kompakt 2M", category: "MCB", poles: "3P", modules: 2, curve: "B", current: 16 });
compact({ manufacturer: "Schrack", series: "BM kompakt", typeCode: "BM 3P C16 kompakt 2M", category: "MCB", poles: "3P", modules: 2, curve: "C", current: 16 });
compact({ manufacturer: "Noark", series: "Ex9BN kompakt", typeCode: "Ex9BN 3P C16 kompakt 2M", category: "MCB", poles: "3P", modules: 2, curve: "C", current: 16 });

export const GENERATED_CATALOG: SeedComponent[] = out;
