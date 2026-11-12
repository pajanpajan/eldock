import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { MANHATTAN, circuitRoutes, summarizeCabling, type RouteNode } from "@/engine/cable-routing";
import { DEFAULT_ELEVATION } from "@/engine/floorplan-bridge";
import { cableListPrice } from "@/server/quote-data";
import { CROSS_CABLE, LIGHT_CABLE_3, LIGHT_CABLE_5, SWITCH_BOX_RESERVE_MM, TRAVELLER_CABLE, breakdownText, lightingTopology, routeBreakdown } from "@/engine/lighting-topology";

import { emptyDraft, type EditorElement, type FloorplanDraft } from "./panel-builder/floorplan-editor";
import { HEIGHT_LEVELS, buildScene, elevationOf, heightIssues, isoProject, setHeights, wallOf } from "./panel-builder/pseudo3d";
import { cableKey } from "./quoting/cable-designations";
import { DEFAULT_CALIBRATION, NH_TASKS, NH_VERSION, calibrateFromActual } from "./quoting/normohodiny-catalog";
import { CUSTOMER_FORBIDDEN, EMPTY_WORK, assertCustomerSafe, buildQuote, type QuoteMaterial, type QuoteOptions } from "./quoting/quote-engine";
import { customerQuoteHtml, customerQuoteRows } from "./quoting/quote-print";
import { isPowerCable, switchboardWork } from "./quoting/quote-sources";
import { csv, inquiryEmail, orderXml, quickOrderText, wholesalerFile, wholesalerRows, type OrderLine } from "./quoting/wholesaler-export";

// Fáze 105: kabely osvětlení (svislé svody, řazení 1 / 5 / 6 / 7, hvězda u sběrnice), cenová nabídka (ceníkové ceny
// a normohodiny, bez interních pojmů ve výstupu pro zákazníka) a export poptávky do velkoobchodů.

const profile = { ...DEFAULT_ELEVATION, ceilingHeightMm: 2600, switchboardHeightMm: 1500, slackPercent: 10, boxAllowanceMm: 150, panelAllowanceMm: 600 };
const node = (id: string, x: number, y: number, heightMm: number): RouteNode => ({ id, x, y, heightMm, room: "r1" });
const panel = { x: 0, y: 0 };

function topology(nodes: RouteNode[], lights: string[], links: { switchId: string; lightId: string }[], switchNo: Record<string, "1" | "5" | "6" | "6+6" | "7">, installation: "classic" | "smart_retrofit" | "bus_loxone" = "classic", circuitCable = "CYKY-J 3x1,5") {
  const byId = new Map(nodes.map((entry) => [entry.id, entry]));
  return lightingTopology({
    installation,
    circuitCable,
    nodes: lights.map((id) => byId.get(id)!),
    byId,
    switchLinks: links,
    switchNoOf: (id) => switchNo[id] ?? "1",
    origin: panel,
    profile,
    metric: MANHATTAN,
    chainRoutes: (chain) => circuitRoutes(chain, panel, profile, MANHATTAN),
  })!;
}

