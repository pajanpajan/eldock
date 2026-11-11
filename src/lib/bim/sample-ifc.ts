// Fáze 95: vzorový BIM model výrobní haly ve formátu IFC4 (ISO 16739, STEP ISO 10303-21) – „✨ Vyzkoušet na vzorovém BIM
// souboru haly“ a podklad testů. Generuje se deterministicky (`public/samples/eldock-sample-plant.ifc` = výstup
// `samplePlantIfc()`, hlídá test). Hala H1 84,0 × 42,5 m: Rozvodna VN/NN, Kompresorovna, Velín údržby a Výrobní hala M1
// v 1. NP, Strojovna VZT ve 2. NP; zdroje TR1 630 kVA, DA1 250 kVA, UPS1 60 kVA; rozváděče HR1 1000 A, RM1 250 A
// a R-UPS 63 A (Pset_DistributionBoardCommon); stroje CNC frézka 45 kW, hydraulický lis 75 kW, šroubový kompresor
// 37 kW a VZT jednotka 18 kW; kabelové žlaby IfcCableCarrierSegment a kabely IfcCableSegment; napájení přes porty
// (IfcRelConnectsPorts), okruhy (IfcDistributionCircuit) i Revit „Panel“; zásuvky, svítidla (i nouzové), vypínač,
// tlačítko CENTRAL STOP, čidlo a pohon žaluzie ve velínu; okna a vrata haly.

export interface SampleIfcOptions {
  /** Délková jednotka souboru (test převodu MILLIMETRE / METRE). */
  units?: "MILLIMETRE" | "METRE";
}

/** Řetězec STEP: apostrof zdvojit, zpětné lomítko zdvojit, znaky mimo ASCII jako \X2\HHHH\X0\. */
export function stepText(text: string): string {
  let out = "";
  let wide = "";
  const flush = () => {
    if (wide) out += `\\X2\\${wide}\\X0\\`;
    wide = "";
  };
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code > 126 || code < 32) {
      for (let index = 0; index < char.length; index++) wide += char.charCodeAt(index).toString(16).toUpperCase().padStart(4, "0");
      continue;
    }
    flush();
    out += char === "'" ? "''" : char === "\\" ? "\\\\" : char;
  }
  flush();
  return `'${out}'`;
}

const GUID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

/** Deterministické IFC GlobalId (22 znaků) z pořadového čísla. */
function guid(seed: number): string {
  let x = (seed * 2654435761) >>> 0;
  let out = "3";
  for (let index = 0; index < 21; index++) {
    x = (x * 1103515245 + 12345 + index) >>> 0;
    out += GUID_CHARS[x % 64];
  }
  return out;
}

const num = (value: number) => {
  const text = Number.isInteger(value) ? `${value}.` : String(Math.round(value * 1e6) / 1e6);
  return text.includes(".") || text.includes("E") ? text : `${text}.`;
};

interface Writer {
  add(line: string): number;
  lines: string[];
}

function writer(): Writer {
  const lines: string[] = [];
  return {
    lines,
    add(line) {
      lines.push(`#${lines.length + 1}=${line};`);
      return lines.length;
    },
  };
}

