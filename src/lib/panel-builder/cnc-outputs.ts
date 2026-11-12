// Fáze 106: výstupy výrobního balíčku rozváděče – CNC vrtací a frézovací plán 1 : 1 (DXF s hladinami 0–4 a strojový CSV
// souřadnic pro Kiesling Perforex / Rittal / Steinhauer), nářezový a drátovací list vodičů (CSV / XLSX) a nářezový list
// lišt, žlabů a hřebenů. `generateManufacturingPackage` = vše najednou (deterministicky, stejné vstupy = stejné soubory).

import { buildXlsx } from "@/lib/xlsx";

import { cncLayout, cutList, wireHarnessList, type CncInput, type CncLayout, type CutItem, type WireRow } from "./cnc-manufacturing-engine";
import { DxfWriter } from "./dxf-export";

export const CNC_LAYERS = [
  { name: "0_OBRYS_SKRINE_A_DESKY", color: 7, label: "Obrys montážní desky, dveří a kabelových čel" },
  { name: "1_CNC_VRTANI_ZAVITY", color: 1, label: "Vrtání závitů M5 / M6 (DIN lišty, žlaby, PE / N)" },
  { name: "2_CNC_VYREZY_DVERE", color: 3, label: "Výřezy ve dveřích (Ø 22,5, měřidlo, ventilace)" },
  { name: "3_CNC_VYVODKY_CELA", color: 5, label: "Otvory pro kabelové vývodky v čelech" },
  { name: "4_OSAZENI_PRISTROJU_KOTY", color: 8, label: "Osazení přístrojů, lišty, žlaby a kóty" },
] as const;
export type CncLayer = (typeof CNC_LAYERS)[number]["name"];

const n1 = (value: number) => String(Math.round(value * 10) / 10).replace(".", ",");

/** Rozmístění dílů ve výkresu: deska vlevo nahoře, dveře vpravo, horní a dolní čelo pod deskou. */
function offsets(layout: CncLayout) {
  return {
    plate: { x: 0, y: 0 },
    door: { x: layout.plate.widthMm + 200, y: 0 },
    top: { x: 0, y: layout.plate.heightMm + 200 },
    bottom: { x: 0, y: layout.plate.heightMm + 200 + layout.face.depthMm + 150 },
  };
}

export interface CncOperation {
  part: "deska" | "dvere" | "celo-horni" | "celo-dolni";
  /** Strojové souřadnice: počátek levý dolní roh dílu, osa Y nahoru [mm]. */
  x: number;
  y: number;
  operation: string;
  size: string;
  layer: CncLayer;
}

/** Všechny operace CNC (vrtání, výřezy, otvory vývodek) ve strojových souřadnicích dílu. */
export function cncOperations(layout: CncLayout): CncOperation[] {
  const ops: CncOperation[] = [];
  const plateY = (y: number) => Math.round((layout.plate.heightMm - y) * 10) / 10;
  for (const hole of [...layout.rails.flatMap((rail) => rail.holes), ...layout.ducts.flatMap((duct) => duct.holes), ...layout.bars.flatMap((bar) => bar.holes)]) {
    ops.push({ part: "deska", x: hole.x, y: plateY(hole.y), operation: `VRTANI_${hole.thread}`, size: `Ø ${n1(hole.diameterMm)} / ${hole.thread}`, layer: "1_CNC_VRTANI_ZAVITY" });
  }
  const doorY = (y: number) => Math.round((layout.door.heightMm - y) * 10) / 10;
  for (const cut of layout.doorCutouts) {
    if (cut.diameterMm) ops.push({ part: "dvere", x: cut.x, y: doorY(cut.y), operation: "VYREZ_KRUH", size: `Ø ${n1(cut.diameterMm)}`, layer: "2_CNC_VYREZY_DVERE" });
    else ops.push({ part: "dvere", x: cut.x, y: doorY(cut.y), operation: "VYREZ_OBDELNIK", size: `${cut.w} × ${cut.h}`, layer: "2_CNC_VYREZY_DVERE" });
  }
  if (!layout.membrane) {
    for (const gland of layout.glands) ops.push({ part: gland.side === "top" ? "celo-horni" : "celo-dolni", x: gland.x, y: Math.round((layout.face.depthMm / 2) * 10) / 10, operation: `VYVODKA_${gland.size}`, size: `Ø ${n1(gland.holeMm)}`, layer: "3_CNC_VYVODKY_CELA" });
  }
  return ops;
}

