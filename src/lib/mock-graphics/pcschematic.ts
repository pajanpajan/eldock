import { xref, type PanelDevice, type PanelModel } from "../panel-model";
import { esc, n } from "./svg";

// Vícelistová dokumentace rozváděče ve stylu PCSCHEMATIC Automation (A3 na šířku):
// rám se sloupci 1–8 a zónami A–F, rohové razítko, 6 listů a klikací křížové odkazy
// (`data-xref="/4.6"` – prohlížeč je obslouží delegací kliknutí). Čisté SVG bez závislostí.

export const PC_WIDTH = 1190;
export const PC_HEIGHT = 842;
export const PC_SHEET_COUNT = 6;

const INK = "#141414";
const MUTED = "#6b7280";
const LINK = "#1d4ed8";
const PHASE_COLORS = { L1: "#7c4a1e", L2: "#141414", L3: "#6b7280", N: "#2563eb", PE: "#15803d" } as const;

/** Kreslicí plocha uvnitř rámu (sloupce 1–8, zóny A–F); razítko je pod ní. */
export const PC_AREA = { x: 40, y: 40, w: 1110, h: 660 } as const;
const COL_W = PC_AREA.w / 8;
const ROW_H = PC_AREA.h / 6;
const ZONES = ["A", "B", "C", "D", "E", "F"] as const;

/** Střed sloupce 1–8 v px. */
const colX = (column: number) => PC_AREA.x + (column - 0.5) * COL_W;
/** Střed zóny A–F (0–5) v px. */
const rowY = (row: number) => PC_AREA.y + (row + 0.5) * ROW_H;

/** Obdélník sloupce (zvýraznění cíle křížového odkazu). */
export function columnRect(column: number) {
  return { x: PC_AREA.x + (Math.min(8, Math.max(1, column)) - 1) * COL_W, y: PC_AREA.y, w: COL_W, h: PC_AREA.h };
}

const text = (x: number, y: number, value: string | number, opts: { size?: number; anchor?: "start" | "middle" | "end"; weight?: number; fill?: string; mono?: boolean } = {}) =>
  `<text x="${n(x)}" y="${n(y)}" font-size="${opts.size ?? 11}"${opts.anchor && opts.anchor !== "start" ? ` text-anchor="${opts.anchor}"` : ""}${opts.weight ? ` font-weight="${opts.weight}"` : ""} fill="${opts.fill ?? INK}"${opts.mono ? ' font-family="ui-monospace, monospace"' : ""}>${esc(value)}</text>`;

const line = (x1: number, y1: number, x2: number, y2: number, stroke = INK, width = 1.4, dash?: string) =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;

const rect = (x: number, y: number, w: number, h: number, opts: { fill?: string; stroke?: string; width?: number; dash?: string; rx?: number } = {}) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${opts.fill ?? "none"}" stroke="${opts.stroke ?? INK}" stroke-width="${opts.width ?? 1.4}"${opts.dash ? ` stroke-dasharray="${opts.dash}"` : ""}${opts.rx ? ` rx="${opts.rx}"` : ""}/>`;

/** Klikací křížový odkaz („/4.6“). */
function link(x: number, y: number, sheet: number, column: number, label?: string, anchor: "start" | "middle" | "end" = "start") {
  const ref = xref(sheet, column);
  return `<text x="${n(x)}" y="${n(y)}" font-size="10.5"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""} fill="${LINK}" text-decoration="underline" style="cursor:pointer" data-xref="${ref}">${esc(label ? `${label} ${ref}` : ref)}</text>`;
}

/** Přístroj jako obdélník s označením (-Q1) a popisem. */
function device(x: number, y: number, w: number, h: number, tag: string, caption?: string) {
  return [
    rect(x, y, w, h, { fill: "#ffffff" }),
    text(x - 6, y + 13, tag, { anchor: "end", weight: 700, size: 12 }),
    caption ? text(x - 6, y + 26, caption, { anchor: "end", size: 9, fill: MUTED }) : "",
  ].join("");
}

/** Číslo vodiče u spoje. */
const wireNo = (x: number, y: number, value: string) => text(x + 4, y, value, { size: 9, fill: MUTED, mono: true });

