import { describe, expect, it } from "vitest";

import { classifyComponent, designationKey, pairBomLifespan, stockOf, type StoredComponent } from "./bom-lifespan";
import { datasheetFor, partKeyOf } from "./component-datasheets";
import { assessComponent, batteryMonths, endOfLifeText, hoursPerDay, remainingText, type ComponentInput } from "./component-lifespan";
import { buildDatasheetView, lossOf } from "./datasheet-view";
import { redlineStage } from "./equipment-redlines";
import { alertKeyOf, generateLifespanPurchaseReport, purchaseReportDue, reportKeys, wholesaleCsv, type PurchaseInputRow, type PurchaseSettings } from "./lifespan-purchase";
import { buildParts } from "./mock-graphics/parts";
import { ROUTINE_ITEMS, influenceCodesFrom, suggestConclusion, suggestEnclosure, thermalCheck } from "./passport-docs";
import { locationText, nearestNeighbourOrder, roomCountdown, walkItemsFor, walkProgress, walkStops, withWalkSort, type WalkItem } from "./revision-walk";

// Fáze 116: životnost součástek z kusovníku (100 % → 0 %, konec životnosti podle směnnosti, spínání a teploty),
// souhrnný nákupní report, doplnění pasportu, Červenky, datasheety a pochůzkový režim revizního technika.

const NOW = new Date("2026-11-14T08:00:00Z");
const DAY = 86_400_000;
const yearsAgo = (years: number) => new Date(NOW.getTime() - years * 365 * DAY);

const contactor = (installedAt: Date, cyclesPerHour: number): ComponentInput => ({
  wearCategory: "SWITCHING_CONTACTOR",
  installedAt,
  cyclesPerHour,
  manualCyclesOffset: 0,
  maxElectricalCycles: 1_369_863,
  maxOperatingHours: null,
  maxCalendarMonths: null,
  replacementStockCount: 0,
});

