// Fáze 97: čtení tabulek XLSX (Office Open XML) bez závislostí – XLSX je ZIP s XML listy. Sdílené řetězce
// (`xl/sharedStrings.xml`), seznam listů (`xl/workbook.xml` + vazby) a buňky listů (`xl/worksheets/sheetN.xml`): text,
// čísla, logické hodnoty a vložené řetězce. Vzorce se nepočítají (bere se uložená hodnota). Čte ze souboru i z bufferu.
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const decode = (text) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");

/** Položky ZIPu v bufferu (centrální adresář; ZIP64 není u tabulek potřeba). */
export function zipFiles(buffer) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Soubor není ZIP / XLSX.");
  const count = buffer.readUInt16LE(eocd + 10);
  let at = buffer.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(at + 10);
    const compressed = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const offset = buffer.readUInt32LE(at + 42);
    const name = buffer.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    files.set(name, { method, compressed, offset });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return {
    names: [...files.keys()],
    /** Rozbalený obsah položky (null = v ZIPu není). */
    read(name) {
      const entry = files.get(name);
      if (!entry) return null;
      const start = entry.offset + 30 + buffer.readUInt16LE(entry.offset + 26) + buffer.readUInt16LE(entry.offset + 28);
      const data = buffer.subarray(start, start + entry.compressed);
      return entry.method === 8 ? inflateRawSync(data) : Buffer.from(data);
    },
  };
}

/** Index sloupce z odkazu buňky („AB12“ → 27). */
export function columnIndex(ref) {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function sharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => decode([...match[1].matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join("")));
}

function sheetRows(xml, strings) {
  const rows = [];
  for (const row of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const number = Number(/\br="(\d+)"/.exec(row[1])?.[1] ?? rows.length + 1);
    const cells = [];
    for (const cell of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const body = cell[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /\bt="([a-zA-Z]+)"/.exec(attrs)?.[1] ?? "n";
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = null;
      if (type === "s" && raw !== undefined) value = strings[Number(raw)] ?? "";
      else if (type === "inlineStr") value = decode([...body.matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join(""));
      else if (type === "b" && raw !== undefined) value = raw === "1" ? "TRUE" : "FALSE";
      else if (raw !== undefined) value = decode(raw);
      const column = ref ? columnIndex(ref) : cells.length;
      cells[column] = value === null ? "" : String(value).trim();
    }
    rows[number - 1] = Array.from(cells, (value) => value ?? "");
  }
  return Array.from(rows, (value) => value ?? []);
}

/**
 * Listy sešitu XLSX: `[{ name, rows }]`, řádek = pole textů buněk (prázdná buňka = ""). Pořadí listů jako v sešitu.
 * `file` = cesta nebo Buffer.
 */
export async function readXlsx(file) {
  const buffer = Buffer.isBuffer(file) ? file : await readFile(file);
  const zip = zipFiles(buffer);
  const text = (name) => zip.read(name)?.toString("utf8") ?? null;
  const strings = sharedStrings(text("xl/sharedStrings.xml"));
  const workbook = text("xl/workbook.xml") ?? "";
  const rels = text("xl/_rels/workbook.xml.rels") ?? "";
  const targets = new Map([...rels.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)].map((match) => [match[1], match[2]]));
  // Vazby mohou mít atributy v jiném pořadí
  for (const match of rels.matchAll(/<Relationship\b[^>]*\bTarget="([^"]+)"[^>]*\bId="([^"]+)"/g)) targets.set(match[2], match[1]);
  const sheets = [];
  for (const match of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = decode(/\bname="([^"]*)"/.exec(match[1])?.[1] ?? `List${sheets.length + 1}`);
    const id = /\br:id="([^"]+)"/.exec(match[1])?.[1];
    const target = id ? targets.get(id) : null;
    if (!target) continue;
    const pathInZip = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    const xml = text(pathInZip);
    if (xml) sheets.push({ name, rows: sheetRows(xml, strings) });
  }
  return sheets;
}

/** CSV (oddělovač „;“ / „,“ / tabulátor podle první řádky, uvozovky „"“) → řádky textů. */
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, "");
  const first = clean.slice(0, clean.indexOf("\n") >= 0 ? clean.indexOf("\n") : clean.length);
  const separator = [";", "\t", ","].map((sep) => [sep, first.split(sep).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < clean.length; index++) {
    const char = clean[index];
    if (quoted) {
      if (char === '"' && clean[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, "").trim());
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}