function frame(model: PanelModel, sheet: number) {
  const meta = model.sheets[sheet - 1];
  const parts: string[] = [];
  parts.push(`<rect width="${PC_WIDTH}" height="${PC_HEIGHT}" fill="#fbfbf8"/>`);
  parts.push(rect(20, 20, PC_WIDTH - 40, PC_HEIGHT - 40, { width: 2 }));
  parts.push(rect(PC_AREA.x, PC_AREA.y, PC_AREA.w, PC_AREA.h, { width: 1 }));
  for (let c = 1; c <= 8; c++) {
    const x = PC_AREA.x + (c - 1) * COL_W;
    if (c > 1) {
      parts.push(line(x, 20, x, PC_AREA.y, INK, 1));
      parts.push(line(x, PC_AREA.y + PC_AREA.h, x, PC_AREA.y + PC_AREA.h + 8, INK, 1));
    }
    parts.push(text(x + COL_W / 2, 34, c, { anchor: "middle", size: 12, weight: 600 }));
  }
  ZONES.forEach((zone, r) => {
    const y = PC_AREA.y + r * ROW_H;
    if (r > 0) {
      parts.push(line(20, y, PC_AREA.x, y, INK, 1));
      parts.push(line(PC_AREA.x + PC_AREA.w, y, PC_WIDTH - 20, y, INK, 1));
    }
    parts.push(text(30, y + ROW_H / 2 + 4, zone, { anchor: "middle", size: 12, weight: 600 }));
    parts.push(text(PC_WIDTH - 30, y + ROW_H / 2 + 4, zone, { anchor: "middle", size: 12, weight: 600 }));
  });

  // Razítko PCSCHEMATIC Automation (dole přes celou šířku)
  const ty = PC_AREA.y + PC_AREA.h + 8;
  const th = PC_HEIGHT - 20 - ty;
  parts.push(rect(PC_AREA.x, ty, PC_AREA.w, th, { width: 1.6, fill: "#ffffff" }));
  parts.push(rect(PC_AREA.x, ty, 170, th, { width: 1.2, fill: "#f3f4f6" }));
  parts.push(text(PC_AREA.x + 12, ty + 30, "PCSCHEMATIC", { size: 17, weight: 800 }));
  parts.push(text(PC_AREA.x + 12, ty + 48, "Automation", { size: 13, fill: MUTED }));
  parts.push(text(PC_AREA.x + 12, ty + 70, "Digitry CAE · ISO/IEC 81346", { size: 9, fill: MUTED }));
  const cells: [label: string, value: string, x: number, w: number, row: 0 | 1][] = [
    ["Project title", model.title, 170, 300, 0],
    ["Customer", model.customer, 470, 230, 0],
    ["File name", model.fileName, 700, 220, 0],
    ["DCC", meta.number === 5 ? "LAYOUT" : meta.number === 6 ? "CALC" : "SCHEMATIC", 920, 190, 0],
    ["Page title", meta.title, 170, 300, 1],
    ["Page ref.", meta.pageRef, 470, 230, 1],
    ["Scale", meta.scale, 700, 70, 1],
    ["Last edit", `${model.revision.date} · ${model.revision.author} · ${model.revision.version}`, 770, 240, 1],
    ["Page", `${meta.number} / ${model.sheets.length}`, 1010, 100, 1],
  ];
  for (const [label, value, x, w, row] of cells) {
    const cy = ty + row * (th / 2);
    parts.push(rect(PC_AREA.x + x, cy, w, th / 2, { width: 1 }));
    parts.push(text(PC_AREA.x + x + 6, cy + 12, label, { size: 8.5, fill: MUTED }));
    parts.push(`<text x="${n(PC_AREA.x + x + 6)}" y="${n(cy + 32)}" font-size="${value.length > 34 ? 10 : 12}" font-weight="600" fill="${INK}" data-field="${esc(label)}">${esc(value)}</text>`);
  }
  return parts.join("");
}

function sheetTitle(model: PanelModel) {
  const parts: string[] = [];
  parts.push(text(PC_AREA.x + 40, rowY(0) + 10, model.title, { size: 30, weight: 800 }));
  parts.push(text(PC_AREA.x + 40, rowY(0) + 40, `${model.refs.full} · ${model.voltage} · In ${model.mainRatedA} A · ${model.ipRating}`, { size: 14, fill: MUTED }));
  parts.push(text(PC_AREA.x + 40, rowY(1) - 4, "Obsah dokumentace (Table of contents)", { size: 16, weight: 700 }));
  const top = rowY(1) + 10;
  const cols = [PC_AREA.x + 40, PC_AREA.x + 120, PC_AREA.x + 520, PC_AREA.x + 820];
  ["List", "Název listu", "Page ref.", "Odkaz"].forEach((label, i) => parts.push(text(cols[i], top, label, { size: 11, weight: 700, fill: MUTED })));
  parts.push(line(cols[0], top + 6, PC_AREA.x + 1000, top + 6, INK, 1));
  model.sheets.forEach((sheet, i) => {
    const y = top + 30 + i * 30;
    parts.push(text(cols[0], y, sheet.number, { size: 13, weight: 700, mono: true }));
    parts.push(text(cols[1], y, sheet.title, { size: 13 }));
    parts.push(text(cols[2], y, sheet.pageRef, { size: 12, mono: true }));
    parts.push(link(cols[3], y, sheet.number, 1, "Otevřít list"));
    parts.push(line(cols[0], y + 9, PC_AREA.x + 1000, y + 9, "#d4d4d8", 0.8));
  });
  const infoY = rowY(4) + 10;
  const info = [
    ["Výrobce rozváděče", model.manufacturer],
    ["Rok výroby", String(model.year)],
    ["Skříň (Š × V × H)", `${model.enclosure.widthMm} × ${model.enclosure.heightMm} × ${model.enclosure.depthMm} mm`],
    ["Norma", "ČSN EN 61439-1/-2, ČSN EN 60204-1, ISO/IEC 81346"],
  ];
  info.forEach(([label, value], i) => {
    parts.push(text(PC_AREA.x + 40 + (i % 2) * 520, infoY + Math.floor(i / 2) * 26, `${label}:`, { size: 11, fill: MUTED }));
    parts.push(text(PC_AREA.x + 190 + (i % 2) * 520, infoY + Math.floor(i / 2) * 26, value, { size: 12, weight: 600 }));
  });
  return parts.join("");
}