describe("zbývající životnost 100 % → 0 % a konec životnosti", () => {
  it("nová součástka = 100 %, stykač podle B10d a četnosti spínání; směnnost zkracuje dobu do konce", () => {
    const fresh = assessComponent(contactor(NOW, 30), { shiftRegime: 2, internalTempC: null }, NOW);
    expect(fresh.remainingPercent).toBe(100);
    expect(fresh.overrunPercent).toBe(0);
    // 2 směny = 4 000 h/rok → 30 × 4 000 = 120 000 cyklů/rok → B10d 1 369 863 za 11,4 roku
    expect(fresh.remainingDays).toBe(Math.floor(1_369_863 / (30 * hoursPerDay(2))));
    const byRegime = [1, 2, 3, 4].map((shiftRegime) => assessComponent(contactor(yearsAgo(1), 30), { shiftRegime, internalTempC: null }, NOW));
    // 1 směna 2 000 h/rok … 24/7 8 760 h/rok: po roce víc spotřebováno a dřívější konec
    expect(byRegime.map((entry) => entry.remainingPercent)).toEqual([95.6, 91.2, 86.9, 80.8]);
    expect(byRegime[0].remainingDays!).toBeGreaterThan(byRegime[1].remainingDays!);
    expect(byRegime[2].remainingDays!).toBeGreaterThan(byRegime[3].remainingDays!);
    expect(byRegime[0].predictedReplacementDate!.getTime()).toBeGreaterThan(byRegime[3].predictedReplacementDate!.getTime());
  });

  it("četnost spínání 45 → 120 sepnutí/h přepočítá % a datum konce; překročení = 0 % zbývá (překročeno o +38 %)", () => {
    const slow = assessComponent(contactor(yearsAgo(2), 45), { shiftRegime: 2, internalTempC: null }, NOW);
    const fast = assessComponent(contactor(yearsAgo(2), 120), { shiftRegime: 2, internalTempC: null }, NOW);
    expect(slow.remainingPercent).toBeGreaterThan(fast.remainingPercent);
    expect(fast.remainingDays!).toBeLessThan(slow.remainingDays!);
    // 120 sepnutí/h, 3 směny, 2,62 roku → 1,89 mil. cyklů = 138 % B10d
    const over = assessComponent(contactor(yearsAgo(2.62), 120), { shiftRegime: 3, internalTempC: null }, NOW);
    expect(over.expired).toBe(true);
    expect(over.remainingPercent).toBe(0);
    expect(over.overrunPercent).toBeCloseTo(38, 0);
    expect(remainingText(over)).toMatch(/^🔴 0 % zbývá \(překročeno o \+3[78],?\d* %\)$/);
    expect(endOfLifeText(over)).toBe("🔴 Překročeno – vyměnit ihned");
    expect(endOfLifeText(assessComponent(contactor(NOW, 30), { shiftRegime: 2, internalTempC: null }, NOW))).toMatch(/^\d{1,2}\. \d{1,2}\. 20\d{2} \(za [\d\s]+ dní\)$/);
  });

  it("teplota v rozváděči (Arrhenius) zkracuje motohodiny zdroje, baterie 25 °C → poloviční životnost po +10 °C", () => {
    const psu = (tempC: number) =>
      assessComponent({ wearCategory: "POWER_ELECTRONICS", installedAt: yearsAgo(3), cyclesPerHour: null, manualCyclesOffset: 0, maxElectricalCycles: null, maxOperatingHours: 50_000, maxCalendarMonths: null, replacementStockCount: 0 }, { shiftRegime: 2, internalTempC: tempC }, NOW);
    expect(psu(35).remainingPercent).toBe(76);
    expect(psu(48).remainingPercent).toBeLessThan(psu(35).remainingPercent);
    expect(psu(50).effectiveMaxHours).toBe(25_000);
    expect(batteryMonths(48, 35)).toBe(24);
    expect(batteryMonths(48, 20)).toBe(48);
  });

  it("předstih upozornění: v okně ≤ N dní nebo ≤ 15 % životnosti", () => {
    const base = contactor(yearsAgo(10.5), 30);
    const near = assessComponent(base, { shiftRegime: 2, internalTempC: null }, NOW, { alertLeadDays: 30 });
    expect(near.remainingDays!).toBeGreaterThan(30);
    expect(near.alert).toBe(true); // zbývá < 15 %
    const early = assessComponent(contactor(yearsAgo(1), 30), { shiftRegime: 2, internalTempC: null }, NOW, { alertLeadDays: 180 });
    expect(early.alert).toBe(false);
    const window = assessComponent(contactor(yearsAgo(11.2), 30), { shiftRegime: 2, internalTempC: null }, NOW, { alertLeadDays: 180 });
    expect(window.remainingDays!).toBeLessThanOrEqual(180);
    expect(window.alert).toBe(true);
    expect(window.status).not.toBe("OK");
  });
});

