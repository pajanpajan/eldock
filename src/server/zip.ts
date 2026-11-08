import { createReadStream, createWriteStream, type WriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { crc32, deflateRawSync } from "node:zlib";

// Minimální zápis ZIP (fáze 69, export dat firmy) bez závislostí: JSON / CSV / texty komprimované (deflate),
// nahrané soubory (fotky, PDF, archivy – už komprimované) uložené bez komprese. Soubor se zapisuje proudově,
// do paměti se nikdy nenačte celý; CRC-32 souboru se spočítá předem po částech. Bez ZIP64 (do 4 GB a 65 535 položek).

const MAX_ZIP32 = 0xffffffff;
const UTF8_FLAG = 0x0800;

interface CentralEntry {
  name: Buffer;
  method: number;
  crc: number;
  compressedSize: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

/** Datum a čas ve formátu MS-DOS (místní čas, rozlišení 2 s). */
export function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** Bezpečný název položky: lomítka, bez „..“ a úvodního lomítka. */
export function zipEntryName(name: string): string {
  const clean = name.replace(/\\/g, "/").split("/").filter((part) => part && part !== "." && part !== "..").join("/");
  if (!clean) throw new Error("Prázdný název položky ZIP.");
  return clean;
}

async function fileCrc32(filePath: string): Promise<number> {
  let crc = 0;
  for await (const chunk of createReadStream(filePath)) crc = crc32(chunk as Buffer, crc);
  return crc;
}

export class ZipWriter {
  private readonly out: WriteStream;
  private readonly entries: CentralEntry[] = [];
  private offset = 0;
  private readonly stamp: { time: number; date: number };
  private readonly names = new Set<string>();

  constructor(target: string, now: Date = new Date()) {
    this.out = createWriteStream(target);
    this.stamp = dosDateTime(now);
  }

  private write(data: Buffer): Promise<void> {
    this.offset += data.length;
    return new Promise((resolve, reject) => this.out.write(data, (error) => (error ? reject(error) : resolve())));
  }

  private localHeader(entry: CentralEntry) {
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // verze pro rozbalení 2.0
    header.writeUInt16LE(UTF8_FLAG, 6);
    header.writeUInt16LE(entry.method, 8);
    header.writeUInt16LE(entry.time, 10);
    header.writeUInt16LE(entry.date, 12);
    header.writeUInt32LE(entry.crc >>> 0, 14);
    header.writeUInt32LE(entry.compressedSize, 18);
    header.writeUInt32LE(entry.size, 22);
    header.writeUInt16LE(entry.name.length, 26);
    header.writeUInt16LE(0, 28);
    return Buffer.concat([header, entry.name]);
  }

  private register(name: string) {
    const clean = zipEntryName(name);
    if (this.names.has(clean)) throw new Error(`Položka ${clean} už v ZIP je.`);
    if (this.entries.length >= 0xfffe) throw new Error("Export má příliš mnoho souborů pro jeden ZIP.");
    this.names.add(clean);
    return Buffer.from(clean, "utf8");
  }

  private guard(size: number) {
    if (size > MAX_ZIP32 || this.offset + size > MAX_ZIP32) throw new Error("Export je větší než 4 GB – kontaktujte podporu Eldocku.");
  }

  /** Text / JSON / CSV (komprimuje deflate, pokud to pomůže). */
  async addBuffer(name: string, data: Buffer | string): Promise<void> {
    const raw = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    const deflated = deflateRawSync(raw, { level: 6 });
    const compress = deflated.length < raw.length;
    const body = compress ? deflated : raw;
    this.guard(body.length);
    const entry: CentralEntry = { name: this.register(name), method: compress ? 8 : 0, crc: crc32(raw), compressedSize: body.length, size: raw.length, offset: this.offset, ...this.stamp };
    await this.write(this.localHeader(entry));
    await this.write(body);
    this.entries.push(entry);
  }

  /** Soubor z disku bez komprese (fotky, PDF, archivy). */
  async addFile(name: string, filePath: string): Promise<void> {
    const size = (await stat(filePath)).size;
    this.guard(size);
    const entry: CentralEntry = { name: this.register(name), method: 0, crc: await fileCrc32(filePath), compressedSize: size, size, offset: this.offset, ...this.stamp };
    await this.write(this.localHeader(entry));
    for await (const chunk of createReadStream(filePath)) await this.write(chunk as Buffer);
    this.entries.push(entry);
  }

  /** Centrální adresář a konec archivu; vrací velikost ZIP v bajtech. */
  async close(): Promise<number> {
    const start = this.offset;
    for (const entry of this.entries) {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(0x031e, 4); // vytvořeno: Unix, verze 3.0
      header.writeUInt16LE(20, 6);
      header.writeUInt16LE(UTF8_FLAG, 8);
      header.writeUInt16LE(entry.method, 10);
      header.writeUInt16LE(entry.time, 12);
      header.writeUInt16LE(entry.date, 14);
      header.writeUInt32LE(entry.crc >>> 0, 16);
      header.writeUInt32LE(entry.compressedSize, 20);
      header.writeUInt32LE(entry.size, 24);
      header.writeUInt16LE(entry.name.length, 28);
      header.writeUInt32LE((0o100644 << 16) >>> 0, 38); // běžný soubor rw-r--r--
      header.writeUInt32LE(entry.offset, 42);
      await this.write(Buffer.concat([header, entry.name]));
    }
    const size = this.offset - start;
    this.guard(0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(this.entries.length, 8);
    end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(size, 12);
    end.writeUInt32LE(start, 16);
    await this.write(end);
    await new Promise<void>((resolve, reject) => this.out.end((error?: Error | null) => (error ? reject(error) : resolve())));
    return this.offset;
  }

  /** Zahodí rozpracovaný archiv (chyba exportu). */
  destroy() {
    this.out.destroy();
  }
}