function sheetSingleLine(model: PanelModel) {
  const parts: string[] = [];
  const busY = rowY(1);
  const left = colX(1);
  // Přívod -W0 a hlavní vypínač -Q1
  parts.push(text(left, PC_AREA.y + 20, `Přívod -W0 (${model.wires.at(-1)?.crossSection ?? ""})`, { anchor: "middle", size: 10, fill: MUTED }));
  parts.push(line(left, PC_AREA.y + 28, left, busY - 60, INK, 2.4));
  parts.push(device(left - 18, busY - 60, 36, 40, "-Q1", `${model.mainRatedA} A`));
  parts.push(line(left, busY - 20, left, busY, INK, 2.4));
  // Přípojnice L1/L2/L3/N
  (["L1", "L2", "L3", "N"] as const).forEach((phase, i) => {
    const y = busY + i * 7;
    parts.push(line(left, y, PC_AREA.x + PC_AREA.w - 20, y, PHASE_COLORS[phase], 2));
    parts.push(text(PC_AREA.x + PC_AREA.w - 16, y + 3, phase, { size: 9, weight: 700, fill: PHASE_COLORS[phase] }));
  });
  parts.push(text(left + 30, busY - 8, "Přípojnice L1 / L2 / L3 / N / PE", { size: 10, fill: MUTED }));
  // -F1 SPD a -F2 RCD
  const spdX = left + 60;
  parts.push(line(spdX, busY + 21, spdX, rowY(2) - 10, INK, 1.4));
  parts.push(device(spdX - 14, rowY(2) - 10, 28, 34, "-F1", "SPD T1+T2"));
  parts.push(line(spdX, rowY(2) + 24, spdX, rowY(2) + 44, PHASE_COLORS.PE, 1.4));
  parts.push(text(spdX, rowY(2) + 56, "PE", { anchor: "middle", size: 9, fill: PHASE_COLORS.PE }));
  const rcdX = left + 110;
  parts.push(line(rcdX, busY + 21, rcdX, rowY(2) - 10, INK, 1.4));
  parts.push(device(rcdX - 14, rowY(2) - 10, 28, 34, "-F2", "RCD 30 mA"));
  parts.push(link(rcdX + 18, rowY(2) + 40, 3, 6));
  // Vývody -F3 … -F12
  const startX = colX(2) - 30;
  const step = (PC_AREA.x + PC_AREA.w - 60 - startX) / model.feeders.length;
  model.feeders.forEach((feeder, i) => {
    const x = startX + i * step + step / 2;
    const top = busY + (feeder.phases.length === 3 ? 0 : (["L1", "L2", "L3"].indexOf(feeder.phases[0]) * 7));
    parts.push(line(x, top, x, rowY(2) - 4, INK, feeder.phases.length === 3 ? 2.2 : 1.3));
    parts.push(`<circle cx="${n(x)}" cy="${n(top)}" r="2.6" fill="${INK}"/>`);
    parts.push(rect(x - 11, rowY(2) - 4, 22, 34, { fill: "#ffffff" }));
    parts.push(text(x, rowY(2) - 10, feeder.device, { anchor: "middle", size: 11, weight: 700 }));
    parts.push(text(x, rowY(2) + 16, `${feeder.ratedA}A`, { anchor: "middle", size: 8.5, mono: true }));
    parts.push(line(x, rowY(2) + 30, x, rowY(4) - 20, INK, feeder.phases.length === 3 ? 2.2 : 1.3));
    parts.push(text(x + 4, rowY(3), feeder.phases.join("+"), { size: 8.5, fill: MUTED, mono: true }));
    parts.push(text(x + 4, rowY(3) + 12, feeder.cable, { size: 8.5, fill: MUTED, mono: true }));
    parts.push(`<path d="M${n(x - 6)} ${n(rowY(4) - 20)} L${n(x)} ${n(rowY(4) - 8)} L${n(x + 6)} ${n(rowY(4) - 20)}" fill="none" stroke="${INK}" stroke-width="1.4"/>`);
    const label = feeder.target ? feeder.target.tag : feeder.label;
    parts.push(`<text transform="translate(${n(x + 3)} ${n(rowY(4))}) rotate(60)" font-size="10" fill="${feeder.label === "Rezerva" ? MUTED : INK}" font-weight="${feeder.target ? 700 : 400}">${esc(label)}</text>`);
  });
  parts.push(text(PC_AREA.x + 20, rowY(5) + 30, "Liniové schéma: počet fází vývodu (L1+L2+L3 / L1 …) a kabel -W. Zatížení fází viz", { size: 10, fill: MUTED }));
  parts.push(link(PC_AREA.x + 470, rowY(5) + 30, 6, 6));
  return parts.join("");
}

