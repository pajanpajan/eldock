import { esc, n } from "./svg";

// SVG dokumenty pasportu a lhůtníku: protokoly (prohlášení o shodě, kusová zkouška,
// výpočet oteplení, vnější vlivy), revizní zprávy a liniové schéma rozvodny.
// A4 na výšku (794 × 1123), žádné externí fonty ani obrázky.

const W = 794;
const H = 1123;
const M = 56;
const FONT = "Segoe UI, Arial, sans-serif";
const MONO = "ui-monospace, Consolas, monospace";

export type DocumentTone = "ok" | "warning" | "danger" | "neutral";

const TONES: Record<DocumentTone, { fill: string; stroke: string; text: string }> = {
  ok: { fill: "#ecfdf5", stroke: "#059669", text: "#065f46" },
  warning: { fill: "#fffbeb", stroke: "#d97706", text: "#92400e" },
  danger: { fill: "#fef2f2", stroke: "#dc2626", text: "#991b1b" },
  neutral: { fill: "#f4f4f5", stroke: "#71717a", text: "#27272a" },
};

export interface DocumentSection {
  heading: string;
  /** Odstavce textu (zalamují se automaticky). */
  lines?: string[];
  /** Tabulka: první řádek = záhlaví. */
  table?: string[][];
}

export interface DocumentInput {
  /** Hlavička vystavitele („Elektro Lumen s.r.o. · výrobce rozváděčů“). */
  issuer: string;
  title: string;
  subtitle?: string;
  documentNumber: string;
  /** Údaje v rámečku pod nadpisem (štítek → hodnota). */
  meta: [string, string][];
  sections: DocumentSection[];
  verdict?: { label: string; text: string; tone: DocumentTone };
  signature: { name: string; role: string; date: string };
}

/** Zalomení textu podle odhadu šířky znaků. */
function wrap(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > maxChars) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

function table(rows: string[][], x: number, y: number, width: number): { svg: string; height: number } {
  const cols = rows[0]?.length ?? 0;
  const colW = width / Math.max(cols, 1);
  const rowH = 24;
  const out: string[] = [];
  rows.forEach((row, r) => {
    const ry = y + r * rowH;
    out.push(`<rect x="${n(x)}" y="${n(ry)}" width="${n(width)}" height="${rowH}" fill="${r === 0 ? "#e4e4e7" : r % 2 ? "#ffffff" : "#fafafa"}" stroke="#d4d4d8"/>`);
    row.forEach((cell, c) => {
      const maxChars = Math.floor(colW / 6.4);
      const value = cell.length > maxChars ? `${cell.slice(0, maxChars - 1)}…` : cell;
      out.push(
        `<text x="${n(x + c * colW + 8)}" y="${n(ry + 16)}" font-family="${FONT}" font-size="11.5" fill="#18181b"${r === 0 ? ' font-weight="700"' : ""}>${esc(value)}</text>`,
      );
    });
  });
  for (let c = 1; c < cols; c++) out.push(`<line x1="${n(x + c * colW)}" y1="${n(y)}" x2="${n(x + c * colW)}" y2="${n(y + rows.length * rowH)}" stroke="#d4d4d8"/>`);
  return { svg: out.join(""), height: rows.length * rowH };
}

