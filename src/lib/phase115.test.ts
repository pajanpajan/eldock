import { describe, expect, it } from "vitest";

import { COMB_ACCESSORY_SUBTYPES, CONFIG_FIELDS, configFields, isCombAccessory, matchConfig, type CatalogLike, type ItemConfig } from "@/lib/panel-builder/configurator";
import { combCuts, combFedIds, combForks, combLabel, combParts, combRuns, parseCombSettings, type CombDevice } from "@/lib/panel-builder/comb-busbars";
import { GLAND_CLEARANCE_MM, GLAND_NUT_MM, cncFitIssues, cncLayout, cutList, wireHarnessList, type CncDevice, type CncInput } from "@/lib/panel-builder/cnc-manufacturing-engine";
import { smartDinComponents } from "@/lib/panel-builder/smart-din-catalog";
import { SMART_SYSTEMS, planSmartHome } from "@/lib/panel-builder/smart-home";
import { thermalDevices } from "@/lib/panel-builder/thermal-input";
import { vectorLayout, wiringPaths } from "@/lib/panel-builder/vector-layout";
import { industryNav } from "@/lib/industry-nav";
import { REVISION_TABS, buildingSemaphore, revisionHref, revisionTabOf } from "@/lib/revision-hub";
import { calculateThermal } from "@/lib/thermalCalculation";

// Fáze 115: celá řada ABB-free@home na DIN lištu s Pv z ABB, hřebeny jen v záhlaví lišty a po skupinách chráničů bez
// duplicitních vodičů, CNC plán 1 : 1 bez přetečení a s vývodkami ve 2 řadách, centrum „📋 Revize & Plánovač“ a horní
// navigace v 5 sekcích.

const catalogRow = (articleNumber: string) => smartDinComponents().find((row) => row.articleNumber === articleNumber)!;