describe("fáze 105 – kabely osvětlení: svislé svody a řazení vypínačů", () => {
  it("řazení 1: přívod do krabice vypínače, svod (strop − výška vypínače) + 0,30 m, ke světlu CYKY-J 3×1,5", () => {
    const nodes = [node("s", 3000, 0, 1200), node("l", 3000, 2000, 2600)];
    const result = topology(nodes, ["l"], [{ switchId: "s", lightId: "l" }], { s: "1" });
    const leg = result.legs.find((part) => part.role === "switch-leg")!;
    expect(leg.cable).toBe(LIGHT_CABLE_3);
    // Vodorovně 2 m, svisle 2600 − 1200 = 1400 mm, rezerva = 10 % + 0,30 m v krabici vypínače + 0,15 m u světla
    expect(leg).toMatchObject({ horizontalMm: 2000, verticalMm: 1400 });
    expect(leg.totalMm).toBe(Math.round(3400 * 1.1 + SWITCH_BOX_RESERVE_MM + 150));
    // Přívod z rozváděče do krabice vypínače (vrchem: z RH ke stropu 1100 + ze stropu k vypínači 1400)
    expect(result.routes.TOP.segments[0]).toMatchObject({ from: "panel", to: "s", horizontalMm: 3000, verticalMm: 1100 + 1400 });
    expect(result.cableMm.TOP.get(LIGHT_CABLE_3)).toBeGreaterThan(leg.totalMm);
  });

  it("skupina světel jednoho vypínače se smyčkuje (vypínač → světlo 1 → světlo 2 → světlo 3)", () => {
    const nodes = [node("s", 0, 3000, 1200), node("l1", 1000, 3000, 2600), node("l2", 2000, 3000, 2600), node("l3", 3000, 3000, 2600)];
    const result = topology(nodes, ["l1", "l2", "l3"], ["l1", "l2", "l3"].map((lightId) => ({ switchId: "s", lightId })), { s: "1" });
    const leg = result.legs.find((part) => part.role === "switch-leg")!;
    expect(leg.horizontalMm).toBe(3000);
    expect(leg.verticalMm).toBe(1400);
    expect(result.routes.OPTIMIZED.segments.filter((segment) => segment.to.startsWith("l")).map((segment) => `${segment.from}>${segment.to}`)).toEqual(["s>l1", "l1>l2", "l2>l3"]);
  });

  it("řazení 5: ke světlům CYKY-J 5×1,5", () => {
    const nodes = [node("s", 2000, 0, 1200), node("l1", 2000, 2000, 2600), node("l2", 3000, 2000, 2600)];
    const result = topology(nodes, ["l1", "l2"], [{ switchId: "s", lightId: "l1" }, { switchId: "s", lightId: "l2" }], { s: "5" });
    expect(result.legs.find((part) => part.role === "switch-leg")?.cable).toBe(LIGHT_CABLE_5);
  });

  it("řazení 6: přívod do A, korespondence A ↔ B CYKY-O 3×1,5 se dvěma svislými svody, z B CYKY-J 3×1,5", () => {
    const nodes = [node("a", 1000, 0, 1200), node("b", 5000, 0, 1200), node("l", 5000, 2000, 2600)];
    const result = topology(nodes, ["l"], [{ switchId: "a", lightId: "l" }, { switchId: "b", lightId: "l" }], { a: "6", b: "6" });
    const traveller = result.legs.find((part) => part.role === "traveller")!;
    expect(traveller).toMatchObject({ cable: TRAVELLER_CABLE, from: "a", to: "b", horizontalMm: 4000, verticalMm: 2 * (2600 - 1200) });
    expect(traveller.totalMm).toBe(Math.round((4000 + 2800) * 1.1 + 2 * SWITCH_BOX_RESERVE_MM));
    expect(result.legs.find((part) => part.role === "switch-leg")).toMatchObject({ cable: LIGHT_CABLE_3, from: "b" });
    // Přívod okruhu vede do krabice přepínače A (blíž rozváděči), ne ke světlu
    expect(result.routes.TOP.segments[0]).toMatchObject({ from: "panel", to: "a" });
  });

  it("řazení 7: řetěz 6 – 7 – 6 kabelem CYKY-J 5×1,5 se svodem u každého vypínače", () => {
    const nodes = [node("a", 1000, 0, 1200), node("c", 3000, 0, 1200), node("b", 5000, 0, 1200), node("l", 5000, 2000, 2600)];
    const result = topology(nodes, ["l"], ["a", "c", "b"].map((switchId) => ({ switchId, lightId: "l" })), { a: "6", c: "7", b: "6" });
    const travellers = result.legs.filter((part) => part.role === "traveller");
    expect(travellers.map((part) => `${part.from}>${part.to}:${part.cable}`)).toEqual([`a>c:${CROSS_CABLE}`, `c>b:${CROSS_CABLE}`]);
    expect(travellers.every((part) => part.verticalMm === 2800)).toBe(true);
  });

  it("Smart Home (sběrnice): skupina světel = jedna hvězdicová větev z rozváděče, DALI / RGBW 5×1,5", () => {
    const nodes = [node("t", 1000, 0, 1200), node("l1", 2000, 2000, 2600), node("l2", 3000, 2000, 2600), node("l3", 6000, 2000, 2600)];
    const result = topology(nodes, ["l1", "l2", "l3"], [{ switchId: "t", lightId: "l1" }, { switchId: "t", lightId: "l2" }], { t: "1" }, "bus_loxone");
    expect(result.star).toBe(true);
    const branches = result.legs.filter((part) => part.role === "branch");
    // l1 + l2 = jedna větev (stejné tlačítko), l3 bez ovládání = vlastní větev
    expect(branches).toHaveLength(2);
    expect(branches.every((part) => part.cable === LIGHT_CABLE_3)).toBe(true);
    const dali = topology(nodes, ["l1", "l2"], [{ switchId: "t", lightId: "l1" }, { switchId: "t", lightId: "l2" }], { t: "1" }, "bus_loxone", "CYKY-J 5x1,5");
    expect(dali.legs.every((part) => part.cable === LIGHT_CABLE_5)).toBe(true);
  });

  it("výkaz kabeláže: okruh světel má rozpad vodorovně + svislé svody + rezerva = celkem", () => {
    const nodes = [node("s", 3000, 0, 1200), node("l", 3000, 2000, 2600)];
    const summary = summarizeCabling({
      circuits: [{ id: "l1", label: "Světla – Obývací pokoj", cable: "CYKY-J 3x1,5", nodeIds: ["l"], kind: "lighting", phases: 1, crossSectionMm2: 1.5, protection: { device: "MCB", poles: "1P", curve: "B", ratedA: 10 } }],
      nodes,
      panel,
      profile,
      selected: "TOP",
      switchLinks: [{ switchId: "s", lightId: "l" }],
      switchNos: { s: "1" },
      installation: "classic",
    });
    const circuit = summary.circuits[0];
    expect(circuit.breakdown).toBeTruthy();
    const { horizontalM, verticalM, reserveM, totalM } = circuit.breakdown!;
    expect(horizontalM).toBe(5);
    expect(verticalM).toBe(3.9);
    expect(Math.round((horizontalM + verticalM + reserveM) * 10) / 10).toBe(totalM);
    expect(breakdownText(circuit.breakdown!)).toMatch(/^Vodorovně po stěnách \/ stropu 5,0 m \+ svislé svody k vypínačům a rozváděči 3,9 m \+ rezerva \d+,\d m = celkem \d+,\d m$/);
    // Svod k vypínači už není samostatný CYKY-O ze stropní krabice – je součástí okruhu
    expect(summary.byCable.map((row) => row.cable)).toEqual(["CYKY-J 3×1,5"]);
    expect(routeBreakdown(circuit.route).totalM).toBe(circuit.lengthsM.TOP);
  });
});

