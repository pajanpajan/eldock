// Fáze 95: BIM model (IFC) → nákres 2D půdorysu: podlaží (IfcBuildingStorey), plátno podle rozměru stavby v měřítku 1 : 1
// (souřadnice v mm, bez kalibrace), místnosti z IfcSpace s českými názvy (obdélník nebo mnohoúhelník), okna a dveře,
// rozváděče (RH / RP s kódem z BIMu), zásuvky, svítidla, vypínače, čidla, pohony a stroje jako vlastní spotřebiče na
// přesných souřadnicích X, Y a výškách Z. Osa Y se otočí (CAD: sever nahoru → plátno: y dolů). Čistá funkce.

import { APPLIANCE_RATINGS, CUSTOM_APPLIANCE_ITEM, cableForPoles, type ApplianceSpec } from "../panel-builder/appliances";
import type { EditorElement, EditorRoom, FloorSheet, FloorplanDraft } from "../panel-builder/floorplan-editor";
import { emptyCalibration } from "../panel-builder/floorplan-pdf";
import type { BimElectricalElement, BimModel, BimOpening, BimSpace } from "./ifc-parser";

/** Okraj plátna kolem stavby [m]. */
const MARGIN_M = 1;

export interface BimFloorplanResult {
  draft: FloorplanDraft;
  floors: number;
  rooms: number;
  elements: number;
  warnings: string[];
}

const element = (id: string, item: string, x: number, y: number, room: string, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });

/** Úhel v půdorysu IFC (proti směru hodinových ručiček, Y nahoru) → otočení značky na plátně (Y dolů). */
const screenAngle = (deg: number) => ((Math.round(-deg) % 360) + 360) % 360;

/** Položka palety pro zásuvku / světlo / ovladač z BIMu; null = do půdorysu se nevkládá. */
function itemOf(element: BimElectricalElement, heightMm: number): string | null {
  const text = `${element.name} ${element.tag}`;
  switch (element.kind) {
    case "outlet":
      if (element.data) return "data-socket";
      if (/IP\s?4[4-9]|IP\s?5\d|IP\s?6\d|venk|koupel/i.test(`${text} ${element.props.ipRating ?? ""}`)) return "ip44-socket";
      if (/dvoj|double|2\s?[x×]/i.test(text)) return "double-socket";
      return "socket";
    case "light":
      if (element.emergency) return "emergency-light";
      return heightMm >= 2200 ? "ceiling-light" : "wall-light";
    case "switch":
      return element.emergency ? null : "switch-1";
    case "sensor":
      return "pir";
    case "actuator":
      return "blind-motor";
    default:
      return null;
  }
}

/** Jištění vlastního spotřebiče: nejbližší jmenovitý proud ≥ Ib (nejvýš 32 A – výš varování). */
function applianceOf(element: BimElectricalElement, warnings: string[]): ApplianceSpec {
  const poles = element.props.phases === 3 || (element.props.voltageV ?? 230) >= 380 ? 3 : 1;
  const powerW = Math.round(Math.min(100_000, Math.max(1, (element.props.powerKw ?? (element.props.apparentPowerKva ?? 2) * 0.9) * 1000)));
  const ib = element.props.nominalCurrentA ?? (poles === 3 ? powerW / (Math.sqrt(3) * 400 * 0.9) : powerW / (230 * 0.95));
  const rating = APPLIANCE_RATINGS.find((value) => value >= ib) ?? APPLIANCE_RATINGS[APPLIANCE_RATINGS.length - 1];
  if (ib > APPLIANCE_RATINGS[APPLIANCE_RATINGS.length - 1]) warnings.push(`${element.tag}: odběr ${Math.round(ib)} A je nad jištěním vlastního spotřebiče (max. 32 A) – vývod dimenzujte v rozváděči ručně.`);
  const label = `${element.tag !== element.name ? `${element.tag} ` : ""}${element.name}`.slice(0, 60);
  return {
    id: `ap-bim-${element.id}`.slice(0, 40),
    label,
    symbol: (element.machineKind === "cnc" ? "CNC" : element.machineKind === "press" ? "LIS" : element.machineKind === "compressor" ? "KOM" : element.machineKind === "hvac" ? "VZT" : "STR").slice(0, 4),
    powerW,
    poles,
    ratedA: rating,
    curve: "C",
    rcd: "A",
    cable: cableForPoles(poles === 3 ? "CYKY-J 5×2,5" : "CYKY-J 3×2,5", poles),
    heightMm: null,
    simultaneity: 1,
    custom: true,
  };
}

function openingItem(opening: BimOpening): string {
  const width = opening.widthM ?? 1;
  if (opening.kind === "window") return width >= 2.2 ? "arch-window-hs" : width >= 1.3 ? "arch-window-2" : "arch-window-1";
  return width >= 2.2 ? "arch-door-sliding" : width >= 1.3 ? "arch-door-2" : "arch-door-1";
}

/**
 * Převede BIM model do nákresu: všechna podlaží (první = podlaží nejblíž ±0), plátno = obálka stavby + 1 m okraj, místnosti,
 * otvory a elektro prvky; ostatní nastavení (řada, výrobce krabic, soustava …) zůstanou z `base`.
 */
