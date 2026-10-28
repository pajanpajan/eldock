import { buildParts, type PartOverrides } from "./parts";
import { esc, n } from "./svg";

// Generátor mock elektrického schématu rozváděče (A3 na šířku).
// Vlevo silový obvod (Q1, F1, odbočky F2–F5 → K1–K4 → X2), vpravo řídicí
// obvod (T1 → +24 V, PLC A1 → cívky K1–K4 → X1 → 0 V) a v rohu razítko.

export const SCHEMATIC_WIDTH = 1190;
export const SCHEMATIC_HEIGHT = 842;

export interface SchematicVariant {
  /** Změny dílů v této revizi (stejné jako pro kusovník). */
  overrides?: PartOverrides;
  /** Svorka, na kterou je v této revizi přivedena cívka K4 (A2), např. "X1:14". */
  a2Terminal?: string;
  /** Označení prvků, které se v revizi změnily → revizní obláček. */
  changed?: string[];
  /** Text do tabulky změn v razítku. */
  changeNote?: string;
}

export interface SchematicInput {
  equipment: { tag: string; name: string; ratedCurrent?: string | null };
  revision: { version: string; date: string; author: string; title?: string };
  sheet?: number;
  sheetCount?: number;
  variant?: SchematicVariant;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const INK = "#141414";
const MUTED = "#6b7280";
const CHANGE = "#dc2626";

const PHASE_X = [150, 164, 178];
const BUS_Y = [250, 262, 274];
const BRANCH_X = [240, 315, 390, 465];
const COIL_X = [760, 860, 960, 1060];
const BRANCH_F_Y = 310;
const BRANCH_K_Y = 400;
const COIL_Y = 420;

const Q1_BOX: Box = { x: 140, y: 100, w: 48, h: 50 };
const F1_BOX: Box = { x: 140, y: 170, w: 48, h: 40 };
const T1_BOX: Box = { x: 580, y: 100, w: 100, h: 60 };
const A1_BOX: Box = { x: 700, y: 220, w: 420, h: 100 };
const F6_BOX: Box = { x: 660, y: 178, w: 30, h: 24 };

function branchBox(i: number, y: number, h: number): Box {
  return { x: BRANCH_X[i] - 8, y, w: 44, h };
}

/** Obdélníky, které daný prvek zabírá (pro revizní obláček a polohu zákresu). */
function boxesOf(designation: string): Box[] {
  switch (designation) {
    case "Q1":
      return [Q1_BOX];
    case "F1":
      return [F1_BOX];
    case "F2":
    case "F3":
    case "F4":
    case "F5":
      return [branchBox(Number(designation[1]) - 2, BRANCH_F_Y, 40)];
    case "K1":
    case "K2":
    case "K3":
    case "K4": {
      const i = Number(designation[1]) - 1;
      return [
        branchBox(i, BRANCH_K_Y, 40),
        { x: COIL_X[i] - 22, y: COIL_Y, w: 44, h: 50 },
      ];
    }
    case "T1":
      return [T1_BOX];
    case "A1":
      return [A1_BOX];
    case "F6":
      return [F6_BOX];
    case "X1":
      return [{ x: COIL_X[0] - 12, y: 552, w: COIL_X[3] - COIL_X[0] + 24, h: 24 }];
    case "X2":
      return [{ x: BRANCH_X[0] - 8, y: 496, w: BRANCH_X[3] - BRANCH_X[0] + 44, h: 18 }];
    default:
      return [];
  }
}

/** Střed prvku ve schématu v normalizovaných souřadnicích 0–1 (pro seedové zákresy). */
export function schematicElementCenter(designation: string): [number, number] {
  const box = boxesOf(designation).at(-1);
  if (!box) throw new Error(`Neznámé označení prvku: ${designation}`);
  return [(box.x + box.w / 2) / SCHEMATIC_WIDTH, (box.y + box.h / 2) / SCHEMATIC_HEIGHT];
}

function line(x1: number, y1: number, x2: number, y2: number, extra = ""): string {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${extra}/>`;
}

function text(
  x: number,
  y: number,
  value: string,
  opts: { size?: number; bold?: boolean; anchor?: "start" | "middle" | "end"; fill?: string; halo?: boolean } = {},
): string {
  const { size = 10, bold = false, anchor = "start", fill = INK, halo = false } = opts;
  const haloAttrs = halo ? ' stroke="#fff" stroke-width="3" paint-order="stroke"' : "";
  return `<text x="${n(x)}" y="${n(y)}" font-size="${size}"${bold ? ' font-weight="700"' : ""} text-anchor="${anchor}" fill="${fill}"${haloAttrs}>${esc(value)}</text>`;
}

function dot(x: number, y: number): string {
  return `<circle cx="${n(x)}" cy="${n(y)}" r="2.6" fill="${INK}"/>`;
}

/** Tři kontakty (silový přístroj) uvnitř obdélníku. */
function threePoleDevice(box: Box, xs: number[], opts: { breaker?: boolean } = {}): string {
  const parts = [
    `<rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" fill="#fff" stroke="${INK}" stroke-width="1.4"/>`,
  ];
  for (const x of xs) {
    const top = box.y + 9;
    const bottom = box.y + box.h - 9;
    parts.push(
      `<circle cx="${n(x)}" cy="${n(top)}" r="2" fill="#fff" stroke="${INK}"/>`,
      `<circle cx="${n(x)}" cy="${n(bottom)}" r="2" fill="#fff" stroke="${INK}"/>`,
      line(x, bottom - 2, x + 6, top + 3),
    );
    if (opts.breaker) {
      parts.push(`<rect x="${n(x - 2.5)}" y="${n(box.y + box.h / 2 - 2)}" width="5" height="4" fill="#fff" stroke="${INK}" stroke-width="0.8"/>`);
    }
  }
  return parts.join("");
}

