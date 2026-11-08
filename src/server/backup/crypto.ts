import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCallback, type ScryptOptions } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, rm, stat, writeFile } from "node:fs/promises";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";

// Šifrování záloh (fáze 68): AES-256-GCM, klíč z hesla `ELDOCK_BACKUP_KEY` přes scrypt se solí v záhlaví souboru.
// Formát: "ELDOCKB1" (8 B) · sůl (16 B) · IV (12 B) · šifrovaná data · autentizační značka (16 B).
// Bez klíče nejde zálohu přečíst – klíč patří i mimo server (správce hesel provozovatele).

export const BACKUP_MAGIC = Buffer.from("ELDOCKB1", "ascii");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
export const HEADER_BYTES = BACKUP_MAGIC.length + SALT_BYTES + IV_BYTES;
/** O kolik je šifrovaný soubor větší než vstup. */
export const ENCRYPTION_OVERHEAD = HEADER_BYTES + TAG_BYTES;
export const MIN_KEY_LENGTH = 16;

type Stage = NodeJS.ReadableStream | NodeJS.WritableStream | NodeJS.ReadWriteStream;

const SCRYPT: ScryptOptions = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const derived = new Map<string, Promise<Buffer>>();

/** Klíč AES-256 z hesla a soli (scrypt N = 2^15) – pro stejnou sůl jen jednou za běh procesu. */
export function deriveKey(secret: string, salt: Buffer): Promise<Buffer> {
  const cacheKey = `${createHash("sha256").update(secret).digest("hex")}:${salt.toString("hex")}`;
  let key = derived.get(cacheKey);
  if (!key) {
    key = new Promise<Buffer>((resolve, reject) => scryptCallback(secret, salt, 32, SCRYPT, (error, result) => (error ? reject(error) : resolve(result))));
    derived.set(cacheKey, key);
  }
  return key;
}

/** Otisk klíče pro velín (prvních 8 znaků SHA-256) – ověří, který klíč je nastavený, aniž by ho ukázal. */
export const keyFingerprint = (secret: string) => createHash("sha256").update(`eldock-backup:${secret}`).digest("hex").slice(0, 8).toUpperCase();

/** Šifrovací kontext jednoho běhu zálohy: jedna sůl a klíč, každý soubor vlastní IV. */
export interface Sealer {
  salt: Buffer;
  key: Buffer;
}

export async function createSealer(secret: string): Promise<Sealer> {
  const salt = randomBytes(SALT_BYTES);
  return { salt, key: await deriveKey(secret, salt) };
}

export interface WrittenFile {
  bytes: number;
  sha256: string;
}

/** Proud, který data zašifruje (záhlaví + šifra + značka) a spočítá velikost a SHA-256 výstupu. */
function sealStream(sealer: Sealer) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", sealer.key, iv);
  const hash = createHash("sha256");
  const header = Buffer.concat([BACKUP_MAGIC, sealer.salt, iv]);
  let bytes = 0;
  let started = false;
  const emit = (stream: Transform, data: Buffer) => {
    if (!data.length) return;
    hash.update(data);
    bytes += data.length;
    stream.push(data);
  };
  const transform = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      if (!started) {
        started = true;
        emit(this, header);
      }
      emit(this, cipher.update(chunk));
      callback();
    },
    flush(callback) {
      if (!started) emit(this, header);
      emit(this, cipher.final());
      emit(this, cipher.getAuthTag());
      callback();
    },
  });
  return { transform, result: (): WrittenFile => ({ bytes, sha256: hash.digest("hex") }) };
}

/** Proud, který jen spočítá velikost a SHA-256 (záloha bez šifrování). */
function measureStream() {
  const hash = createHash("sha256");
  let bytes = 0;
  const transform = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      bytes += chunk.length;
      callback(null, chunk);
    },
  });
  return { transform, result: (): WrittenFile => ({ bytes, sha256: hash.digest("hex") }) };
}

/** Zapíše soubor `source` do `target`: volitelně gzip a šifrování (bez `sealer` = jen gzip / kopie). */
export async function packFile(source: string, target: string, options: { sealer?: Sealer | null; gzip?: boolean }): Promise<WrittenFile> {
  const tail = options.sealer ? sealStream(options.sealer) : measureStream();
  const stages: Stage[] = [createReadStream(source)];
  if (options.gzip) stages.push(createGzip({ level: 6 }));
  stages.push(tail.transform, createWriteStream(target));
  await pipeline(stages);
  return tail.result();
}

/** Je soubor zašifrovaná záloha Eldocku? (podle záhlaví) */
export async function isSealedFile(filePath: string): Promise<boolean> {
  const handle = await open(filePath, "r");
  try {
    const head = Buffer.alloc(BACKUP_MAGIC.length);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    return bytesRead === head.length && head.equals(BACKUP_MAGIC);
  } finally {
    await handle.close();
  }
}

const WRONG_KEY = "Zálohu nejde rozšifrovat – jiný klíč ELDOCK_BACKUP_KEY, nebo je soubor poškozený.";

/**
 * Rozbalí zálohu `source` do `target`: šifrovaný soubor nejdřív celý rozšifruje a ověří značkou GCM (špatný klíč
 * nebo poškozená data = chyba, nic neověřeného se dál nezpracuje), teprve potom rozbalí gzip (`gunzip`).
 */
export async function unpackFile(source: string, target: string, options: { secret?: string | null; gunzip?: boolean }): Promise<void> {
  if (!(await isSealedFile(source))) {
    await pipeline([createReadStream(source), ...(options.gunzip ? [createGunzip()] : []), createWriteStream(target)]);
    return;
  }
  if (!options.gunzip) return decryptFile(source, target, options.secret);
  const part = `${target}.part`;
  try {
    await decryptFile(source, part, options.secret);
    await pipeline([createReadStream(part), createGunzip(), createWriteStream(target)]);
  } finally {
    await rm(part, { force: true });
  }
}

/** Rozšifruje soubor zálohy (AES-256-GCM); při chybě klíče nebo poškození výstup smaže. */
async function decryptFile(source: string, target: string, secret: string | null | undefined): Promise<void> {
  if (!secret) throw new Error("Záloha je šifrovaná – nastavte ELDOCK_BACKUP_KEY (stejné heslo jako při zálohování).");
  const size = (await stat(source)).size;
  if (size < ENCRYPTION_OVERHEAD) throw new Error("Soubor zálohy je poškozený (příliš krátký).");
  const handle = await open(source, "r");
  const header = Buffer.alloc(HEADER_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  try {
    await handle.read(header, 0, HEADER_BYTES, 0);
    await handle.read(tag, 0, TAG_BYTES, size - TAG_BYTES);
  } finally {
    await handle.close();
  }
  const salt = header.subarray(BACKUP_MAGIC.length, BACKUP_MAGIC.length + SALT_BYTES);
  const iv = header.subarray(BACKUP_MAGIC.length + SALT_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", await deriveKey(secret, salt), iv);
  decipher.setAuthTag(tag);
  try {
    if (size === ENCRYPTION_OVERHEAD) {
      decipher.final();
      await writeFile(target, Buffer.alloc(0));
      return;
    }
    await pipeline([createReadStream(source, { start: HEADER_BYTES, end: size - TAG_BYTES - 1 }), decipher, createWriteStream(target)]);
  } catch (error) {
    await rm(target, { force: true });
    if (error instanceof Error && /unable to authenticate|unsupported state|auth/i.test(error.message)) throw new Error(WRONG_KEY);
    throw error;
  }
}