export function bimToFloorplan(model: BimModel, base: FloorplanDraft): BimFloorplanResult {
  const warnings: string[] = [];
  const { bounds } = model;
  const left = bounds.x - MARGIN_M;
  const top = bounds.y + bounds.h + MARGIN_M;
  const mm = (value: number) => Math.round(value * 1000);
  const toX = (x: number) => mm(x - left);
  const toY = (y: number) => mm(top - y);
  const widthMm = mm(bounds.w + 2 * MARGIN_M);
  const heightMm = mm(bounds.h + 2 * MARGIN_M);
  // Podlaží: bez IfcBuildingStorey jedno podlaží
  const storeys = model.storeys.length ? model.storeys : [{ id: -1, guid: "", name: base.floorName || "1. NP", elevationM: 0, buildingId: null }];
  const ground = storeys.reduce((best, storey) => (Math.abs(storey.elevationM) < Math.abs(best.elevationM) ? storey : best), storeys[0]);
  const appliances: ApplianceSpec[] = [...base.appliances];
  const boards = model.electrical.filter((entry) => entry.kind === "board");
  const byId = new Map(model.electrical.map((entry) => [entry.id, entry]));
  // Hlavní rozváděč: napájený ze zdroje nebo bez napájení; ostatní rozváděče = podružné RP
  const main = boards.find((board) => board.fedById === null || ["transformer", "generator", "ups"].includes(byId.get(board.fedById)?.kind ?? "")) ?? boards[0] ?? null;
  const usedCodes = new Set<string>();
  const boardCode = (tag: string) => {
    let code = tag.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8) || "RP";
    if (code === "RH") code = "RH1";
    while (usedCodes.has(code)) code = `${code.slice(0, 6)}${usedCodes.size}`;
    usedCodes.add(code);
    return code;
  };
  let roomCount = 0;
  let elementCount = 0;

  const sheetOf = (storey: (typeof storeys)[number], index: number): FloorSheet => {
    const onStorey = <T extends { storeyId: number | null }>(list: readonly T[]) => list.filter((entry) => entry.storeyId === storey.id || (entry.storeyId === null && storey.id === ground.id));
    const spaces = onStorey(model.spaces);
    const rooms: EditorRoom[] = spaces.map((space: BimSpace) => {
      const rectangle = space.polygon.length === 4 && Math.abs(space.areaM2 - space.bounds.w * space.bounds.h) < 0.5;
      return {
        id: `bim-${space.id}`,
        name: space.name.slice(0, 60),
        x: toX(space.bounds.x),
        y: toY(space.bounds.y + space.bounds.h),
        w: mm(space.bounds.w),
        h: mm(space.bounds.h),
        ...(rectangle || space.polygon.length > 40 ? {} : { points: space.polygon.map((point) => ({ x: toX(point.x), y: toY(point.y) })) }),
      };
    });
    roomCount += rooms.length;
    const roomName = (spaceId: number | null) => (spaceId ? (model.spaces.find((space) => space.id === spaceId)?.name.slice(0, 60) ?? "") : "");
    const elements: EditorElement[] = [];
    for (const opening of onStorey(model.openings)) {
      elements.push(element(`bim-${opening.id}`, openingItem(opening), toX(opening.position.x), toY(opening.position.y), "", { rotation: screenAngle(opening.angleDeg) }));
    }
    for (const entry of onStorey(model.electrical)) {
      const heightMm = Math.max(0, Math.min(6000, mm(entry.position.z - storey.elevationM)));
      const at = { x: toX(entry.position.x), y: toY(entry.position.y) };
      const room = roomName(entry.spaceId);
      if (entry.kind === "board") {
        const isMain = entry.id === main?.id;
        elements.push(element(`bim-${entry.id}`, isMain ? "panel" : "subpanel", at.x, at.y, room, { mountHeightMm: heightMm || null, ...(isMain ? {} : { boardCode: boardCode(entry.tag) }) }));
        continue;
      }
      if (entry.kind === "machine") {
        const spec = applianceOf(entry, warnings);
        appliances.push(spec);
        elements.push(element(`bim-${entry.id}`, CUSTOM_APPLIANCE_ITEM, at.x, at.y, room, { appliance: spec.id, mountHeightMm: heightMm || null }));
        continue;
      }
      if (entry.kind === "transformer" || entry.kind === "generator" || entry.kind === "ups") continue;
      const item = itemOf(entry, heightMm);
      if (!item) {
        if (entry.kind === "switch" && entry.emergency) warnings.push(`${entry.name}: tlačítko CENTRAL STOP se v půdorysu neosazuje – vypínací spoušť doplní rozváděč (režim BD4).`);
        continue;
      }
      elements.push(element(`bim-${entry.id}`, item, at.x, at.y, room, { mountHeightMm: heightMm, rotation: screenAngle(entry.angleDeg) }));
    }
    elementCount += elements.length;
    return {
      id: index === 0 ? base.floorId : `bim-f${storey.id}`,
      name: storey.name.slice(0, 40),
      levelMm: mm(storey.elevationM - ground.elevationM),
      background: null,
      cad: null,
      calibration: emptyCalibration(),
      mmPerPx: base.mmPerPx,
      widthMm,
      heightMm,
      rooms,
      elements,
      frames: [],
      annotations: [],
    };
  };

  const ordered = [ground, ...storeys.filter((storey) => storey.id !== ground.id)];
  const sheets = ordered.map(sheetOf);
  const [first, ...others] = sheets;
  if (boards.length === 0) warnings.push("V BIM modelu není rozváděč – hlavní rozváděč RH vložte do půdorysu ručně.");
  return {
    draft: {
      ...base,
      floorId: first.id,
      floorName: first.name,
      floorLevelMm: first.levelMm,
      background: null,
      cad: null,
      calibration: emptyCalibration(),
      widthMm: first.widthMm,
      heightMm: first.heightMm,
      rooms: first.rooms,
      elements: first.elements,
      frames: [],
      annotations: [],
      otherFloors: others,
      appliances,
    },
    floors: sheets.length,
    rooms: roomCount,
    elements: elementCount,
    warnings: [...model.warnings, ...warnings],
  };
}