function sheetPower(model: PanelModel) {
  const parts: string[] = [];
  const rails = { L1: rowY(0) - 22, L2: rowY(0) - 8, L3: rowY(0) + 6, PE: rowY(0) + 20 } as const;
  for (const [phase, y] of Object.entries(rails) as [keyof typeof rails, number][]) {
    parts.push(line(PC_AREA.x + 8, y, PC_AREA.x + PC_AREA.w - 8, y, PHASE_COLORS[phase], 1.8, phase === "PE" ? "8 4" : undefined));
    parts.push(text(PC_AREA.x + 12, y - 3, phase, { size: 9, weight: 700, fill: PHASE_COLORS[phase] }));
  }
  const motor = model.devices.find((d) => d.tag === "-Q2")!;
  const xs = [colX(2) - 18, colX(2), colX(2) + 18];
  // -Q1 (sloupec 1) – hlavní vypínač ze sběrnice
  parts.push(device(colX(1) - 30, rowY(1) - 20, 60, 40, "-Q1", `${model.mainRatedA} A`));
  parts.push(text(colX(1), rowY(1) + 38, "13-14 →", { anchor: "middle", size: 9, fill: MUTED }));
  parts.push(link(colX(1) - 16, rowY(1) + 52, 4, 3));
  // -Q2 motorový spouštěč, -Q3 stykač
  xs.forEach((x, i) => {
    const railY = [rails.L1, rails.L2, rails.L3][i];
    parts.push(`<circle cx="${n(x)}" cy="${n(railY)}" r="2.4" fill="${INK}"/>`);
    parts.push(line(x, railY, x, rowY(1) - 20));
    parts.push(line(x, rowY(1) + 20, x, rowY(2) - 20));
    parts.push(line(x + (colX(3) - colX(2)), rowY(2) + 20, x + (colX(3) - colX(2)), rowY(3) - 12));
  });
  const wires = model.wires;
  wires.slice(0, 3).forEach((wire, i) => parts.push(wireNo(xs[i], rowY(1) - 28, wire.number)));
  parts.push(device(colX(2) - 30, rowY(1) - 20, 60, 40, "-Q2", motor.description.replace("Motorový spouštěč ", "")));
  // přechod -Q2 → -Q3
  xs.forEach((x, i) => {
    parts.push(line(x, rowY(2) - 20, x + (colX(3) - colX(2)), rowY(2) - 20));
    parts.push(wireNo(x + 10, rowY(2) - 24 - i * 0, wires[3 + i].number));
  });
  parts.push(device(colX(3) - 30, rowY(2) - 20, 60, 40, "-Q3", "Stykač"));
  parts.push(text(colX(3) + 34, rowY(2) - 6, "A1/A2 cívka", { size: 9, fill: MUTED }));
  parts.push(link(colX(3) + 34, rowY(2) + 8, 4, 6));
  // -X1 svorky U V W PE
  const terminalsY = rowY(3);
  const pins = ["U", "V", "W", "PE"];
  pins.forEach((pin, i) => {
    const x = colX(4) - 36 + i * 24;
    const sourceX = i < 3 ? xs[i] + (colX(3) - colX(2)) : colX(4) + 60;
    if (i < 3) {
      parts.push(line(sourceX, rowY(3) - 12, x, rowY(3) - 12));
      parts.push(line(x, rowY(3) - 12, x, terminalsY - 8));
      parts.push(wireNo(x, rowY(3) - 16, wires[6 + i].number));
    } else {
      parts.push(line(x, rails.PE, x, terminalsY - 8, PHASE_COLORS.PE, 1.4, "6 3"));
    }
    parts.push(`<circle cx="${n(x)}" cy="${n(terminalsY)}" r="7" fill="#ffffff" stroke="${INK}" stroke-width="1.3"/>`);
    parts.push(text(x, terminalsY + 3.5, pin, { anchor: "middle", size: 8, weight: 700 }));
    parts.push(line(x, terminalsY + 7, x, rowY(4) + 10, pin === "PE" ? PHASE_COLORS.PE : INK, 1.4, pin === "PE" ? "6 3" : undefined));
  });
  parts.push(text(colX(4) - 46, terminalsY + 4, "-X1", { anchor: "end", size: 12, weight: 700 }));
  // Kabel -W1 se žilami
  parts.push(`<ellipse cx="${n(colX(4))}" cy="${n(rowY(4) - 10)}" rx="54" ry="10" fill="none" stroke="${INK}" stroke-width="1.2"/>`);
  const cores = wires.filter((wire) => wire.cable?.tag === "-W1");
  parts.push(text(colX(4) + 62, rowY(4) - 6, `-W1  ${cores.map((wire) => wire.cable!.core).join(" · ")}  4G${cores[0]?.crossSection.replace(" mm²", "")}`, { size: 10.5, weight: 700 }));
  // Motor -M1
  parts.push(line(colX(4) - 36, rowY(4) + 10, colX(4) - 10, rowY(5) - 22));
  parts.push(line(colX(4) - 12, rowY(4) + 10, colX(4) - 2, rowY(5) - 24));
  parts.push(line(colX(4) + 12, rowY(4) + 10, colX(4) + 6, rowY(5) - 24));
  parts.push(`<circle cx="${n(colX(4))}" cy="${n(rowY(5))}" r="26" fill="#ffffff" stroke="${INK}" stroke-width="1.6"/>`);
  parts.push(text(colX(4), rowY(5) - 2, "M", { anchor: "middle", size: 16, weight: 700 }));
  parts.push(text(colX(4), rowY(5) + 14, "3~", { anchor: "middle", size: 11 }));
  parts.push(text(colX(4) + 34, rowY(5) + 4, ">-M1", { size: 13, weight: 700 }));
  // -F2 RCD → -X2 zásuvkový okruh
  parts.push(`<circle cx="${n(colX(6) - 10)}" cy="${n(rails.L1)}" r="2.4" fill="${INK}"/>`);
  parts.push(line(colX(6) - 10, rails.L1, colX(6) - 10, rowY(1) - 20));
  parts.push(line(colX(6) + 10, rails.L3 + 30, colX(6) + 10, rowY(1) - 20, PHASE_COLORS.N));
  parts.push(text(colX(6) + 14, rails.L3 + 40, "N", { size: 9, fill: PHASE_COLORS.N }));
  parts.push(device(colX(6) - 26, rowY(1) - 20, 52, 40, "-F2", "40 A / 30 mA"));
  parts.push(link(colX(6) - 26, rowY(1) + 52, 2, 1, "z"));
  ["1", "2", "3"].forEach((pin, i) => {
    const x = colX(7) - 24 + i * 24;
    parts.push(line(i < 2 ? colX(6) - 10 + i * 20 : x, i < 2 ? rowY(1) + 20 : rails.PE, i < 2 ? colX(6) - 10 + i * 20 : x, rowY(2)));
    if (i < 2) parts.push(line(colX(6) - 10 + i * 20, rowY(2), x, rowY(2)));
    parts.push(line(x, rowY(2), x, rowY(3) - 8));
    parts.push(`<circle cx="${n(x)}" cy="${n(rowY(3))}" r="7" fill="#ffffff" stroke="${INK}" stroke-width="1.3"/>`);
    parts.push(text(x, rowY(3) + 3.5, pin, { anchor: "middle", size: 8, weight: 700 }));
    parts.push(wireNo(x, rowY(3) - 14, wires[16 + i].number));
  });
  parts.push(text(colX(7) - 34, rowY(3) + 4, "-X2", { anchor: "end", size: 12, weight: 700 }));
  parts.push(text(colX(7), rowY(4), "Zásuvky 230 V (L1, N, PE)", { anchor: "middle", size: 10, fill: MUTED }));
  parts.push(text(colX(7), rowY(4) + 14, "pokračování -X2:4…9", { anchor: "middle", size: 9, fill: MUTED }));
  parts.push(link(colX(7) + 60, rowY(4) + 14, 4, 2));
  return parts.join("");
}

