import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { emptyDraft, parseDraft } from "@/lib/panel-builder/floorplan-editor";

import { bimToFloorplan } from "../bim-floorplan";
import { toPlantPayload } from "../bim-payload";
import { bimToPlantPlan, zoneKindOf } from "../bim-plant";
import { bimSummary } from "../bim-summary";
import { IfcError, parseIfc } from "../ifc-parser";
import { samplePlantIfc, stepText } from "../sample-ifc";
import { decodeStepString } from "../step";

// Fáze 95: parser IFC (ISO 16739 / ISO 10303-21) nad vzorovým modelem haly `public/samples/eldock-sample-plant.ifc`.

const SAMPLE_PATH = path.join(process.cwd(), "public", "samples", "eldock-sample-plant.ifc");
const model = parseIfc(readFileSync(SAMPLE_PATH, "utf8"));
const tagged = (tag: string) => model.electrical.find((element) => element.tag === tag)!;
const tagOf = (id: number | null) => model.electrical.find((element) => element.id === id)?.tag ?? null;

describe("fáze 95 – parser IFC: jednotky, diakritika, stavební část", () => {
  it("vzorový soubor v repozitáři odpovídá generátoru a je čisté ASCII (diakritika jako \\X2\\…\\X0\\)", () => {
    const text = readFileSync(SAMPLE_PATH, "utf8");
    expect(text).toBe(samplePlantIfc());
    expect(/[^\n\x20-\x7e]/.test(text)).toBe(false);
    expect(model.schema).toBe("IFC4");
  });

  it("jednotky MILLIMETRE i METRE dávají stejné rozměry v metrech", () => {
    const metre = parseIfc(samplePlantIfc({ units: "METRE" }));
    expect(model).toMatchObject({ lengthUnitM: 0.001, lengthUnitLabel: "MILLIMETRE" });
    expect(metre).toMatchObject({ lengthUnitM: 1, lengthUnitLabel: "METRE" });
    expect(model.bounds).toEqual({ x: 20, y: 15, w: 84, h: 42.5 });
    expect(metre.bounds).toEqual(model.bounds);
    expect(metre.spaces.map((space) => space.bounds)).toEqual(model.spaces.map((space) => space.bounds));
    expect(metre.carriers.map((carrier) => carrier.lengthM)).toEqual(model.carriers.map((carrier) => carrier.lengthM));
  });

  it("dekódování řetězců STEP: \\X2\\ (UTF-16), \\X\\ (ISO 8859-1), \\S\\, zdvojený apostrof", () => {
    expect(decodeStepString("P\\X2\\0159\\X0\\\\X2\\00ED\\X0\\kon")).toBe("Příkon");
    expect(decodeStepString("V\\X2\\00FD\\X0\\robn\\X2\\00ED\\X0\\ hala")).toBe("Výrobní hala");
    expect(decodeStepString("Caf\\X\\E9 ''U Vel\\S\\mna''")).toBe("Café 'U Velína'");
    expect(stepText("Velín údržby – R'1")).toBe("'Vel\\X2\\00ED\\X0\\n \\X2\\00FA\\X0\\dr\\X2\\017E\\X0\\by \\X2\\2013\\X0\\ R''1'");
    expect(model.project.name).toBe("Výrobní závod – vzorová hala H1");
    expect(model.spaces.map((space) => space.name)).toEqual(["Rozvodna VN/NN", "Kompresorovna", "Velín údržby", "Výrobní hala M1", "Strojovna VZT"]);
  });

  it("podlaží s kótou, místnosti s rozměrem X × Y (obdélník i mnohoúhelník), plochou a polohou z hierarchie placementů", () => {
    expect(model.storeys.map((storey) => [storey.name, storey.elevationM, storey.longName])).toEqual([
      ["1. NP", 0, "Přízemí – výroba"],
      ["2. NP", 4.5, "Technické podlaží"],
    ]);
    const hall = model.spaces.find((space) => space.code === "1.04")!;
    // Budova posunutá v areálu o 20 × 15 m, hala od X = 12 m budovy
    expect(hall).toMatchObject({ bounds: { x: 32, y: 15, w: 72, h: 42.5 }, areaM2: 3060, heightM: 4.5 });
    expect(hall.polygon).toHaveLength(5);
    expect(model.spaces.find((space) => space.code === "1.01")).toMatchObject({ bounds: { x: 20, y: 15, w: 12, h: 10 }, areaM2: 120 });
    expect(model.spaces.find((space) => space.code === "2.01")?.storeyId).toBe(model.storeys[1].id);
    expect(model.walls).toHaveLength(5);
    expect(model.walls[0]).toMatchObject({ start: { x: 20, y: 15 }, end: { x: 104, y: 15 }, thicknessM: 0.3 });
    expect(model.openings.filter((opening) => opening.kind === "window")).toHaveLength(4);
    expect(model.openings.find((opening) => opening.name.startsWith("Vrata"))).toMatchObject({ kind: "door", widthM: 4, heightM: 4.5, position: { x: 68, y: 57.5 } });
  });
});

