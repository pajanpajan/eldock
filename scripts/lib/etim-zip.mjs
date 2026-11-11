// Fáze 94: proudové čtení BMEcat ETIM 9.0 přímo ze ZIPu (bez rozbalení na disk) – centrální adresář → lokální hlavička →
// inflateRaw a dělení proudu po `</PRODUCT>`; v paměti je vždy jen jeden produkt. Bez závislostí (node:fs, node:zlib).
import { open } from "node:fs/promises";
import { createInflateRaw } from "node:zlib";

/** Položky ZIPu z centrálního adresáře (jméno, metoda, komprimovaná velikost, offset lokální hlavičky). */
export async function zipEntries(file) {
  const handle = await open(file, "r");
  try {
    const { size } = await handle.stat();
    const tail = Buffer.alloc(Math.min(size, 66_000));
    await handle.read(tail, 0, tail.length, size - tail.length);
    const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) throw new Error("Soubor není ZIP (chybí konec centrálního adresáře).");
    let count = tail.readUInt16LE(eocd + 10);
    let dirSize = tail.readUInt32LE(eocd + 12);
    let dirOffset = tail.readUInt32LE(eocd + 16);
    // ZIP64: velikosti v rozšířeném záznamu
    if (dirOffset === 0xffffffff || count === 0xffff) {
      const locator = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x07]));
      const z64 = Buffer.alloc(56);
      await handle.read(z64, 0, 56, Number(tail.readBigUInt64LE(locator + 8)));
      count = Number(z64.readBigUInt64LE(32));
      dirSize = Number(z64.readBigUInt64LE(40));
      dirOffset = Number(z64.readBigUInt64LE(48));
    }
    const dir = Buffer.alloc(dirSize);
    await handle.read(dir, 0, dirSize, dirOffset);
    const entries = [];
    for (let at = 0, index = 0; index < count; index++) {
      const method = dir.readUInt16LE(at + 10);
      let compressed = dir.readUInt32LE(at + 20);
      let uncompressed = dir.readUInt32LE(at + 24);
      const nameLength = dir.readUInt16LE(at + 28);
      const extraLength = dir.readUInt16LE(at + 30);
      const commentLength = dir.readUInt16LE(at + 32);
      let offset = dir.readUInt32LE(at + 42);
      const name = dir.subarray(at + 46, at + 46 + nameLength).toString("utf8");
      // ZIP64 extra (0x0001): skutečné velikosti a offset
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
      entries.push({ name, method, compressed, uncompressed, offset });
      at += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  } finally {
    await handle.close();
  }
}

/** Proud rozbaleného obsahu položky ZIPu (deflate / stored). */
export async function* zipEntryStream(file, entry) {
  const handle = await open(file, "r");
  try {
    const header = Buffer.alloc(30);
    await handle.read(header, 0, 30, entry.offset);
    const start = entry.offset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
    const source = handle.createReadStream({ start, end: start + entry.compressed - 1, autoClose: false });
    const stream = entry.method === 8 ? source.pipe(createInflateRaw()) : source;
    for await (const chunk of stream) yield chunk;
  } finally {
    await handle.close();
  }
}

/** Produkty BMEcat po jednom (text bloku `<PRODUCT …>…</PRODUCT>`). */
export async function* productBlocks(chunks) {
  let buffer = "";
  const decoder = new TextDecoder("utf-8");
  for await (const chunk of chunks) {
    buffer += decoder.decode(chunk, { stream: true });
    let end;
    while ((end = buffer.indexOf("</PRODUCT>")) >= 0) {
      // Otevírací tag produktu („<PRODUCT mode=…>“ / „<PRODUCT>“) – ne vnořené <PRODUCT_DETAILS> a spol.
      const start = Math.max(buffer.lastIndexOf("<PRODUCT ", end), buffer.lastIndexOf("<PRODUCT>", end));
      if (start >= 0) yield buffer.slice(start, end + 10);
      buffer = buffer.slice(end + 10);
    }
    // Hlavička katalogu a mezery mezi produkty se nedrží
    if (buffer.length > 4_000_000 && buffer.indexOf("<PRODUCT") < 0) buffer = buffer.slice(-1000);
  }
}