function sheetControl(model: PanelModel) {
  const parts: string[] = [];
  const plus = rowY(0) - 10;
  const zero = rowY(5) + 20;
  parts.push(line(PC_AREA.x + 8, plus, PC_AREA.x + PC_AREA.w - 8, plus, "#1e3a8a", 1.8));
  parts.push(text(PC_AREA.x + 12, plus - 4, "+24 VDC", { size: 9, weight: 700, fill: "#1e3a8a" }));
  parts.push(line(PC_AREA.x + 8, zero, PC_AREA.x + PC_AREA.w - 8, zero, "#1e3a8a", 1.8, "10 4"));
  parts.push(text(PC_AREA.x + 12, zero - 4, "0 V", { size: 9, weight: 700, fill: "#1e3a8a" }));
  // -T1 zdroj 230 VAC / 24 VDC
  parts.push(text(colX(1), rowY(1) - 30, `230 V ~ z ${model.feeders.find((feeder) => feeder.label.includes("-T1"))?.device ?? "-F2"}`, { anchor: "middle", size: 9, fill: MUTED }));
  parts.push(device(colX(1) - 30, rowY(1) - 20, 60, 50, "-T1", "24 VDC 5 A"));
  parts.push(text(colX(1), rowY(1) + 8, "~ / =", { anchor: "middle", size: 12, weight: 700 }));
  parts.push(line(colX(1) + 18, rowY(1) - 20, colX(1) + 18, plus));
  parts.push(line(colX(1) - 18, rowY(1) + 30, colX(1) - 18, zero, "#1e3a8a", 1.4, "6 3"));
  // PLC -K1 – vstupy DI0–DI7 (zóna C), výstupy DO0–DO3 a AI0
  const plcTop = rowY(2) - 26;
  parts.push(rect(colX(2) - 40, plcTop, colX(8) - colX(2) + 80, 52, { fill: "#eef2ff", width: 1.6 }));
  parts.push(text(colX(2) - 46, plcTop + 16, "-K1", { anchor: "end", size: 13, weight: 800 }));
  parts.push(text(colX(2) - 46, plcTop + 30, "PLC", { anchor: "end", size: 9, fill: MUTED }));
  for (const io of model.plc) {
    const index = Number(io.channel.slice(2));
    const x = io.channel.startsWith("DI") ? colX(io.column) - 40 + (index % 4) * 26 - (io.column === 3 ? 104 : 0) : io.channel === "AI0" ? colX(5) : colX(io.column) - 20 + (index % 2) * 40;
    parts.push(`<circle cx="${n(x)}" cy="${n(plcTop)}" r="3" fill="#ffffff" stroke="${INK}"/>`);
    parts.push(`<text transform="translate(${n(x + 3)} ${n(plcTop + 12)}) rotate(90)" font-size="8.5" fill="${INK}" font-family="ui-monospace, monospace">${esc(`${io.channel} ${io.terminal}`)}</text>`);
    parts.push(text(x, plcTop + 64, io.address, { anchor: "middle", size: 8.5, fill: MUTED, mono: true }));
    if (io.channel.startsWith("DI") && !io.signal.startsWith("SPARE")) {
      parts.push(line(x, plus, x, plcTop - 3));
    }
    if (io.channel.startsWith("DO")) {
      parts.push(line(x, plcTop + 52, x, rowY(4) - 16));
    }
  }
  parts.push(text(colX(5) + 30, plcTop + 46, "slot 001.001.001.001 (DI) · .002 (DO) · .003 (AI)", { size: 9, fill: MUTED, mono: true }));
  // Tlačítka -S1…-S3 (sloupec 2) a pomocné kontakty -Q1:13-14, -Q2:13-14 (sloupec 3)
  const inputs: [tag: string, caption: string, column: number, offset: number, ref?: [number, number]][] = [
    ["-S1", "Endstop UP", 2, 0, undefined],
    ["-S2", "STOP", 2, 1, undefined],
    ["-S3", "E-STOP", 2, 2, undefined],
    ["-Q1", "13-14", 3, 3, [3, 1]],
    ["-Q2", "13-14", 3, 4, [3, 2]],
  ];
  for (const [tag, caption, column, index, ref] of inputs) {
    const x = colX(column) - 40 + (index % 4) * 26 - (column === 3 ? 104 : 0);
    const y = rowY(1) - 6;
    parts.push(rect(x - 7, y - 10, 14, 20, { fill: "#ffffff" }));
    parts.push(line(x - 7, y + 10, x + 7, y - 10, INK, 1.2));
    parts.push(`<text transform="translate(${n(x - 9)} ${n(y + 8)}) rotate(-90)" font-size="9.5" font-weight="700" fill="${INK}">${esc(tag)}</text>`);
    parts.push(`<text transform="translate(${n(x + 17)} ${n(y + 12)}) rotate(-90)" font-size="8" fill="${MUTED}">${esc(caption)}</text>`);
    if (ref) parts.push(link(x, y + 26, ref[0], ref[1], undefined, "middle"));
  }
  parts.push(text(colX(2) - 40, rowY(1) + 40, "-X2:4…7 · kabel -W2", { size: 9, fill: MUTED }));
  // Výstupy: -Q3 cívka (sloupec 6) a kontrolky -P1…-P3 (sloupce 7–8)
  const outputs: [tag: string, caption: string, x: number, coil: boolean][] = [
    ["-Q3", "M1_RUN", colX(6) - 20, true],
    ["-P1", "CHOD", colX(7) - 20, false],
    ["-P2", "ALARM_ON_1", colX(7) + 20, false],
    ["-P3", "VÝSTRAHA", colX(8) - 20, false],
  ];
  for (const [tag, caption, x, coil] of outputs) {
    const y = rowY(4);
    if (coil) parts.push(rect(x - 12, y - 16, 24, 32, { fill: "#ffffff" }));
    else {
      parts.push(`<circle cx="${n(x)}" cy="${n(y)}" r="13" fill="#ffffff" stroke="${INK}" stroke-width="1.4"/>`);
      parts.push(line(x - 9, y - 9, x + 9, y + 9, INK, 1));
      parts.push(line(x - 9, y + 9, x + 9, y - 9, INK, 1));
    }
    parts.push(line(x, y + 16, x, zero, "#1e3a8a", 1.2, "6 3"));
    parts.push(text(x - 16, y - 2, tag, { anchor: "end", size: 10.5, weight: 700 }));
    parts.push(text(x - 16, y + 10, caption, { anchor: "end", size: 8, fill: MUTED }));
    if (coil) parts.push(link(x + 16, y + 4, 3, 3, "hl. kontakty"));
  }
  // AI0 – teplotní čidlo -B1
  parts.push(line(colX(5), plcTop + 52, colX(5), rowY(4) - 14));
  parts.push(rect(colX(5) - 14, rowY(4) - 14, 28, 28, { fill: "#ffffff" }));
  parts.push(text(colX(5), rowY(4) + 4, "ϑ", { anchor: "middle", size: 14 }));
  parts.push(text(colX(5) - 18, rowY(4) - 2, "-B1", { anchor: "end", size: 10.5, weight: 700 }));
  parts.push(text(colX(5) - 18, rowY(4) + 10, "4–20 mA", { anchor: "end", size: 8, fill: MUTED }));
  return parts.join("");
}