describe("fáze 115 – ABB-free@home na DIN lištu (ABB ETIM 9.0 a new.abb.com)", () => {
  it("SA-M-8.16.2.2 má Pv 8 W z datasheetu ABB (bez odhadu IEC) v katalogu i ve výpočtu oteplení", () => {
    const sa8 = catalogRow("2CDG510026R0011");
    expect(sa8).toMatchObject({ typeCode: "SA-M-8.16.2.2", modulesCount: 8, powerLossWatts: 8, lossEstimated: false, ean: "4053546111316", datasheetUrl: "https://new.abb.com/products/2CDG510026R0011" });
    const [device] = thermalDevices([{ id: "a1", designation: "-A1", circuitLabel: "Světla", parentItemId: null, phaseAssignment: null, operatingCurrentA: null, catalogComponent: { category: "PLC", poles: "1P", ratedCurrentA: 16, powerLossWatts: sa8.powerLossWatts!, typeCode: sa8.typeCode, description: sa8.description } }]);
    const thermal = calculateThermal([device], { heightMm: 600, widthMm: 400, depthMm: 120, installation: "WALL_MOUNTED", ambientTempC: 25, simultaneityFactor: 1, internalWiringLossW: 0 });
    expect(thermal.rows[0].ratedLossW).toBe(8);
    expect(thermal.deviceLossW).toBeCloseTo(8, 5);
  });

  it("ověřené kusy: SA-M 4× / 8× / 12×, DA/M 4× 6M / 6× 8M, PS-M 9 W, binární vstupy 4× 2M / 10× 4M, SysAP na DIN 6M", () => {
    expect(catalogRow("2CDG510025R0011")).toMatchObject({ modulesCount: 4, powerLossWatts: 4, lossEstimated: false, ean: "4053546111309" });
    expect(catalogRow("2CDG510027R0011")).toMatchObject({ modulesCount: 12, powerLossWatts: 12, ean: "4053546111330" });
    expect(catalogRow("2CKA006220A0729")).toMatchObject({ typeCode: "DA/M.4.210.2.1", modulesCount: 6, powerLossWatts: 2.3, lossEstimated: false, ean: "4011395251799" });
    expect(catalogRow("2CKA006220A0731")).toMatchObject({ typeCode: "DA/M.6.210.2.1", modulesCount: 8, powerLossWatts: 3.3, ean: "4011395252031" });
    expect(catalogRow("2CDG510001R0011")).toMatchObject({ typeCode: "PS-M-64.1.1", modulesCount: 4, powerLossWatts: 9, ean: "4016779941839" });
    expect(catalogRow("2CDG510015R0011")).toMatchObject({ typeCode: "BI-M-10.20.1.1", modulesCount: 4, powerLossWatts: 0.25 });
    const fah = SMART_SYSTEMS.find((system) => system.id === "abb_freeathome")!;
    expect(fah.modules.find((unit) => unit.id === "fah-sap-din")).toMatchObject({ modules: 6, manualOnly: true });
    // Typy ze zadání, které ABB nevede, v katalogu nejsou (žádné vymyšlené kusy)
    for (const missing of ["DA/M.6.315.2.1", "BI-M-2.24.1", "BI-M-8.24.1", "SU-M-4.2.1", "SU-M-4.4.1", "BA-M-4.230.2.1"]) expect(fah.modules.some((unit) => unit.typeCode === missing), missing).toBe(false);
    // Všechny Pv řady free@home s produktovou stránkou ABB jsou ověřené (kromě SysAP – výrobce Pv neuvádí)
    for (const unit of fah.modules.filter((entry) => entry.datasheetUrl?.startsWith("https://new.abb.com/") && entry.role !== "system")) expect(unit.lossFrom, unit.typeCode).toBe("manufacturer");
  });

  it("C3 „Počet kanálů / šířka“ nabízí jen existující kusy free@home a vybere skutečný katalogový kus", () => {
    const base = { category: "SMART_HOME", manufacturer: "ABB", smartSystem: "abb_freeathome" } as const;
    const labels = (smartRole: string) => configFields({ ...base, smartRole }).find((field) => field.key === "channels")!.options.map((option) => option.label);
    expect(labels("switch")).toEqual(["Libovolný", "4× (4M)", "8× (8M)", "12× (12M)"]);
    expect(labels("dim")).toEqual(["Libovolný", "4× (6M)", "6× (8M)"]);
    expect(labels("blind")).toEqual(["Libovolný", "4× (4M)", "8× (8M)"]);
    expect(labels("heating")).toEqual(["Libovolný", "6× (4M)", "12× (8M)"]);
    expect(labels("input")).toEqual(["Libovolný", "4× (2M)", "10× (4M)"]);
    const catalog: CatalogLike[] = smartDinComponents().map((row, index) => ({ id: `c${index}`, manufacturer: row.manufacturer, typeCode: row.typeCode, articleNumber: row.articleNumber, category: row.category, poles: row.poles, ratedCurrentA: row.ratedCurrentA, trippingCurve: null, breakingCapacityKa: null, rcdType: null, rcdSensitivityMa: null, spdType: null, surgeCurrentKa: null, contactConfig: null, coilVoltage: null, relaySubtype: null, moduleSubtype: row.moduleSubtype, modulesCount: row.modulesCount }));
    const pick = (smartRole: string, label: string) => {
      const option = configFields({ ...base, smartRole }).find((field) => field.key === "channels")!.options.find((entry) => entry.label === label)!;
      return matchConfig(catalog, { ...base, smartRole, poles: "1P", modules: 1, ratedCurrentA: null, ...option.patch } as ItemConfig);
    };
    expect(pick("switch", "8× (8M)")).toMatchObject({ typeCode: "SA-M-8.16.2.2", modulesCount: 8 });
    expect(pick("switch", "12× (12M)")).toMatchObject({ typeCode: "SA-M-12.16.2.2" });
    expect(pick("dim", "6× (8M)")).toMatchObject({ typeCode: "DA/M.6.210.2.1", modulesCount: 8 });
  });

  it("plánovač: 5 čidel = jeden 10násobný BI-M (4 M) místo dvou 4násobných", () => {
    const loads = Array.from({ length: 5 }, (_, index) => ({ id: `s${index}`, role: "input" as const, label: `Čidlo ${index}`, room: "Obývák", powerW: 0 }));
    const plan = planSmartHome({ system: "abb_freeathome", loads, busDevices: 5 });
    expect(plan.modules.filter((module) => module.role === "input").map((module) => module.typeCode)).toEqual(["BI-M-10.20.1.1"]);
  });
});