export function samplePlantIfc(options: SampleIfcOptions = {}): string {
  const metre = options.units === "METRE";
  /** Délka [m] → jednotka souboru. */
  const L = (m: number) => num(metre ? m : m * 1000);
  const w = writer();
  let seed = 1;
  const id = () => stepText(guid(seed++));
  const ref = (n: number) => `#${n}`;
  const list = (items: number[]) => `(${items.map(ref).join(",")})`;

  // ── Kontext, jednotky, projekt ─────────────────────────────────────────
  const origin = w.add(`IFCCARTESIANPOINT((0.,0.,0.))`);
  const zDir = w.add(`IFCDIRECTION((0.,0.,1.))`);
  const xDir = w.add(`IFCDIRECTION((1.,0.,0.))`);
  const world = w.add(`IFCAXIS2PLACEMENT3D(${ref(origin)},${ref(zDir)},${ref(xDir)})`);
  const context = w.add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${ref(world)},$)`);
  const lengthUnit = w.add(metre ? `IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)` : `IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)`);
  const areaUnit = w.add(`IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)`);
  const powerUnit = w.add(`IFCSIUNIT(*,.POWERUNIT.,$,.WATT.)`);
  const currentUnit = w.add(`IFCSIUNIT(*,.ELECTRICCURRENTUNIT.,$,.AMPERE.)`);
  const voltageUnit = w.add(`IFCSIUNIT(*,.ELECTRICVOLTAGEUNIT.,$,.VOLT.)`);
  const units = w.add(`IFCUNITASSIGNMENT(${list([lengthUnit, areaUnit, powerUnit, currentUnit, voltageUnit])})`);
  const project = w.add(`IFCPROJECT(${id()},$,${stepText("ELDOCK-VZOR")},${stepText("Vzorový BIM model výrobního závodu pro import do ELDOCKu")},$,${stepText("Výrobní závod – vzorová hala H1")},$,(${ref(context)}),${ref(units)})`);

  // ── Placement ────────────────────────────────────────────────────────────
  const point = (x: number, y: number, z: number) => w.add(`IFCCARTESIANPOINT((${L(x)},${L(y)},${L(z)}))`);
  const point2 = (x: number, y: number) => w.add(`IFCCARTESIANPOINT((${L(x)},${L(y)}))`);
  const axis = (x: number, y: number, z: number, dir?: [number, number, number]) => {
    const location = point(x, y, z);
    const reference = dir ? w.add(`IFCDIRECTION((${dir.map(num).join(",")}))`) : xDir;
    return w.add(`IFCAXIS2PLACEMENT3D(${ref(location)},${ref(zDir)},${ref(reference)})`);
  };
  const local = (parent: number | null, x: number, y: number, z: number, dir?: [number, number, number]) => w.add(`IFCLOCALPLACEMENT(${parent ? ref(parent) : "$"},${ref(axis(x, y, z, dir))})`);

  const sitePlacement = local(null, 0, 0, 0);
  const site = w.add(`IFCSITE(${id()},$,${stepText("Areál")},$,$,${ref(sitePlacement)},$,${stepText("Areál Eldock – vzorový závod")},.ELEMENT.,$,$,$,$,$)`);
  // Budova posunutá v areálu o 20 m × 15 m (test hierarchie placementů)
  const buildingPlacement = local(sitePlacement, 20, 15, 0);
  const building = w.add(`IFCBUILDING(${id()},$,${stepText("H1")},${stepText("Výrobní a technologická hala")},$,${ref(buildingPlacement)},$,${stepText("Hala H1 – výroba a technologie")},.ELEMENT.,$,$,$)`);
  const storey1Placement = local(buildingPlacement, 0, 0, 0);
  const storey1 = w.add(`IFCBUILDINGSTOREY(${id()},$,${stepText("1. NP")},${stepText("Přízemí – výroba")},$,${ref(storey1Placement)},$,${stepText("1. nadzemní podlaží")},.ELEMENT.,${L(0)})`);
  const storey2Placement = local(buildingPlacement, 0, 0, 4.5);
  const storey2 = w.add(`IFCBUILDINGSTOREY(${id()},$,${stepText("2. NP")},${stepText("Technické podlaží")},$,${ref(storey2Placement)},$,${stepText("2. nadzemní podlaží")},.ELEMENT.,${L(4.5)})`);
  w.add(`IFCRELAGGREGATES(${id()},$,$,$,${ref(project)},(${ref(site)}))`);
  w.add(`IFCRELAGGREGATES(${id()},$,$,$,${ref(site)},(${ref(building)}))`);
  w.add(`IFCRELAGGREGATES(${id()},$,$,$,${ref(building)},(${ref(storey1)},${ref(storey2)}))`);

  // ── Vlastnosti ───────────────────────────────────────────────────────────
  type Prop = [name: string, value: string];
  const label = (text: string) => `IFCLABEL(${stepText(text)})`;
  const pset = (objects: number[], name: string, props: Prop[]) => {
    const values = props.map(([key, value]) => w.add(`IFCPROPERTYSINGLEVALUE(${stepText(key)},$,${value},$)`));
    const set = w.add(`IFCPROPERTYSET(${id()},$,${stepText(name)},$,${list(values)})`);
    w.add(`IFCRELDEFINESBYPROPERTIES(${id()},$,$,$,${list(objects)},${ref(set)})`);
  };

  // ── Tvary ────────────────────────────────────────────────────────────────
  const shape = (items: number[], identifier = "Body", type = "SweptSolid") => {
    const representation = w.add(`IFCSHAPEREPRESENTATION(${ref(context)},${stepText(identifier)},${stepText(type)},${list(items)})`);
    return representation;
  };
  const product = (representations: number[]) => w.add(`IFCPRODUCTDEFINITIONSHAPE($,$,${list(representations)})`);
  /** Kvádr w × h (osa X × Y) od rohu (0, 0) lokálního systému, výška z. */
  const box = (wM: number, hM: number, zM: number) => {
    const center = w.add(`IFCAXIS2PLACEMENT2D(${ref(point2(wM / 2, hM / 2))},$)`);
    const profile = w.add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${ref(center)},${L(wM)},${L(hM)})`);
    const solid = w.add(`IFCEXTRUDEDAREASOLID(${ref(profile)},${ref(axis(0, 0, 0))},${ref(zDir)},${L(zM)})`);
    return product([shape([solid])]);
  };
  /** Mnohoúhelník (lokální souřadnice od rohu) vytažený do výšky. */
  const polygonSolid = (points: [number, number][], zM: number) => {
    const pts = [...points, points[0]].map(([x, y]) => point2(x, y));
    const polyline = w.add(`IFCPOLYLINE(${list(pts)})`);
    const profile = w.add(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${ref(polyline)})`);
    const solid = w.add(`IFCEXTRUDEDAREASOLID(${ref(profile)},${ref(axis(0, 0, 0))},${ref(zDir)},${L(zM)})`);
    return product([shape([solid])]);
  };

  // ── Místnosti ────────────────────────────────────────────────────────────
  const spaces: { storey: number; ids: number[] }[] = [
    { storey: storey1, ids: [] },
    { storey: storey2, ids: [] },
  ];
  const space = (storeyIndex: 0 | 1, code: string, name: string, x: number, y: number, wM: number, hM: number, area: number, polygon?: [number, number][]) => {
    const parent = storeyIndex === 0 ? storey1Placement : storey2Placement;
    const placement = local(parent, x, y, 0);
    const representation = polygon ? polygonSolid(polygon, storeyIndex === 0 ? 4.5 : 3.5) : box(wM, hM, storeyIndex === 0 ? 4.5 : 3.5);
    const own = w.add(`IFCSPACE(${id()},$,${stepText(code)},$,$,${ref(placement)},${ref(representation)},${stepText(name)},.ELEMENT.,.INTERNAL.,$)`);
    const quantity = w.add(`IFCQUANTITYAREA(${stepText("NetFloorArea")},$,$,${num(area)},$)`);
    const quantities = w.add(`IFCELEMENTQUANTITY(${id()},$,${stepText("BaseQuantities")},$,$,(${ref(quantity)}))`);
    w.add(`IFCRELDEFINESBYPROPERTIES(${id()},$,$,$,(${ref(own)}),${ref(quantities)})`);
    spaces[storeyIndex].ids.push(own);
    return { id: own, placement };
  };
  space(0, "1.01", "Rozvodna VN/NN", 0, 0, 12, 10, 120);
  space(0, "1.02", "Kompresorovna", 0, 10, 12, 10, 120);
  const velin = space(0, "1.03", "Velín údržby", 0, 20, 12, 10, 120);
  // Výrobní hala jako obecný mnohoúhelník (IfcArbitraryClosedProfileDef)
  space(0, "1.04", "Výrobní hala M1", 12, 0, 72, 42.5, 3060, [
    [0, 0],
    [72, 0],
    [72, 42.5],
    [0, 42.5],
  ]);
  space(1, "2.01", "Strojovna VZT", 0, 0, 12, 10, 120);
  for (const own of spaces) w.add(`IFCRELAGGREGATES(${id()},$,$,$,${ref(own.storey)},${list(own.ids)})`);

  // ── Stěny, okna, vrata ───────────────────────────────────────────────────
  const storey1Elements: number[] = [];
  const storey2Elements: number[] = [];
  const wall = (name: string, x1: number, y1: number, x2: number, y2: number) => {
    const length = Math.hypot(x2 - x1, y2 - y1);
    const direction: [number, number, number] = [(x2 - x1) / length, (y2 - y1) / length, 0];
    const placement = local(storey1Placement, x1, y1, 0, direction);
    const axisLine = w.add(`IFCPOLYLINE((${ref(point2(0, 0))},${ref(point2(length, 0))}))`);
    const center = w.add(`IFCAXIS2PLACEMENT2D(${ref(point2(length / 2, 0))},$)`);
    const profile = w.add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${ref(center)},${L(length)},${L(0.3)})`);
    const solid = w.add(`IFCEXTRUDEDAREASOLID(${ref(profile)},${ref(axis(0, 0, 0))},${ref(zDir)},${L(8)})`);
    const representation = product([shape([axisLine], "Axis", "Curve2D"), shape([solid])]);
    storey1Elements.push(w.add(`IFCWALLSTANDARDCASE(${id()},$,${stepText(name)},$,$,${ref(placement)},${ref(representation)},$,.STANDARD.)`));
  };
  wall("Obvodová stěna jih", 0, 0, 84, 0);
  wall("Obvodová stěna východ", 84, 0, 84, 42.5);
  wall("Obvodová stěna sever", 84, 42.5, 0, 42.5);
  wall("Obvodová stěna západ", 0, 42.5, 0, 0);
  wall("Příčka rozvodny", 12, 0, 12, 30);
  for (const [index, x] of [24, 40, 56, 72].entries()) {
    const placement = local(storey1Placement, x, 0, 1.2);
    storey1Elements.push(w.add(`IFCWINDOW(${id()},$,${stepText(`Okno O${index + 1}`)},$,$,${ref(placement)},$,$,${L(1.8)},${L(3)},.WINDOW.,.SINGLE_PANEL.,$)`));
  }
  storey1Elements.push(w.add(`IFCDOOR(${id()},$,${stepText("Vrata V1 – vjezd do haly")},$,$,${ref(local(storey1Placement, 48, 42.5, 0, [-1, 0, 0]))},$,$,${L(4.5)},${L(4)},.GATE.,.SLIDING_TO_LEFT.,$)`));
  storey1Elements.push(w.add(`IFCDOOR(${id()},$,${stepText("Dveře rozvodny D1")},$,$,${ref(local(storey1Placement, 12, 5, 0, [0, 1, 0]))},$,$,${L(2.1)},${L(1.2)},.DOOR.,.SINGLE_SWING_LEFT.,$)`));

  // ── Elektro prvky ────────────────────────────────────────────────────────
  const ports = new Map<number, { source: number; sink: number }>();
  const element = (type: string, storeyIndex: 0 | 1, name: string, description: string | null, tag: string | null, predefined: string, x: number, y: number, z: number, parentPlacement?: number) => {
    const placement = local(parentPlacement ?? (storeyIndex === 0 ? storey1Placement : storey2Placement), x, y, z);
    const representation = box(0.8, 0.6, 2);
    const own = w.add(`${type}(${id()},$,${stepText(name)},${description ? stepText(description) : "$"},$,${ref(placement)},${ref(representation)},${tag ? stepText(tag) : "$"},.${predefined}.)`);
    (storeyIndex === 0 ? storey1Elements : storey2Elements).push(own);
    // Porty napájení: výstup (SOURCE) a vstup (SINK)
    const source = w.add(`IFCDISTRIBUTIONPORT(${id()},$,${stepText(`${tag ?? name} – výstup`)},$,$,$,$,.SOURCE.,.CABLE.,.ELECTRICAL.)`);
    const sink = w.add(`IFCDISTRIBUTIONPORT(${id()},$,${stepText(`${tag ?? name} – vstup`)},$,$,$,$,.SINK.,.CABLE.,.ELECTRICAL.)`);
    w.add(`IFCRELNESTS(${id()},$,$,$,${ref(own)},(${ref(source)},${ref(sink)}))`);
    ports.set(own, { source, sink });
    return own;
  };
  const watts = (kw: number) => `IFCPOWERMEASURE(${num(kw * 1000)})`;
  const amps = (a: number) => `IFCELECTRICCURRENTMEASURE(${num(a)})`;
  const volts = (v: number) => `IFCELECTRICVOLTAGEMEASURE(${num(v)})`;

  const tr1 = element("IFCTRANSFORMER", 0, "TR1", "Trafostanice 22/0,4 kV 630 kVA", "TR1", "VOLTAGE", 2, 2, 0);
  pset([tr1], "Pset_TransformerTypeCommon", [["RatedApparentPower", watts(630)], ["NominalVoltage", volts(400)], ["IP_Code", label("IP00")]]);
  const da1 = element("IFCELECTRICGENERATOR", 0, "DA1", "Dieselagregát 250 kVA (ATS do 15 s)", "DA1", "ENGINEGENERATOR", 9, 2, 0);
  pset([da1], "Pset_ElectricGeneratorTypeCommon", [["ApparentPower", watts(250)], ["NominalVoltage", volts(400)], ["IP_Code", label("IP23")]]);
  const ups1 = element("IFCELECTRICFLOWSTORAGEDEVICE", 0, "UPS1", "Centrální UPS 60 kVA pro velín", "UPS1", "UPS", 2, 2, 0, velin.placement);
  pset([ups1], "Pset_ElectricFlowStorageDeviceTypeCommon", [["ApparentPower", watts(60)], ["NominalVoltage", volts(400)], ["IP_Code", label("IP20")]]);
  const hr1 = element("IFCELECTRICDISTRIBUTIONBOARD", 0, "HR1", "Hlavní rozváděč 1000 A", "HR1", "SWITCHBOARD", 6, 8, 0);
  pset([hr1], "Pset_DistributionBoardCommon", [["Reference", label("HR1")], ["NominalCurrent", amps(1000)], ["NominalVoltage", volts(400)], ["NumberOfPoles", "IFCINTEGER(3)"], ["TotalConnectedLoad", watts(420)], ["IP_Code", label("IP54")]]);
  const rm1 = element("IFCELECTRICDISTRIBUTIONBOARD", 0, "RM1", "Podružný rozváděč lisovny 250 A", "RM1", "DISTRIBUTIONBOARD", 40, 2, 0);
  pset([rm1], "Pset_DistributionBoardCommon", [["Reference", label("RM1")], ["NominalCurrent", amps(250)], ["NominalVoltage", volts(400)], ["NumberOfPoles", "IFCINTEGER(3)"], ["TotalConnectedLoad", watts(120)], ["IP_Code", label("IP54")]]);
  const rUps = element("IFCELECTRICDISTRIBUTIONBOARD", 0, "R-UPS", "Kritický rozváděč velínu 63 A", "R-UPS", "DISTRIBUTIONBOARD", 9, 8, 0, velin.placement);
  pset([rUps], "Pset_DistributionBoardCommon", [["Reference", label("R-UPS")], ["NominalCurrent", amps(63)], ["NominalVoltage", volts(400)], ["NumberOfPoles", "IFCINTEGER(3)"], ["TotalConnectedLoad", watts(18)], ["IP_Code", label("IP41")], ["BackupTier", label("CRITICAL_UPS_ZIS")]]);

  const cnc = element("IFCELECTRICAPPLIANCE", 0, "CNC Frézka 45 kW", "5osé obráběcí centrum", "CNC-01", "USERDEFINED", 30, 20, 0);
  pset([cnc], "Pset_ElectricalDeviceCommon", [["RatedPower", watts(45)], ["NominalVoltage", volts(400)], ["NumberOfPoles", "IFCINTEGER(3)"], ["NominalCurrent", amps(80)], ["IP_Code", label("IP54")]]);
  const press = element("IFCELECTRICAPPLIANCE", 0, "Hydraulický lis 75 kW", "Lis 250 t", "LIS-01", "USERDEFINED", 55, 20, 0);
  pset([press], "Pset_ElectricalDeviceCommon", [["RatedPower", watts(75)], ["NominalVoltage", volts(400)], ["NumberOfPoles", "IFCINTEGER(3)"], ["NominalCurrent", amps(135)], ["IP_Code", label("IP54")]]);
  const compressor = element("IFCELECTRICAPPLIANCE", 0, "Šroubový kompresor 37 kW", "Kompresor 7,5 bar", "KOMP-01", "USERDEFINED", 6, 15, 0);
  // Revit: napájecí rozváděč a okruh jako parametry „Panel“ a „Circuit Number“, příkon česky
  pset([compressor], "Elektro (Revit)", [["Panel", label("HR1")], ["Circuit_Number", label("Q5")], ["Příkon", "IFCREAL(37.)"], ["Napětí", label("400 V 3f")], ["IP_Code", label("IP55")]]);
  const ahu = element("IFCUNITARYEQUIPMENT", 1, "VZT jednotka 18 kW", "Vzduchotechnika haly", "VZT-01", "AIRHANDLER", 6, 5, 0);
  pset([ahu], "Elektro (Revit)", [["Panel", label("HR1")], ["Circuit_Number", label("Q6")], ["Apparent_Load", "IFCREAL(20000.)"], ["RatedPower", watts(18)], ["Voltage", volts(400)]]);

  // Velín: zásuvky, svítidla, vypínač, CENTRAL STOP, čidlo a pohon žaluzie (pro 2D půdorys), napájené z R-UPS
  const small = (type: string, name: string, predefined: string, x: number, y: number, z: number) => {
    const own = w.add(`${type}(${id()},$,${stepText(name)},$,$,${ref(local(velin.placement, x, y, z))},$,$,.${predefined}.)`);
    storey1Elements.push(own);
    pset([own], "Elektro (Revit)", [["Panel", label("R-UPS")]]);
    return own;
  };
  small("IFCOUTLET", "Zásuvka 230 V", "POWEROUTLET", 1, 9.8, 0.3);
  small("IFCOUTLET", "Zásuvka 230 V", "POWEROUTLET", 4, 9.8, 0.3);
  small("IFCOUTLET", "Datová zásuvka RJ45", "DATAOUTLET", 6, 9.8, 0.3);
  small("IFCLIGHTFIXTURE", "Svítidlo LED 40 W", "POINTSOURCE", 3, 5, 3);
  small("IFCLIGHTFIXTURE", "Svítidlo LED 40 W", "POINTSOURCE", 9, 5, 3);
  small("IFCLIGHTFIXTURE", "Nouzové svítidlo EXIT", "SECURITYLIGHTING", 11.5, 1, 2.4);
  small("IFCSWITCHINGDEVICE", "Vypínač", "TOGGLESWITCH", 11.7, 0.6, 1.2);
  small("IFCSWITCHINGDEVICE", "Tlačítko CENTRAL STOP", "EMERGENCYSTOP", 11.7, 2, 1.5);
  small("IFCSENSOR", "Pohybové čidlo", "MOVEMENTSENSOR", 6, 5, 3);
  small("IFCACTUATOR", "Pohon žaluzie", "ELECTRICACTUATOR", 0.3, 5, 2.5);

  // ── Kabely a napájení (porty) ────────────────────────────────────────────
  const polyline3 = (points: [number, number, number][]) => w.add(`IFCPOLYLINE(${list(points.map(([x, y, z]) => point(x, y, z)))})`);
  const cable = (name: string, cableType: string, points: [number, number, number][]) => {
    const representation = product([shape([polyline3(points)], "Axis", "Curve3D")]);
    const own = w.add(`IFCCABLESEGMENT(${id()},$,${stepText(name)},$,$,${ref(local(storey1Placement, 0, 0, 0))},${ref(representation)},$,.CABLESEGMENT.)`);
    storey1Elements.push(own);
    pset([own], "Pset_CableSegmentOccurrence", [["CableType", label(cableType)]]);
    return own;
  };
  const connect = (from: number, to: number, via: number | null) => {
    w.add(`IFCRELCONNECTSPORTS(${id()},$,$,$,${ref(ports.get(from)!.source)},${ref(ports.get(to)!.sink)},${via ? ref(via) : "$"})`);
  };
  const w1 = cable("W1 TR1 → HR1", "4× 1-AYKY 3×240+120", [[2, 2, 0], [2, 2, -0.8], [6, 8, -0.8], [6, 8, 0]]);
  connect(tr1, hr1, w1);
  // HR1 → RM1 po kabelovém žlabu ve výšce 4 m (stoupání 4 m + 34 m + 6,5 m + sestup 4 m)
  const w2 = cable("W2 HR1 → RM1", "CYKY-J 4×120", [[6, 8, 2], [6, 8, 4], [6, 9.5, 4], [40, 9.5, 4], [40, 3, 4], [40, 3, 2]]);
  connect(hr1, rm1, w2);
  const w3 = cable("W3 DA1 → UPS1", "CYKY-J 5×35", [[9, 2, 0], [9, 2, -0.6], [2, 22, -0.6], [2, 22, 0]]);
  connect(da1, ups1, w3);
  const w4 = cable("W4 UPS1 → R-UPS", "CYKY-J 5×16", [[2, 22, 1], [2, 22, 3], [9, 28, 3], [9, 28, 1]]);
  connect(ups1, rUps, w4);

  // Okruhy RM1 (IfcDistributionCircuit + IfcRelAssignsToGroup) – stroje lisovny
  const circuit = (name: string, members: number[]) => {
    const own = w.add(`IFCDISTRIBUTIONCIRCUIT(${id()},$,${stepText(name)},$,$,$,.ELECTRICAL.)`);
    w.add(`IFCRELASSIGNSTOGROUP(${id()},$,$,$,${list(members)},$,${ref(own)})`);
  };
  const w5 = cable("W5 RM1 → CNC-01", "CYKY-J 5×25", [[40, 3, 2], [40, 3, 4], [30, 3, 4], [30, 20, 4], [30, 20, 1]]);
  circuit("RM1-Q1 CNC frézka", [rm1, cnc, w5]);
  const w6 = cable("W6 RM1 → LIS-01", "CYKY-J 5×50", [[40, 3, 2], [40, 3, 4], [55, 3, 4], [55, 20, 4], [55, 20, 1]]);
  circuit("RM1-Q2 hydraulický lis", [rm1, press, w6]);

  // ── Kabelové žlaby (IfcCableCarrierSegment) ──────────────────────────────
  const tray = (name: string, x: number, y: number, z: number, length: number, direction: [number, number, number], widthM: number, heightM: number) => {
    const placement = local(storey1Placement, x, y, z);
    const center = w.add(`IFCAXIS2PLACEMENT2D(${ref(point2(0, 0))},$)`);
    const profile = w.add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${ref(center)},${L(widthM)},${L(heightM)})`);
    const dir = w.add(`IFCDIRECTION((${direction.map(num).join(",")}))`);
    const solid = w.add(`IFCEXTRUDEDAREASOLID(${ref(profile)},${ref(axis(0, 0, 0))},${ref(dir)},${L(length)})`);
    const own = w.add(`IFCCABLECARRIERSEGMENT(${id()},$,${stepText(name)},$,$,${ref(placement)},${ref(product([shape([solid])]))},$,.CABLETRAYSEGMENT.)`);
    storey1Elements.push(own);
    pset([own], "Pset_CableCarrierSegmentTypeCableTraySegment", [["NominalWidth", `IFCPOSITIVELENGTHMEASURE(${L(widthM)})`], ["NominalHeight", `IFCPOSITIVELENGTHMEASURE(${L(heightM)})`]]);
    return own;
  };
  tray("Kabelový žlab KZ1 300×60 – rozvodna", 6, 9.5, 0.3, 3.7, [0, 0, 1], 0.3, 0.06);
  tray("Kabelový žlab KZ2 300×60 – páteř haly", 6, 9.5, 4, 34, [1, 0, 0], 0.3, 0.06);
  tray("Kabelový žlab KZ3 200×60 – lisovna", 40, 9.5, 4, 6.5, [0, -1, 0], 0.2, 0.06);
  // Lávka s osou jako 3D polyline (IfcPolyline v reprezentaci Axis)
  const ladder = w.add(
    `IFCCABLECARRIERSEGMENT(${id()},$,${stepText("Kabelová lávka KL1 400 – strojní řada")},$,$,${ref(local(storey1Placement, 0, 0, 0))},${ref(product([shape([polyline3([[30, 9.5, 4], [30, 30, 4], [60, 30, 4]])], "Axis", "Curve3D")]))},$,.CABLELADDERSEGMENT.)`,
  );
  storey1Elements.push(ladder);

  w.add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${id()},$,$,$,${list(storey1Elements)},${ref(storey1)})`);
  w.add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${id()},$,$,$,${list(storey2Elements)},${ref(storey2)})`);

  return [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');",
    `FILE_NAME('eldock-sample-plant.ifc','2026-11-11T00:00:00',('ELDOCK'),('Eldock'),${stepText("ELDOCK – generátor vzorového BIM modelu")},'ELDOCK','');`,
    "FILE_SCHEMA(('IFC4'));",
    "ENDSEC;",
    "DATA;",
    ...w.lines,
    "ENDSEC;",
    "END-ISO-10303-21;",
    "",
  ].join("\n");
}