const material = (patch: Partial<QuoteMaterial> = {}): QuoteMaterial => ({ key: "k", name: "Zásuvka", code: "6619A-A06357 B", quantity: 10, unit: "ks", section: "floorplan", listPriceCzk: 200, priceSource: "ceník výrobce", ...patch });
const options = (patch: Partial<QuoteOptions> = {}): QuoteOptions => ({
  scope: "complete",
  hourlyRate: 650,
  construction: "aac",
  discountPct: 0,
  vatRate: 12,
  layout: "items",
  number: "NAB-2026-0001",
  issuedAt: "2026-11-12",
  validityDays: 14,
  customer: { name: "Jan Novák", ico: null },
  supplier: { name: "Elektro Tester s.r.o.", ico: "12345678" },
  title: "Elektroinstalace RD Novák",
  ...patch,
});

describe("fáze 105 – cenová nabídka", () => {
  it("normohodiny NH-2026.11 podle zadání", () => {
    expect(NH_VERSION).toBe("NH-2026.11");
    const nh = Object.fromEntries(NH_TASKS.map((task) => [task.id, task.nh]));
    expect(nh).toMatchObject({ "chase-light": 0.12, "chase-power": 0.16, "cable-dry": 0.06, box: 0.35, "box-deep": 0.4, "box-sdk": 0.18, device: 0.25, "device-data": 0.35, light: 0.45, "light-strip": 0.8, appliance: 0.75, "enclosure-s": 1.5, "enclosure-m": 2.5, "enclosure-l": 4, "din-1p": 0.25, "din-3p": 0.45, "din-smart": 0.65, "board-finish": 2, "test-circuit": 0.35, "test-report": 1.5 });
  });

  it("materiál z ceníkové ceny se slevou, práce z normohodin × sazba × koeficient stavby, DPH 12 %", () => {
    const work = { ...EMPTY_WORK, lightCableM: 100, devices: 10, circuits: 4 };
    const result = buildQuote([material()], work, options({ discountPct: 10, construction: "brick" }));
    const materialChapter = result.customer.chapters.find((chapter) => chapter.id === "material")!;
    expect(materialChapter.lines[0]).toMatchObject({ quantity: 10, unit: "ks", unitPriceCzk: 180, totalCzk: 1800 });
    const installation = result.customer.chapters.find((chapter) => chapter.id === "installation")!;
    // 100 m × 0,12 NH × 1,15 (plná cihla) × 650 Kč = 8 970 Kč
    expect(installation.lines.find((line) => line.unit === "m")).toMatchObject({ quantity: 100, totalCzk: 8970 });
    expect(installation.lines.find((line) => line.name.startsWith("Montáž a zapojení zásuvek"))).toMatchObject({ quantity: 10, unitPriceCzk: 162.5 });
    const testing = result.customer.chapters.find((chapter) => chapter.id === "testing")!;
    expect(testing.totalCzk).toBe(4 * 0.35 * 650 + 1.5 * 650);
    expect(result.customer.totals.vatRate).toBe(12);
    expect(result.customer.totals.withVatCzk).toBe(result.customer.totals.withoutVatCzk + Math.round(result.customer.totals.withoutVatCzk * 0.12));
    expect(result.internal.materialListCzk).toBe(2000);
    expect(result.internal.laborHours).toBeGreaterThan(10);
  });

  it("ve výstupu pro zákazníka není interní upozornění, ceníková cena, normohodina, NH ani rabat", () => {
    const work = { ...EMPTY_WORK, lightCableM: 50, devices: 4, lights: 3, din1p: 6, din3p: 2, enclosureModules: [48], circuits: 6 };
    const nhFuse = material({ key: "f", name: "Pojistkový odpínač NH00 3P", code: "NH00-3P", section: "switchboard", unit: "ks", quantity: 1, listPriceCzk: 1500 });
    for (const layout of ["items", "chapters"] as const) {
      const result = buildQuote([material(), nhFuse, material({ key: "x", listPriceCzk: null })], work, options({ layout }));
      const text = JSON.stringify(result.customer) + customerQuoteHtml(result.customer, "©") + JSON.stringify(customerQuoteRows(result.customer));
      for (const pattern of CUSTOMER_FORBIDDEN) expect(text, String(pattern)).not.toMatch(pattern);
      expect(text).not.toContain("Informace ke kalkulaci");
      expect(text).toContain("Dodávka elektroinstalačního materiálu");
      expect(text).toContain("Kompletace a zapojení rozváděče");
      expect(text).toContain("Zkoušky, měření a výchozí revize");
      // Položka bez ceny je interní upozornění, ne text v nabídce
      expect(result.internal.missingPrices.map((item) => item.key)).toEqual(["x"]);
    }
    expect(() => assertCustomerSafe({ ...buildQuote([], EMPTY_WORK, options()).customer, notes: ["Cena dle normohodin"] })).toThrow();
  });

  it("rozsah: jen půdorys / jen rozváděč, souhrnná nabídka po kapitolách", () => {
    const work = { ...EMPTY_WORK, lightCableM: 10, din1p: 4, enclosureModules: [24], circuits: 2 };
    const materials = [material(), material({ key: "b", section: "switchboard", name: "Jistič B16" })];
    expect(buildQuote(materials, work, options({ scope: "floorplan" })).customer.chapters.map((chapter) => chapter.id)).toEqual(["material", "installation", "testing"]);
    expect(buildQuote(materials, work, options({ scope: "switchboard" })).customer.chapters.map((chapter) => chapter.id)).toEqual(["material", "switchboard", "testing"]);
    const summary = buildQuote(materials, work, options({ layout: "chapters" })).customer;
    expect(summary.chapters.every((chapter) => chapter.lines.length === 1 && chapter.lines[0].unit === "kpl")).toBe(true);
  });

  it("kalibrace: skutečně odpracované hodiny upraví firemní koeficient", () => {
    const next = calibrateFromActual(DEFAULT_CALIBRATION, { plannedHours: 20, actualHours: 25 });
    expect(next.factor).toBe(1.25);
    expect(next.samples).toBe(1);
    const again = calibrateFromActual(next, { plannedHours: 25, actualHours: 25 });
    expect(again.factor).toBeCloseTo((1.25 + 1.25) / 2, 3);
  });
});