describe("fáze 115 – propojovací hřebeny po skupinách chráničů", () => {
  const device = (id: string, position: number, patch: Partial<CombDevice> = {}): CombDevice => ({ id, designation: `-${id.toUpperCase()}`, dinRailIndex: 1, positionOnRail: position, modulesWidth: 1, category: "MCB", poles: "1P", phaseAssignment: null, manufacturer: "ABB", ...patch });
  // Lišta: -FI1 4P + F1…F3, stykač ESB, F4 (také z -FI1), -FI2 4P + F5, F6, elektroměr, svorkovnice HLAK
  const devices = [
    device("fi1", 1, { category: "RCD", poles: "4P", modulesWidth: 4 }),
    device("f1", 2),
    device("f2", 3),
    device("f3", 4),
    device("k1", 5, { category: "CONTACTOR", poles: "4P", modulesWidth: 2 }),
    device("f4", 6),
    device("fi2", 7, { category: "RCD", poles: "4P", modulesWidth: 4 }),
    device("f5", 8),
    device("f6", 9),
    device("x2", 10, { category: "OTHER", moduleSubtype: undefined, modulesWidth: 4 } as Partial<CombDevice>),
    device("x1", 11, { category: "TERMINAL", modulesWidth: 4 }),
  ];
  const parent: Record<string, string | null> = { fi1: null, fi2: null, f1: "fi1", f2: "fi1", f3: "fi1", k1: "fi1", f4: "fi1", f5: "fi2", f6: "fi2", x2: null, x1: null };
  const nodes = devices.map((row) => ({ id: row.id, parentItemId: parent[row.id] }));

  it("každý chránič = samostatný úsek končící u posledního jističe skupiny, nikdy přes stykač, elektroměr ani svorkovnici", () => {
    const runs = combRuns(devices, nodes);
    expect(runs.map((run) => run.ids)).toEqual([
      ["fi1", "f1", "f2", "f3"],
      ["fi2", "f5", "f6"],
    ]);
    for (const run of runs) {
      expect(run.ids.filter((id) => devices.find((row) => row.id === id)!.category === "RCD")).toHaveLength(1);
      expect(run.ids).not.toContain("k1");
      expect(run.ids).not.toContain("x2");
      expect(run.ids).not.toContain("x1");
    }
    // 4P chránič + 1P jističe: hřeben 3f L1 L2 L3 bez vidličky na N
    expect(runs[0]).toMatchObject({ kind: "3P", conductors: ["L1", "L2", "L3"], input: false, modules: 7 });
    expect(combLabel(runs[0])).toBe("Hřeben 3f · L1 L2 L3");
    expect(combForks({ poles: "4P", category: "RCD" }, runs[0])).toEqual([0, 1, 2]);
    expect(combForks({ poles: "1P", category: "MCB" }, runs[0])).toEqual([0]);
  });

  it("3P+N jen pod řadou jističochráničů s pólem N; volba 3P+N pod 1P jističi zůstane 3P s poznámkou", () => {
    const rcbo = [0, 2, 4].map((position, index) => device(`fa${index + 1}`, position, { category: "RCBO", poles: "1P+N", modulesWidth: 2 }));
    const run = combRuns(rcbo, rcbo.map((row) => ({ id: row.id, parentItemId: "q1" })))[0];
    expect(run).toMatchObject({ kind: "3PN", conductors: ["L1", "L2", "L3", "N"], input: true, modules: 6 });
    expect(combLabel(run)).toBe("Hřeben 3P+N · L1 L2 L3 N");
    expect(combForks({ poles: "1P+N", category: "RCBO" }, run)).toEqual([0, 1]);
    const forced = combRuns(devices, nodes, { 1: "3PN" })[0];
    expect(forced).toMatchObject({ kind: "3P", conductors: ["L1", "L2", "L3"] });
    expect(forced.note).toContain("3P+N nelze");
    expect(combRuns(devices, nodes, { 1: "OFF" })).toEqual([]);
    expect(parseCombSettings({ 1: "3PN", 2: "OFF", 3: "1F" })).toEqual({ 1: "3PN", 2: "OFF", 3: "1P" });
  });

  it("jistič na hřebenu nemá modrou spojnici od chrániče; stykač a jistič za ním ano", () => {
    const runs = combRuns(devices, nodes);
    const fed = combFedIds(runs);
    expect([...fed].sort()).toEqual(["f1", "f2", "f3", "f5", "f6"]);
    const items = devices.map((row) => ({ id: row.id, designation: row.designation, dinRailIndex: row.dinRailIndex, positionOnRail: row.positionOnRail, modulesWidth: row.modulesWidth }));
    const tree = devices.map((row) => ({ id: row.id, parentItemId: parent[row.id], fedFromIncomer: !parent[row.id] }));
    const layout = vectorLayout(items, 1, 30);
    const drops = (combFed: Set<string>) => wiringPaths(layout, items, tree, "TOP", combFed).filter((wire) => wire.kind === "drop");
    const withComb = drops(fed);
    const target = (x: number) => items.find((item) => {
      const rect = layout.rects.get(item.id)!;
      return Math.abs(rect.x + rect.w / 2 - x) < 0.01;
    })?.id;
    expect(withComb.map((wire) => target(wire.points[0][0])).sort()).toEqual(["f4", "k1"]);
    // Bez hřebenu (drátováno vodiči) vede spojnice ke všem
    expect(drops(new Set()).length).toBe(7);
  });

  it("kusovník a nářez: ABB PS3/12 a 60pinový pro dlouhý úsek, 2 koncové krytky PS-END na úsek, jiný výrobce bez čísla", () => {
    const runs = combRuns(devices, nodes);
    expect(combParts(runs, devices)).toEqual([
      expect.objectContaining({ typeCode: "PS3/12", articleNumber: "2CDL230001R1012", quantity: 2, kind: "comb" }),
      expect.objectContaining({ typeCode: "PS-END", articleNumber: "2CDL200001R0001", quantity: 4, kind: "end" }),
    ]);
    const long = [device("fi", 0, { category: "RCD", poles: "4P", modulesWidth: 4 }), ...Array.from({ length: 12 }, (_, index) => device(`m${index}`, index + 1))];
    const longRuns = combRuns(long, long.map((row) => ({ id: row.id, parentItemId: row.id === "fi" ? null : "fi" })));
    expect(combParts(longRuns, long)[0]).toMatchObject({ typeCode: "PS3/60", articleNumber: "2CDL230001R1060", quantity: 1 });
    expect(combCuts(longRuns, long)[0]).toMatchObject({ pins: 16, lengthMm: Math.round(16 * 17.6), item: "Hřeben ABB PS3/60 (2CDL230001R1060) – zkrátit na 16 pinů" });
    const oez = devices.map((row) => ({ ...row, manufacturer: "OEZ" }));
    expect(combParts(combRuns(oez, nodes), oez).every((part) => part.articleNumber === "–" && part.manufacturer === "OEZ")).toBe(true);
  });

  it("hřeben a koncovka hřebenu nejsou v kaskádě vkládání na lištu", () => {
    const options = CONFIG_FIELDS.ACCESSORY[0].options.map((option) => option.value);
    for (const subtype of COMB_ACCESSORY_SUBTYPES) expect(options).not.toContain(subtype);
    expect(options).toContain("TERMINAL_BLOCK");
    expect(isCombAccessory({ category: "ACCESSORY", moduleSubtype: "BUSBAR" })).toBe(true);
    expect(isCombAccessory({ category: "ACCESSORY", moduleSubtype: "BUSBAR_END_CAP" })).toBe(true);
    expect(isCombAccessory({ category: "ACCESSORY", moduleSubtype: "AUX_CONTACT" })).toBe(false);
  });
});

