// Fáze 105: export poptávky / košíku do elektro-velkoobchodu z kusovníku 2D půdorysu, rozváděče nebo cenové nabídky.
//
// Formáty souborů pro import košíku: Sonepar ČR (objednací číslo / EAN; množství; jednotka; poznámka), ELKOV elektro
// (EAN / katalogové číslo; množství), K&V ELEKTRO (CSV / XLSX: objednací číslo, EAN, název, množství, jednotka), DEK
// (poptávkový list s EAN a MPN) a univerzální B2B poptávka (CSV / XLSX / XML). Sloupce odpovídají zadání provozovatele;
// přesné šablony importu se u jednotlivých velkoobchodů mohou lišit (ověřit s obchodním zástupcem).

import { buildXlsx } from "@/lib/xlsx";

export type WholesalerId = "sonepar" | "elkov" | "kv" | "dek" | "universal";

export interface Wholesaler {
  id: WholesalerId;
  label: string;
  site: string;
  hint: string;
  /** Formáty souboru pro import (první = výchozí). */
  formats: readonly ("csv" | "xlsx" | "xml")[];
}

export const WHOLESALERS: readonly Wholesaler[] = [
  { id: "sonepar", label: "Sonepar ČR", site: "sonepar.cz", hint: "B2B import košíku: Objednací číslo / EAN; Množství; Jednotka; Poznámka", formats: ["csv", "xlsx"] },
  { id: "elkov", label: "ELKOV elektro", site: "elkov.cz", hint: "Rychlý import podle EAN / katalogového čísla", formats: ["csv", "xlsx"] },
  { id: "kv", label: "K&V ELEKTRO", site: "kvelektro.cz", hint: "B2B import košíku CSV / XLSX", formats: ["xlsx", "csv"] },
  { id: "dek", label: "DEK / Stavebniny DEK Elektro", site: "dek.cz", hint: "Poptávkový list s EAN a MPN", formats: ["xlsx", "csv"] },
  { id: "universal", label: "Univerzální B2B poptávka", site: "", hint: "XLSX / CSV / XML + e-mail obchodnímu zástupci", formats: ["xlsx", "csv", "xml"] },
];

export const wholesalerOf = (id: string | null | undefined): Wholesaler => WHOLESALERS.find((entry) => entry.id === id) ?? WHOLESALERS[0];

/** Řádek poptávky (položka kusovníku). */
export interface OrderLine {
  /** Objednací číslo výrobce (MPN). */
  code: string | null;
  ean: string | null;
  name: string;
  manufacturer?: string | null;
  quantity: number;
  unit: string;
  note?: string | null;
}

export interface OrderFile {
  name: string;
  mime: string;
  content: string | Uint8Array;
}

/** Jen položky s množstvím; stejné objednací číslo / EAN se sečte. */
export function orderLines(lines: readonly OrderLine[]): OrderLine[] {
  const merged = new Map<string, OrderLine>();
  for (const line of lines) {
    if (!(line.quantity > 0)) continue;
    const key = line.ean || line.code || `${line.name}|${line.unit}`;
    const own = merged.get(key);
    if (own) own.quantity = Math.round((own.quantity + line.quantity) * 100) / 100;
    else merged.set(key, { ...line, quantity: Math.round(line.quantity * 100) / 100 });
  }
  return [...merged.values()];
}

const quantityText = (value: number) => String(value).replace(".", ",");
/** CSV se středníkem (český Excel), UTF-8 s BOM, uvozovky jen kde je třeba. */
export function csv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const cell = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : typeof value === "number" ? quantityText(value) : value;
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `﻿${rows.map((row) => row.map(cell).join(";")).join("\r\n")}\r\n`;
}

