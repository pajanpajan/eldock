import type { PrismaClient } from "@/generated/prisma/client";
import {
  BACKUP_STORAGE_KEY,
  MIN_BACKUP_KEY,
  SMTP_KEY,
  backupStorageInputSchema,
  parseStoredBackupStorage,
  parseStoredSmtp,
  smtpInputSchema,
  type StoredBackupStorage,
  type StoredSmtp,
} from "@/lib/platform-settings";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { openSecret, sealSecret } from "@/server/platform-secrets";

// Fáze 113: nastavení SMTP a úložiště záloh mimo server (S3 / Cloudflare R2) z velínu. Uloží se do `PlatformSetting`
// (tajné hodnoty zašifrované) a drží se v paměti procesu – odesílání e-mailů i plánovač záloh je čtou synchronně.
// Proměnné prostředí mají vždy přednost (`mailer.ts`, `backup/config.ts`).

export interface SmtpRuntime {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string | null;
  from: string;
}

export interface BackupStorageRuntime {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string | null;
  prefix: string;
  pathStyle: boolean;
  backupKey: string | null;
}

interface PlatformCache {
  smtp: SmtpRuntime | null;
  storage: BackupStorageRuntime | null;
  loaded: boolean;
}

const CACHE = Symbol.for("eldock.platform-settings");

/** Nastavení v paměti procesu (sdílené všemi moduly serveru přes `globalThis`). */
export function platformCache(): PlatformCache {
  const holder = globalThis as unknown as Record<symbol, PlatformCache | undefined>;
  return (holder[CACHE] ??= { smtp: null, storage: null, loaded: false });
}

async function read(db: PrismaClient, key: string): Promise<string | null> {
  try {
    return (await db.platformSetting.findUnique({ where: { key }, select: { valueJson: true } }))?.valueJson ?? null;
  } catch {
    return null;
  }
}

const smtpRuntime = (stored: StoredSmtp | null): SmtpRuntime | null => (stored ? { host: stored.host, port: stored.port, secure: stored.secure, user: stored.user, pass: openSecret(stored.passwordSealed), from: stored.from } : null);

const storageRuntime = (stored: StoredBackupStorage | null): BackupStorageRuntime | null =>
  stored
    ? {
        endpoint: stored.endpoint,
        region: stored.region,
        bucket: stored.bucket,
        accessKeyId: stored.accessKeyId,
        secretAccessKey: openSecret(stored.secretSealed),
        prefix: stored.prefix,
        pathStyle: stored.pathStyle,
        backupKey: openSecret(stored.backupKeySealed),
      }
    : null;

/** Načte nastavení z databáze do paměti procesu (start serveru, skript zálohy, uložení ve velínu). */
export async function loadPlatformSettings(db: PrismaClient): Promise<PlatformCache> {
  const cache = platformCache();
  const [smtp, storage] = await Promise.all([read(db, SMTP_KEY), read(db, BACKUP_STORAGE_KEY)]);
  cache.smtp = smtpRuntime(parseStoredSmtp(smtp));
  cache.storage = storageRuntime(parseStoredBackupStorage(storage));
  cache.loaded = true;
  return cache;
}

/** Uloží SMTP z velínu (prázdné heslo = ponechat uložené) a hned ho použije. */
export async function saveSmtpSettings(db: PrismaClient, input: unknown): Promise<SmtpRuntime> {
  const parsed = smtpInputSchema.safeParse(input);
  if (!parsed.success) throw new WorkflowError("VALIDATION", parsed.error.issues[0]?.message ?? "Zkontrolujte nastavení SMTP.");
  const previous = parseStoredSmtp(await read(db, SMTP_KEY));
  const stored: StoredSmtp = {
    host: parsed.data.host,
    port: parsed.data.port,
    secure: parsed.data.secure,
    user: parsed.data.user,
    passwordSealed: parsed.data.password?.trim() ? sealSecret(parsed.data.password) : (previous?.passwordSealed ?? null),
    from: parsed.data.from,
  };
  const json = JSON.stringify(stored);
  await db.platformSetting.upsert({ where: { key: SMTP_KEY }, create: { key: SMTP_KEY, valueJson: json }, update: { valueJson: json } });
  await loadPlatformSettings(db);
  return smtpRuntime(stored)!;
}