describe("fáze 95 – parser IFC: elektro část, property sety a topologie napájení", () => {
  it("zdroje TR1 630 kVA, DA1 250 kVA a UPS1 60 kVA s úrovní zálohování", () => {
    expect(tagged("TR1")).toMatchObject({ kind: "transformer", backupTier: "GRID_STANDARD", props: { apparentPowerKva: 630, voltageV: 400, phases: 3 } });
    expect(tagged("DA1")).toMatchObject({ kind: "generator", backupTier: "BACKUP_GENERATOR_DA", props: { apparentPowerKva: 250 } });
    expect(tagged("UPS1")).toMatchObject({ kind: "ups", backupTier: "CRITICAL_UPS_ZIS", props: { apparentPowerKva: 60 } });
    expect(tagOf(tagged("UPS1").fedById)).toBe("DA1");
  });

  it("rozváděče HR1 / RM1 / R-UPS s In, příkonem, krytím z Pset_DistributionBoardCommon a napájením přes porty", () => {
    expect(tagged("HR1")).toMatchObject({ kind: "board", description: "Hlavní rozváděč 1000 A", props: { nominalCurrentA: 1000, powerKw: 420, voltageV: 400, phases: 3, ipRating: "IP54" } });
    expect(tagOf(tagged("HR1").fedById)).toBe("TR1");
    expect(tagged("RM1")).toMatchObject({ props: { nominalCurrentA: 250, powerKw: 120 }, backupTier: "GRID_STANDARD" });
    expect(tagOf(tagged("RM1").fedById)).toBe("HR1");
    // R-UPS: BackupTier z property setu, napájení z UPS1, poloha přes placement místnosti Velín
    expect(tagged("R-UPS")).toMatchObject({ props: { nominalCurrentA: 63, ipRating: "IP41" }, backupTier: "CRITICAL_UPS_ZIS", position: { x: 29, y: 43, z: 0 } });
    expect(tagOf(tagged("R-UPS").fedById)).toBe("UPS1");
    // Přívodní kabel z IfcRelConnectsPorts (RealizingElement)
    expect(model.carriers.find((carrier) => carrier.id === tagged("RM1").feederCableId)).toMatchObject({ name: "W2 HR1 → RM1", lengthM: 46, cableType: "CYKY-J 4×120" });
  });

  it("stroje: příkon z IfcPowerMeasure i z českého parametru, napájení z okruhu IfcDistributionCircuit a z Revit „Panel“", () => {
    expect(tagged("CNC-01")).toMatchObject({ kind: "machine", machineKind: "cnc", props: { powerKw: 45, nominalCurrentA: 80, circuit: "RM1-Q1 CNC frézka" } });
    expect(tagOf(tagged("CNC-01").fedById)).toBe("RM1");
    expect(tagged("LIS-01")).toMatchObject({ machineKind: "press", props: { powerKw: 75 } });
    expect(tagged("KOMP-01")).toMatchObject({ machineKind: "compressor", props: { powerKw: 37, voltageV: 400, phases: 3, circuit: "Q5", panel: "HR1", ipRating: "IP55" } });
    expect(tagOf(tagged("KOMP-01").fedById)).toBe("HR1");
    expect(tagged("VZT-01")).toMatchObject({ machineKind: "hvac", storeyId: model.storeys[1].id, props: { powerKw: 18, apparentPowerKva: 20 } });
    // Domovní přístroje velínu dědí zálohování UPS ze svého rozváděče
    const outlets = model.electrical.filter((element) => element.kind === "outlet");
    expect(outlets).toHaveLength(3);
    expect(outlets.filter((element) => element.data)).toHaveLength(1);
    expect(outlets.every((element) => tagOf(element.fedById) === "R-UPS" && element.backupTier === "CRITICAL_UPS_ZIS")).toBe(true);
    expect(model.electrical.filter((element) => element.emergency).map((element) => element.name)).toEqual(["Nouzové svítidlo EXIT", "Tlačítko CENTRAL STOP"]);
  });

  it("kabelové žlaby a lávka: 3D délka včetně stoupání, rozměr žlabu; kabely s typem", () => {
    const trays = model.carriers.filter((carrier) => carrier.kind === "tray" || carrier.kind === "ladder");
    expect(trays.map((carrier) => [carrier.kind, carrier.lengthM, carrier.widthMm])).toEqual([
      ["tray", 3.7, 300],
      ["tray", 34, 300],
      ["tray", 6.5, 200],
      ["ladder", 50.5, null],
    ]);
    // Svislý žlab KZ1 stoupá z 0,3 na 4,0 m
    expect(trays[0].points.map((point) => point.z)).toEqual([0.3, 4]);
    expect(model.carriers.filter((carrier) => carrier.kind === "cable").map((carrier) => carrier.lengthM)).toEqual([8.81, 46, 22.39, 13.22, 32, 37]);
  });

  it("souhrn pro okno kontroly: rozměr areálu, plochy, zdroje, rozváděče, stroje a metráž tras", () => {
    const summary = bimSummary(model);
    expect(summary).toMatchObject({ buildings: 1, storeys: 2, spaces: 5, areaM2: 3540, dimensions: "84,0 × 42,5 m", routes: { count: 4, meters: 94.7, cables: 6, cableMeters: 159.4 }, windows: 4, doors: 2 });
    expect(summary.sources.map((source) => `${source.tag} ${source.kva} kVA ${source.tier}`)).toEqual(["TR1 630 kVA Síť", "DA1 250 kVA DA", "UPS1 60 kVA UPS / ZIS"]);
    expect(summary.boards.map((board) => [board.tag, board.currentA, board.powerKw, board.ip, board.tier, board.fedFrom])).toEqual([
      ["HR1", 1000, 420, "IP54", "Síť", "TR1"],
      ["RM1", 250, 120, "IP54", "Síť", "HR1"],
      ["R-UPS", 63, 18, "IP41", "UPS / ZIS", "UPS1"],
    ]);
    expect(summary.machines.map((machine) => `${machine.tag} ${machine.powerKw}`)).toEqual(["CNC-01 45", "LIS-01 75", "KOMP-01 37", "VZT-01 18"]);
  });

  it("IFC2X3: rozváděč z IfcFlowController podle názvu, jednotky v metrech; neplatný soubor = srozumitelná chyba", () => {
    const ifc2x3 = [
      "ISO-10303-21;",
      "HEADER;FILE_DESCRIPTION((''),'2;1');FILE_NAME('a','',(''),(''),'','','');FILE_SCHEMA(('IFC2X3'));ENDSEC;",
      "DATA;",
      "#1=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);",
      "#2=IFCUNITASSIGNMENT((#1));",
      "#3=IFCPROJECT('0001',$,'Byt',$,$,$,$,$,#2);",
      "#4=IFCCARTESIANPOINT((2.5,1.,0.));",
      "#5=IFCAXIS2PLACEMENT3D(#4,$,$);",
      "#6=IFCLOCALPLACEMENT($,#5);",
      "#7=IFCFLOWCONTROLLER('0002',$,'RH1 Rozv\\X2\\00E1\\X0\\d\\X2\\011B\\X0\\\\X2\\010D\\X0\\ bytu',$,$,#6,$,$);",
      "#8=IFCBUILDINGSTOREY('0003',$,'1. NP',$,$,$,$,$,.ELEMENT.,0.);",
      "#9=IFCRELCONTAINEDINSPATIALSTRUCTURE('0004',$,$,$,(#7),#8);",
      "ENDSEC;END-ISO-10303-21;",
    ].join("\n");
    const flat = parseIfc(ifc2x3);
    expect(flat.schema).toBe("IFC2X3");
    expect(flat.electrical).toEqual([expect.objectContaining({ kind: "board", tag: "RH1", name: "RH1 Rozváděč bytu", position: { x: 2.5, y: 1, z: 0 }, storeyId: 8 })]);
    expect(() => parseIfc("toto není IFC")).toThrow(IfcError);
  });
});