const lines: OrderLine[] = [
  { code: "6619A-A06357 B", ean: "8592624446804", name: "Zásuvka Tango bílá", manufacturer: "ABB", quantity: 6, unit: "ks" },
  { code: "KPR 68_KA", ean: "8595568936233", name: "Krabice přístrojová", manufacturer: "KOPOS", quantity: 12, unit: "ks" },
  { code: "6619A-A06357 B", ean: "8592624446804", name: "Zásuvka Tango bílá", manufacturer: "ABB", quantity: 2, unit: "ks" },
  { code: null, ean: null, name: "CYKY-J 3×1,5", quantity: 120, unit: "m" },
];

describe("fáze 105 – export poptávky do velkoobchodů", () => {
  it("Sonepar / ELKOV / K&V / DEK: sloupce s EAN / objednacím číslem a sečteným množstvím", () => {
    expect(wholesalerRows("sonepar", lines)).toEqual([
      ["Objednací číslo / EAN", "Množství", "Jednotka", "Poznámka"],
      ["8592624446804", 8, "ks", "6619A-A06357 B"],
      ["8595568936233", 12, "ks", "KPR 68_KA"],
      ["CYKY-J 3×1,5", 120, "m", "doplnit objednací číslo"],
    ]);
    expect(wholesalerRows("elkov", lines)[1]).toEqual(["8592624446804", 8]);
    expect(wholesalerRows("kv", lines)[0]).toEqual(["Objednací číslo", "EAN", "Název", "Množství", "Jednotka"]);
    expect(wholesalerRows("dek", lines)[2]).toEqual(["8595568936233", "KPR 68_KA", "KOPOS", "Krabice přístrojová", 12, "ks", ""]);
  });

  it("platné soubory CSV (středník, BOM), XLSX (ZIP) a XML; rychlý seznam a e-mail", () => {
    const file = wholesalerFile("sonepar", "csv", lines, { title: "RD Novák", createdAt: "2026-11-12" });
    expect(file.name).toBe("rd-novak-sonepar.csv");
    expect(String(file.content).startsWith("﻿Objednací číslo / EAN;Množství;Jednotka;Poznámka\r\n8592624446804;8;ks;")).toBe(true);
    const xlsx = wholesalerFile("kv", "xlsx", lines, { title: "RD Novák", createdAt: "2026-11-12" }).content as Uint8Array;
    expect([xlsx[0], xlsx[1]]).toEqual([0x50, 0x4b]);
    expect(orderXml(lines, { title: "RD & Novák", createdAt: "2026-11-12" })).toContain("<Quantity unit=\"ks\">8</Quantity>");
    expect(orderXml(lines, { title: "RD & Novák", createdAt: "2026-11-12" })).toContain("RD &amp; Novák");
    expect(quickOrderText(lines)).toBe("8592624446804\t8\n8595568936233\t12");
    expect(csv([["a;b", 1.5]])).toBe('﻿"a;b";1,5\r\n');
    const email = inquiryEmail("elkov", lines, { title: "RD Novák", company: "Elektro Tester s.r.o." });
    expect(email.subject).toBe("Poptávka materiálu – RD Novák");
    expect(email.body).toContain("ELKOV elektro");
    expect(email.mailto.startsWith("mailto:?subject=")).toBe(true);
  });

  it("označení kabelů ceníku a výkazu Eldocku se sjednotí", () => {
    expect(cableKey("Kabel CYKY-J 3 x 1,5 mm², kruh 100 m")).toBe("CYKY-J 3X1,5");
    expect(cableKey("CYKY-J 3×1,5")).toBe("CYKY-J 3X1,5");
    expect(cableKey("CAT7 / KNX J-Y(St)Y 2×2×0,8 (sběrnice 24 V DC)")).toBe(cableKey("Instalační kabel J-Y(ST)Y 2x2x0,8"));
    expect(cableKey("Vodič-lanko H07V-K 1,5 mm² (CYA), černý plášť")).toBe("H07V-K 1,5");
    expect(cableKey("Kabel CYKY 5 x 2,5 mm²")).toBeNull();
    expect(cableKey("1-CXKH-R-J 3×1,5 (B2ca)")).toBe("1-CXKH-R-J 3X1,5");
  });
});

