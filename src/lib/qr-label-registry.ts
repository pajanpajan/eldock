// Fáze 103: registr průmyslových QR štítků ELDOCK – globálně unikátní sériová čísla EL-000001 … (nikdy se neopakují:
// monotónní počítadlo v databázi + UNIQUE na `serialCode` a `sequence`), tři rozměry pro termotransferovou tiskárnu
// Zebra ZD421t (300 DPI = 11,811 bodu / mm) a kód ZPL. Čisté funkce bez I/O.

export const QR_BASE_URL = "https://eldock.cz/q";
export const QR_SERIAL_PREFIX = "EL";
/** Šířka čísla série – EL-000001 až EL-999999, pak se číslo prodlouží (EL-1000000) a dál zůstane unikátní. */
export const QR_SERIAL_DIGITS = 6;

/** Sériové číslo štítku z pořadového čísla (1 → „EL-000001“). */
export function serialCode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error(`Neplatné pořadové číslo štítku ${sequence}.`);
  return `${QR_SERIAL_PREFIX}-${String(sequence).padStart(QR_SERIAL_DIGITS, "0")}`;
}

/** Pořadové číslo ze sériového čísla („EL-000042“ → 42), jiný tvar → null. */
export function sequenceOf(code: string): number | null {
  const match = /^EL-(\d{6,9})$/.exec(code.trim().toUpperCase());
  return match ? Number(match[1]) : null;
}

export const isSerialCode = (code: string) => sequenceOf(code) !== null;

/** Cílová adresa v QR kódu štítku. */
export const qrUrl = (code: string) => `${QR_BASE_URL}/${code}`;

/** Rozsah nové série: po posledním vydaném čísle `last` dalších `count` štítků. */
export function batchRange(last: number, count: number): { first: number; last: number; codes: string[] } {
  if (!Number.isInteger(count) || count < 1 || count > 5000) throw new Error("Série má 1 až 5 000 štítků.");
  const first = last + 1;
  return { first, last: last + count, codes: Array.from({ length: count }, (_, index) => serialCode(first + index)) };
}

/** Účel a rozměr štítku (termotransfer Zebra ZD421t, 300 DPI). */
export const LABEL_PURPOSES = [
  { id: "APPLIANCE", icon: "🔌", title: "SPOTŘEBIČ & NÁŘADÍ", norm: "ČSN 33 1600 ed. 2", widthMm: 30, heightMm: 15, caption: "REVIZE ELDOCK.CZ" },
  { id: "SWITCHBOARD", icon: "⚡", title: "ROZVÁDĚČ", norm: "ČSN EN IEC 61439", widthMm: 50, heightMm: 25, caption: "DOKUMENTACE ROZVÁDĚČE" },
  { id: "MACHINE", icon: "🏭", title: "STROJ & PRŮMYSL", norm: "EU 2023/1230", widthMm: 70, heightMm: 40, caption: "QR DIAGNOSTIKA STROJE" },
] as const;
export type LabelPurpose = (typeof LABEL_PURPOSES)[number]["id"];
export const labelPurpose = (id: string) => LABEL_PURPOSES.find((purpose) => purpose.id === id) ?? LABEL_PURPOSES[1];
export const purposeLabel = (id: string) => {
  const purpose = labelPurpose(id);
  return `${purpose.icon} ${purpose.title} (${purpose.widthMm} × ${purpose.heightMm} mm – ${purpose.norm})`;
};

/** 300 DPI: body tiskárny na milimetr. */
export const DOTS_PER_MM = 300 / 25.4;
export const dots = (mm: number) => Math.round(mm * DOTS_PER_MM);

/** Text do ZPL (bez řídicích znaků ^ a ~, diakritika přes ^CI28 = UTF-8). */
const zplText = (value: string) => value.replace(/[\^~\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

/**
 * ZPL II jednoho štítku pro Zebra ZD421t (300 DPI, termotransfer): QR kód tiskárny `^BQ` (model 2, korekce H,
 * vlevo) s adresou štítku, sériové číslo a popisek vpravo. Logo uprostřed QR kódu nativní `^BQ` neumí – štítek
 * s logem ELDOCK tiskněte z PDF 1:1 (`/tisk`); ZPL je rychlý tisk čistého kódu se stejnou adresou.
 */
export function labelZpl(input: { code: string; purpose: string; companyName?: string | null }): string {
  const purpose = labelPurpose(input.purpose);
  const width = dots(purpose.widthMm);
  const height = dots(purpose.heightMm);
  const margin = dots(1.2);
  // Velikost modulu QR: kód zabere ~85 % výšky štítku (verze 3–4 = 29–33 modulů + okraj)
  const magnification = Math.max(2, Math.min(10, Math.floor((height - 2 * margin) / 37)));
  const qrSize = magnification * 37;
  const textX = margin + qrSize + dots(1.5);
  const big = purpose.id === "APPLIANCE" ? 28 : purpose.id === "SWITCHBOARD" ? 40 : 56;
  const small = Math.round(big * 0.62);
  const lines = [
    "^XA",
    "^CI28",
    `^PW${width}`,
    `^LL${height}`,
    "^LH0,0",
    `^FO${margin},${margin}^BQN,2,${magnification}^FDHA,${qrUrl(input.code)}^FS`,
    `^FO${textX},${margin + dots(0.5)}^A0N,${big},${big}^FD${input.code}^FS`,
    `^FO${textX},${margin + dots(0.5) + big + dots(0.8)}^A0N,${small},${small}^FDELDOCK.CZ^FS`,
  ];
  if (purpose.id !== "APPLIANCE" && input.companyName) lines.push(`^FO${textX},${margin + dots(0.5) + big + small + dots(1.6)}^A0N,${small},${small}^FD${zplText(input.companyName)}^FS`);
  lines.push(`^FO${textX},${height - margin - small}^A0N,${small},${small}^FD${zplText(purpose.caption)}^FS`, "^PQ1", "^XZ");
  return lines.join("\n");
}

/** ZPL celé série (štítky za sebou). */
export const batchZpl = (codes: readonly string[], purpose: string, companyName?: string | null) => codes.map((code) => labelZpl({ code, purpose, companyName })).join("\n");

/** Logo ELDOCK do středu QR kódu: „EL“ v rámečku, černobílé, vektor (data URI pro `imageSettings`). */
export const QR_LOGO_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#fff"/><rect x="3" y="3" width="34" height="34" rx="5" fill="#000"/><rect x="6" y="6" width="28" height="28" rx="3" fill="#fff"/><text x="20" y="27" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="900" fill="#000">EL</text></svg>',
  );
