// Hesla registrovaných firem: scrypt z node:crypto se solí, porovnání v konstantním čase.
// Formát: `scrypt$<N>$<r>$<p>$<sůl base64>$<hash base64>`. Záměrně bez `server-only` (testy, seed).
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

const KEY_LENGTH = 64;
const DEFAULTS = { N: 16384, r: 8, p: 1 };

function scrypt(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCallback(password.normalize("NFKC"), salt, KEY_LENGTH, { ...options, maxmem: 64 * 1024 * 1024 }, (error, key) => (error ? reject(error) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, DEFAULTS);
  return ["scrypt", DEFAULTS.N, DEFAULTS.r, DEFAULTS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(password, Buffer.from(salt, "base64"), { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}