function sheetLayout(model: PanelModel) {
  const parts: string[] = [];
  const { widthMm, heightMm, depthMm } = model.enclosure;
  // Měřítko 1:5 → 1 mm = 0,2 px na A3 při tisku; zde přepočet na plochu listu.
  const scale = Math.min(500 / widthMm, 560 / heightMm);
  const w = widthMm * scale;
  const h = heightMm * scale;
  const x0 = PC_AREA.x + 70;
  const y0 = PC_AREA.y + 50;
  parts.push(rect(x0, y0, w, h, { width: 2.2, fill: "#ffffff" }));
  parts.push(rect(x0 + 14, y0 + 14, w - 28, h - 28, { width: 1, stroke: MUTED, dash: "4 3" }));
  // kóty v mm
  parts.push(line(x0, y0 - 18, x0 + w, y0 - 18, INK, 0.8));
  parts.push(text(x0 + w / 2, y0 - 22, `${widthMm} mm`, { anchor: "middle", size: 11, weight: 600 }));
  parts.push(line(x0 - 18, y0, x0 - 18, y0 + h, INK, 0.8));
  parts.push(`<text transform="translate(${n(x0 - 24)} ${n(y0 + h / 2)}) rotate(-90)" font-size="11" font-weight="600" text-anchor="middle" fill="${INK}">${heightMm} mm</text>`);
  parts.push(text(x0 + w + 12, y0 + 14, `hloubka ${depthMm} mm`, { size: 10, fill: MUTED }));
  // rastr montážní desky 1–8 × A–F
  const gx = (w - 28) / 8;
  const gy = (h - 28) / 6;
  for (let c = 0; c < 8; c++) parts.push(text(x0 + 14 + (c + 0.5) * gx, y0 + 10, c + 1, { anchor: "middle", size: 8, fill: MUTED }));
  ZONES.forEach((zone, r) => parts.push(text(x0 + 6, y0 + 14 + (r + 0.5) * gy + 3, zone, { anchor: "middle", size: 8, fill: MUTED })));
  for (let r = 1; r < 6; r++) parts.push(line(x0 + 14, y0 + 14 + r * gy, x0 + w - 14, y0 + 14 + r * gy, "#e5e7eb", 0.6));
  const placed = model.devices.filter((d) => d.mount);
  for (const item of placed) {
    const c = Number(item.mount.slice(0, -1)) - 1;
    const r = ZONES.indexOf(item.mount.slice(-1) as (typeof ZONES)[number]);
    const dw = Math.min(gx - 4, item.size[0] * scale * 0.9);
    const dh = Math.min(gy - 8, item.size[1] * scale * 0.9);
    const dx = x0 + 14 + c * gx + (gx - dw) / 2;
    const dy = y0 + 14 + r * gy + (gy - dh) / 2;
    parts.push(rect(dx, dy, dw, dh, { fill: item.tag === "-K1" ? "#e0e7ff" : "#f4f4f5", width: 1 }));
    parts.push(text(dx + dw / 2, dy + dh / 2 + 3, item.tag, { anchor: "middle", size: 8, weight: 700 }));
  }
  // tabulka přístrojů
  const tx = x0 + w + 60;
  const ty = PC_AREA.y + 50;
  const cols = [tx, tx + 60, tx + 110, tx + 330];
  ["Tag", "Pozice", "Popis", "Objednací č."].forEach((label, i) => parts.push(text(cols[i], ty, label, { size: 10, weight: 700, fill: MUTED })));
  parts.push(line(tx, ty + 5, PC_AREA.x + PC_AREA.w - 10, ty + 5, INK, 0.8));
  placed.slice(0, 22).forEach((item, i) => {
    const y = ty + 22 + i * 21;
    parts.push(text(cols[0], y, item.tag, { size: 10, weight: 700, mono: true }));
    parts.push(`<text x="${n(cols[1])}" y="${n(y)}" font-size="10" font-family="ui-monospace, monospace" fill="${INK}" data-mount="${esc(item.mount)}">${esc(item.mount)}</text>`);
    parts.push(text(cols[2], y, item.description.length > 40 ? `${item.description.slice(0, 39)}…` : item.description, { size: 9.5 }));
    parts.push(text(cols[3], y, item.partNumber, { size: 9, fill: MUTED, mono: true }));
  });
  parts.push(text(tx, PC_AREA.y + PC_AREA.h - 14, "Pozice = rastr montážní desky (sloupec 1–8, řada A–F), M 1:5.", { size: 9.5, fill: MUTED }));
  return parts.join("");
}