describe("fáze 105 – Pseudo-3D náhled a kontrola výšek", () => {
  const el = (id: string, item: string, x: number, y: number, patch: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Kuchyně", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...patch });
  const kitchen = (): FloorplanDraft => ({
    ...emptyDraft(),
    rooms: [{ id: "k", name: "Kuchyně", x: 0, y: 0, w: 4000, h: 3000 }],
    elements: [el("linka", "arch-kitchen", 1300, 300), el("z1", "socket", 1000, 150), el("z2", "socket", 3800, 2500), el("s1", "switch-1", 3900, 1500), el("l1", "ceiling-light", 2000, 1500)],
  });

  it("scéna: stěny, nábytek s výškou, prvky ve skutečné výšce Z (zásuvka 300, vypínač, světlo u stropu)", () => {
    const scene = buildScene(kitchen());
    expect(scene.ceilingMm).toBe(2600);
    expect(scene.furniture).toEqual([expect.objectContaining({ type: "kitchen", height: 900 })]);
    const z = Object.fromEntries(scene.elements.map((element) => [element.id, element.z]));
    expect(z).toMatchObject({ z1: 300, z2: 300, l1: 2600, s1: kitchen().profile.defaultSwitchHeightMm });
    const projected = isoProject({ x: 100, y: 0, z: 1000 }, { rotation: 0, tilt: 0.6 }, { x: 0, y: 0 });
    expect(projected.y).toBeLessThan(isoProject({ x: 100, y: 0, z: 0 }, { rotation: 0, tilt: 0.6 }, { x: 0, y: 0 }).y);
  });

  it("zásuvka 300 mm za kuchyňskou linkou = varování a oprava „Zvýšit zásuvky u linky na 1150 mm“", () => {
    const issues = heightIssues(kitchen());
    const worktop = issues.find((issue) => issue.id === "worktop")!;
    expect(worktop.elementIds).toEqual(["z1"]);
    expect(worktop.fix).toEqual({ label: "Zvýšit zásuvky u linky na 1150 mm", heightMm: 1150 });
    const fixed = setHeights(kitchen(), worktop.elementIds, worktop.fix!.heightMm);
    expect(fixed.elements.find((element) => element.id === "z1")?.mountHeightMm).toBe(1150);
    expect(heightIssues(fixed).some((issue) => issue.id === "worktop")).toBe(false);
  });

  it("pohled na stěnu: severní stěna kuchyně s linkou a zásuvkou, výškové hladiny pravítka", () => {
    const north = elevationOf(kitchen(), "k", "N")!;
    expect(north.lengthMm).toBe(4000);
    expect(north.elements.map((element) => element.id)).toEqual(["z1"]);
    expect(north.furniture).toEqual([expect.objectContaining({ height: 900, width: 2600 })]);
    expect(elevationOf(kitchen(), "k", "E")!.elements.map((element) => element.id).sort()).toEqual(["s1", "z2"]);
    expect(wallOf(kitchen().rooms[0], "W")).toMatchObject({ length: 3000 });
    expect(HEIGHT_LEVELS.map((level) => level.mm)).toEqual([300, 900, 1150, 1200, 1500]);
  });
});

describe("fáze 105 – podklady nabídky a ceníky výrobců na serveru", () => {
  it("půdorys: silové kabely zvlášť (drážka 0,16 NH / m), krabice, přístroje, světla a okruhy", () => {
    expect(isPowerCable("CYKY-J 5×2,5")).toBe(true);
    expect(isPowerCable("CYKY-J 3×2,5")).toBe(false);
    expect(isPowerCable("CYKY-J 3×1,5")).toBe(false);
    const work = switchboardWork([{ protection: { device: "MCB", poles: "1P" } }, { protection: { device: "RCBO", poles: "1P+N" } }, { protection: { device: "MCB", poles: "3P" } }], { rcdGroups: 1, spd: true, mainSwitch: true });
    expect(work).toMatchObject({ din1p: 1, din3p: 5 });
    expect(work.enclosureModules[0]).toBeGreaterThanOrEqual(12);
  });

  it("ceníky jen na serveru: kabely Schrack za metr, krabice KOPOS, celé ceníky do klientských modulů nesmí", () => {
    expect(readFileSync(path.join(process.cwd(), "src/lib/quoting/list-prices.generated.ts"), "utf8")).toMatch(/^import "server-only";$/m);
    expect(cableListPrice("CYKY-J 3×1,5")).toMatchObject({ priceCzk: expect.any(Number), source: expect.stringContaining("Schrack") });
    expect(cableListPrice("CYKY-J 3×1,5")!.priceCzk).toBeGreaterThan(10);
    expect(cableListPrice("Neznámý kabel")).toBeNull();
    for (const file of ["src/components/quoting/QuoteWizardModal.tsx", "src/components/quoting/WholesalerExport.tsx", "src/components/panel-builder/EnclosureVisual.tsx", "src/components/panel-builder/floorplan/FloorplanPseudo3DModal.tsx", "src/lib/quoting/quote-engine.ts", "src/lib/quoting/quote-sources.ts"]) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/list-prices\.generated|etim-universal\.generated|brand-etim\.generated|abb-etim\.generated/);
    }
  });
});