/** Obecný protokol / revizní zpráva na jednu stranu A4. */
export function renderDocumentSvg(input: DocumentInput): string {
  const out: string[] = [];
  const inner = W - 2 * M;
  out.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
  out.push(`<rect x="${M - 20}" y="${M - 24}" width="${inner + 40}" height="${H - 2 * M + 48}" fill="none" stroke="#a1a1aa"/>`);

  // Hlavička vystavitele
  out.push(`<rect x="${M - 20}" y="${M - 24}" width="${inner + 40}" height="40" fill="#18181b"/>`);
  out.push(`<text x="${M}" y="${M + 2}" font-family="${FONT}" font-size="13" font-weight="600" fill="#facc15">${esc(input.issuer)}</text>`);
  out.push(`<text x="${W - M}" y="${M + 2}" font-family="${MONO}" font-size="12" fill="#e4e4e7" text-anchor="end">${esc(input.documentNumber)}</text>`);

  let y = M + 62;
  out.push(`<text x="${M}" y="${y}" font-family="${FONT}" font-size="24" font-weight="700" fill="#09090b">${esc(input.title)}</text>`);
  y += 24;
  if (input.subtitle) {
    for (const line of wrap(input.subtitle, 95)) {
      out.push(`<text x="${M}" y="${y}" font-family="${FONT}" font-size="12.5" fill="#52525b">${esc(line)}</text>`);
      y += 17;
    }
  }
  y += 10;

  // Údaje v rámečku (dva sloupce)
  const metaRows = Math.ceil(input.meta.length / 2);
  const metaH = metaRows * 34 + 12;
  out.push(`<rect x="${M}" y="${y}" width="${inner}" height="${metaH}" fill="#fafafa" stroke="#d4d4d8"/>`);
  input.meta.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + 12 + col * (inner / 2);
    const my = y + 20 + row * 34;
    out.push(`<text x="${x}" y="${my}" font-family="${FONT}" font-size="10" fill="#71717a">${esc(label.toUpperCase())}</text>`);
    const maxChars = 50;
    const shown = value.length > maxChars ? `${value.slice(0, maxChars - 1)}…` : value;
    out.push(`<text x="${x}" y="${my + 15}" font-family="${FONT}" font-size="13" font-weight="600" fill="#18181b">${esc(shown)}</text>`);
  });
  y += metaH + 26;

  // Oddíly
  for (const section of input.sections) {
    if (y > H - 260) break;
    out.push(`<text x="${M}" y="${y}" font-family="${FONT}" font-size="14" font-weight="700" fill="#09090b">${esc(section.heading)}</text>`);
    out.push(`<line x1="${M}" y1="${y + 6}" x2="${W - M}" y2="${y + 6}" stroke="#facc15" stroke-width="2"/>`);
    y += 24;
    for (const paragraph of section.lines ?? []) {
      for (const line of wrap(paragraph, 100)) {
        out.push(`<text x="${M}" y="${y}" font-family="${FONT}" font-size="12" fill="#27272a">${esc(line)}</text>`);
        y += 17;
      }
      y += 4;
    }
    if (section.table?.length) {
      const t = table(section.table, M, y - 6, inner);
      out.push(t.svg);
      y += t.height + 8;
    }
    y += 14;
  }

  // Posudek
  if (input.verdict) {
    const tone = TONES[input.verdict.tone];
    const lines = wrap(input.verdict.text, 92);
    const boxH = 40 + lines.length * 17;
    const by = Math.min(y, H - 210 - boxH);
    out.push(`<rect x="${M}" y="${by}" width="${inner}" height="${boxH}" rx="6" fill="${tone.fill}" stroke="${tone.stroke}" stroke-width="2"/>`);
    out.push(`<text x="${M + 14}" y="${by + 24}" font-family="${FONT}" font-size="14" font-weight="700" fill="${tone.text}">${esc(input.verdict.label)}</text>`);
    lines.forEach((line, i) => {
      out.push(`<text x="${M + 14}" y="${by + 44 + i * 17}" font-family="${FONT}" font-size="12" fill="${tone.text}">${esc(line)}</text>`);
    });
  }

  // Podpis a razítko
  const sy = H - 150;
  out.push(`<line x1="${W - M - 250}" y1="${sy + 40}" x2="${W - M}" y2="${sy + 40}" stroke="#71717a"/>`);
  out.push(`<path d="M ${W - M - 230} ${sy + 30} c 20 -26 34 8 52 -10 s 30 -14 44 4 s 26 -6 40 -12" fill="none" stroke="#1d4ed8" stroke-width="1.6"/>`);
  out.push(`<text x="${W - M}" y="${sy + 58}" font-family="${FONT}" font-size="12" font-weight="600" fill="#18181b" text-anchor="end">${esc(input.signature.name)}</text>`);
  out.push(`<text x="${W - M}" y="${sy + 74}" font-family="${FONT}" font-size="10.5" fill="#52525b" text-anchor="end">${esc(input.signature.role)}</text>`);
  out.push(`<text x="${M}" y="${sy + 58}" font-family="${FONT}" font-size="12" fill="#18181b">Datum: ${esc(input.signature.date)}</text>`);
  out.push(`<circle cx="${M + 230}" cy="${sy + 30}" r="34" fill="none" stroke="#2563eb" stroke-width="2" opacity="0.55"/>`);
  out.push(`<text x="${M + 230}" y="${sy + 34}" font-family="${FONT}" font-size="9" fill="#2563eb" opacity="0.7" text-anchor="middle">RAZÍTKO</text>`);

  out.push(`<text x="${W / 2}" y="${H - M + 14}" font-family="${FONT}" font-size="9.5" fill="#a1a1aa" text-anchor="middle">Demo dokument ELDOCK · eldock.cz – vygenerováno aplikací, fiktivní údaje · strana 1/1</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${out.join("")}</svg>`;
}

