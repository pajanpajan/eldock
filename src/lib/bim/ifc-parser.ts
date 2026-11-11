// Fáze 95: parser BIM modelu IFC (ISO 16739 – IFC2X3, IFC4, IFC4X3) nad STEP Physical File (ISO 10303-21).
// Stavební část (projekt, areál, budovy, podlaží, místnosti s půdorysem, stěny, okna a dveře) a elektro část (zdroje,
// rozváděče, kabelové žlaby a kabely, stroje, svítidla, zásuvky, vypínače, čidla, pohony) s globální polohou XYZ
// z hierarchie IfcLocalPlacement, parametry z property setů (In, P, U, fáze, IP, označení, okruh), úrovní zálohování
// a topologií napájení (IfcRelConnectsPorts, IfcRelAssignsToGroup / IfcSystem, Revit „Panel“). Všechny délky v metrech.
// Čisté funkce – běží v prohlížeči (2D půdorys) i na serveru (import do Správy závodů).

import { isEnum, isRef, isTyped, readStep, type StepEntity, type StepFile, type StepValue } from "./step";

export type BimBackupTier = "GRID_STANDARD" | "BACKUP_GENERATOR_DA" | "CRITICAL_UPS_ZIS";

export type BimElectricalKind = "transformer" | "generator" | "ups" | "board" | "machine" | "light" | "outlet" | "switch" | "sensor" | "actuator";

export type BimMachineKind = "cnc" | "press" | "compressor" | "hvac" | "pump" | "motor" | "machine";

export interface BimPoint {
  x: number;
  y: number;
  z: number;
}

export interface BimRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BimBuilding {
  id: number;
  guid: string;
  name: string;
  longName: string | null;
}

export interface BimStorey {
  id: number;
  guid: string;
  name: string;
  /** Dlouhý název / popis podlaží („Přízemí – výroba“). */
  longName: string | null;
  /** Výšková kóta podlaží [m]. */
  elevationM: number;
  buildingId: number | null;
}

export interface BimSpace {
  id: number;
  guid: string;
  /** Kód / číslo místnosti (IfcSpace.Name, „1.02“). */
  code: string;
  /** Čitelný název (LongName, „Výrobní hala M1“), bez něj kód. */
  name: string;
  storeyId: number | null;
  /** Obrys v globálních souřadnicích [m] (≥ 3 body). */
  polygon: { x: number; y: number }[];
  bounds: BimRect;
  areaM2: number;
  heightM: number | null;
}

export interface BimWall {
  id: number;
  name: string;
  storeyId: number | null;
  start: { x: number; y: number };
  end: { x: number; y: number };
  thicknessM: number | null;
}

export interface BimOpening {
  id: number;
  kind: "window" | "door";
  name: string;
  storeyId: number | null;
  position: BimPoint;
  widthM: number | null;
  heightM: number | null;
  /** Natočení osy X prvku v půdorysu [°]. */
  angleDeg: number;
}

export interface BimElectricalProps {
  nominalCurrentA: number | null;
  powerKw: number | null;
  apparentPowerKva: number | null;
  voltageV: number | null;
  phases: 1 | 3 | null;
  ipRating: string | null;
  circuit: string | null;
  /** Revit „Panel“ – označení napájecího rozváděče u spotřebiče. */
  panel: string | null;
  cableType: string | null;
}

export interface BimElectricalElement {
  id: number;
  guid: string;
  ifcType: string;
  kind: BimElectricalKind;
  machineKind: BimMachineKind | null;
  /** Označení („RH1“, „R-UPS“, „-F1“). */
  tag: string;
  name: string;
  /** Popis z BIMu (IfcRoot.Description – „Hlavní rozváděč 1000 A“). */
  description: string | null;
  storeyId: number | null;
  spaceId: number | null;
  position: BimPoint;
  angleDeg: number;
  props: BimElectricalProps;
  backupTier: BimBackupTier;
  /** Napájecí prvek (id elektro prvku), null = kořen / neznámé. */
  fedById: number | null;
  /** Kabel (IfcCableSegment) napájení z nadřazeného prvku, když ho model přiřazuje. */
  feederCableId: number | null;
  /** Nouzové svítidlo (EXIT / SAFETY), datová zásuvka, nouzové tlačítko CENTRAL STOP. */
  emergency: boolean;
  data: boolean;
  systems: string[];
}

export interface BimCarrier {
  id: number;
  guid: string;
  ifcType: string;
  kind: "tray" | "ladder" | "conduit" | "trunking" | "cable" | "fitting";
  name: string;
  storeyId: number | null;
  points: BimPoint[];
  /** Skutečná 3D délka úseku včetně stoupání [m]. */
  lengthM: number;
  widthMm: number | null;
  heightMm: number | null;
  cableType: string | null;
}

export interface BimModel {
  schema: string;
  /** Kolik metrů je jedna délková jednotka souboru (MILLIMETRE → 0,001). */
  lengthUnitM: number;
  lengthUnitLabel: string;
  project: { name: string; description: string | null };
  site: string | null;
  buildings: BimBuilding[];
  storeys: BimStorey[];
  spaces: BimSpace[];
  walls: BimWall[];
  openings: BimOpening[];
  electrical: BimElectricalElement[];
  carriers: BimCarrier[];
  /** Obálka stavby v půdorysu [m] (místnosti, stěny a prvky). */
  bounds: BimRect;
  warnings: string[];
}

// ---------------------------------------------------------------------------
//  Geometrie: placement → globální matice
// ---------------------------------------------------------------------------

type Vec = [number, number, number];

interface Frame3 {
  t: Vec;
  x: Vec;
  y: Vec;
  z: Vec;
}

const IDENTITY: Frame3 = { t: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec): Vec => {
  const length = Math.hypot(a[0], a[1], a[2]);
  return length > 1e-12 ? [a[0] / length, a[1] / length, a[2] / length] : [0, 0, 0];
};
/** Bod v souřadnicích rámu → nadřazený systém. */
const apply = (frame: Frame3, p: Vec): Vec => add(frame.t, add(add(scale(frame.x, p[0]), scale(frame.y, p[1])), scale(frame.z, p[2])));
const rotate = (frame: Frame3, v: Vec): Vec => add(add(scale(frame.x, v[0]), scale(frame.y, v[1])), scale(frame.z, v[2]));
const compose = (parent: Frame3, child: Frame3): Frame3 => ({ t: apply(parent, child.t), x: rotate(parent, child.x), y: rotate(parent, child.y), z: rotate(parent, child.z) });

const round = (value: number, digits = 3) => {
  const k = 10 ** digits;
  return Math.round(value * k) / k;
};

// ---------------------------------------------------------------------------
//  Klasifikace
// ---------------------------------------------------------------------------