const xml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Řádky importního souboru podle velkoobchodu (záhlaví + položky). */
export function wholesalerRows(id: WholesalerId, input: readonly OrderLine[]): (string | number)[][] {
  const lines = orderLines(input);
  const ref = (line: OrderLine) => line.code ?? line.ean ?? "";
  switch (id) {
    case "sonepar":
      return [["Objednací číslo / EAN", "Množství", "Jednotka", "Poznámka"], ...lines.map((line) => [line.ean ?? line.code ?? line.name, line.quantity, line.unit, [line.ean && line.code ? line.code : null, line.note, !line.ean && !line.code ? "doplnit objednací číslo" : null].filter(Boolean).join(" · ")])];
    case "elkov":
      return [["EAN / katalogové číslo", "Množství"], ...lines.map((line) => [line.ean ?? line.code ?? line.name, line.quantity])];
    case "kv":
      return [["Objednací číslo", "EAN", "Název", "Množství", "Jednotka"], ...lines.map((line) => [ref(line), line.ean ?? "", line.name, line.quantity, line.unit])];
    case "dek":
      return [["EAN", "MPN (objednací číslo výrobce)", "Výrobce", "Název a specifikace", "Množství", "Jednotka", "Poznámka"], ...lines.map((line) => [line.ean ?? "", line.code ?? "", line.manufacturer ?? "", line.name, line.quantity, line.unit, line.note ?? ""])];
    default:
      return [["Pořadí", "EAN (GTIN)", "Objednací číslo (MPN)", "Výrobce", "Název a specifikace", "Množství", "Jednotka", "Poznámka"], ...lines.map((line, index) => [index + 1, line.ean ?? "", line.code ?? "", line.manufacturer ?? "", line.name, line.quantity, line.unit, line.note ?? ""])];
  }
}

/** XML univerzální poptávky (jednoduchý vlastní formát s EAN, MPN a množstvím). */
export function orderXml(input: readonly OrderLine[], meta: { title: string; createdAt: string }): string {
  const lines = orderLines(input);
  const items = lines
    .map((line, index) => `  <Item no="${index + 1}">\n    <EAN>${xml(line.ean ?? "")}</EAN>\n    <MPN>${xml(line.code ?? "")}</MPN>\n    <Manufacturer>${xml(line.manufacturer ?? "")}</Manufacturer>\n    <Name>${xml(line.name)}</Name>\n    <Quantity unit="${xml(line.unit)}">${line.quantity}</Quantity>\n  </Item>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Inquiry generator="ELDOCK" created="${xml(meta.createdAt)}">\n  <Title>${xml(meta.title)}</Title>\n${items}\n</Inquiry>\n`;
}

const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60) || "poptavka";

/** Soubor pro import košíku velkoobchodu. */
export function wholesalerFile(id: WholesalerId, format: "csv" | "xlsx" | "xml", lines: readonly OrderLine[], meta: { title: string; createdAt: string }): OrderFile {
  const base = `${slug(meta.title)}-${wholesalerOf(id).id}`;
  if (format === "xml") return { name: `${base}.xml`, mime: "application/xml", content: orderXml(lines, meta) };
  const rows = wholesalerRows(id, lines);
  if (format === "xlsx") return { name: `${base}.xlsx`, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content: buildXlsx("Poptávka", rows) };
  return { name: `${base}.csv`, mime: "text/csv;charset=utf-8", content: csv(rows) };
}

/** Rychlý seznam pro pole „Rychlá objednávka“ e-shopu: EAN (jinak objednací číslo) a množství na řádek. */
export function quickOrderText(lines: readonly OrderLine[]): string {
  return orderLines(lines)
    .filter((line) => line.ean || line.code)
    .map((line) => `${line.ean ?? line.code}\t${quantityText(line.quantity)}`)
    .join("\n");
}

/** Průvodní e-mail obchodnímu zástupci (předmět a text; odeslání je na uživateli). */
export function inquiryEmail(id: WholesalerId, lines: readonly OrderLine[], meta: { title: string; company?: string | null; contact?: string | null; phone?: string | null }) {
  const shop = wholesalerOf(id);
  const merged = orderLines(lines);
  const withoutCode = merged.filter((line) => !line.ean && !line.code).length;
  const subject = `Poptávka materiálu – ${meta.title}`;
  const body = [
    "Dobrý den,",
    "",
    `prosíme o cenovou nabídku a termín dodání materiálu pro zakázku „${meta.title}“ (${merged.length} položek – soubor pro import košíku ${shop.label} v příloze).`,
    "",
    ...merged.slice(0, 60).map((line) => `- ${line.name}${line.code ? ` (${line.code})` : ""}${line.ean ? `, EAN ${line.ean}` : ""}: ${quantityText(line.quantity)} ${line.unit}`),
    ...(merged.length > 60 ? [`- … a dalších ${merged.length - 60} položek v příloze`] : []),
    ...(withoutCode ? ["", `${withoutCode} položek je bez objednacího čísla – prosíme o návrh odpovídajícího výrobku.`] : []),
    "",
    "Děkujeme.",
    "",
    [meta.contact, meta.company, meta.phone].filter(Boolean).join(" · "),
  ].join("\n");
  return { subject, body, mailto: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}
