// Fáze 113: nastavení odesílání e-mailů (SMTP) a záloh mimo server (S3 / Cloudflare R2) zadané ve velínu. Proměnné
// prostředí (`ELDOCK_SMTP_URL`, `ELDOCK_BACKUP_S3_*`, `ELDOCK_BACKUP_KEY`) mají přednost; bez nich platí velín.
// Čisté typy a kontroly vstupu (tajné hodnoty šifruje server – `server/platform-secrets.ts`).

import { z } from "zod";

export const SMTP_KEY = "smtp";
export const BACKUP_STORAGE_KEY = "backup-storage";

/** Uložené nastavení SMTP (heslo zašifrované). */
export interface StoredSmtp {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  passwordSealed: string | null;
  from: string;
}

/** Uložené úložiště záloh mimo server (klíč a heslo šifrování zašifrované). */
export interface StoredBackupStorage {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretSealed: string | null;
  prefix: string;
  pathStyle: boolean;
  backupKeySealed: string | null;
}

const text = (max: number) => z.string().trim().max(max);

/** Formulář SMTP z velínu – prázdné heslo = ponechat uložené. */
export const smtpInputSchema = z.object({
  host: text(200).min(3, "Vyplňte server SMTP (např. smtp.seznam.cz)."),
  port: z.number().int().min(1, "Port 1–65535.").max(65_535, "Port 1–65535."),
  secure: z.boolean(),
  user: text(200),
  password: z.string().max(400).optional(),
  from: text(200).min(3, "Vyplňte odesílatele (např. ELDOCK <info@eldock.cz>).").refine((value) => /[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/.test(value), "Odesílatel musí obsahovat e-mail."),
});

/** Formulář úložiště záloh z velínu – prázdné tajné hodnoty = ponechat uložené. */
export const backupStorageInputSchema = z.object({
  endpoint: text(300).refine((value) => /^https?:\/\/[^\s/]+/.test(value), "Adresa úložiště ve tvaru https://<účet>.r2.cloudflarestorage.com"),
  region: text(60).default("auto"),
  bucket: text(120).min(3, "Vyplňte bucket."),
  accessKeyId: text(200).min(4, "Vyplňte Access Key ID."),
  secretAccessKey: z.string().max(400).optional(),
  prefix: text(120).default("eldock"),
  pathStyle: z.boolean().default(false),
  backupKey: z.string().max(400).optional(),
});

export const MIN_BACKUP_KEY = 16;

export function parseStoredSmtp(json: string | null | undefined): StoredSmtp | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as Partial<StoredSmtp>;
    if (typeof raw.host !== "string" || !raw.host) return null;
    return {
      host: raw.host,
      port: typeof raw.port === "number" ? raw.port : 465,
      secure: raw.secure !== false,
      user: typeof raw.user === "string" ? raw.user : "",
      passwordSealed: typeof raw.passwordSealed === "string" ? raw.passwordSealed : null,
      from: typeof raw.from === "string" ? raw.from : "",
    };
  } catch {
    return null;
  }
}

export function parseStoredBackupStorage(json: string | null | undefined): StoredBackupStorage | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as Partial<StoredBackupStorage>;
    if (typeof raw.endpoint !== "string" || typeof raw.bucket !== "string") return null;
    return {
      endpoint: raw.endpoint,
      region: typeof raw.region === "string" && raw.region ? raw.region : "auto",
      bucket: raw.bucket,
      accessKeyId: typeof raw.accessKeyId === "string" ? raw.accessKeyId : "",
      secretSealed: typeof raw.secretSealed === "string" ? raw.secretSealed : null,
      prefix: typeof raw.prefix === "string" && raw.prefix ? raw.prefix : "eldock",
      pathStyle: raw.pathStyle === true,
      backupKeySealed: typeof raw.backupKeySealed === "string" ? raw.backupKeySealed : null,
    };
  } catch {
    return null;
  }
}

/** Klidná informace ve velínu, když záloha mimo server není nastavená. */
export const LOCAL_BACKUP_INFO = "💾 Lokální záloha na serveru je aktivní (S3/R2 cloud úložiště je volitelné)";