const MACHINE_TYPES = new Set(["IFCELECTRICAPPLIANCE", "IFCELECTRICMOTOR", "IFCMOTORCONNECTION", "IFCUNITARYEQUIPMENT", "IFCPUMP", "IFCFAN", "IFCCHILLER", "IFCBOILER", "IFCCOMPRESSOR", "IFCAIRTOAIRHEATRECOVERY", "IFCCOOLINGTOWER", "IFCHEATEXCHANGER"]);
const CARRIER_TYPES = new Set(["IFCCABLECARRIERSEGMENT", "IFCCABLECARRIERFITTING", "IFCCABLESEGMENT", "IFCCABLEFITTING"]);
const GENERIC_TYPES = new Set(["IFCDISTRIBUTIONCONTROLELEMENT", "IFCFLOWCONTROLLER", "IFCBUILDINGELEMENTPROXY", "IFCFLOWTERMINAL", "IFCENERGYCONVERSIONDEVICE", "IFCFLOWSTORAGEDEVICE", "IFCDISTRIBUTIONELEMENT", "IFCFLOWSEGMENT", "IFCFLOWFITTING", "IFCFLOWMOVINGDEVICE", "IFCFURNISHINGELEMENT", "IFCDISTRIBUTIONFLOWELEMENT"]);
const BOARD_WORDS = /SWITCHBOARD|PANELBOARD|DISTRIBUTION\s*BOARD|DISTRIBUTIONBOARD|CONSUMER\s*UNIT|MOTORCONTROLCENTRE|ROZV[AÁ]D[EĚ]Č|ROZVODNICE|^(RM|RH|HR|RP|RS|HDR|R)[-\s.]?[A-Z0-9]/i;

/** Text bez diakritiky malými písmeny (porovnání názvů vlastností). */
const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\s_\-.]+/g, "");

export function machineKindOf(text: string, ifcType: string): BimMachineKind {
  const t = text.toLowerCase();
  if (/\bcnc\b|fr[eé]zk|soustruh|obr[aá]b[eě]c/i.test(t)) return "cnc";
  if (/\blis\b|lisovna|press/i.test(t)) return "press";
  if (/kompres|compressor/i.test(t) || ifcType === "IFCCOMPRESSOR") return "compressor";
  if (/vzt|vzduchotech|klimat|ventil[aá]tor|hvac|ahu|rekuper|chladi/i.test(t) || ["IFCFAN", "IFCUNITARYEQUIPMENT", "IFCCHILLER", "IFCBOILER", "IFCAIRTOAIRHEATRECOVERY", "IFCCOOLINGTOWER"].includes(ifcType)) return "hvac";
  if (/čerpad|cerpad|pump/i.test(t) || ifcType === "IFCPUMP") return "pump";
  if (/motor/i.test(t) || ifcType === "IFCELECTRICMOTOR" || ifcType === "IFCMOTORCONNECTION") return "motor";
  return "machine";
}

/** Úroveň zálohování podle textu (název, systém, vlastnost BackupTier). */
export function backupTierOf(text: string): BimBackupTier | null {
  if (/CRITICAL_UPS_ZIS|\bUPS\b|\bZIS\b|UPS[-_\s]|[-_\s]UPS|\bIT\s*ZIS/i.test(text)) return "CRITICAL_UPS_ZIS";
  if (/BACKUP_GENERATOR_DA|\bDA\d*\b|DIESEL|GENER[AÁ]TOR|\bGEN\b|DIESELAGREG/i.test(text)) return "BACKUP_GENERATOR_DA";
  if (/GRID_STANDARD/i.test(text)) return "GRID_STANDARD";
  return null;
}

// ---------------------------------------------------------------------------
//  Hodnoty vlastností
// ---------------------------------------------------------------------------

type PropValue = number | string | boolean;

interface UnitScales {
  length: number;
  power: number;
  current: number;
  voltage: number;
}

const PREFIX: Record<string, number> = { EXA: 1e18, PETA: 1e15, TERA: 1e12, GIGA: 1e9, MEGA: 1e6, KILO: 1e3, HECTO: 1e2, DECA: 1e1, DECI: 1e-1, CENTI: 1e-2, MILLI: 1e-3, MICRO: 1e-6, NANO: 1e-9 };

function unwrap(value: StepValue | undefined): PropValue | null {
  if (value === null || value === undefined || value === "*") return null;
  if (isTyped(value)) return unwrap(value.value);
  if (isEnum(value)) return value.enum;
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length ? unwrap(value[0]) : null;
  return null;
}

/** Číslo z hodnoty („45 kW“, „1000 A“, „400 V“, „45,5“). */
function numberIn(value: PropValue | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const match = /[-+]?\d+(?:[.,]\d+)?/.exec(value.replace(/\s(?=\d{3}\b)/g, ""));
  return match ? Number(match[0].replace(",", ".")) : null;
}

// ---------------------------------------------------------------------------
//  Parser
// ---------------------------------------------------------------------------

export class IfcError extends Error {}

/** Rozparsuje text souboru IFC na model stavby a elektro části. */
export function parseIfc(text: string): BimModel {
  let step: StepFile;
  try {
    step = readStep(text);
  } catch (error) {
    throw new IfcError(error instanceof Error ? error.message : "Soubor IFC se nepodařilo přečíst.");
  }
  return new IfcReader(step).model();
}

class IfcReader {
  private warnings: string[] = [];
  private units: UnitScales = { length: 1, power: 1, current: 1, voltage: 1 };
  private unitLabel = "METRE";
  private placements = new Map<number, Frame3>();
  private props = new Map<number, Map<string, { name: string; value: PropValue | null; type: string | null }>>();
  private typeOfElement = new Map<number, number>();
  private containedIn = new Map<number, number>();
  private aggregatedIn = new Map<number, number>();
  private groupsOf = new Map<number, number[]>();
  private nestedPorts = new Map<number, number[]>();

  constructor(private step: StepFile) {}

  private get(id: number | null | undefined): StepEntity | undefined {
    return id ? this.step.get(id) : undefined;
  }

  private ref(value: StepValue | undefined): StepEntity | undefined {
    return isRef(value) ? this.step.get(value.ref) : undefined;
  }

  private refs(value: StepValue | undefined): number[] {
    return Array.isArray(value) ? value.filter(isRef).map((item) => item.ref) : isRef(value) ? [value.ref] : [];
  }

  private str(value: StepValue | undefined): string | null {
    const raw = unwrap(value);
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }

  private num(value: StepValue | undefined): number | null {
    const raw = unwrap(value);
    return typeof raw === "number" ? raw : null;
  }

  // ── Jednotky ────────────────────────────────────────────────────────────
  private readUnits() {
    const project = this.get(this.step.idsOf("IFCPROJECT")[0]);
    const assignment = this.ref(project?.args[8]);
    const units = this.refs(assignment?.args[0]).map((id) => this.get(id)).filter((entity): entity is StepEntity => Boolean(entity));
    for (const unit of units) {
      if (unit.type === "IFCSIUNIT") {
        const kind = isEnum(unit.args[1]) ? unit.args[1].enum : "";
        const prefix = isEnum(unit.args[2]) ? (PREFIX[unit.args[2].enum] ?? 1) : 1;
        const name = isEnum(unit.args[3]) ? unit.args[3].enum : "";
        if (kind === "LENGTHUNIT" && name === "METRE") {
          this.units.length = prefix;
          this.unitLabel = isEnum(unit.args[2]) ? `${unit.args[2].enum}METRE` : "METRE";
        }
        if (kind === "POWERUNIT" && name === "WATT") this.units.power = prefix;
        if (kind === "ELECTRICCURRENTUNIT" && name === "AMPERE") this.units.current = prefix;
        if (kind === "ELECTRICVOLTAGEUNIT" && name === "VOLT") this.units.voltage = prefix;
      }
      if (unit.type === "IFCCONVERSIONBASEDUNIT" && isEnum(unit.args[1]) && unit.args[1].enum === "LENGTHUNIT") {
        const name = (this.str(unit.args[2]) ?? "").toUpperCase();
        const factor = this.ref(unit.args[3]);
        const base = this.ref(factor?.args[1]);
        const basePrefix = base && isEnum(base.args[2]) ? (PREFIX[base.args[2].enum] ?? 1) : 1;
        const value = this.num(factor?.args[0]);
        this.units.length = value ? value * basePrefix : name.includes("INCH") ? 0.0254 : name.includes("FOOT") ? 0.3048 : 1;
        this.unitLabel = name || "CONVERSION";
      }
    }
    if (!units.length) this.warnings.push("Soubor neuvádí jednotky (IfcUnitAssignment) – délky se berou v metrech.");
  }