function sheetThermal(model: PanelModel) {
  const parts: string[] = [];
  const tx = PC_AREA.x + 20;
  const ty = PC_AREA.y + 26;
  const cols = [tx, tx + 70, tx + 340, tx + 410, tx + 480, tx + 530];
  ["Tag", "Přístroj", "In [A]", "Imax [A]", "SF", "Pv [W]"].forEach((label, i) => parts.push(text(cols[i], ty, label, { size: 10, weight: 700, fill: MUTED })));
  parts.push(text(cols[5] + 60, ty, "Pn [W]", { size: 10, weight: 700, fill: MUTED }));
  parts.push(line(tx, ty + 5, tx + 640, ty + 5, INK, 0.8));
  const rows = model.devices.filter((device: PanelDevice) => device.lossW >= 1).slice(0, 20);
  rows.forEach((device, i) => {
    const y = ty + 20 + i * 19;
    const ratio = device.ratedA && device.operatingA !== undefined ? Math.min(1, device.operatingA / device.ratedA) : 1;
    const pv = device.lossW * Math.max(0.25, ratio * ratio) * model.thermal.simultaneity;
    parts.push(text(cols[0], y, device.tag, { size: 9.5, weight: 700, mono: true }));
    parts.push(text(cols[1], y, device.description.length > 44 ? `${device.description.slice(0, 43)}…` : device.description, { size: 9 }));
    parts.push(text(cols[2], y, device.ratedA ?? "—", { size: 9.5, mono: true }));
    parts.push(text(cols[3], y, device.operatingA !== undefined ? device.operatingA.toLocaleString("cs-CZ") : "—", { size: 9.5, mono: true }));
    parts.push(text(cols[4], y, "0,5", { size: 9.5, mono: true }));
    parts.push(text(cols[5], y, (Math.round(pv * 10) / 10).toLocaleString("cs-CZ"), { size: 9.5, mono: true, weight: 600 }));
    parts.push(text(cols[5] + 60, y, device.lossW.toLocaleString("cs-CZ"), { size: 9.5, mono: true, fill: MUTED }));
  });
  const sumY = ty + 20 + rows.length * 19 + 8;
  parts.push(line(tx, sumY - 12, tx + 640, sumY - 12, INK, 0.8));
  parts.push(`<text x="${n(tx)}" y="${n(sumY + 4)}" font-size="13" font-weight="800" fill="${INK}" data-total-loss="${model.thermal.totalLossW}">${esc(`Celkový ztrátový výkon: ${model.thermal.totalLossW.toLocaleString("cs-CZ")} W`)}</text>`);
  const status = model.thermal.internalC <= model.thermal.maxC ? "#15803d" : "#b91c1c";
  parts.push(
    text(tx, sumY + 24, `Vnitřní teplota ${model.thermal.internalC.toLocaleString("cs-CZ")} °C při okolí ${model.thermal.ambientC} °C (limit ${model.thermal.maxC} °C, A = ${model.thermal.surfaceM2.toLocaleString("cs-CZ")} m², k = 5,5 W/m²K)`, {
      size: 11,
      weight: 600,
      fill: status,
    }),
  );

  // Graf zatížení fází (sloupec 6–8, zóny A–C)
  const gx = colX(6) - 40;
  const gy = PC_AREA.y + 40;
  const gh = 220;
  parts.push(text(gx, gy - 10, `Zatížení fází vůči -Q1 ${model.mainRatedA} A`, { size: 12, weight: 700 }));
  parts.push(line(gx, gy, gx, gy + gh, INK, 1));
  parts.push(line(gx, gy + gh, gx + 300, gy + gh, INK, 1));
  const max = Math.max(model.mainRatedA * 0.6, ...Object.values(model.phaseLoad)) * 1.1;
  (["L1", "L2", "L3", "N"] as const).forEach((phase, i) => {
    const value = model.phaseLoad[phase];
    const bh = (value / max) * gh;
    const bx = gx + 20 + i * 70;
    parts.push(`<rect x="${n(bx)}" y="${n(gy + gh - bh)}" width="44" height="${n(bh)}" fill="${PHASE_COLORS[phase]}" opacity="0.85" data-phase="${phase}"/>`);
    parts.push(text(bx + 22, gy + gh - bh - 6, `${value.toLocaleString("cs-CZ")} A`, { anchor: "middle", size: 10, weight: 700 }));
    parts.push(text(bx + 22, gy + gh + 14, phase, { anchor: "middle", size: 11, weight: 700 }));
  });
  // CE štítek dle EN 61439 (zóny D–F)
  const cx = colX(6) - 40;
  const cy = rowY(3) - 20;
  parts.push(rect(cx, cy, 330, 230, { width: 2, fill: "#ffffff", rx: 6 }));
  parts.push(text(cx + 16, cy + 46, "CE", { size: 44, weight: 900 }));
  parts.push(text(cx + 110, cy + 26, "Typový štítek rozváděče", { size: 12, weight: 700 }));
  parts.push(text(cx + 110, cy + 42, "ČSN EN 61439-1 / -2", { size: 10.5, fill: MUTED }));
  const plate = [
    ["Výrobce", model.manufacturer],
    ["Označení", model.refs.full],
    ["Un / In", `${model.voltage.split(",")[0]} / ${model.mainRatedA} A`],
    ["Icw / Ipk", model.mainRatedA > 630 ? "50 kA 1 s / 105 kA" : "25 kA 1 s / 52,5 kA"],
    ["Krytí / síť", `${model.ipRating} / TN-S`],
    ["Rok výroby", String(model.year)],
    ["Dokumentace", `${model.fileName} · ${model.revision.version}`],
  ];
  plate.forEach(([label, value], i) => {
    parts.push(text(cx + 16, cy + 82 + i * 20, label, { size: 9.5, fill: MUTED }));
    parts.push(text(cx + 110, cy + 82 + i * 20, value, { size: 10, weight: 600 }));
  });
  return parts.join("");
}

const RENDERERS = [sheetTitle, sheetSingleLine, sheetPower, sheetControl, sheetLayout, sheetThermal];

/** Jeden list (1–6) jako samostatné SVG. */
export function renderPanelSheetSvg(model: PanelModel, sheet: number): string {
  const index = Math.min(PC_SHEET_COUNT, Math.max(1, Math.round(sheet))) - 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PC_WIDTH} ${PC_HEIGHT}" font-family="Arial, Helvetica, sans-serif" data-sheet="${index + 1}">${frame(model, index + 1)}${RENDERERS[index](model)}</svg>`;
}