describe("napárování kusovníku na model životnosti A–E", () => {
  const bom = buildParts("63 A").map((part, index) => ({ ...part, position: index + 1, note: part.note ?? null }));

  it("kategorie podle označení a popisu: -Q, -F, -K, -T, -A, -X, -FAN, -BT, -FV", () => {
    expect(classifyComponent({ designation: "Q1", description: "Hlavní vypínač 3P 63 A" })).toBe("MAIN_SWITCH");
    expect(classifyComponent({ designation: "F2", description: "Jistič 3P C16 A, 10 kA" })).toBe("BREAKER");
    expect(classifyComponent({ designation: "K1", description: "Stykač 3P 25 A, cívka 24 V DC" })).toBe("CONTACTOR");
    expect(classifyComponent({ designation: "-KA3", description: "Pomocné relé 24 V" })).toBe("RELAY");
    expect(classifyComponent({ designation: "T1", description: "Spínaný zdroj 3× 400 V AC / 24 V DC, 10 A" })).toBe("PSU");
    expect(classifyComponent({ designation: "-U1", description: "Frekvenční měnič vřetene" })).toBe("VFD");
    expect(classifyComponent({ designation: "A1", description: "Řídicí jednotka PLC" })).toBe("PLC");
    expect(classifyComponent({ designation: "X1", description: "Průchozí svorka 2,5 mm²" })).toBe("TERMINAL");
    expect(classifyComponent({ designation: "-FAN1", description: "Filtrační rohož ventilátoru" })).toBe("FILTER");
    expect(classifyComponent({ designation: "-FAN2", description: "Ventilátor rozváděče 230 V" })).toBe("FAN");
    expect(classifyComponent({ designation: "-BT1", description: "Záložní baterie PLC" })).toBe("BATTERY");
    expect(classifyComponent({ designation: "-FV1", description: "Přepěťová ochrana T2" })).toBe("SPD");
    expect(designationKey("-K1")).toBe("K1");
    expect(designationKey("=A1-K4")).toBe("K4");
  });

  it("každá položka kusovníku dostane model; LC1D25BD z technického listu (B10d), svorky bez opotřebení; uložená součástka má přednost", () => {
    const stored: StoredComponent = { id: "c1", designation: "-T1", name: "Zdroj", manufacturer: "Siemens", modelNumber: "6EP3334-8SB00-0AY0", wearCategory: "POWER_ELECTRONICS", installedAt: yearsAgo(2), cyclesPerHour: null, manualCyclesOffset: 0, maxElectricalCycles: null, maxOperatingHours: 50_000, maxCalendarMonths: null, replacementStockCount: 0, alertLeadDays: 30, hoursReading: null, hoursReadingAt: null, quantity: 1, source: "MANUAL", notes: null };
    const extra: StoredComponent = { ...stored, id: "c2", designation: "-FAN1", name: "Filtrační rohož", modelNumber: null, wearCategory: "COOLING_FAN_FILTER", maxOperatingHours: null, maxCalendarMonths: 6, alertLeadDays: null };
    const rows = pairBomLifespan(bom, [stored, extra], new Date(Date.UTC(2019, 0, 1)));
    expect(rows.map((row) => row.designation)).toEqual(["-Q1", "-F1", "-F2", "-F3", "-F4", "-F5", "-F6", "-K1", "-K2", "-K3", "-K4", "-T1", "-A1", "-X1", "-X2", "-FAN1"]);
    const k1 = rows.find((row) => row.key === "K1")!;
    expect(k1.limitSource).toBe("datasheet");
    expect(k1.model?.maxElectricalCycles).toBe(1_369_863);
    expect(k1.rateSource).toBe("estimate");
    expect(rows.find((row) => row.key === "X1")!.model).toBeNull();
    const t1 = rows.find((row) => row.key === "T1")!;
    expect(t1.componentId).toBe("c1");
    expect(t1.partNumber).toBe("6EP3334-8SB00-0AY0");
    expect(t1.note).toContain("V kusovníku revize: Phoenix Contact QUINT4-PS/3AC/24DC/10");
    expect(rows.at(-1)!.inBom).toBe(false);
    expect(stockOf({ partNumber: "LC1D25BD", componentStock: 0 }, new Map([[partKeyOf("LC1D25BD"), 3]]))).toBe(3);
    expect(stockOf({ partNumber: null, componentStock: 4 }, new Map())).toBe(4);
  });
});

describe("oficiální datasheet součástky", () => {
  it("LC1D25BD: B10d, životnost, rozměry, Pv a svorky z listu Schneider Electric; jiný díl obecné značení", () => {
    const sheet = datasheetFor("lc1d25bd");
    expect(sheet?.lifespan.b10dCycles).toBe(1_369_863);
    const view = buildDatasheetView({ manufacturer: "Schneider Electric", partNumber: "LC1D25BD", description: "Stykač", kind: "CONTACTOR" }, null)!;
    expect(view.verified).toBe(true);
    expect(view.dimensions).toBe("45 × 85 × 101 mm (Š × V × H)");
    expect(view.lifespan.map((entry) => entry.label)).toContain("B10d (ČSN EN ISO 13849-1)");
    expect(view.terminals.map((pair) => `${pair.from}-${pair.to}`)).toEqual(["1/L1-2/T1", "3/L2-4/T2", "5/L3-6/T3", "A1-A2", "13-14", "21-22"]);
    expect(view.datasheetUrl).toContain("se.com/cz/cs/product/download-pdf/LC1D25BD");
    expect(lossOf("LC1D25BD", null)).toEqual({ lossW: 3.75, source: "technický list Schneider Electric (AC-3)" });
    const generic = buildDatasheetView({ manufacturer: "Siemens", partNumber: "5SY4316-7", description: "Jistič 3P C16 A", kind: "BREAKER" }, null)!;
    expect(generic.verified).toBe(false);
    expect(generic.terminalsVerified).toBe(false);
    expect(generic.terminals).toHaveLength(3);
  });
});