function cloud(box: Box, pad = 6): string {
  const x = box.x - pad;
  const y = box.y - pad;
  const w = box.w + 2 * pad;
  const h = box.h + 2 * pad;
  const nx = Math.max(2, Math.round(w / 16));
  const ny = Math.max(2, Math.round(h / 16));
  const sx = w / nx;
  const sy = h / ny;
  const arc = (r: number, dx: number, dy: number) => `a${n(r)} ${n(r)} 0 0 1 ${n(dx)} ${n(dy)}`;
  let d = `M${n(x)} ${n(y)}`;
  for (let i = 0; i < nx; i++) d += arc(sx / 2, sx, 0);
  for (let i = 0; i < ny; i++) d += arc(sy / 2, 0, sy);
  for (let i = 0; i < nx; i++) d += arc(sx / 2, -sx, 0);
  for (let i = 0; i < ny; i++) d += arc(sy / 2, 0, -sy);
  return `<path d="${d}Z" fill="none" stroke="${CHANGE}" stroke-width="1.6"/>`;
}

function deltaMarker(x: number, y: number, label: string): string {
  return (
    `<path d="M${n(x)} ${n(y - 13)} L${n(x + 13)} ${n(y + 10)} L${n(x - 13)} ${n(y + 10)} Z" fill="#fff" stroke="${CHANGE}" stroke-width="1.4"/>` +
    text(x, y + 7, label, { size: 10, bold: true, anchor: "middle", fill: CHANGE })
  );
}

