import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { authSecret } from "@/lib/auth";

// Fáze 113: tajné údaje zadané ve velínu (heslo SMTP, klíč úložiště S3 / R2, heslo šifrování záloh) se v databázi
// drží zašifrované AES-256-GCM klíčem odvozeným z tajemství přihlášení serveru (`ELDOCK_AUTH_SECRET`). Do prohlížeče
// se nikdy nevracejí – velín ukáže jen, že jsou uložené. Bez `server-only`: modul čte i skript zálohy (`npm run backup`).

const PREFIX = "v1:";

const key = () => createHash("sha256").update(`eldock-platform-settings:${authSecret()}`).digest();

/** Zašifruje tajnou hodnotu pro uložení do `PlatformSetting`. */
export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

/** Rozšifruje uloženou hodnotu; jiný klíč serveru / poškozená data = null (velín vyzve k novému zadání). */
export function openSecret(sealed: string | null | undefined): string | null {
  if (!sealed?.startsWith(PREFIX)) return null;
  try {
    const raw = Buffer.from(sealed.slice(PREFIX.length), "base64");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
