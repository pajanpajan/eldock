import "server-only";

import { inflateRawSync } from "node:zlib";

import { parseXmlRecords, rowsFromText } from "@/lib/revision-import";

// Fáze 112: čtení souborů pro import revizních dat bez závislostí – CSV / TSV / TXT (UTF-8 nebo Windows-1250), XLSX
// (ZIP s XML listy, první list s daty), XML export přístroje a Word DOCX (tabulky `w:tbl`, jinak odstavce jako text).
// PDF se čte v prohlížeči (pdf.js), fotka tabulky přes Gemini (`services/revision-import.ts`).

const decode = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");

interface ZipEntry {
  method: number;
  compressed: number;
  offset: number;
}

/** Položky ZIPu (centrální adresář, bez ZIP64 – tabulky a dokumenty jsou malé). */
export function zipEntries(buffer: Buffer) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Soubor není ZIP (XLSX / DOCX).");
  const count = buffer.readUInt16LE(eocd + 10);
  let at = buffer.readUInt32LE(eocd + 16);
  const files = new Map<string, ZipEntry>();
  for (let index = 0; index < count && at + 46 <= buffer.length; index++) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) break;
    const nameLength = buffer.readUInt16LE(at + 28);
    const name = buffer.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    files.set(name, { method: buffer.readUInt16LE(at + 10), compressed: buffer.readUInt32LE(at + 20), offset: buffer.readUInt32LE(at + 42) });
    at += 46 + nameLength + buffer.readUInt16LE(at + 30) + buffer.readUInt16LE(at + 32);
  }
  return {
    names: [...files.keys()],
    text(name: string): string | null {
      const entry = files.get(name);
      if (!entry) return null;
      const start = entry.offset + 30 + buffer.readUInt16LE(entry.offset + 26) + buffer.readUInt16LE(entry.offset + 28);
      const data = buffer.subarray(start, start + entry.compressed);
      return (entry.method === 8 ? inflateRawSync(data) : data).toString("utf8");
    },
  };
}

const columnIndex = (ref: string) => {
  let index = 0;
  for (const letter of /^[A-Z]+/.exec(ref)?.[0] ?? "A") index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
};

/** XLSX → řádky prvního listu s daty (sdílené řetězce, vložené řetězce, čísla; vzorce = uložená hodnota). */
export function readXlsxRows(buffer: Buffer): string[][] {
  const zip = zipEntries(buffer);
  const strings = [...(zip.text("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => decode([...match[1].matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join("")));
  const sheets = zip.names.filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort((a, b) => Number(/(\d+)\.xml$/.exec(a)?.[1]) - Number(/(\d+)\.xml$/.exec(b)?.[1]));
  for (const sheet of sheets) {
    const rows: string[][] = [];
    for (const row of (zip.text(sheet) ?? "").matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const number = Number(/\br="(\d+)"/.exec(row[1])?.[1] ?? rows.length + 1);
      const cells: string[] = [];
      for (const cell of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /\br="([A-Z]+\d+)"/.exec(cell[1])?.[1];
        const type = /\bt="([a-zA-Z]+)"/.exec(cell[1])?.[1] ?? "n";
        const raw = /<v>([\s\S]*?)<\/v>/.exec(cell[2] ?? "")?.[1];
        const value =
          type === "s" && raw !== undefined
            ? (strings[Number(raw)] ?? "")
            : type === "inlineStr"
              ? decode([...(cell[2] ?? "").matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join(""))
              : raw !== undefined
                ? decode(raw)
                : "";
        cells[ref ? columnIndex(ref) : cells.length] = value.trim();
      }
      rows[number - 1] = Array.from(cells, (value) => value ?? "");
    }
    const filled = Array.from(rows, (value) => value ?? []);
    if (filled.some((row) => row.some(Boolean))) return filled.slice(0, 2000);
  }
  return [];
}

/** DOCX → řádky tabulek (`w:tr` / `w:tc`); bez tabulky odstavce jako text (sloupce z mezer / tabulátorů). */
export function readDocxRows(buffer: Buffer): string[][] {
  const xml = zipEntries(buffer).text("word/document.xml");
  if (!xml) throw new Error("Dokument Word neobsahuje text (word/document.xml).");
  const textOf = (fragment: string) => decode([...fragment.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>/g)].map((part) => (part[0] === "<w:tab/>" ? "\t" : part[1])).join("")).trim();
  const rows = [...xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((row) => [...row[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((cell) => textOf(cell[0])));
  if (rows.some((row) => row.length >= 3)) return rows.filter((row) => row.some(Boolean)).slice(0, 2000);
  const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((paragraph) => textOf(paragraph[0]));
  return rowsFromText(paragraphs.join("\n"));
}

/** Text souboru: UTF-8, jinak Windows-1250 (starší české exporty z revizních programů). */
export function decodeText(buffer: Buffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (!utf8.includes("�")) return utf8.replace(/^﻿/, "");
  try {
    return new TextDecoder("windows-1250").decode(buffer);
  } catch {
    return utf8;
  }
}

/** CSV / TSV (oddělovač podle první řádky, uvozovky „"“) → řádky textů. */
export function parseCsvRows(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const first = clean.slice(0, clean.indexOf("\n") >= 0 ? clean.indexOf("\n") : clean.length);
  const separator = ([";", "\t", ","] as const).map((sep) => [sep, first.split(sep).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < clean.length; index++) {
    const char = clean[index];
    if (quoted) {
      if (char === '"' && clean[index + 1] === '"') {
        value += '"';
        index++;
      } else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) {
      row.push(value.trim());
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, "").trim());
      rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (value || row.length) {
    row.push(value.trim());
    rows.push(row);
  }
  return rows.slice(0, 5000);
}

export type RevisionFileKind = "csv" | "xlsx" | "xml" | "docx" | "text" | "image" | "pdf";

/** Druh souboru podle přípony a obsahu (ZIP / XML / obrázek). */
export function revisionFileKind(name: string, buffer: Buffer): RevisionFileKind | null {
  const lower = name.toLowerCase();
  if (/\.(png|jpe?g|webp)$/.test(lower)) return "image";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) return "xlsx";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".xml") || buffer.subarray(0, 64).toString("utf8").trimStart().startsWith("<?xml")) return "xml";
  if (/\.(csv|tsv|txt)$/.test(lower)) return "csv";
  return null;
}

/** Tabulka ze souboru (bez obrázků a PDF – ty řeší volající). */
export function readRevisionTable(name: string, buffer: Buffer): string[][] {
  const kind = revisionFileKind(name, buffer);
  if (kind === "xlsx") return readXlsxRows(buffer);
  if (kind === "docx") return readDocxRows(buffer);
  if (kind === "xml") return parseXmlRecords(decodeText(buffer));
  if (kind === "csv") return parseCsvRows(decodeText(buffer));
  throw new Error("Podporované soubory: CSV, TSV, TXT, XLSX, XML, DOCX, PDF a fotka tabulky (JPG / PNG / WebP).");
}