/** Strojový CSV pro CNC centrum: X_mm; Y_mm; Typ_operace; Prumer_nebo_Rozmer_mm; Hladina (+ díl). */
export function cncCsv(layout: CncLayout): string {
  const rows = [["X_mm", "Y_mm", "Typ_operace", "Prumer_nebo_Rozmer_mm", "Hladina", "Dil"], ...cncOperations(layout).map((op) => [n1(op.x), n1(op.y), op.operation, op.size, op.layer, op.part])];
  return `﻿${rows.map((row) => row.join(";")).join("\r\n")}\r\n`;
}

/** CNC výkres 1 : 1 v mm (DXF R12) s hladinami 0–4. */
export function cncDxf(layout: CncLayout, input: Pick<CncInput, "name" | "enclosure">): string {
  const dxf = new DxfWriter<CncLayer>(CNC_LAYERS, "ELDOCK - CNC vrtaci a frezovaci plan rozvadece, jednotky mm, meritko 1:1");
  const at = offsets(layout);
  const rect = (layer: CncLayer, x: number, y: number, w: number, h: number) =>
    dxf.polyline(
      layer,
      [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
      true,
    );
  const hole = (layer: CncLayer, x: number, y: number, diameter: number) => {
    dxf.circle(layer, { x, y }, diameter / 2);
    // Středová značka
    dxf.line(layer, { x: x - diameter * 0.7, y }, { x: x + diameter * 0.7, y });
    dxf.line(layer, { x, y: y - diameter * 0.7 }, { x, y: y + diameter * 0.7 });
  };
  // Deska
  rect("0_OBRYS_SKRINE_A_DESKY", at.plate.x, at.plate.y, layout.plate.widthMm, layout.plate.heightMm);
  dxf.text("0_OBRYS_SKRINE_A_DESKY", { x: at.plate.x, y: at.plate.y - 25 }, 12, `MONTAZNI DESKA ${input.enclosure.manufacturer} ${input.enclosure.model} – ${n1(layout.plate.widthMm)} x ${n1(layout.plate.heightMm)} mm – ${input.name}`);
  for (const rail of layout.rails) {
    rect("4_OSAZENI_PRISTROJU_KOTY", rail.x1, rail.y - 17.5, rail.lengthMm, 35);
    dxf.text("4_OSAZENI_PRISTROJU_KOTY", { x: rail.x1, y: rail.y - 22 }, 6, `TS35 L${rail.index}: ${rail.lengthMm} mm, osa Y=${n1(layout.plate.heightMm - rail.y)}`);
    for (const point of rail.holes) hole("1_CNC_VRTANI_ZAVITY", point.x, point.y, point.diameterMm);
  }
  for (const duct of layout.ducts) {
    rect("4_OSAZENI_PRISTROJU_KOTY", duct.x, duct.y, duct.w, duct.h);
    for (const point of duct.holes) hole("1_CNC_VRTANI_ZAVITY", point.x, point.y, point.diameterMm);
  }
  for (const bar of layout.bars) {
    rect("4_OSAZENI_PRISTROJU_KOTY", bar.x, bar.y - 6, bar.lengthMm, 12);
    dxf.text("4_OSAZENI_PRISTROJU_KOTY", { x: bar.x, y: bar.y - 10 }, 6, `Sbernice ${bar.name}`);
    for (const point of bar.holes) hole("1_CNC_VRTANI_ZAVITY", point.x, point.y, point.diameterMm);
  }
  for (const device of layout.devices) {
    rect("4_OSAZENI_PRISTROJU_KOTY", device.x, device.y, device.w, device.h);
    dxf.text("4_OSAZENI_PRISTROJU_KOTY", { x: device.x + device.w / 2, y: device.y + device.h / 2 }, 5, device.designation, 0, "center");
  }
  // Dveře
  rect("0_OBRYS_SKRINE_A_DESKY", at.door.x, at.door.y, layout.door.widthMm, layout.door.heightMm);
  dxf.text("0_OBRYS_SKRINE_A_DESKY", { x: at.door.x, y: at.door.y - 25 }, 12, `DVERE – ${n1(layout.door.widthMm)} x ${n1(layout.door.heightMm)} mm`);
  for (const cut of layout.doorCutouts) {
    if (cut.diameterMm) hole("2_CNC_VYREZY_DVERE", at.door.x + cut.x, at.door.y + cut.y, cut.diameterMm);
    else rect("2_CNC_VYREZY_DVERE", at.door.x + cut.x - (cut.w ?? 0) / 2, at.door.y + cut.y - (cut.h ?? 0) / 2, cut.w ?? 0, cut.h ?? 0);
    dxf.text("4_OSAZENI_PRISTROJU_KOTY", { x: at.door.x + cut.x, y: at.door.y + cut.y - (cut.diameterMm ?? cut.h ?? 0) / 2 - 6 }, 5, cut.label, 0, "center");
  }
  // Čela s vývodkami (u zapuštěné rozvodnice membránová příruba – jen obrys)
  for (const side of ["top", "bottom"] as const) {
    const origin = side === "top" ? at.top : at.bottom;
    rect("0_OBRYS_SKRINE_A_DESKY", origin.x, origin.y, layout.face.widthMm, layout.face.depthMm);
    dxf.text("0_OBRYS_SKRINE_A_DESKY", { x: origin.x, y: origin.y - 12 }, 10, `${side === "top" ? "HORNI" : "DOLNI"} CELO – ${layout.face.widthMm} x ${layout.face.depthMm} mm${layout.membrane ? " (membranova priruba)" : ""}`);
    if (layout.membrane) continue;
    for (const gland of layout.glands.filter((entry) => entry.side === side)) {
      hole("3_CNC_VYVODKY_CELA", origin.x + gland.x, origin.y + layout.face.depthMm / 2, gland.holeMm);
      dxf.text("4_OSAZENI_PRISTROJU_KOTY", { x: origin.x + gland.x, y: origin.y + layout.face.depthMm / 2 + gland.holeMm / 2 + 8 }, 4, `${gland.size} ${gland.cable}`, 0, "center");
    }
  }
  return dxf.toString();
}

/** Tabulka drátovacího listu (CSV / XLSX / náhled). */
export function wireTable(wires: readonly WireRow[]): (string | number)[][] {
  return [["Číslo vodiče", "Odkud (Přístroj : Svorka)", "Kam (Přístroj : Svorka)", "Typ a průřez vodiče", "Barva vodiče", "Délka [mm]", "Zakončení konce A", "Zakončení konce B"], ...wires.map((row) => [row.no, row.from, row.to, row.comb ?? row.type, row.color, row.lengthMm, row.endA, row.endB])];
}

export const cutTable = (items: readonly CutItem[]): (string | number)[][] => [["Položka", "Délka [mm]", "Počet kusů"], ...items.map((item) => [item.item, item.lengthMm, item.pieces])];

const csvOf = (rows: readonly (readonly (string | number)[])[]) => `﻿${rows.map((row) => row.map((cell) => (typeof cell === "number" ? String(cell).replace(".", ",") : /[";\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(";")).join("\r\n")}\r\n`;

export interface ManufacturingPackage {
  layout: CncLayout;
  wires: WireRow[];
  cuts: CutItem[];
  files: { name: string; mime: string; content: string | Uint8Array }[];
  summary: { holes: number; doorCutouts: number; glands: number; wires: number; combs: number; wireMm: number };
}

/** Kompletní výrobní podklady rozváděče na jeden klik. */
export function generateManufacturingPackage(input: CncInput): ManufacturingPackage {
  const layout = cncLayout(input);
  const wires = wireHarnessList(input, layout);
  const cuts = cutList(layout, wires);
  const wireRows = wireTable(wires);
  const files = [
    { name: "1_CNC_Vrtaci_plan_1-1.dxf", mime: "application/dxf", content: cncDxf(layout, input) },
    { name: "1_CNC_Vrtaci_plan_1-1.csv", mime: "text/csv;charset=utf-8", content: cncCsv(layout) },
    { name: "2_Narezovy_a_dratovaci_list_vodicu.csv", mime: "text/csv;charset=utf-8", content: csvOf(wireRows) },
    { name: "2_Narezovy_a_dratovaci_list_vodicu.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content: buildXlsx("Vodiče", wireRows) },
    { name: "2b_Narezovy_list_list_zlabu_a_hrebenu.csv", mime: "text/csv;charset=utf-8", content: csvOf(cutTable(cuts)) },
  ];
  const operations = cncOperations(layout);
  return {
    layout,
    wires,
    cuts,
    files,
    summary: {
      holes: operations.filter((op) => op.operation.startsWith("VRTANI")).length,
      doorCutouts: layout.doorCutouts.length,
      glands: layout.glands.length,
      wires: wires.filter((row) => row.kind === "wire").length,
      combs: wires.filter((row) => row.kind === "comb").length,
      wireMm: wires.filter((row) => row.kind === "wire").reduce((sum, row) => sum + row.lengthMm, 0),
    },
  };
}
