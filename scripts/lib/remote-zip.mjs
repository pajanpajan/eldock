// Fáze 97: čtení vzdáleného ZIPu po částech přes HTTP Range (bez stažení celého archivu) – kompletní fotobanky výrobců mají
// desítky GB, Eldock z nich potřebuje stovky fotek. Konec souboru → záznam ZIP64 / EOCD → centrální adresář (jména,
// offsety, velikosti) → jednotlivá položka: lokální hlavička + komprimovaná data (stored / deflate). Bez závislostí.
import { inflateRawSync } from "node:zlib";

/**
 * Bajty `start`–`end` (včetně) – server musí odpovědět 206 Partial Content, jinak chyba (nic se nestahuje celé).
 * @param {string} url
 * @param {number} start
 * @param {number} end
 * @param {{ userAgent?: string }} [options]
 */
export async function fetchRange(url, start, end, { userAgent } = {}) {
  const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}`, ...(userAgent ? { "User-Agent": userAgent } : {}) }, signal: AbortSignal.timeout(120_000) });
  if (response.status !== 206) {
    // Celý archiv by se začal stahovat – spojení se hned ukončí
    await response.body?.cancel().catch(() => {});
    throw new Error(`server nepodporuje částečné stažení (HTTP ${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Centrální adresář vzdáleného ZIPu (i ZIP64). `size` = délka souboru (Content-Length z HEAD).
 * @param {string} url
 * @param {{ userAgent?: string; size: number }} options
 */
export async function remoteZipDirectory(url, { userAgent, size }) {
  if (!size) throw new Error("neznámá velikost archivu");
  const tailLength = Math.min(size, 66_000);
  const tail = await fetchRange(url, size - tailLength, size - 1, { userAgent });
  const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("konec centrálního adresáře nenalezen");
  let count = tail.readUInt16LE(eocd + 10);
  let directorySize = tail.readUInt32LE(eocd + 12);
  let directoryOffset = tail.readUInt32LE(eocd + 16);
  if (directoryOffset === 0xffffffff || count === 0xffff || directorySize === 0xffffffff) {
    const record = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x06]));
    if (record < 0) throw new Error("záznam ZIP64 nenalezen");
    count = Number(tail.readBigUInt64LE(record + 32));
    directorySize = Number(tail.readBigUInt64LE(record + 40));
    directoryOffset = Number(tail.readBigUInt64LE(record + 48));
  }
  const dir = await fetchRange(url, directoryOffset, directoryOffset + directorySize - 1, { userAgent });
  const entries = [];
  for (let at = 0, index = 0; index < count && at + 46 <= dir.length; index++) {
    if (dir.readUInt32LE(at) !== 0x02014b50) break;
    const flags = dir.readUInt16LE(at + 8);
    const method = dir.readUInt16LE(at + 10);
    let compressed = dir.readUInt32LE(at + 20);
    let uncompressed = dir.readUInt32LE(at + 24);
    const nameLength = dir.readUInt16LE(at + 28);
    const extraLength = dir.readUInt16LE(at + 30);
    const commentLength = dir.readUInt16LE(at + 32);
    let offset = dir.readUInt32LE(at + 42);
    const name = dir.subarray(at + 46, at + 46 + nameLength).toString(flags & 0x800 ? "utf8" : "latin1");
    for (let x = at + 46 + nameLength; x < at + 46 + nameLength + extraLength; ) {
      const id = dir.readUInt16LE(x);
      const length = dir.readUInt16LE(x + 2);
      if (id === 1) {
        let y = x + 4;
        if (uncompressed === 0xffffffff) {
          uncompressed = Number(dir.readBigUInt64LE(y));
          y += 8;
        }
        if (compressed === 0xffffffff) {
          compressed = Number(dir.readBigUInt64LE(y));
          y += 8;
        }
        if (offset === 0xffffffff) offset = Number(dir.readBigUInt64LE(y));
      }
      x += 4 + length;
    }
    if (!(flags & 1)) entries.push({ name, offset, compressed, uncompressed, method });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return { entries, directorySize, count };
}

/**
 * Jedna položka vzdáleného ZIPu (rozbalený obsah). `entry` = `{ offset, compressed, method }` z adresáře.
 * @param {string} url
 * @param {{ offset: number; compressed: number; method: number }} entry
 * @param {{ userAgent?: string }} [options]
 */
export async function remoteZipEntry(url, entry, { userAgent } = {}) {
  // Lokální hlavička 30 B + jméno + extra (délky jen v lokální hlavičce) – rezerva 1 kB, data se dočtou podle délek
  const head = await fetchRange(url, entry.offset, entry.offset + 30 + 1024 - 1, { userAgent });
  if (head.readUInt32LE(0) !== 0x04034b50) throw new Error("neplatná lokální hlavička položky");
  const start = entry.offset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
  const data = entry.compressed ? await fetchRange(url, start, start + entry.compressed - 1, { userAgent }) : Buffer.alloc(0);
  return entry.method === 8 ? inflateRawSync(data) : data;
}