  // ── Vztahy ──────────────────────────────────────────────────────────────
  private readRelations() {
    for (const id of this.step.idsOf("IFCRELDEFINESBYPROPERTIES")) {
      const rel = this.get(id)!;
      const definition = this.ref(rel.args[5]);
      if (!definition) continue;
      for (const object of this.refs(rel.args[4])) this.addPropertySet(object, definition);
    }
    for (const id of this.step.idsOf("IFCRELDEFINESBYTYPE")) {
      const rel = this.get(id)!;
      const type = isRef(rel.args[5]) ? rel.args[5].ref : null;
      if (!type) continue;
      for (const object of this.refs(rel.args[4])) this.typeOfElement.set(object, type);
    }
    // Vlastnosti typu (HasPropertySets) – instance je přepíše
    for (const [element, typeId] of this.typeOfElement) {
      const type = this.get(typeId);
      for (const psetId of this.refs(type?.args[5])) {
        const pset = this.get(psetId);
        if (pset) this.addPropertySet(element, pset, false);
      }
    }
    for (const id of this.step.idsOf("IFCRELCONTAINEDINSPATIALSTRUCTURE")) {
      const rel = this.get(id)!;
      const structure = isRef(rel.args[5]) ? rel.args[5].ref : null;
      if (!structure) continue;
      for (const element of this.refs(rel.args[4])) this.containedIn.set(element, structure);
    }
    for (const id of this.step.idsOf("IFCRELAGGREGATES")) {
      const rel = this.get(id)!;
      const parent = isRef(rel.args[4]) ? rel.args[4].ref : null;
      if (!parent) continue;
      for (const child of this.refs(rel.args[5])) this.aggregatedIn.set(child, parent);
    }
    for (const id of this.step.idsOf("IFCRELASSIGNSTOGROUP")) {
      const rel = this.get(id)!;
      const group = isRef(rel.args[6]) ? rel.args[6].ref : null;
      if (!group) continue;
      for (const object of this.refs(rel.args[4])) {
        const list = this.groupsOf.get(object) ?? [];
        list.push(group);
        this.groupsOf.set(object, list);
      }
    }
    // Porty: IFC4 IfcRelNests (prvek → porty), IFC2X3 IfcRelConnectsPortToElement
    for (const id of this.step.idsOf("IFCRELNESTS")) {
      const rel = this.get(id)!;
      const host = isRef(rel.args[4]) ? rel.args[4].ref : null;
      if (!host) continue;
      const ports = this.refs(rel.args[5]).filter((port) => this.step.typeOf(port) === "IFCDISTRIBUTIONPORT");
      if (ports.length) this.nestedPorts.set(host, [...(this.nestedPorts.get(host) ?? []), ...ports]);
    }
    for (const id of this.step.idsOf("IFCRELCONNECTSPORTTOELEMENT")) {
      const rel = this.get(id)!;
      const port = isRef(rel.args[4]) ? rel.args[4].ref : null;
      const host = isRef(rel.args[5]) ? rel.args[5].ref : null;
      if (port && host) this.nestedPorts.set(host, [...(this.nestedPorts.get(host) ?? []), port]);
    }
  }

  private addPropertySet(object: number, definition: StepEntity, override = true) {
    const own = this.props.get(object) ?? new Map();
    const put = (name: string | null, value: PropValue | null, type: string | null) => {
      if (!name) return;
      const key = plain(name);
      if (!override && own.has(key)) return;
      own.set(key, { name, value, type });
    };
    if (definition.type === "IFCPROPERTYSET") {
      for (const propId of this.refs(definition.args[4])) {
        const prop = this.get(propId);
        if (!prop) continue;
        const name = this.str(prop.args[0]);
        if (prop.type === "IFCPROPERTYSINGLEVALUE") put(name, unwrap(prop.args[2]), isTyped(prop.args[2]) ? prop.args[2].type : null);
        else if (prop.type === "IFCPROPERTYENUMERATEDVALUE") put(name, unwrap(prop.args[2]), null);
        else if (prop.type === "IFCPROPERTYBOUNDEDVALUE") put(name, unwrap(prop.args[2]) ?? unwrap(prop.args[3]), isTyped(prop.args[2]) ? prop.args[2].type : null);
      }
    }
    if (definition.type === "IFCELEMENTQUANTITY") {
      for (const quantityId of this.refs(definition.args[5])) {
        const quantity = this.get(quantityId);
        if (!quantity) continue;
        put(this.str(quantity.args[0]), unwrap(quantity.args[3]), quantity.type);
      }
    }
    this.props.set(object, own);
  }

  /** Vlastnost prvku podle jména (bez diakritiky, mezer a podtržítek; první nalezená z kandidátů). */
  private prop(object: number, names: readonly string[]) {
    const own = this.props.get(object);
    if (!own) return null;
    for (const name of names) {
      const found = own.get(plain(name));
      if (found && found.value !== null && found.value !== "") return found;
    }
    return null;
  }

  // ── Placement ───────────────────────────────────────────────────────────
  private point(value: StepValue | undefined): Vec | null {
    const entity = this.ref(value);
    if (!entity || entity.type !== "IFCCARTESIANPOINT" || !Array.isArray(entity.args[0])) return null;
    const coords = (entity.args[0] as StepValue[]).map((item) => (typeof item === "number" ? item : 0));
    return [coords[0] ?? 0, coords[1] ?? 0, coords[2] ?? 0];
  }

  private direction(value: StepValue | undefined): Vec | null {
    const entity = this.ref(value);
    if (!entity || entity.type !== "IFCDIRECTION" || !Array.isArray(entity.args[0])) return null;
    const ratios = (entity.args[0] as StepValue[]).map((item) => (typeof item === "number" ? item : 0));
    return norm([ratios[0] ?? 0, ratios[1] ?? 0, ratios[2] ?? 0]);
  }

