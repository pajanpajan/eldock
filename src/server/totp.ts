// Dvoufázové ověření TOTP (RFC 6238 / RFC 4226: HMAC-SHA1, 6 číslic, krok 30 s) – fáze 67.
// Tajemství se ukládá šifrované AES-256-GCM klíčem odvozeným z tajemství aplikace (únik databáze bez `.env` ho neprozradí;
// změna `ELDOCK_AUTH_SECRET` = nové spárování aplikace). Záložní kódy jen jako SHA-256. Záměrně bez `server-only` (testy).
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { authSecret } from "@/lib/auth";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Neplatný znak tajemství TOTP.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

/** Nové tajemství (160 bitů) v base32 pro aplikaci Authenticator. */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

/** Kód TOTP pro daný čas (RFC 6238, dynamické zkrácení podle RFC 4226). */
export function totpCode(secret: string, timeMs: number, step = TOTP_STEP_SECONDS): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / 1000 / step)));
  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Ověří kód s tolerancí ±1 krok (rozdíl hodin telefonu a serveru). */
export function verifyTotp(secret: string, code: string, timeMs: number, window = 1): boolean {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  let ok = false;
  for (let offset = -window; offset <= window; offset++) ok = safeEqual(totpCode(secret, timeMs + offset * TOTP_STEP_SECONDS * 1000), clean) || ok;
  return ok;
}

/** Odkaz `otpauth://` pro QR kód aplikace Authenticator. */
export function totpUri({ secret, account, issuer = "Eldock" }: { secret: string; account: string; issuer?: string }): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

// ---------------------------------------------------------------------------
//  Šifrování tajemství a záložní kódy
// ---------------------------------------------------------------------------

const secretKey = () => createHash("sha256").update(`${authSecret()}:totp-secret`).digest();

/** `v1.<iv>.<tag>.<data>` (base64url). */
export function encryptTotpSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** Dešifruje tajemství; jiný klíč aplikace nebo poškozená hodnota → `null`. */
export function decryptTotpSecret(stored: string | null | undefined): string | null {
  const [version, iv, tag, data] = (stored ?? "").split(".");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

const normalizeRecovery = (code: string) => code.toUpperCase().replace(/[^A-Z2-7]/g, "");

/** 8 záložních kódů „ABCD-EFGH“ (40 bitů každý) – uživatel je uvidí jen jednou. */
export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const code = base32Encode(randomBytes(5)).slice(0, 8);
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  });
}

export const hashRecoveryCode = (code: string) => createHash("sha256").update(`eldock-recovery:${normalizeRecovery(code)}`).digest("hex");
