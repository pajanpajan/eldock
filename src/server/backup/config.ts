import path from "node:path";

import { brandEnv } from "@/lib/auth";

import { platformCache } from "@/server/services/platform-settings";

import { MIN_KEY_LENGTH, keyFingerprint } from "./crypto";
import type { S3Config } from "./s3";

// Nastavení záloh (fáze 68) z proměnných prostředí. Tajné hodnoty (heslo zálohy, klíče úložiště) se nikde nevypisují –
// velín ukáže jen otisk klíče a adresu úložiště.

export interface BackupConfig {
  /** Denní záloha v procesu aplikace (produkce; `ELDOCK_BACKUP=0` ji vypne). */
  scheduleEnabled: boolean;
  /** Čas denní zálohy (Europe/Prague), `HH:MM`. */
  time: { hour: number; minute: number };
  /** Složka místních záloh (snímky databáze). */
  dir: string;
  keepLocal: number;
  /** Heslo šifrování (`ELDOCK_BACKUP_KEY`, min. 16 znaků); null = místní zálohy bez šifrování a nic mimo server. */
  secret: string | null;
  /** Úložiště mimo server (všechny proměnné `ELDOCK_BACKUP_S3_*` vyplněné), jinak null. */
  s3: (S3Config & { prefix: string }) | null;
  keepDaily: number;
  keepMonthly: number;
  /** Soubor smazaný v aplikaci zmizí ze zálohy mimo server po tolika dnech. */
  deletedRetentionDays: number;
  /** Chyby nastavení pro velín (neúplné S3, krátký klíč…). */
  issues: string[];
}

const intEnv = (name: string, fallback: number, min: number, max: number) => {
  const value = Number.parseInt(brandEnv(name) ?? "", 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
};

function parseTime(value: string | undefined) {
  const match = value?.match(/^(\d{1,2}):(\d{2})$/);
  const hour = match ? Number(match[1]) : 2;
  const minute = match ? Number(match[2]) : 30;
  return hour < 24 && minute < 60 ? { hour, minute } : { hour: 2, minute: 30 };
}

export function backupConfig(env: { cwd?: string } = {}): BackupConfig {
  const issues: string[] = [];
  // Fáze 113: úložiště a heslo šifrování z velínu (⚙️ SMTP & Cloud zálohy), když je nedává prostředí
  const stored = platformCache().storage;
  const rawSecret = brandEnv("BACKUP_KEY") ?? stored?.backupKey ?? null;
  let secret: string | null = null;
  if (rawSecret && rawSecret.length < MIN_KEY_LENGTH) issues.push(`Heslo záloh ELDOCK_BACKUP_KEY je kratší než ${MIN_KEY_LENGTH} znaků – zálohy se nešifrují a mimo server se nic neposílá.`);
  else if (rawSecret) secret = rawSecret;

  const s3Values = {
    endpoint: brandEnv("BACKUP_S3_ENDPOINT"),
    bucket: brandEnv("BACKUP_S3_BUCKET"),
    accessKeyId: brandEnv("BACKUP_S3_ACCESS_KEY"),
    secretAccessKey: brandEnv("BACKUP_S3_SECRET_KEY"),
  };
  const filled = Object.values(s3Values).filter(Boolean).length;
  let s3: BackupConfig["s3"] = null;
  if (!filled && stored?.secretAccessKey) {
    s3 = { endpoint: stored.endpoint, region: stored.region || "auto", bucket: stored.bucket, accessKeyId: stored.accessKeyId, secretAccessKey: stored.secretAccessKey, pathStyle: stored.pathStyle, prefix: stored.prefix || "eldock" };
  }
  if (filled === 4) {
    try {
      const endpoint = new URL(s3Values.endpoint!);
      if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") throw new Error("protokol");
      s3 = {
        endpoint: endpoint.origin,
        region: brandEnv("BACKUP_S3_REGION") ?? "us-east-1",
        bucket: s3Values.bucket!,
        accessKeyId: s3Values.accessKeyId!,
        secretAccessKey: s3Values.secretAccessKey!,
        pathStyle: brandEnv("BACKUP_S3_PATH_STYLE") === "1",
        prefix: (brandEnv("BACKUP_S3_PREFIX") ?? "eldock").replace(/^\/+|\/+$/g, ""),
      };
    } catch {
      issues.push("ELDOCK_BACKUP_S3_ENDPOINT není platná adresa (např. https://fsn1.your-objectstorage.com).");
    }
  } else if (filled > 0 && filled < 4) {
    issues.push("Úložiště mimo server je nastavené jen zčásti – vyplňte ELDOCK_BACKUP_S3_ENDPOINT, _BUCKET, _ACCESS_KEY a _SECRET_KEY.");
  }
  if (s3 && !secret) issues.push("Mimo server se zálohy posílají jen šifrované – nastavte ELDOCK_BACKUP_KEY nebo heslo šifrování záloh ve velínu.");

  return {
    scheduleEnabled: process.env.NODE_ENV === "production" && brandEnv("BACKUP") !== "0",
    time: parseTime(brandEnv("BACKUP_TIME")),
    dir: brandEnv("BACKUP_DIR") ?? path.join(env.cwd ?? process.cwd(), "data", "backups"),
    // Fáze 113: místní denní snímky 14 dní (bez úložiště mimo server jediná záloha)
    keepLocal: intEnv("BACKUP_KEEP_LOCAL", 14, 1, 90),
    secret,
    s3,
    keepDaily: intEnv("BACKUP_KEEP_DAILY", 14, 1, 365),
    keepMonthly: intEnv("BACKUP_KEEP_MONTHLY", 6, 0, 60),
    deletedRetentionDays: 30,
    issues,
  };
}

/** Nastavení pro velín – bez tajných hodnot. */
export function publicBackupConfig(config: BackupConfig) {
  return {
    scheduleEnabled: config.scheduleEnabled,
    time: `${String(config.time.hour).padStart(2, "0")}:${String(config.time.minute).padStart(2, "0")}`,
    dir: config.dir,
    keepLocal: config.keepLocal,
    encrypted: !!config.secret,
    keyFingerprint: config.secret ? keyFingerprint(config.secret) : null,
    offsite: config.s3 && config.secret ? { endpoint: config.s3.endpoint, bucket: config.s3.bucket, prefix: config.s3.prefix } : null,
    keepDaily: config.keepDaily,
    keepMonthly: config.keepMonthly,
    deletedRetentionDays: config.deletedRetentionDays,
    issues: config.issues,
  };
}

export type PublicBackupConfig = ReturnType<typeof publicBackupConfig>;