function titleBlock(input: SchematicInput, sheet: number, sheetCount: number, changeNote?: string): string {
  const { equipment, revision } = input;
  const x = 800;
  const y = 722;
  const w = 360;
  const cell = (cx: number, cy: number, cw: number, ch: number) =>
    `<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="none" stroke="${INK}" stroke-width="1"/>`;
  const label = (cx: number, cy: number, value: string) => text(cx + 4, cy + 7, value, { size: 6, fill: MUTED });
  const parts = [
    cell(x, y, w, 90),
    cell(x, y, 86, 48),
    text(x + 43, y + 24, "DIGITRY", { size: 14, bold: true, anchor: "middle" }),
    text(x + 43, y + 38, "CAE", { size: 9, anchor: "middle", fill: MUTED }),
    cell(x + 86, y, w - 86, 30),
    label(x + 86, y, "Zařízení"),
    text(x + 92, y + 24, (equipment.name.startsWith(equipment.tag) ? equipment.name : `${equipment.tag} – ${equipment.name}`).slice(0, 44), { size: 11, bold: true }),
    cell(x + 86, y + 30, w - 86, 18),
    text(x + 92, y + 43, revision.title ?? "Elektrické schéma – silový a řídicí obvod", { size: 9 }),
    cell(x, y + 48, 120, 21),
    label(x, y + 48, "Revize"),
    text(x + 6, y + 66, revision.version, { size: 11, bold: true }),
    cell(x + 120, y + 48, 120, 21),
    label(x + 120, y + 48, "Datum"),
    text(x + 126, y + 66, revision.date, { size: 10 }),
    cell(x + 240, y + 48, 120, 21),
    label(x + 240, y + 48, "List"),
    text(x + 246, y + 66, `${sheet} / ${sheetCount}`, { size: 10, bold: true }),
    cell(x, y + 69, 240, 21),
    label(x, y + 69, "Zpracoval"),
    text(x + 6, y + 87, revision.author, { size: 10 }),
    cell(x + 240, y + 69, 120, 21),
    label(x + 240, y + 69, "Formát / měřítko"),
    text(x + 246, y + 87, "A3 · n.t.s.", { size: 10 }),
  ];
  // Tabulka změn vlevo od razítka.
  const tx = 560;
  parts.push(
    cell(tx, y, 240, 90),
    cell(tx, y, 240, 16),
    text(tx + 6, y + 11, "Změna", { size: 8, bold: true }),
    text(tx + 130, y + 11, "Popis", { size: 8, bold: true }),
    cell(tx, y + 16, 60, 74),
    text(tx + 6, y + 32, revision.version, { size: 10, bold: true }),
  );
  const note = changeNote ?? "Výchozí digitalizace dokumentace.";
  const words = note.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > 40) {
      lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  lines.slice(0, 5).forEach((l, i) => parts.push(text(tx + 66, y + 32 + i * 12, l, { size: 8 })));
  return parts.join("");
}