/** Uloží úložiště záloh mimo server z velínu (prázdné tajné hodnoty = ponechat uložené). */
export async function saveBackupStorage(db: PrismaClient, input: unknown): Promise<BackupStorageRuntime> {
  const parsed = backupStorageInputSchema.safeParse(input);
  if (!parsed.success) throw new WorkflowError("VALIDATION", parsed.error.issues[0]?.message ?? "Zkontrolujte úložiště záloh.");
  const key = parsed.data.backupKey?.trim();
  if (key && key.length < MIN_BACKUP_KEY) throw new WorkflowError("VALIDATION", `Heslo šifrování záloh musí mít aspoň ${MIN_BACKUP_KEY} znaků.`);
  const previous = parseStoredBackupStorage(await read(db, BACKUP_STORAGE_KEY));
  const stored: StoredBackupStorage = {
    endpoint: new URL(parsed.data.endpoint).origin,
    region: parsed.data.region || "auto",
    bucket: parsed.data.bucket,
    accessKeyId: parsed.data.accessKeyId,
    secretSealed: parsed.data.secretAccessKey?.trim() ? sealSecret(parsed.data.secretAccessKey.trim()) : (previous?.secretSealed ?? null),
    prefix: (parsed.data.prefix || "eldock").replace(/^\/+|\/+$/g, ""),
    pathStyle: parsed.data.pathStyle,
    backupKeySealed: key ? sealSecret(key) : (previous?.backupKeySealed ?? null),
  };
  if (!stored.secretSealed) throw new WorkflowError("VALIDATION", "Vyplňte Secret Access Key úložiště.");
  const json = JSON.stringify(stored);
  await db.platformSetting.upsert({ where: { key: BACKUP_STORAGE_KEY }, create: { key: BACKUP_STORAGE_KEY, valueJson: json }, update: { valueJson: json } });
  await loadPlatformSettings(db);
  return storageRuntime(stored)!;
}

/** Odebrání SMTP z velínu (e-maily se dál jen zapisují do logu, pokud SMTP nedává prostředí). */
export async function clearSmtpSettings(db: PrismaClient) {
  await db.platformSetting.deleteMany({ where: { key: SMTP_KEY } });
  await loadPlatformSettings(db);
}

/** Odebrání úložiště záloh z velínu (zálohy dál jen místně na serveru). */
export async function clearBackupStorage(db: PrismaClient) {
  await db.platformSetting.deleteMany({ where: { key: BACKUP_STORAGE_KEY } });
  await loadPlatformSettings(db);
}

/** Pohled pro velín bez tajných hodnot. */
export function publicPlatformSettings(cache: PlatformCache, env: { smtpUrl: boolean; s3: boolean }) {
  return {
    smtp: cache.smtp ? { host: cache.smtp.host, port: cache.smtp.port, secure: cache.smtp.secure, user: cache.smtp.user, from: cache.smtp.from, passwordSet: Boolean(cache.smtp.pass) } : null,
    storage: cache.storage
      ? { endpoint: cache.storage.endpoint, region: cache.storage.region, bucket: cache.storage.bucket, accessKeyId: cache.storage.accessKeyId, prefix: cache.storage.prefix, pathStyle: cache.storage.pathStyle, secretSet: Boolean(cache.storage.secretAccessKey), backupKeySet: Boolean(cache.storage.backupKey) }
      : null,
    envSmtp: env.smtpUrl,
    envStorage: env.s3,
  };
}

export type PublicPlatformSettings = ReturnType<typeof publicPlatformSettings>;