describe("fáze 95 – převod BIM modelu do závodu a do 2D půdorysu", () => {
  it("závod: budova H1 84 × 43 m, podlaží 1. NP / 2. NP, místnosti, zdroje, rozváděče a stroje s napájením a údaji z BIMu", () => {
    const plan = bimToPlantPlan(toPlantPayload(model), { plantId: "p1", campus: { widthM: 400, depthM: 280 }, existingCodes: ["A", "B"], existingPolygons: ["4,4 30,4 30,30 4,30"] });
    const [building] = plan.concept.buildings;
    expect(plan.buildingCode).toBe("H1");
    expect(building.building).toMatchObject({ mode: "new", code: "H1", name: "Hala H1 – výroba a technologie", type: "PRODUCTION" });
    expect(building.grid).toMatchObject({ widthM: 84, depthM: 43, stepMeters: 6 });
    expect(building.floors.map((floor) => [floor.level, floor.usage, floor.zones.length])).toEqual([
      [0, "Přízemí – výroba", 4],
      [1, "Technické podlaží", 1],
    ]);
    // Sever nahoru: Rozvodna (Y 0–10 m od jihu) leží v rastru Studia dole (y = 42,5 − 10)
    expect(building.floors[0].zones.find((zone) => zone.name === "Rozvodna VN/NN")).toMatchObject({ x: 0, y: 32.5, w: 12, h: 10, kind: "ELECTRICAL" });
    expect(zoneKindOf("Kompresorovna")).toBe("FACILITIES");
    expect(zoneKindOf("Velín údržby")).toBe("OFFICE");
    const byTag = new Map(building.equipment.map((item) => [item.tag, item]));
    expect([...byTag.keys()]).toEqual(["TR1", "DA1", "UPS1", "HR1", "RM1", "R-UPS", "CNC-01", "LIS-01", "KOMP-01", "VZT-01"]);
    expect(byTag.get("TR1")).toMatchObject({ type: "TRANSFORMER", parent: null, powerBackupTier: "GRID_STANDARD" });
    expect(byTag.get("UPS1")).toMatchObject({ type: "TRANSFORMER", parent: null, powerBackupTier: "CRITICAL_UPS_ZIS" });
    expect(byTag.get("HR1")).toMatchObject({ type: "SWITCHBOARD", parent: { kind: "draft", key: byTag.get("TR1")!.key }, isRoot: false, name: "Hlavní rozváděč 1000 A" });
    expect(byTag.get("R-UPS")).toMatchObject({ parent: { kind: "draft", key: byTag.get("UPS1")!.key }, powerBackupTier: "CRITICAL_UPS_ZIS", zone: "Velín údržby" });
    expect(byTag.get("CNC-01")).toMatchObject({ type: "CNC_MACHINE", parent: { kind: "draft", key: byTag.get("RM1")!.key }, circuit: "RM1-Q1 CNC frézka", pos: { x: 30, y: 23 } });
    expect(byTag.get("KOMP-01")).toMatchObject({ type: "COMPRESSOR", circuit: "Q5" });
    expect(byTag.get("VZT-01")).toMatchObject({ type: "HVAC_UNIT", floor: { kind: "draft", key: building.floors[1].key } });
    expect(plan.details[byTag.get("HR1")!.key]).toMatchObject({ ratedCurrent: "1000 A", ratedVoltage: "400 V AC / 50 Hz", ipRating: "IP54", ratedPowerKw: 420, feederLengthM: 8.8, feederCableType: "4× 1-AYKY 3×240+120" });
    expect(plan.details[byTag.get("CNC-01")!.key]).toMatchObject({ ratedPowerKw: 45, nominalCurrentA: 80, feederLengthM: 32, feederCableType: "CYKY-J 5×25" });
    expect(plan.details[byTag.get("DA1")!.key]).toMatchObject({ backupCapacityKva: 250 });
    expect(plan.details[byTag.get("UPS1")!.key].description).toContain("Napájení podle BIMu: DA1.");
    // Budova se v areálu 400 × 280 m vejde vedle stávající (21 × 15,4 % mapy)
    expect(plan.concept.campus).toBeNull();
    expect(building.building.mode === "new" && building.building.map).toMatchObject({ w: 21, h: 15.4 });
  });

  it("2D půdorys: podlaží, plátno 1 : 1, místnosti s českými názvy, okna a dveře, rozváděče, zásuvky, svítidla a stroje", () => {
    const result = bimToFloorplan(model, emptyDraft());
    expect(result).toMatchObject({ floors: 2, rooms: 5 });
    const { draft } = result;
    expect(draft).toMatchObject({ floorName: "1. NP", widthMm: 86_000, heightMm: 44_500, background: null, cad: null });
    expect(draft.otherFloors.map((floor) => [floor.name, floor.levelMm, floor.rooms.map((room) => room.name)])).toEqual([["2. NP", 4500, ["Strojovna VZT"]]]);
    expect(draft.rooms.find((room) => room.name === "Velín údržby")).toMatchObject({ x: 1000, y: 13_500, w: 12_000, h: 10_000 });
    const items = draft.elements.map((element) => element.item);
    const count = (item: string) => items.filter((entry) => entry === item).length;
    expect([count("panel"), count("subpanel"), count("socket"), count("data-socket"), count("ceiling-light"), count("emergency-light"), count("switch-1"), count("pir"), count("blind-motor"), count("appliance")]).toEqual([1, 2, 2, 1, 2, 1, 1, 1, 1, 3]);
    expect([count("arch-window-hs"), count("arch-door-sliding"), count("arch-door-1")]).toEqual([4, 1, 1]);
    expect(draft.elements.filter((element) => element.item === "subpanel").map((element) => element.boardCode)).toEqual(["RM1", "R-UPS"]);
    expect(draft.elements.find((element) => element.item === "data-socket")).toMatchObject({ mountHeightMm: 300, room: "Velín údržby" });
    // Stroje = vlastní spotřebiče s příkonem a 3f jištěním (nad 32 A varování)
    expect(draft.appliances.find((spec) => spec.label === "CNC-01 CNC Frézka 45 kW")).toMatchObject({ powerW: 45_000, poles: 3, ratedA: 32, curve: "C" });
    expect(result.warnings.some((warning) => warning.startsWith("CNC-01: odběr 80 A"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("CENTRAL STOP"))).toBe(true);
    // Nákres projde parserem uložení (stejně jako po uložení na server)
    const parsed = parseDraft(JSON.parse(JSON.stringify(draft)))!;
    expect(parsed.rooms).toHaveLength(4);
    expect(parsed.elements).toHaveLength(draft.elements.length);
    expect(parsed.appliances).toHaveLength(4);
    expect(parsed.otherFloors[0].elements.map((element) => element.item)).toEqual(["appliance"]);
  });
});
