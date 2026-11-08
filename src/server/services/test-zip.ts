// Pomocník pro testy (fáze 69): přečte ZIP z exportu – centrální adresář → položky, ověří CRC-32 a velikosti. Jen pro Vitest.
import { crc32, inflateRawSync } from "node:zlib";

export function readZip(buffer: Buffer): Map<string, Buffer> {
  const end = buffer.length - 22;
  if (buffer.readUInt32LE(end) !== 0x06054b50) throw new Error("ZIP: chybí konec centrálního adresáře");
  const count = buffer.readUInt16LE(end + 10);
  let pointer = buffer.readUInt32LE(end + 16);
  const entries = new Map<string, Buffer>();
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) throw new Error("ZIP: poškozený centrální adresář");
    const method = buffer.readUInt16LE(pointer + 10);
    const crc = buffer.readUInt32LE(pointer + 16);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const size = buffer.readUInt32LE(pointer + 24);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const offset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.subarray(pointer + 46, pointer + 46 + nameLength).toString("utf8");
    if (buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error(`ZIP: chybí místní záhlaví ${name}`);
    const dataStart = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    if (data.length !== size) throw new Error(`ZIP: velikost ${name} nesedí`);
    if (crc32(data) >>> 0 !== crc >>> 0) throw new Error(`ZIP: CRC ${name} nesedí`);
    entries.set(name, data);
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