const row = (patch: Partial<PurchaseInputRow>): PurchaseInputRow => ({
  equipmentId: "eq-1",
  tag: "LIS-01",
  equipmentName: "Lis",
  buildingName: "Hala A",
  floorName: "1. NP",
  designation: "-K1",
  manufacturer: "Schneider Electric",
  partNumber: "LC1D25BD",
  description: "Stykač 3P 25 A",
  quantity: 1,
  remainingDays: 400,
  endDate: new Date(NOW.getTime() + 400 * DAY),
  remainingPercent: 50,
  alert: false,
  expired: false,
  alertLeadDays: 60,
  estimated: false,
  ...patch,
});

describe("souhrnný nákupní report (Smart Batch Trigger)", () => {
  const hallA = [1, 2, 3, 4].map((index) => row({ equipmentId: "eq-a", tag: "LIS-01", designation: `-K${index}`, remainingDays: 40 + index * 10, endDate: new Date(NOW.getTime() + (40 + index * 10) * DAY) }));
  const hallB = [1, 2].map((index) => row({ equipmentId: "eq-b", tag: "CNC-04", buildingName: "Hala B", designation: `-K${index}`, remainingDays: 120 + index * 20, endDate: new Date(NOW.getTime() + (120 + index * 20) * DAY) }));

  it("bez prvního varování se nic neobjednává", () => {
    const report = generateLifespanPurchaseReport([...hallA, ...hallB], { now: NOW, horizonDays: 180, stock: new Map() });
    expect(report.triggered).toBe(false);
    expect(report.lines).toHaveLength(0);
  });

  it("první součástka v předstihu spustí report: 4× LC1D25BD Hala A + 2× Hala B = 6 ks, skladem 1 → doobjednat 5", () => {
    const rows = [{ ...hallA[0], alert: true }, ...hallA.slice(1), ...hallB, row({ equipmentId: "eq-c", tag: "RM1", designation: "-T1", partNumber: "6EP3334-8SB00-0AY0", manufacturer: "Siemens", remainingDays: 700, endDate: new Date(NOW.getTime() + 700 * DAY) })];
    const report = generateLifespanPurchaseReport(rows, { now: NOW, horizonDays: 180, stock: new Map([["LC1D25BD", 1]]) });
    expect(report.triggered).toBe(true);
    expect(report.trigger?.designation).toBe("-K1");
    expect(report.lines).toHaveLength(1);
    expect(report.lines[0]).toMatchObject({ partNumber: "LC1D25BD", manufacturer: "Schneider Electric", needed: 6, inStock: 1, toOrder: 5, nearestDays: 50 });
    expect(report.lines[0].machines.map((machine) => `${machine.tag} ${machine.designation}`)).toEqual(["LIS-01 -K1", "LIS-01 -K2", "LIS-01 -K3", "LIS-01 -K4", "CNC-04 -K1", "CNC-04 -K2"]);
    // Kratší výhled 90 dní = jen Hala A
    const short = generateLifespanPurchaseReport(rows, { now: NOW, horizonDays: 90, stock: new Map([["LC1D25BD", 1]]) });
    expect(short.lines[0]).toMatchObject({ needed: 4, toOrder: 3 });
    expect(wholesaleCsv(report)).toContain("LC1D25BD;5;Schneider Electric");
  });

  it("součástka bez objednacího čísla a po konci životnosti se uvede zvlášť", () => {
    const report = generateLifespanPurchaseReport([row({ partNumber: null, expired: true, alert: true, remainingDays: -20 }), row({ designation: "-K2", alert: true })], { now: NOW, horizonDays: 60, stock: new Map() });
    expect(report.withoutPartNumber).toHaveLength(1);
    expect(report.lines).toHaveLength(0); // -K2 končí za 400 dní – mimo výhled
  });

  it("e-mail nákupu: při prvním varování jen s novou součástkou, měsíčně 1. den, čtvrtletně v lednu / dubnu / červenci / říjnu", () => {
    const settings: PurchaseSettings = { email: "nakup@example.com", frequency: "FIRST_WARNING", horizonDays: 90, lastSentAt: null, notifiedKeys: [] };
    const alertRow = { ...hallA[0], alert: true };
    const report = generateLifespanPurchaseReport([alertRow, ...hallA.slice(1)], { now: NOW, horizonDays: 90, stock: new Map() });
    expect(purchaseReportDue(settings, report, [alertKeyOf(alertRow)], NOW).due).toBe(true);
    const known = { ...settings, lastSentAt: "2026-11-01T08:00:00Z", notifiedKeys: reportKeys(report) };
    expect(purchaseReportDue(known, report, [alertKeyOf(alertRow)], NOW).due).toBe(false);
    expect(purchaseReportDue({ ...settings, email: null }, report, [alertKeyOf(alertRow)], NOW).due).toBe(false);
    expect(purchaseReportDue({ ...settings, frequency: "MONTHLY" }, report, [], new Date("2026-12-01T08:00:00Z")).due).toBe(true);
    expect(purchaseReportDue({ ...settings, frequency: "MONTHLY" }, report, [], new Date("2026-12-02T08:00:00Z")).due).toBe(false);
    expect(purchaseReportDue({ ...settings, frequency: "QUARTERLY" }, report, [], new Date("2027-01-01T08:00:00Z")).due).toBe(true);
    expect(purchaseReportDue({ ...settings, frequency: "QUARTERLY" }, report, [], new Date("2027-02-01T08:00:00Z")).due).toBe(false);
  });
});