export function renderSchematicSvg(input: SchematicInput): string {
  const { equipment, revision, variant = {} } = input;
  const sheet = input.sheet ?? 1;
  const sheetCount = input.sheetCount ?? 1;
  const parts = new Map(buildParts(equipment.ratedCurrent, variant.overrides).map((p) => [p.designation, p]));
  const part = (d: string) => parts.get(d)!;
  const out: string[] = [];

  // Rám a zóny
  out.push(
    `<rect width="${SCHEMATIC_WIDTH}" height="${SCHEMATIC_HEIGHT}" fill="#fff"/>`,
    `<rect x="10" y="10" width="1170" height="822" fill="none" stroke="${INK}" stroke-width="0.8"/>`,
    `<rect x="30" y="30" width="1130" height="782" fill="none" stroke="${INK}" stroke-width="2"/>`,
  );
  for (let i = 1; i <= 8; i++) {
    const zx = 30 + (1130 / 8) * (i - 0.5);
    out.push(text(zx, 24, String(i), { size: 9, anchor: "middle", fill: MUTED }));
  }
  "ABCDEF".split("").forEach((c, i) => out.push(text(20, 30 + (782 / 6) * (i + 0.5) + 3, c, { size: 9, anchor: "middle", fill: MUTED })));

  // --- Silový obvod ---
  out.push(text(60, 56, "SILOVÝ OBVOD", { size: 11, bold: true }), line(60, 61, 300, 61, `stroke="${INK}" stroke-width="0.8"`));
  const wire = `stroke="${INK}" stroke-width="1.3"`;
  ["L1", "L2", "L3"].forEach((l, i) => out.push(text(PHASE_X[i], 74, l, { size: 10, bold: true, anchor: "middle" })));
  out.push(text(200, 74, "N", { size: 10, bold: true, anchor: "middle" }), text(214, 74, "PE", { size: 10, bold: true, anchor: "middle" }));

  // Q1
  out.push(`<g data-designation="Q1">`);
  PHASE_X.forEach((x) => out.push(line(x, 80, x, Q1_BOX.y, wire)));
  out.push(
    threePoleDevice(Q1_BOX, PHASE_X),
    line(PHASE_X[0] + 3, Q1_BOX.y + Q1_BOX.h / 2, PHASE_X[2] + 3, Q1_BOX.y + Q1_BOX.h / 2, `stroke="${INK}" stroke-dasharray="3 2"`),
    text(224, 118, "Q1", { size: 11, bold: true }),
    text(224, 131, part("Q1").description, { size: 9 }),
    text(224, 143, `${part("Q1").manufacturer} ${part("Q1").partNumber}`, { size: 8, fill: MUTED }),
    `</g>`,
  );

  // F1
  out.push(`<g data-designation="F1">`);
  PHASE_X.forEach((x) => out.push(line(x, Q1_BOX.y + Q1_BOX.h, x, F1_BOX.y, wire)));
  out.push(
    threePoleDevice(F1_BOX, PHASE_X, { breaker: true }),
    text(224, 188, "F1", { size: 11, bold: true }),
    text(224, 201, part("F1").description, { size: 9 }),
    text(224, 213, `${part("F1").manufacturer} ${part("F1").partNumber}`, { size: 8, fill: MUTED }),
    `</g>`,
  );

  // N, PE a přípojnice
  out.push(
    line(200, 80, 200, 560, wire),
    line(214, 80, 214, 580, `stroke="#15803d" stroke-width="1.3"`),
    line(200, 560, 500, 560, wire),
    line(214, 580, 500, 580, `stroke="#15803d" stroke-width="1.3"`),
    text(506, 563, "N", { size: 9 }),
    text(506, 583, "PE", { size: 9 }),
  );
  PHASE_X.forEach((x, k) => {
    out.push(line(x, F1_BOX.y + F1_BOX.h, x, BUS_Y[k], wire), line(x, BUS_Y[k], 500, BUS_Y[k], wire), dot(x, BUS_Y[k]));
  });
  out.push(text(506, 266, "L1–L3", { size: 9 }));

  // Odbočky
  for (let i = 0; i < 4; i++) {
    const xs = [BRANCH_X[i], BRANCH_X[i] + 14, BRANCH_X[i] + 28];
    const fDes = `F${i + 2}`;
    const kDes = `K${i + 1}`;
    const fBox = branchBox(i, BRANCH_F_Y, 40);
    const kBox = branchBox(i, BRANCH_K_Y, 40);
    xs.forEach((x, k) => {
      out.push(line(x, BUS_Y[k], x, fBox.y, wire), dot(x, BUS_Y[k]), line(x, fBox.y + fBox.h, x, kBox.y, wire), line(x, kBox.y + kBox.h, x, 500, wire));
    });
    out.push(
      `<g data-designation="${fDes}">`,
      threePoleDevice(fBox, xs, { breaker: true }),
      text(fBox.x + fBox.w + 3, fBox.y + 12, fDes, { size: 10, bold: true }),
      text(fBox.x, fBox.y + fBox.h + 11, part(fDes).partNumber, { size: 7.5, fill: MUTED, halo: true }),
      `</g>`,
      `<g data-designation="${kDes}" data-part="power">`,
      threePoleDevice(kBox, xs),
      text(kBox.x + kBox.w + 3, kBox.y + 12, kDes, { size: 10, bold: true }),
      text(kBox.x, kBox.y + kBox.h + 11, part(kDes).partNumber, { size: 7.5, fill: MUTED, halo: true }),
      `</g>`,
    );
    // X2
    out.push(`<g data-designation="X2">`);
    xs.forEach((x, k) => {
      out.push(
        `<rect x="${n(x - 5)}" y="500" width="10" height="10" fill="#fff" stroke="${INK}"/>`,
        text(x, 508, String(i * 3 + k + 1), { size: 6.5, anchor: "middle" }),
      );
    });
    out.push(`</g>`, text(xs[0] - 6, 526, `Odbočka ${i + 1}`, { size: 8 }), text(xs[0] - 6, 537, `→ M${i + 1}`, { size: 8, fill: MUTED }));
  }
  out.push(text(60, 500, "X2", { size: 10, bold: true }), text(60, 513, part("X2").partNumber, { size: 7.5, fill: MUTED }));

  // --- Řídicí obvod ---
  out.push(text(580, 56, "ŘÍDICÍ OBVOD 24 V DC", { size: 11, bold: true }), line(580, 61, 840, 61, `stroke="${INK}" stroke-width="0.8"`));
  out.push(`<g data-designation="T1">`);
  [592, 606, 620].forEach((x) => out.push(line(x, 82, x, T1_BOX.y, wire)));
  out.push(
    text(606, 78, "400 V AC (L1–L3)", { size: 7.5, anchor: "middle", fill: MUTED }),
    `<rect x="${T1_BOX.x}" y="${T1_BOX.y}" width="${T1_BOX.w}" height="${T1_BOX.h}" fill="#fff" stroke="${INK}" stroke-width="1.4"/>`,
    line(T1_BOX.x, T1_BOX.y + T1_BOX.h, T1_BOX.x + T1_BOX.w, T1_BOX.y, `stroke="${INK}" stroke-width="0.8"`),
    text(T1_BOX.x + 6, T1_BOX.y + 14, "~", { size: 14 }),
    text(T1_BOX.x + T1_BOX.w - 6, T1_BOX.y + T1_BOX.h - 6, "=", { size: 14, anchor: "end" }),
    text(T1_BOX.x + T1_BOX.w + 8, T1_BOX.y + 14, "T1", { size: 11, bold: true }),
    text(T1_BOX.x + T1_BOX.w + 8, T1_BOX.y + 27, part("T1").description, { size: 8.5 }),
    text(T1_BOX.x + T1_BOX.w + 8, T1_BOX.y + 39, `${part("T1").manufacturer} ${part("T1").partNumber}`, { size: 8, fill: MUTED }),
    `</g>`,
  );
  // +24 V a 0 V
  out.push(
    line(640, 160, 640, 190, wire),
    line(640, 190, F6_BOX.x, 190, wire),
    line(F6_BOX.x + F6_BOX.w, 190, 1120, 190, `stroke="#b91c1c" stroke-width="1.4"`),
    dot(640, 190),
    text(1126, 193, "+24 V", { size: 9, bold: true }),
    line(585, 160, 585, 690, `stroke="#1d4ed8" stroke-width="1.4"`),
    line(585, 690, 1120, 690, `stroke="#1d4ed8" stroke-width="1.4"`),
    text(1126, 693, "0 V", { size: 9, bold: true }),
    `<g data-designation="F6">`,
    `<rect x="${F6_BOX.x}" y="${F6_BOX.y}" width="${F6_BOX.w}" height="${F6_BOX.h}" fill="#fff" stroke="${INK}" stroke-width="1.4"/>`,
    line(F6_BOX.x + 5, F6_BOX.y + F6_BOX.h - 4, F6_BOX.x + F6_BOX.w - 5, F6_BOX.y + 4),
    text(F6_BOX.x + F6_BOX.w / 2, F6_BOX.y - 5, "F6", { size: 10, bold: true, anchor: "middle" }),
    text(F6_BOX.x + F6_BOX.w / 2, F6_BOX.y + F6_BOX.h + 11, part("F6").partNumber, { size: 7.5, fill: MUTED, anchor: "middle" }),
    `</g>`,
  );

  // PLC A1
  out.push(
    `<g data-designation="A1">`,
    `<rect x="${A1_BOX.x}" y="${A1_BOX.y}" width="${A1_BOX.w}" height="${A1_BOX.h}" fill="#fff" stroke="${INK}" stroke-width="1.6"/>`,
    text(A1_BOX.x + 10, A1_BOX.y + 20, "A1", { size: 12, bold: true }),
    text(A1_BOX.x + 36, A1_BOX.y + 20, part("A1").description, { size: 9 }),
    text(A1_BOX.x + 36, A1_BOX.y + 33, `${part("A1").manufacturer} ${part("A1").partNumber}`, { size: 8, fill: MUTED }),
    line(720, 190, 720, A1_BOX.y, wire),
    dot(720, 190),
    text(726, 216, "L+", { size: 8 }),
    `</g>`,
  );

  // Cívky K1–K4 a svorky X1
  out.push(`<g data-designation="X1">`);
  for (let i = 0; i < 4; i++) {
    const cx = COIL_X[i];
    const terminalLabel = i === 3 && variant.a2Terminal ? variant.a2Terminal : `X1:${9 + i}`;
    const terminalNo = terminalLabel.split(":")[1] ?? String(9 + i);
    out.push(
      text(cx, A1_BOX.y + A1_BOX.h - 10, `Q0.${i}`, { size: 8, anchor: "middle" }),
      `<circle cx="${cx}" cy="${A1_BOX.y + A1_BOX.h}" r="2.5" fill="#fff" stroke="${INK}"/>`,
      line(cx, A1_BOX.y + A1_BOX.h, cx, COIL_Y, wire),
      line(cx, COIL_Y + 50, cx, 556, wire),
      line(cx, 572, cx, 690, wire),
      dot(cx, 690),
      text(cx + 6, 520, terminalLabel, { size: 8, fill: i === 3 && variant.a2Terminal ? CHANGE : MUTED }),
      `<rect x="${cx - 8}" y="556" width="16" height="16" fill="#fff" stroke="${INK}"/>`,
      text(cx, 568, terminalNo, { size: 8, anchor: "middle" }),
    );
  }
  out.push(`</g>`);
  for (let i = 0; i < 4; i++) {
    const cx = COIL_X[i];
    const des = `K${i + 1}`;
    out.push(
      `<g data-designation="${des}" data-part="coil">`,
      `<rect x="${cx - 22}" y="${COIL_Y}" width="44" height="50" fill="#fff" stroke="${INK}" stroke-width="1.4"/>`,
      line(cx - 22, COIL_Y + 8, cx + 22, COIL_Y + 8),
      text(cx, COIL_Y + 32, des, { size: 12, bold: true, anchor: "middle" }),
      text(cx - 6, COIL_Y - 4, "A1", { size: 7.5, anchor: "end" }),
      text(cx - 6, COIL_Y + 62, "A2", { size: 7.5, anchor: "end" }),
      text(cx, COIL_Y - 14, part(des).partNumber, { size: 7.5, fill: MUTED, anchor: "middle", halo: true }),
      `</g>`,
    );
  }
  out.push(text(COIL_X[0] - 70, 568, "X1", { size: 10, bold: true }), text(COIL_X[0] - 70, 581, part("X1").partNumber, { size: 7.5, fill: MUTED }));
  out.push(text(700, 625, "Svorkovnice X1: cívky stykačů K1–K4 → 0 V", { size: 8, fill: MUTED }));

  // Revizní obláčky
  const changed = variant.changed ?? [];
  const minor = revision.version.replace(/^v\d+\./, "").slice(0, 2) || "1";
  changed.forEach((des, idx) => {
    const boxes = boxesOf(des);
    boxes.forEach((box, bi) => {
      out.push(cloud(box));
      if (idx === 0 && bi === 0) out.push(deltaMarker(box.x - 14, box.y - 16, minor));
    });
  });

  out.push(titleBlock(input, sheet, sheetCount, variant.changeNote));

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCHEMATIC_WIDTH} ${SCHEMATIC_HEIGHT}" ` +
    `width="${SCHEMATIC_WIDTH}" height="${SCHEMATIC_HEIGHT}" font-family="Arial, Helvetica, sans-serif">` +
    `<title>${esc(`${equipment.tag} – schéma ${revision.version}, list ${sheet}`)}</title>` +
    out.join("") +
    `</svg>\n`
  );
}