  /** IfcAxis2Placement3D / 2D → rám (posun v metrech). */
  private axis(value: StepValue | undefined): Frame3 {
    const entity = this.ref(value);
    if (!entity) return IDENTITY;
    const location = this.point(entity.args[0]) ?? [0, 0, 0];
    const t = scale(location, this.units.length);
    if (entity.type === "IFCAXIS2PLACEMENT2D") {
      const ref = this.direction(entity.args[1]) ?? [1, 0, 0];
      const x = norm([ref[0], ref[1], 0]);
      return { t, x, y: [-x[1], x[0], 0], z: [0, 0, 1] };
    }
    const z = this.direction(entity.args[1]) ?? [0, 0, 1];
    const reference = this.direction(entity.args[2]) ?? (Math.abs(z[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0]);
    let x = norm(add(reference, scale(z, -dot(reference, z))));
    if (Math.hypot(...x) < 0.5) x = norm(cross([0, 1, 0], z));
    return { t, x, y: cross(z, x), z };
  }

  /** Globální rám IfcLocalPlacement (rekurzivně PlacementRelTo). */
  private placement(id: number | null, depth = 0): Frame3 {
    if (!id || depth > 64) return IDENTITY;
    const cached = this.placements.get(id);
    if (cached) return cached;
    const entity = this.get(id);
    let frame = IDENTITY;
    if (entity?.type === "IFCLOCALPLACEMENT") {
      const parent = isRef(entity.args[0]) ? this.placement(entity.args[0].ref, depth + 1) : IDENTITY;
      frame = compose(parent, this.axis(entity.args[1]));
    } else if (entity?.type === "IFCGRIDPLACEMENT") {
      if (this.warnings.length < 20) this.warnings.push(`#${id}: IfcGridPlacement – poloha vůči osám rastru se nevyhodnocuje.`);
    }
    this.placements.set(id, frame);
    return frame;
  }

  private placementOf(entity: StepEntity): Frame3 {
    return isRef(entity.args[5]) ? this.placement(entity.args[5].ref) : IDENTITY;
  }

  // ── Tvar: profil, extruze, osy ──────────────────────────────────────────
  /** 2D profil (lokální souřadnice profilu, metry). */
  private profile(value: StepValue | undefined): { x: number; y: number }[] | null {
    const entity = this.ref(value);
    if (!entity) return null;
    const unit = this.units.length;
    if (entity.type === "IFCRECTANGLEPROFILEDEF" || entity.type === "IFCROUNDEDRECTANGLEPROFILEDEF") {
      const xDim = (this.num(entity.args[3]) ?? 0) * unit;
      const yDim = (this.num(entity.args[4]) ?? 0) * unit;
      if (!xDim || !yDim) return null;
      const frame = this.axis(entity.args[2]);
      return [
        [-xDim / 2, -yDim / 2],
        [xDim / 2, -yDim / 2],
        [xDim / 2, yDim / 2],
        [-xDim / 2, yDim / 2],
      ].map(([px, py]) => {
        const p = apply(frame, [px, py, 0]);
        return { x: p[0], y: p[1] };
      });
    }
    if (entity.type === "IFCCIRCLEPROFILEDEF") {
      const radius = (this.num(entity.args[3]) ?? 0) * unit;
      const frame = this.axis(entity.args[2]);
      return Array.from({ length: 16 }, (_, index) => {
        const angle = (index / 16) * Math.PI * 2;
        const p = apply(frame, [Math.cos(angle) * radius, Math.sin(angle) * radius, 0]);
        return { x: p[0], y: p[1] };
      });
    }
    if (entity.type === "IFCARBITRARYCLOSEDPROFILEDEF" || entity.type === "IFCARBITRARYPROFILEDEFWITHVOIDS") return this.curve(entity.args[2]);
    return null;
  }

  /** Body 2D křivky (IfcPolyline, IfcIndexedPolyCurve, IfcCompositeCurve z polyline úseků). */
  private curve(value: StepValue | undefined, depth = 0): { x: number; y: number }[] | null {
    const entity = this.ref(value);
    if (!entity || depth > 8) return null;
    const unit = this.units.length;
    if (entity.type === "IFCPOLYLINE") {
      const points = this.refs(entity.args[0]).map((id) => this.point({ ref: id })).filter((p): p is Vec => p !== null);
      return points.map((p) => ({ x: p[0] * unit, y: p[1] * unit }));
    }
    if (entity.type === "IFCINDEXEDPOLYCURVE") {
      const list = this.ref(entity.args[0]);
      const coords = Array.isArray(list?.args[0]) ? (list!.args[0] as StepValue[]) : [];
      return coords.filter(Array.isArray).map((pair) => ({ x: Number((pair as StepValue[])[0] ?? 0) * unit, y: Number((pair as StepValue[])[1] ?? 0) * unit }));
    }
    if (entity.type === "IFCCOMPOSITECURVE") {
      const out: { x: number; y: number }[] = [];
      for (const segmentId of this.refs(entity.args[0])) {
        const segment = this.get(segmentId);
        const part = this.curve(segment?.args[2], depth + 1);
        if (part) out.push(...part);
      }
      return out.length ? out : null;
    }
    if (entity.type === "IFCTRIMMEDCURVE") return this.curve(entity.args[0], depth + 1);
    return null;
  }

  /** Tvar prvku: půdorysný obrys [m globálně], výška, osa (stěny, žlaby) a rozměr průřezu. */
  private shape(entity: StepEntity, frame: Frame3) {
    const result: { footprint: { x: number; y: number }[] | null; heightM: number | null; axis: BimPoint[] | null; extent: BimPoint[] | null; section: { w: number; h: number } | null } = { footprint: null, heightM: null, axis: null, extent: null, section: null };
    const definition = this.ref(entity.args[6]);
    if (!definition) return result;
    const points: Vec[] = [];
    for (const repId of this.refs(definition.args[2])) {
      const representation = this.get(repId);
      if (!representation) continue;
      const identifier = (this.str(representation.args[1]) ?? "").toLowerCase();
      for (const itemId of this.refs(representation.args[3])) {
        const item = this.get(itemId);
        if (!item) continue;
        if (identifier === "axis" && (item.type === "IFCPOLYLINE" || item.type === "IFCINDEXEDPOLYCURVE")) {
          const raw = item.type === "IFCPOLYLINE" ? this.refs(item.args[0]).map((id) => this.point({ ref: id })).filter((p): p is Vec => p !== null).map((p) => scale(p, this.units.length)) : (this.curve({ ref: itemId }) ?? []).map((p) => [p.x, p.y, 0] as Vec);
          result.axis = raw.map((p) => {
            const g = apply(frame, p);
            return { x: g[0], y: g[1], z: g[2] };
          });
          continue;
        }
        const solid = this.extruded(item, frame);
        if (solid) {
          if (!result.footprint || (identifier === "body" && solid.footprint.length)) result.footprint = solid.footprint;
          result.heightM = solid.heightM;
          result.section = solid.section;
          if (!result.axis && solid.axis) result.axis = solid.axis;
          // Počátek a konec extruze (i svislé – stoupací žlab)
          if (!result.extent) result.extent = solid.extent;
          continue;
        }
        if (item.type === "IFCMAPPEDITEM") {
          const source = this.ref(item.args[0]);
          const mapped = this.ref(source?.args[1]);
          const origin = this.axis(source?.args[0]);
          const target = this.ref(item.args[1]);
          const shift = target ? (this.point(target.args[2]) ?? [0, 0, 0]) : [0, 0, 0];
          const mappedFrame = compose(compose(frame, { ...IDENTITY, t: scale(shift as Vec, this.units.length) }), origin);
          for (const innerId of this.refs(mapped?.args[3])) {
            const inner = this.get(innerId);
            const innerSolid = inner ? this.extruded(inner, mappedFrame) : null;
            if (innerSolid && !result.footprint) {
              result.footprint = innerSolid.footprint;
              result.heightM = innerSolid.heightM;
              result.section = innerSolid.section;
            } else if (inner) this.collect(inner, points, 0);
          }
          continue;
        }
        this.collect(item, points, 0);
      }
    }
    // Obecná geometrie (B-rep, tesselace): obálka bodů v půdorysu
    if (!result.footprint && points.length >= 3) {
      const global = points.map((p) => apply(frame, scale(p, this.units.length)));
      const xs = global.map((p) => p[0]);
      const ys = global.map((p) => p[1]);
      const zs = global.map((p) => p[2]);
      const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      if (maxX - minX > 0.05 && maxY - minY > 0.05)
        result.footprint = [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
        ];
      result.heightM = Math.max(...zs) - Math.min(...zs) || null;
    }
    return result;
  }

  private extruded(item: StepEntity, frame: Frame3) {
    if (item.type !== "IFCEXTRUDEDAREASOLID" && item.type !== "IFCEXTRUDEDAREASOLIDTAPERED") return null;
    const profile = this.profile(item.args[0]);
    if (!profile || profile.length < 2) return null;
    const position = compose(frame, this.axis(item.args[1]));
    const direction = this.direction(item.args[2]) ?? [0, 0, 1];
    const depth = (this.num(item.args[3]) ?? 0) * this.units.length;
    const footprint = profile.map((p) => {
      const g = apply(position, [p.x, p.y, 0]);
      return { x: g[0], y: g[1] };
    });
    const profileEntity = this.ref(item.args[0]);
    const rect = profileEntity?.type === "IFCRECTANGLEPROFILEDEF" ? { w: (this.num(profileEntity.args[3]) ?? 0) * this.units.length, h: (this.num(profileEntity.args[4]) ?? 0) * this.units.length } : null;
    const start = apply(position, [0, 0, 0]);
    const end = apply(position, scale(direction, depth));
    const vertical = Math.abs(rotate(position, direction)[2]) > 0.7;
    return {
      footprint: vertical ? footprint : [],
      heightM: vertical ? depth * Math.abs(rotate(position, direction)[2]) : rect?.h ?? null,
      section: rect,
      // Vodorovně / šikmo vytažený profil = úsek trasy (žlab, kabel) od počátku po konec extruze
      axis: vertical ? null : [start, end].map((g) => ({ x: g[0], y: g[1], z: g[2] })),
      extent: [start, end].map((g) => ({ x: g[0], y: g[1], z: g[2] })),
    };
  }

  /** Souřadnice bodů pod položkou tvaru (B-rep, IfcPolygonalFaceSet) – lokálně v souřadnicích prvku. */
  private collect(entity: StepEntity, out: Vec[], depth: number) {
    if (depth > 6 || out.length > 20_000) return;
    if (entity.type === "IFCCARTESIANPOINT") {
      const p = this.point({ ref: entity.id });
      if (p) out.push(p);
      return;
    }
    if (entity.type === "IFCCARTESIANPOINTLIST3D" && Array.isArray(entity.args[0])) {
      for (const triple of entity.args[0] as StepValue[]) if (Array.isArray(triple)) out.push([Number(triple[0] ?? 0), Number(triple[1] ?? 0), Number(triple[2] ?? 0)]);
      return;
    }
    for (const arg of entity.args) {
      for (const id of this.refs(arg)) {
        const child = this.get(id);
        if (child) this.collect(child, out, depth + 1);
      }
      if (Array.isArray(arg)) for (const nested of arg) if (Array.isArray(nested)) for (const id of this.refs(nested)) {
        const child = this.get(id);
        if (child) this.collect(child, out, depth + 1);
      }
    }
  }

  // ── Prostorová struktura ────────────────────────────────────────────────
  private storeyOf(id: number, depth = 0): number | null {
    if (depth > 12) return null;
    const parent = this.containedIn.get(id) ?? this.aggregatedIn.get(id);
    if (!parent) return null;
    const type = this.step.typeOf(parent);
    if (type === "IFCBUILDINGSTOREY") return parent;
    return this.storeyOf(parent, depth + 1);
  }

  private buildingOf(id: number, depth = 0): number | null {
    if (depth > 12) return null;
    const parent = this.aggregatedIn.get(id) ?? this.containedIn.get(id);
    if (!parent) return null;
    return this.step.typeOf(parent) === "IFCBUILDING" ? parent : this.buildingOf(parent, depth + 1);
  }

  model(): BimModel {
    this.readUnits();
    this.readRelations();
    const projectEntity = this.get(this.step.idsOf("IFCPROJECT")[0]);
    const project = { name: this.str(projectEntity?.args[5]) ?? this.str(projectEntity?.args[2]) ?? "Projekt IFC", description: this.str(projectEntity?.args[3]) };
    const siteEntity = this.get(this.step.idsOf("IFCSITE")[0]);
    const site = siteEntity ? (this.str(siteEntity.args[7]) ?? this.str(siteEntity.args[2])) : null;
    const buildings: BimBuilding[] = this.step.idsOf("IFCBUILDING").map((id) => {
      const entity = this.get(id)!;
      return { id, guid: this.str(entity.args[0]) ?? "", name: this.str(entity.args[2]) ?? "Budova", longName: this.str(entity.args[7]) };
    });

    const storeys: BimStorey[] = this.step
      .idsOf("IFCBUILDINGSTOREY")
      .map((id) => {
        const entity = this.get(id)!;
        const elevation = this.num(entity.args[9]);
        const frame = this.placementOf(entity);
        const longName = this.str(entity.args[3]) ?? this.str(entity.args[7]);
        return { id, guid: this.str(entity.args[0]) ?? "", name: this.str(entity.args[2]) ?? this.str(entity.args[7]) ?? "Podlaží", longName, elevationM: round(elevation !== null ? elevation * this.units.length : frame.t[2]), buildingId: this.buildingOf(id) };
      })
      .sort((a, b) => a.elevationM - b.elevationM);

    const spaces: BimSpace[] = [];
    for (const id of this.step.idsOf("IFCSPACE")) {
      const entity = this.get(id)!;
      const frame = this.placementOf(entity);
      const shape = this.shape(entity, frame);
      if (!shape.footprint || shape.footprint.length < 3) {
        this.warnings.push(`Místnost ${this.str(entity.args[2]) ?? `#${id}`}: bez půdorysu (geometrie IfcSpace se nenačetla).`);
        continue;
      }
      const polygon = shape.footprint.map((p) => ({ x: round(p.x), y: round(p.y) }));
      const bounds = boundsOf(polygon);
      const quantity = this.prop(id, ["NetFloorArea", "GrossFloorArea", "Area", "Plocha"]);
      const area = numberIn(quantity?.value) ?? polygonArea(polygon);
      const code = this.str(entity.args[2]) ?? `${id}`;
      spaces.push({ id, guid: this.str(entity.args[0]) ?? "", code, name: this.str(entity.args[7]) ?? code, storeyId: this.storeyOf(id), polygon, bounds, areaM2: round(area, 2), heightM: shape.heightM ? round(shape.heightM) : null });
    }

    const walls: BimWall[] = [];
    for (const type of ["IFCWALL", "IFCWALLSTANDARDCASE", "IFCCURTAINWALL"]) {
      for (const id of this.step.idsOf(type)) {
        const entity = this.get(id)!;
        const frame = this.placementOf(entity);
        const shape = this.shape(entity, frame);
        let start: { x: number; y: number } | null = null;
        let end: { x: number; y: number } | null = null;
        if (shape.axis && shape.axis.length >= 2) {
          start = shape.axis[0];
          end = shape.axis[shape.axis.length - 1];
        } else if (shape.footprint && shape.footprint.length === 4) {
          // Obdélník: osa po delší straně uprostřed
          const [a, b, c, d] = shape.footprint;
          const ab = Math.hypot(b.x - a.x, b.y - a.y);
          const bc = Math.hypot(c.x - b.x, c.y - b.y);
          start = ab >= bc ? { x: (a.x + d.x) / 2, y: (a.y + d.y) / 2 } : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          end = ab >= bc ? { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 } : { x: (d.x + c.x) / 2, y: (d.y + c.y) / 2 };
        }
        if (!start || !end) continue;
        const thickness = shape.footprint && shape.footprint.length === 4 ? Math.min(...pairs(shape.footprint).map(([p, q]) => Math.hypot(q.x - p.x, q.y - p.y))) : null;
        walls.push({ id, name: this.str(entity.args[2]) ?? "Stěna", storeyId: this.storeyOf(id), start: { x: round(start.x), y: round(start.y) }, end: { x: round(end.x), y: round(end.y) }, thicknessM: thickness ? round(thickness) : null });
      }
    }

    const openings: BimOpening[] = [];
    for (const [type, kind] of [
      ["IFCWINDOW", "window"],
      ["IFCDOOR", "door"],
    ] as const) {
      for (const id of this.step.idsOf(type)) {
        const entity = this.get(id)!;
        const frame = this.placementOf(entity);
        const height = this.num(entity.args[8]);
        const width = this.num(entity.args[9]);
        openings.push({
          id,
          kind,
          name: this.str(entity.args[2]) ?? (kind === "window" ? "Okno" : "Dveře"),
          storeyId: this.storeyOf(id),
          position: { x: round(frame.t[0]), y: round(frame.t[1]), z: round(frame.t[2]) },
          widthM: width ? round(width * this.units.length) : null,
          heightM: height ? round(height * this.units.length) : null,
          angleDeg: round((Math.atan2(frame.x[1], frame.x[0]) * 180) / Math.PI, 1),
        });
      }
    }

    const { electrical, carriers } = this.electrical(spaces);
    const all = [...spaces.flatMap((space) => space.polygon), ...walls.flatMap((wall) => [wall.start, wall.end]), ...electrical.map((element) => element.position)];
    const bounds = all.length ? boundsOf(all) : { x: 0, y: 0, w: 0, h: 0 };
    if (!spaces.length) this.warnings.push("Model neobsahuje místnosti (IfcSpace) s půdorysem.");
    return { schema: this.step.schema, lengthUnitM: this.units.length, lengthUnitLabel: this.unitLabel, project, site, buildings, storeys, spaces, walls, openings, electrical, carriers, bounds: { x: round(bounds.x), y: round(bounds.y), w: round(bounds.w), h: round(bounds.h) }, warnings: this.warnings };
  }

  // ── Elektro ─────────────────────────────────────────────────────────────
  private electrical(spaces: BimSpace[]) {
    const electrical: BimElectricalElement[] = [];
    const carriers: BimCarrier[] = [];
    const seen = new Set<number>();
    const candidates: number[] = [];
    for (const type of ["IFCTRANSFORMER", "IFCELECTRICGENERATOR", "IFCELECTRICFLOWSTORAGEDEVICE", "IFCELECTRICDISTRIBUTIONBOARD", "IFCELECTRICDISTRIBUTIONPOINT", "IFCLIGHTFIXTURE", "IFCOUTLET", "IFCSWITCHINGDEVICE", "IFCSENSOR", "IFCACTUATOR", "IFCPROTECTIVEDEVICE", ...MACHINE_TYPES, ...CARRIER_TYPES, ...GENERIC_TYPES]) candidates.push(...this.step.idsOf(type));
    for (const id of candidates) {
      if (seen.has(id)) continue;
      seen.add(id);
      const entity = this.get(id);
      if (!entity) continue;
      const typeEntity = this.get(this.typeOfElement.get(id));
      const typeName = typeEntity?.type ?? "";
      const name = this.str(entity.args[2]) ?? "";
      const objectType = this.str(entity.args[4]) ?? "";
      const predefined = (isEnum(entity.args[8]) ? entity.args[8].enum : "") || (typeEntity && isEnum(typeEntity.args[9]) ? typeEntity.args[9].enum : "");
      const text = `${name} ${objectType} ${predefined} ${typeEntity ? (this.str(typeEntity.args[2]) ?? "") : ""}`;
      const frame = this.placementOf(entity);
      const ifcType = entity.type;
      // Kabelové trasy a kabely
      const carrierKind = carrierKindOf(ifcType, typeName, predefined, text);
      if (carrierKind) {
        const shape = this.shape(entity, frame);
        const points = shape.axis ?? shape.extent ?? [{ x: frame.t[0], y: frame.t[1], z: frame.t[2] }];
        const length = numberIn(this.prop(id, ["Length", "Délka", "Delka"])?.value) ?? null;
        const geometric = polylineLength(points);
        const lengthM = length !== null ? length * (this.prop(id, ["Length"])?.type === "IFCQUANTITYLENGTH" ? this.units.length : 1) : geometric;
        const width = numberIn(this.prop(id, ["NominalWidth", "Width", "Šířka", "Sirka"])?.value);
        const height = numberIn(this.prop(id, ["NominalHeight", "Height", "Výška", "Vyska"])?.value);
        carriers.push({
          id,
          guid: this.str(entity.args[0]) ?? "",
          ifcType,
          kind: carrierKind,
          name: name || (carrierKind === "cable" ? "Kabel" : "Kabelová trasa"),
          storeyId: this.storeyOf(id),
          points: points.map((p) => ({ x: round(p.x), y: round(p.y), z: round(p.z) })),
          lengthM: round(lengthM, 2),
          widthMm: width ? round(width * this.units.length * 1000, 0) : shape.section ? round(shape.section.w * 1000, 0) : null,
          heightMm: height ? round(height * this.units.length * 1000, 0) : shape.section ? round(shape.section.h * 1000, 0) : null,
          cableType: carrierKind === "cable" ? (this.propText(id, ["CableType", "Typ kabelu", "Cable", "Designation", "Označení kabelu"]) ?? (name || null)) : null,
        });
        continue;
      }
      const kind = electricalKindOf(ifcType, typeName, predefined, text);
      if (!kind) continue;
      const tag = this.propText(id, ["Tag", "Reference", "Mark", "Označení", "Oznaceni", "Panel_Name", "Panel Name", "Kód", "Kod"]) ?? this.str(entity.args[7]) ?? (tagFromName(name) || `${kind.toUpperCase()}-${id}`);
      const storeyId = this.storeyOf(id);
      const position = { x: round(frame.t[0]), y: round(frame.t[1]), z: round(frame.t[2]) };
      const container = this.containedIn.get(id);
      const spaceId = container && this.step.typeOf(container) === "IFCSPACE" ? container : (spaces.find((space) => (storeyId === null || space.storeyId === storeyId) && insidePolygon(position, space.polygon))?.id ?? null);
      const systems = (this.groupsOf.get(id) ?? []).map((group) => this.str(this.get(group)?.args[2]) ?? "").filter(Boolean);
      const props = this.electricalProps(id, kind, text);
      const explicit = backupTierOf(this.propText(id, ["BackupTier", "Zálohování", "Zalohovani", "PowerBackup"]) ?? "");
      electrical.push({
        id,
        guid: this.str(entity.args[0]) ?? "",
        ifcType,
        kind,
        machineKind: kind === "machine" ? machineKindOf(text, ifcType) : null,
        tag: cleanTag(tag),
        name: name || tag,
        description: this.str(entity.args[3]),
        storeyId,
        spaceId,
        position,
        angleDeg: round((Math.atan2(frame.x[1], frame.x[0]) * 180) / Math.PI, 1),
        props,
        backupTier: explicit ?? (kind === "ups" ? "CRITICAL_UPS_ZIS" : kind === "generator" ? "BACKUP_GENERATOR_DA" : (backupTierOf(`${tag} ${systems.join(" ")}`) ?? "GRID_STANDARD")),
        fedById: null,
        feederCableId: null,
        emergency: /EXIT|SAFETY|EMERGENCY|NOUZ|CENTRAL\s*STOP|TOTAL\s*STOP|\bNO[_\s-]?SV\b/i.test(`${text}`),
        data: kind === "outlet" && /DATA|TELEPHONE|RJ\s?45|COMMUNICATION|AUDIOVISUAL/i.test(`${predefined} ${name} ${objectType}`),
        systems,
      });
    }
    this.topology(electrical, carriers);
    return { electrical, carriers };
  }

  private propText(id: number, names: readonly string[]): string | null {
    const found = this.prop(id, names);
    if (!found) return null;
    const text = String(found.value).trim();
    return text || null;
  }

  private electricalProps(id: number, kind: BimElectricalKind, text: string): BimElectricalProps {
    const current = this.prop(id, ["NominalCurrent", "RatedCurrent", "Nominal_Current", "Rated Current", "Jmenovitý proud", "Jmenovity proud", "In", "Proud"]);
    const power = this.prop(id, ["RatedPower", "NominalPower", "ElectricalPower", "TotalConnectedLoad", "Příkon", "Prikon", "Power", "Výkon", "Vykon", "Load", "Instalovaný výkon"]);
    const apparent = this.prop(id, ["ApparentPower", "Apparent_Load", "Apparent Load", "RatedApparentPower", "Zdánlivý výkon", "Zdanlivy vykon"]);
    const voltage = this.prop(id, ["NominalVoltage", "RatedVoltage", "Voltage", "Napětí", "Napeti", "U"]);
    const poles = this.prop(id, ["NumberOfPoles", "Number_of_Poles", "Number of Poles", "Phases", "NumberOfPhases", "Počet fází", "Pocet fazi", "Fáze"]);
    const ip = this.propText(id, ["IP_Code", "IPCode", "IP", "IngressProtection", "Krytí", "Kryti", "IP krytí"]);
    const circuit = this.propText(id, ["Circuit_Number", "Circuit Number", "CircuitNumber", "Okruh", "Vývod", "Vyvod"]);
    const panel = kind === "board" || kind === "transformer" || kind === "generator" || kind === "ups" ? this.propText(id, ["FedFrom", "Napájeno z", "Napajeno z", "Supply", "Panel"]) : this.propText(id, ["Panel", "FedFrom", "Napájeno z", "Napajeno z"]);
    const cableType = this.propText(id, ["CableType", "Typ kabelu", "Přívodní kabel", "Prívodni kabel", "FeederCable"]);
    const asKw = (found: ReturnType<IfcReader["prop"]>, apparentPower = false): number | null => {
      if (!found) return null;
      const value = numberIn(found.value);
      if (value === null) return null;
      if (found.type && /POWERMEASURE/.test(found.type)) return (value * this.units.power) / 1000;
      const label = `${found.name} ${typeof found.value === "string" ? found.value : ""}`;
      if (apparentPower ? /kVA/i.test(label) : /kW/i.test(label)) return value;
      if (apparentPower ? /\bVA\b/i.test(label) : /\bW\b|watt/i.test(label)) return value / 1000;
      if (apparentPower ? /MVA/i.test(label) : /MW/i.test(label)) return value * 1000;
      return value >= 1000 ? value / 1000 : value;
    };
    const amps = (() => {
      const value = numberIn(current?.value);
      if (value === null) return null;
      return current?.type && /CURRENTMEASURE/.test(current.type) ? value * this.units.current : value;
    })();
    const volts = (() => {
      const value = numberIn(voltage?.value);
      if (value === null) return /400\s?V|3\s?[x×]\s?400|3f|3~|3\s?N/i.test(text) ? 400 : null;
      return voltage?.type && /VOLTAGEMEASURE/.test(voltage.type) ? value * this.units.voltage : value;
    })();
    const poleCount = numberIn(poles?.value);
    const phases: 1 | 3 | null = poleCount !== null ? (poleCount >= 3 ? 3 : 1) : volts !== null ? (volts >= 380 ? 3 : 1) : null;
    let powerKw = asKw(power);
    let kva = asKw(apparent, true);
    // Zdroje udávají výkon v kVA („TR1 630 kVA“) – z názvu, když property set chybí
    if (kva === null && (kind === "transformer" || kind === "generator" || kind === "ups")) {
      const match = /(\d+(?:[.,]\d+)?)\s*kVA/i.exec(text);
      if (match) kva = Number(match[1].replace(",", "."));
      if (kva === null && powerKw !== null && /kVA/i.test(power?.name ?? "")) kva = powerKw;
    }
    if (powerKw === null) {
      const match = /(\d+(?:[.,]\d+)?)\s*kW\b/i.exec(text);
      if (match) powerKw = Number(match[1].replace(",", "."));
    }
    const currentFromName = amps === null && kind === "board" ? /(\d{2,4})\s*A\b/.exec(text) : null;
    return {
      nominalCurrentA: amps !== null ? round(amps, 1) : currentFromName ? Number(currentFromName[1]) : null,
      powerKw: powerKw !== null ? round(powerKw, 2) : null,
      apparentPowerKva: kva !== null ? round(kva, 2) : null,
      voltageV: volts !== null ? round(volts, 0) : null,
      phases,
      ipRating: ip ? (/^IP/i.test(ip) ? ip.toUpperCase().replace(/\s+/g, "") : `IP${ip}`) : (/\bIP\s?(\d{2})\b/i.exec(text)?.[0].toUpperCase().replace(/\s+/g, "") ?? null),
      circuit,
      panel,
      cableType,
    };
  }

  /** Napájení: porty (zdroj → spotřebič), skupiny / systémy s jedním rozváděčem, Revit „Panel“ podle označení. */
  private topology(elements: BimElectricalElement[], carriers: BimCarrier[]) {
    const byId = new Map(elements.map((element) => [element.id, element]));
    const isSource = (element: BimElectricalElement) => element.kind === "board" || element.kind === "transformer" || element.kind === "generator" || element.kind === "ups";
    const cables = new Set(carriers.filter((carrier) => carrier.kind === "cable").map((carrier) => carrier.id));
    const portOwner = new Map<number, number>();
    for (const [host, ports] of this.nestedPorts) for (const port of ports) portOwner.set(port, host);
    // 1) IfcRelConnectsPorts: port SOURCE → port SINK (případně přes kabel)
    const links: { from: number; to: number; via: number | null }[] = [];
    for (const id of this.step.idsOf("IFCRELCONNECTSPORTS")) {
      const rel = this.get(id)!;
      const a = isRef(rel.args[4]) ? rel.args[4].ref : null;
      const b = isRef(rel.args[5]) ? rel.args[5].ref : null;
      if (!a || !b) continue;
      const flow = (port: number) => {
        const entity = this.get(port);
        return entity && isEnum(entity.args[7]) ? entity.args[7].enum : "";
      };
      const [source, sink] = flow(a) === "SINK" || flow(b) === "SOURCE" ? [b, a] : [a, b];
      const from = portOwner.get(source);
      const to = portOwner.get(sink);
      const via = isRef(rel.args[6]) ? rel.args[6].ref : null;
      if (from && to) links.push({ from, to, via });
    }
    // Kabel mezi dvěma porty: zdroj → kabel → spotřebič
    for (const link of links) {
      const from = byId.get(link.from);
      const to = byId.get(link.to);
      if (from && to && isSource(from) && to.fedById === null && from.id !== to.id) {
        to.fedById = from.id;
        if (link.via && cables.has(link.via)) to.feederCableId = link.via;
      }
      if (cables.has(link.to)) {
        const next = links.find((other) => other.from === link.to);
        const target = next ? byId.get(next.to) : undefined;
        if (from && target && isSource(from) && target.fedById === null) {
          target.fedById = from.id;
          target.feederCableId = link.to;
        }
      }
    }
    // 2) Skupiny / systémy (IfcSystem, IfcDistributionCircuit): jediný rozváděč skupiny napájí ostatní členy
    const members = new Map<number, number[]>();
    for (const [object, groups] of this.groupsOf) for (const group of groups) members.set(group, [...(members.get(group) ?? []), object]);
    for (const [group, list] of members) {
      const groupName = this.str(this.get(group)?.args[2]) ?? "";
      const inGroup = list.map((id) => byId.get(id)).filter((element): element is BimElectricalElement => Boolean(element));
      const boards = inGroup.filter(isSource);
      let feeder = boards.length === 1 ? boards[0] : null;
      if (!feeder && groupName) {
        // „RM1-Q3“, „HR1 / QF2“ – rozváděč podle označení v názvu systému
        feeder = elements.filter(isSource).find((element) => new RegExp(`(^|[^A-Z0-9])${escapeRegExp(element.tag)}([^A-Z0-9]|$)`, "i").test(groupName)) ?? null;
      }
      if (!feeder) continue;
      for (const element of inGroup) {
        if (element.id === feeder.id || element.fedById !== null) continue;
        element.fedById = feeder.id;
        if (!element.props.circuit && groupName) element.props.circuit = groupName.slice(0, 40);
        const cable = list.find((id) => cables.has(id));
        if (cable && element.feederCableId === null) element.feederCableId = cable;
      }
    }
    // 3) Revit „Panel“ / „Napájeno z“: označení napájecího rozváděče
    const byTag = new Map(elements.filter(isSource).map((element) => [element.tag.toUpperCase(), element]));
    for (const element of elements) {
      if (element.fedById !== null || !element.props.panel) continue;
      const parent = byTag.get(cleanTag(element.props.panel).toUpperCase());
      if (parent && parent.id !== element.id) element.fedById = parent.id;
    }
    // Zálohování po větvi: prvek napájený z UPS / DA (nebo ze zálohované větve) dědí úroveň
    const tierOf = (element: BimElectricalElement, depth = 0): BimBackupTier => {
      if (element.backupTier !== "GRID_STANDARD" || depth > 32 || element.fedById === null) return element.backupTier;
      const parent = byId.get(element.fedById);
      return parent ? tierOf(parent, depth + 1) : element.backupTier;
    };
    for (const element of elements) if (element.kind !== "transformer") element.backupTier = tierOf(element);
  }
}

// ---------------------------------------------------------------------------
//  Pomocné funkce
// ---------------------------------------------------------------------------

function carrierKindOf(ifcType: string, typeName: string, predefined: string, text: string): BimCarrier["kind"] | null {
  const own = ifcType === "IFCCABLECARRIERSEGMENT" || typeName === "IFCCABLECARRIERSEGMENTTYPE";
  if (ifcType === "IFCCABLESEGMENT" || typeName === "IFCCABLESEGMENTTYPE") return "cable";
  if (ifcType === "IFCCABLECARRIERFITTING" || typeName === "IFCCABLECARRIERFITTINGTYPE" || ifcType === "IFCCABLEFITTING") return "fitting";
  if (!own && !(ifcType === "IFCFLOWSEGMENT" && /CABLE|KABEL|ŽLAB|ZLAB|TRAY|LÁVK|LAVK/i.test(text))) return null;
  if (/LADDER|LÁVK|LAVK|ŽEB/i.test(`${predefined} ${text}`)) return "ladder";
  if (/CONDUIT|TRUBK|CHRÁNIČ|CHRANIC/i.test(`${predefined} ${text}`)) return "conduit";
  if (/TRUNKING|LIŠT|LIST|KANÁL|KANAL/i.test(`${predefined} ${text}`)) return "trunking";
  if (ifcType === "IFCFLOWSEGMENT" && /KABEL\b|CABLE\b|CYKY|CXKH|N2XH/i.test(text) && !/ŽLAB|ZLAB|TRAY/i.test(text)) return "cable";
  return "tray";
}

function electricalKindOf(ifcType: string, typeName: string, predefined: string, text: string): BimElectricalKind | null {
  if (ifcType === "IFCTRANSFORMER" || typeName === "IFCTRANSFORMERTYPE") return "transformer";
  if (ifcType === "IFCELECTRICGENERATOR" || typeName === "IFCELECTRICGENERATORTYPE") return "generator";
  if (ifcType === "IFCELECTRICFLOWSTORAGEDEVICE" || typeName === "IFCELECTRICFLOWSTORAGEDEVICETYPE") return "ups";
  if (ifcType === "IFCELECTRICDISTRIBUTIONBOARD" || ifcType === "IFCELECTRICDISTRIBUTIONPOINT" || typeName === "IFCELECTRICDISTRIBUTIONBOARDTYPE") return "board";
  if (ifcType === "IFCLIGHTFIXTURE" || typeName === "IFCLIGHTFIXTURETYPE") return "light";
  if (ifcType === "IFCOUTLET" || typeName === "IFCOUTLETTYPE") return "outlet";
  if (ifcType === "IFCSWITCHINGDEVICE" || typeName === "IFCSWITCHINGDEVICETYPE") return "switch";
  if (ifcType === "IFCSENSOR" || typeName === "IFCSENSORTYPE") return "sensor";
  if (ifcType === "IFCACTUATOR" || typeName === "IFCACTUATORTYPE") return "actuator";
  if (MACHINE_TYPES.has(ifcType) || /APPLIANCE|MOTOR|UNITARY|PUMP|FAN|CHILLER|BOILER|COMPRESSOR/.test(typeName)) return "machine";
  if (GENERIC_TYPES.has(ifcType)) {
    if (/TRANSFORM|TRAFO|\bTR\d/i.test(text)) return "transformer";
    if (/\bUPS\b|UPS\d|UPS-/i.test(text)) return "ups";
    if (/DIESEL|GENER[AÁ]TOR|\bDA\d/i.test(text)) return "generator";
    if (BOARD_WORDS.test(text.trim()) || /\b(SWITCHBOARD|PANELBOARD|DISTRIBUTIONBOARD)\b/i.test(predefined)) return "board";
    if (/CNC|LIS\b|KOMPRES|STROJ|MACHINE|MOTOR/i.test(text)) return "machine";
  }
  return null;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Označení z názvu „RM1 – Podružný rozváděč“ → „RM1“, „HR1 (Hlavní …)“ → „HR1“. */
export function tagFromName(name: string): string {
  const match = /^\s*([A-Z0-9][A-Z0-9.\-/]{0,15})(?=\s|$|\(|–|-\s|:)/i.exec(name);
  return match && /\d/.test(match[1]) ? match[1].replace(/[-.]+$/, "") : "";
}

const cleanTag = (tag: string) => tag.trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9.\-/]/g, "").slice(0, 24) || "BIM";

function pairs<T>(points: readonly T[]): [T, T][] {
  return points.map((point, index) => [point, points[(index + 1) % points.length]]);
}

export function polygonArea(points: readonly { x: number; y: number }[]): number {
  let sum = 0;
  for (const [p, q] of pairs(points)) sum += p.x * q.y - q.x * p.y;
  return Math.abs(sum) / 2;
}

export function boundsOf(points: readonly { x: number; y: number }[]): BimRect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

export function insidePolygon(point: { x: number; y: number }, polygon: readonly { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-12) + a.x) inside = !inside;
  }
  return inside;
}

export function polylineLength(points: readonly BimPoint[]): number {
  let sum = 0;
  for (let index = 1; index < points.length; index++) sum += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y, points[index].z - points[index - 1].z);
  return sum;
}