describe("pasport & shoda (61439)", () => {
  it("výpočet oteplení IEC TR 60890: ΔT pod stropem ≤ 30 K vyhovuje, větší ztráty ne", () => {
    const enclosure = suggestEnclosure(4, 63);
    expect(enclosure).toEqual({ heightMm: 1200, widthMm: 600, depthMm: 250, installation: "WALL_MOUNTED", material: "PAINTED_STEEL" });
    const ok = thermalCheck({ enclosure, ambientTempC: 35, maxRiseK: 30, losses: [{ designation: "K1", description: "Stykač", quantity: 4, lossW: 3.75, source: "list" }], wiringLossW: 3 });
    expect(ok.deviceLossW).toBe(15);
    expect(ok.ok).toBe(true);
    expect(ok.verdict).toMatch(/^VYHOVUJE – oteplení pod stropem skříně ΔT = [\d,]+ K ≤ 30,0 K/);
    const hot = thermalCheck({ enclosure: { ...enclosure, heightMm: 400, widthMm: 300, depthMm: 150 }, ambientTempC: 35, maxRiseK: 30, losses: [{ designation: "U1", description: "Měnič", quantity: 1, lossW: 400, source: "list" }], wiringLossW: 40 });
    expect(hot.ok).toBe(false);
  });

  it("vnější vlivy z karty zařízení + výchozí třídy; návrh závěru podle kódů; kusová zkouška čl. 11.2–11.10", () => {
    const codes = influenceCodesFrom("AA5, AB4, BA4 – normální průmyslové");
    expect(codes.slice(0, 3)).toEqual(["AA5", "AB4", "AD1"]);
    expect(codes).toContain("BA4");
    expect(suggestConclusion(codes)).toBe("NORMAL");
    expect(suggestConclusion([...codes, "AD4"])).toBe("DANGEROUS");
    expect(suggestConclusion(["BC4"])).toBe("SPECIAL");
    expect(ROUTINE_ITEMS.map((item) => item.clause)).toEqual(["11.2", "11.3", "11.4", "11.5", "11.6", "11.7", "11.8", "11.9", "11.10"]);
  });

  it("Červenky: stav podle požadavku a předání k překreslení", () => {
    expect(redlineStage({ status: "SUBMITTED", assigneeName: null, task: null, approvedVersion: null }).label).toBe("Čeká na překreslení");
    expect(redlineStage({ status: "SUBMITTED", assigneeName: null, task: { mode: "INTERNAL_DESIGNER", status: "OPEN", claimedBy: null, internalName: "Ing. Král" }, approvedVersion: null }).label).toBe("Přiřazeno internímu projektantovi (Ing. Král)");
    expect(redlineStage({ status: "SUBMITTED", assigneeName: null, task: { mode: "POOL", status: "OPEN", claimedBy: null, internalName: null }, approvedVersion: null }).stage).toBe("POOL");
    expect(redlineStage({ status: "APPROVED", assigneeName: null, task: null, approvedVersion: "v1.1" }).label).toBe("Schváleno do v1.1");
  });
});