export interface SingleLineFeeder {
  /** „Pole 2 / QF2“ */
  circuit: string;
  /** Napájené zařízení („R-CNC-04“). */
  label: string;
  /** Jmenovitý proud jističe („160 A“). */
  rating?: string;
}

export interface SingleLineInput {
  tag: string;
  name: string;
  ratedCurrent: string | null;
  supply: string;
  documentNumber: string;
  author: string;
  date: string;
  feeders: SingleLineFeeder[];
}

/** Liniové (jednopólové) schéma rozváděče: přívod, hlavní jistič, přípojnice a vývody. */
export function renderSingleLineSvg(input: SingleLineInput): string {
  const SW = 1123;
  const SH = 794;
  const out: string[] = [`<rect width="${SW}" height="${SH}" fill="#ffffff"/>`];
  out.push(`<rect x="20" y="20" width="${SW - 40}" height="${SH - 40}" fill="none" stroke="#18181b" stroke-width="2"/>`);
  out.push(`<text x="44" y="60" font-family="${FONT}" font-size="20" font-weight="700" fill="#09090b">Liniové schéma – ${esc(input.name)}</text>`);
  out.push(`<text x="44" y="82" font-family="${FONT}" font-size="12" fill="#52525b">Jednopólové zobrazení, TN-C-S 3/PEN AC 400/230 V 50 Hz · ČSN EN 61439-2</text>`);

  const cx = SW / 2;
  // Přívod
  out.push(`<text x="${cx}" y="122" font-family="${FONT}" font-size="12" fill="#18181b" text-anchor="middle">${esc(input.supply)}</text>`);
  out.push(`<line x1="${cx}" y1="130" x2="${cx}" y2="196" stroke="#18181b" stroke-width="2.5"/>`);
  // Hlavní jistič QF0
  out.push(`<line x1="${cx}" y1="196" x2="${cx + 16}" y2="224" stroke="#18181b" stroke-width="2.5"/>`);
  out.push(`<line x1="${cx - 6}" y1="190" x2="${cx + 6}" y2="202" stroke="#18181b" stroke-width="2"/><line x1="${cx + 6}" y1="190" x2="${cx - 6}" y2="202" stroke="#18181b" stroke-width="2"/>`);
  out.push(`<line x1="${cx}" y1="230" x2="${cx}" y2="270" stroke="#18181b" stroke-width="2.5"/>`);
  out.push(`<text x="${cx + 26}" y="214" font-family="${MONO}" font-size="13" font-weight="700" fill="#18181b">QF0</text>`);
  out.push(`<text x="${cx + 26}" y="230" font-family="${FONT}" font-size="11" fill="#52525b">${esc(input.ratedCurrent ?? "")} – hlavní vypínač</text>`);
  // Přípojnice
  const feeders = input.feeders.length ? input.feeders : [{ circuit: "Rezerva", label: "—" }];
  const left = 90;
  const right = SW - 90;
  out.push(`<rect x="${left}" y="270" width="${right - left}" height="8" fill="#b45309"/>`);
  out.push(`<text x="${left}" y="262" font-family="${FONT}" font-size="11" fill="#92400e">Přípojnice L1, L2, L3, PEN</text>`);
  const step = (right - left) / feeders.length;
  feeders.forEach((feeder, i) => {
    const x = left + step * (i + 0.5);
    const [field, breaker] = feeder.circuit.split("/").map((part) => part.trim());
    out.push(`<line x1="${n(x)}" y1="278" x2="${n(x)}" y2="340" stroke="#18181b" stroke-width="2"/>`);
    out.push(`<line x1="${n(x)}" y1="340" x2="${n(x + 13)}" y2="364" stroke="#18181b" stroke-width="2"/>`);
    out.push(`<line x1="${n(x - 5)}" y1="335" x2="${n(x + 5)}" y2="345" stroke="#18181b" stroke-width="1.6"/><line x1="${n(x + 5)}" y1="335" x2="${n(x - 5)}" y2="345" stroke="#18181b" stroke-width="1.6"/>`);
    out.push(`<line x1="${n(x)}" y1="370" x2="${n(x)}" y2="470" stroke="#18181b" stroke-width="2"/>`);
    out.push(`<polygon points="${n(x - 7)},470 ${n(x + 7)},470 ${n(x)},484" fill="#18181b"/>`);
    out.push(`<text x="${n(x + 8)}" y="330" font-family="${MONO}" font-size="12" font-weight="700" fill="#18181b">${esc(breaker ?? "")}</text>`);
    if (feeder.rating) out.push(`<text x="${n(x + 8)}" y="392" font-family="${FONT}" font-size="10.5" fill="#52525b">${esc(feeder.rating)}</text>`);
    out.push(`<text x="${n(x)}" y="508" font-family="${FONT}" font-size="11" fill="#52525b" text-anchor="middle">${esc(field ?? "")}</text>`);
    out.push(`<text x="${n(x)}" y="526" font-family="${MONO}" font-size="12.5" font-weight="700" fill="#09090b" text-anchor="middle">${esc(feeder.label)}</text>`);
  });

  // Razítko
  const bx = SW - 440;
  const by = SH - 130;
  out.push(`<rect x="${bx}" y="${by}" width="400" height="90" fill="#fafafa" stroke="#18181b"/>`);
  out.push(`<line x1="${bx}" y1="${by + 30}" x2="${bx + 400}" y2="${by + 30}" stroke="#18181b"/><line x1="${bx + 200}" y1="${by + 30}" x2="${bx + 200}" y2="${by + 90}" stroke="#18181b"/>`);
  out.push(`<text x="${bx + 10}" y="${by + 20}" font-family="${FONT}" font-size="13" font-weight="700" fill="#09090b">${esc(input.tag)} · liniové schéma</text>`);
  out.push(`<text x="${bx + 10}" y="${by + 52}" font-family="${FONT}" font-size="11" fill="#52525b">Číslo dokumentu</text>`);
  out.push(`<text x="${bx + 10}" y="${by + 72}" font-family="${MONO}" font-size="12" fill="#09090b">${esc(input.documentNumber)}</text>`);
  out.push(`<text x="${bx + 210}" y="${by + 52}" font-family="${FONT}" font-size="11" fill="#52525b">Vypracoval · datum</text>`);
  out.push(`<text x="${bx + 210}" y="${by + 72}" font-family="${FONT}" font-size="12" fill="#09090b">${esc(input.author)} · ${esc(input.date)}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}" width="${SW}" height="${SH}">${out.join("")}</svg>`;
}