describe("fáze 115 – CNC vrtací plán 1 : 1 bez přetečení", () => {
  const device = (patch: Partial<CncDevice> & Pick<CncDevice, "id" | "designation">): CncDevice => ({ category: "MCB", poles: "1P", modules: 1, ratedCurrentA: 16, rail: 1, position: 0, parentId: null, ...patch });
  // Kabel vývodu má každý třetí jistič (ostatní jsou rezerva / slaboproud po sběrnici)
  const fill = (rail: number, modules: number, prefix: string) => Array.from({ length: modules }, (_, index) => device({ id: `${prefix}${rail}-${index}`, designation: `-F${rail}${index}`, rail, position: index, cable: index % 3 === 0 ? "CYKY-J 3×1,5" : null }));
  const base = (patch: Partial<CncInput>): CncInput => ({
    name: "Test",
    enclosure: { manufacturer: "ABB", model: "ComfortLine CA25V (2 pole po 12 M)", rows: 5, modulesPerRow: 24, widthMm: 600, heightMm: 950, depthMm: 160 },
    devices: [],
    supplyCable: "CYKY-J 5×16",
    entry: "top",
    mounting: "surface",
    door: { centralStop: false, phaseLamps: false, meter: false, ventilation: false },
    ...patch,
  });

  it("2 pole vedle sebe: Pole A vlevo, Pole B vpravo, nic za pravým ani dolním okrajem desky", () => {
    const devices = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((rail) => fill(rail, 12, "d"));
    const layout = cncLayout(base({ devices, fields: { count: 2, aRails: 4 } }));
    expect(layout.fields).toBe(2);
    expect(layout.columns).toHaveLength(2);
    const a = layout.rails.filter((rail) => rail.field === 0);
    const b = layout.rails.filter((rail) => rail.field === 1);
    expect(a.map((rail) => rail.index).slice(0, 4)).toEqual([1, 2, 3, 4]);
    expect(b.map((rail) => rail.index).slice(0, 4)).toEqual([5, 6, 7, 8]);
    expect(Math.min(...b.map((rail) => rail.x1))).toBeGreaterThan(Math.max(...a.map((rail) => rail.x2)));
    for (const rail of layout.rails) expect(rail.lengthMm).toBe(Math.round(12 * 17.5 + 20));
    expect(cncFitIssues(layout)).toEqual([]);
    expect(layout.warnings).toEqual([]);
    expect(layout.ducts.filter((duct) => duct.kind === "vertical")).toHaveLength(3);
  });

  it("široké lišty 24M v úzké skříni: deska se zvětší s upozorněním, přístroje zůstanou na desce", () => {
    const devices = [1, 2, 3].flatMap((rail) => fill(rail, 24, "w"));
    const layout = cncLayout(base({ devices, enclosure: { manufacturer: "ABB", model: "Mistral65 54M", rows: 3, modulesPerRow: 18, widthMm: 400, heightMm: 550, depthMm: 120 } }));
    expect(cncFitIssues(layout)).toEqual([]);
    expect(layout.plate.widthMm).toBeGreaterThanOrEqual(24 * 17.5 + 20);
    expect(layout.warnings.join(" ")).toContain("zvolte širší skříň");
  });

  it("vývodky: víc než jedna řada = 2 šachovnicové řady (rozteč ≥ matice + 8 mm), přebytek slaboproudu do dolního čela", () => {
    const cabled = (count: number) => Array.from({ length: count }, (_, index) => device({ id: `c${index}`, designation: `-F${index + 1}`, rail: 1 + Math.floor(index / 18), position: index % 18, cable: "CYKY-J 3×1,5" }));
    const enclosure = { manufacturer: "ABB", model: "Mistral65 54M", rows: 3, modulesPerRow: 18, widthMm: 500, heightMm: 620, depthMm: 140 };
    const noOverlap = (layout: ReturnType<typeof cncLayout>) => {
      expect(cncFitIssues(layout)).toEqual([]);
      for (const side of ["top", "bottom"] as const) {
        const list = layout.glands.filter((gland) => gland.side === side);
        for (const [index, a] of list.entries()) {
          for (const b of list.slice(index + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual((GLAND_NUT_MM[a.size] + GLAND_NUT_MM[b.size]) / 2 + GLAND_CLEARANCE_MM - 0.05);
        }
      }
    };
    // 20 vývodů + přívod: horní čelo ve 2 řadách, druhá řada posunutá
    const two = cncLayout(base({ devices: cabled(20), enclosure }));
    const top = two.glands.filter((gland) => gland.side === "top");
    expect(new Set(top.map((gland) => gland.row))).toEqual(new Set([0, 1]));
    expect(top.find((gland) => gland.row === 1)!.x).not.toBe(top.find((gland) => gland.row === 0)!.x);
    expect(two.glands.some((gland) => gland.side === "bottom")).toBe(false);
    noOverlap(two);
    // 40 vývodů + 6 sběrnic: nad 2 řady → slaboproud a část vývodů do dolního čela, nic se nepřekrývá
    const split = cncLayout(base({ devices: cabled(40), busCables: 6, enclosure }));
    expect(Math.max(...split.glands.filter((gland) => gland.side === "top").map((gland) => gland.row))).toBeLessThanOrEqual(1);
    expect(split.glands.some((gland) => gland.side === "bottom" && gland.role === "bus")).toBe(true);
    expect(split.glands.find((gland) => gland.role === "supply")!.side).toBe("top");
    expect(split.warnings).toEqual([]);
    noOverlap(split);
  });

  it("drátovací a nářezový list: hřeben pod chráničem s jističi na téže liště místo vodičů, 2 koncové krytky", () => {
    const devices = [
      device({ id: "q1", designation: "-Q1", category: "MAIN_SWITCH", poles: "3P+N", modules: 4, ratedCurrentA: 40, manufacturer: "ABB" }),
      device({ id: "fi1", designation: "-FI1", category: "RCD", poles: "4P", modules: 4, ratedCurrentA: 40, rail: 2, position: 0, parentId: "q1", manufacturer: "ABB" }),
      device({ id: "f1", designation: "-F1", rail: 2, position: 4, parentId: "fi1", manufacturer: "ABB" }),
      device({ id: "f2", designation: "-F2", rail: 2, position: 5, parentId: "fi1", manufacturer: "ABB" }),
      device({ id: "f3", designation: "-F3", rail: 2, position: 6, parentId: "fi1", manufacturer: "ABB" }),
    ];
    const input = base({ devices, enclosure: { manufacturer: "ABB", model: "Mistral65 54M", rows: 3, modulesPerRow: 18, widthMm: 500, heightMm: 620, depthMm: 140 } });
    const wires = wireHarnessList(input);
    const comb = wires.find((row) => row.kind === "comb")!;
    expect(comb).toMatchObject({ comb: "Hřeben ABB PS3/12 (2CDL230001R1012) – zkrátit na 7 pinů", from: "-FI1 … -F3", to: "propojovací hřeben (L1 L2 L3)", lengthMm: Math.round(7 * 17.6) });
    expect(wires.filter((row) => row.kind === "wire" && /^-F[123] :/.test(row.to))).toHaveLength(0);
    // N chrániče na můstek N1
    expect(wires.find((row) => row.from === "-FI1 : N-out")).toMatchObject({ to: "Sběrnice N1 : Svorka 1" });
    const cuts = cutList(cncLayout(input), wires);
    expect(cuts.find((item) => item.item.startsWith("Hřeben ABB PS3/12"))).toMatchObject({ pieces: 1 });
    expect(cuts.find((item) => item.item === "Koncová krytka ABB PS-END (2CDL200001R0001)")).toMatchObject({ pieces: 2, lengthMm: 0 });
  });
});

describe("fáze 115 – průmysl: Revize & Plánovač a navigace v 5 sekcích", () => {
  it("záložky centra revizí, adresa s filtrem budovy a semafor budov", () => {
    expect(REVISION_TABS.map((tab) => tab.id)).toEqual(["chytra", "lhutnik", "spotrebice", "ticr"]);
    expect(REVISION_TABS[0].label).toBe("🧠 Chytrá revize & Plánovač výjezdů");
    expect(revisionTabOf("lhutnik")).toBe("lhutnik");
    expect(revisionTabOf("nic")).toBe("chytra");
    expect(revisionHref("/revize", "chytra", null)).toBe("/revize");
    expect(revisionHref("/revize", "lhutnik", "b1")).toBe("/revize?tab=lhutnik&budova=b1");
    expect(revisionHref("/plant/p1?faze=4", "ticr", null)).toBe("/plant/p1?faze=4&tab=ticr");
    const semaphore = buildingSemaphore(
      [
        { buildingId: "a", state: "VALID" },
        { buildingId: "a", state: "EXPIRING" },
        { buildingId: "b", state: "FAILED" },
        { buildingId: "b", state: "VALID" },
      ],
      [
        { id: "a", name: "Hala A – Lisovna" },
        { id: "b", name: "Hala B – Montáž" },
        { id: "c", name: "Sklad" },
      ],
    );
    expect(semaphore).toEqual([
      { id: "a", name: "Hala A – Lisovna", valid: 1, expiring: 1, expired: 0, missing: 0, status: "amber" },
      { id: "b", name: "Hala B – Montáž", valid: 1, expiring: 0, expired: 1, missing: 0, status: "red" },
      { id: "c", name: "Sklad", valid: 0, expiring: 0, expired: 0, missing: 0, status: "none" },
    ]);
  });

  it("horní navigace: 5 sekcí, revize na jednom místě, všechny dřívější stránky dostupné", () => {
    const sections = industryNav("plant-jbc");
    expect(sections.map((section) => `${section.emoji} ${section.label}`)).toEqual(["🗺️ Areál & Budovy", "⚡ Rozváděče & Stroje", "📐 Schémata & Červenka", "📋 Revize & Hlídač", "⚙️ Správa & Účty"]);
    const hrefs = sections.flatMap((section) => section.links.map((link) => link.href));
    for (const href of ["/cae", "/portal-projektantu", "/inspections", "/hlidac-revizi", "/inspections/planner", "/inspections/rapid", "/inspections/audit-report", "/inspections/ticr", "/studio", "/admin/modules", "/admin/users"]) expect(hrefs, href).toContain(href);
    const revize = sections.find((section) => section.id === "revize")!;
    expect(revize.links[0].href).toBe("/revize");
    // Bez závodu žádné odkazy do závodu
    expect(industryNav(null).flatMap((section) => section.links).some((link) => link.href.startsWith("/plant/"))).toBe(false);
  });
});