const walkItem = (patch: Partial<WalkItem>): WalkItem => ({
  id: "x",
  tag: "PP-0001",
  name: "Prodlužovací buben",
  type: "EXTENSION_CORD",
  buildingName: "Hala A",
  buildingOrder: 1,
  floorCode: "1NP",
  floorLevel: 0,
  floorName: "1. NP",
  zone: null,
  state: "EXPIRED",
  daysLeft: -10,
  validUntil: null,
  plantId: "p",
  plantName: "Závod",
  buildingId: "b-a",
  floorId: "f-a1",
  buildingCenter: null,
  pinX: 10,
  pinY: 10,
  room: "Dílna",
  gridRef: "B3",
  locationNote: null,
  photoUrl: null,
  nameplatePhotoUrl: null,
  protectionClass: "I",
  entrance: { x: 0, y: 0, label: "Vrata" },
  last: null,
  inspectedToday: false,
  ...patch,
});

describe("🚶 pochůzkový režim revizního technika", () => {
  const items = [
    walkItem({ id: "1", tag: "PP-1", buildingName: "Hala B", buildingOrder: 2, buildingId: "b-b", floorId: "f-b1", room: "Montáž", pinX: 20, pinY: 20 }),
    walkItem({ id: "2", tag: "PP-2", room: "Lisovna", pinX: 80, pinY: 80 }),
    walkItem({ id: "3", tag: "PP-3", room: "Dílna", pinX: 15, pinY: 10, inspectedToday: true }),
    walkItem({ id: "4", tag: "PP-4", floorLevel: 1, floorCode: "2NP", floorName: "2. NP", floorId: "f-a2", room: "Kancelář 204", locationNote: "Pracovní místo u okna", gridRef: null }),
    walkItem({ id: "5", tag: "PP-5", room: "Dílna", pinX: 12, pinY: 14, daysLeft: 20, state: "EXPIRING" }),
  ];

  it("zastávky Budova ➔ Patro ➔ Místnost, na patře od vchodu nejbližším sousedem – každá místnost jen jednou", () => {
    const stops = walkStops(items);
    expect(stops.map((stop) => `${stop.buildingName}/${stop.floorName}/${stop.room}`)).toEqual(["Hala A/1. NP/Dílna", "Hala A/1. NP/Lisovna", "Hala A/2. NP/Kancelář 204", "Hala B/1. NP/Montáž"]);
    expect(stops[0].items.map((item) => item.tag)).toEqual(["PP-3", "PP-5"]);
    expect(nearestNeighbourOrder(items.slice(1, 3), { x: 100, y: 100 }).map((item) => item.tag)).toEqual(["PP-2", "PP-3"]);
  });

  it("kde to najdu, odpočet místnosti a postup dnešního výjezdu", () => {
    expect(locationText(items[1])).toBe("📍 Lisovna · Osový kříž B3");
    expect(locationText(items[3])).toBe("📍 Kancelář 204 · Pracovní místo u okna");
    const [dilna] = walkStops(items);
    expect(roomCountdown(dilna)).toMatchObject({ done: 1, total: 2 });
    expect(roomCountdown(dilna).remaining.map((item) => item.tag)).toEqual(["PP-5"]);
    expect(walkProgress(items)).toEqual({ done: 1, total: 5 });
    expect(walkItemsFor(items, 30, "b-b").map((item) => item.tag)).toEqual(["PP-1"]);
    expect(withWalkSort("/revize?zavod=p", "trasa")).toBe("/revize?zavod=p&razeni=trasa");
    expect(withWalkSort("/revize?razeni=trasa", "urgence")).toBe("/revize");
  });
});
