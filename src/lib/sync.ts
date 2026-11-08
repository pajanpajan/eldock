// Fáze 70: synchronizace s aplikacemi (Windows, iOS, Android, server závodu) – pravidla, kódy párování a stav
// synchronizace. Čisté funkce (server i klient, bez Prismy a node:crypto). Protokol popisuje `docs/SYNC_API.md`.

import type { SyncPlatform } from "@/generated/prisma/enums";

/** Identifikace API (odpověď `GET /api/sync/v1`) a jeho verze v cestě. */
export const SYNC_API = "eldock-sync";
export const SYNC_API_VERSION = 1;
/**
 * Verze tvaru synchronizovaných dat. Zvýšit, když se změní obsah, který server posílá (nová tabulka, jiná pole),
 * nebo po opravě žurnálu – aplikace s jinou verzí dostanou `reset` a stáhnou vše znovu.
 */
export const SYNC_SCHEMA_VERSION = 1;

export const SYNC_POLICY = {
  /** Platnost kódu párování. */
  pairingTtlMinutes: 10,
  /** Upozornění „nesynchronizováno“ (offline provoz = synchronizace aspoň jednou denně). */
  staleAfterHours: 24,
  /** Token zařízení vyprší po tolika dnech bez spojení (pak je nutné spárovat znovu). */
  idleExpiryDays: 90,
  maxDevicesPerUser: 10,
  /** Limit chybných kódů párování z jedné IP adresy za 15 minut. */
  maxPairFailuresPerIp: 10,
  pairFailureWindowMinutes: 15,
  /** Nejvýš úprav v jednom odeslání fronty. */
  maxBatch: 50,
  defaultPageSize: 500,
  maxPageSize: 2000,
  /** Čas provedení úpravy z aplikace (offline) se převezme jen z posledních N dní. */
  performedAtMaxAgeDays: 30,
  /** Retence: značky smazání v žurnálu, evidence úprav, odpojená zařízení, kódy párování. */
  tombstoneDays: 90,
  mutationDays: 90,
  revokedDeviceDays: 30,
  pairingDays: 1,
} as const;

export const SYNC_PLATFORMS: readonly SyncPlatform[] = ["WINDOWS", "IOS", "ANDROID", "PLANT_SERVER", "OTHER"];

export const SYNC_PLATFORM_LABELS: Record<SyncPlatform, string> = {
  WINDOWS: "Windows",
  IOS: "iPhone / iPad",
  ANDROID: "Android",
  PLANT_SERVER: "Server závodu",
  OTHER: "Jiné zařízení",
};

/** Druhy úprav z aplikace (v1) – popisky do správy zařízení. Obsluhu má `server/sync/mutations.ts`. */
export const SYNC_MUTATION_LABELS = {
  "changeRequest.submit": "Zadání změny",
  "changeRequest.comment": "Komentář ke změně",
  "temporaryMod.create": "Nové provizorium",
  "temporaryMod.restore": "Ukončení provizoria 1:1",
  "defect.resolve": "Odstranění závady",
  "component.replace": "Výměna součástky",
  "equipment.photo": "Fotka zařízení",
} as const;
export type SyncMutationType = keyof typeof SYNC_MUTATION_LABELS;
export const SYNC_MUTATION_TYPES = Object.keys(SYNC_MUTATION_LABELS) as SyncMutationType[];

// ---------------------------------------------------------------------------
//  Kód párování (Crockford Base32: bez I, L, O, U – při přepisu z obrazovky se nepletou)
// ---------------------------------------------------------------------------

export const PAIRING_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const PAIRING_CODE_LENGTH = 8;

/** Kód z náhodných bajtů (každý bajt → jeden znak, 5 bitů). */
export function pairingCodeFrom(bytes: Uint8Array): string {
  if (bytes.length < PAIRING_CODE_LENGTH) throw new Error("Málo náhodných bajtů pro kód párování.");
  return Array.from(bytes.subarray(0, PAIRING_CODE_LENGTH), (byte) => PAIRING_ALPHABET[byte & 31]).join("");
}

/** Zobrazení po čtveřicích: „K7QX-3MZP“. */
export const formatPairingCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** Normalizace opsaného kódu: velká písmena, bez mezer a pomlček, O → 0, I / L → 1. Neplatný = `null`. */
export function normalizePairingCode(input: string): string | null {
  const code = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (code.length !== PAIRING_CODE_LENGTH) return null;
  return [...code].every((char) => PAIRING_ALPHABET.includes(char)) ? code : null;
}

/** Obsah QR kódu párování: adresa serveru (cloud nebo server závodu) a kód. */
export function pairingUri(server: string, code: string): string {
  return `eldock://pair?server=${encodeURIComponent(server.replace(/\/$/, ""))}&code=${encodeURIComponent(code)}`;
}

// ---------------------------------------------------------------------------
//  Stav zařízení
// ---------------------------------------------------------------------------

export type DeviceSyncState = "never" | "ok" | "stale" | "expired" | "revoked";

export interface DeviceStateInput {
  revokedAt?: Date | string | null;
  lastSeenAt: Date | string;
  lastPullAt?: Date | string | null;
}

const time = (value: Date | string) => (typeof value === "string" ? new Date(value) : value).getTime();

/** Stav synchronizace: odpojené, vypršelé (90 dní bez spojení), nikdy nesynchronizované, aktuální, nebo po 24 h bez synchronizace. */
export function deviceSyncState(device: DeviceStateInput, now: Date | number = Date.now()): DeviceSyncState {
  const at = typeof now === "number" ? now : now.getTime();
  if (device.revokedAt) return "revoked";
  if (at - time(device.lastSeenAt) > SYNC_POLICY.idleExpiryDays * 86_400_000) return "expired";
  if (!device.lastPullAt) return "never";
  return at - time(device.lastPullAt) > SYNC_POLICY.staleAfterHours * 3_600_000 ? "stale" : "ok";
}

/** Hodiny od poslední synchronizace (zaokrouhlené dolů), `null` = nikdy. */
export function hoursSinceSync(lastPullAt: Date | string | null | undefined, now: Date | number = Date.now()): number | null {
  if (!lastPullAt) return null;
  const at = typeof now === "number" ? now : now.getTime();
  return Math.max(0, Math.floor((at - time(lastPullAt)) / 3_600_000));
}

/**
 * Čas provedení úpravy z aplikace (offline): převezme se, je-li platný a nejvýš 30 dní starý; budoucí čas
 * (rozjeté hodiny) nejvýš o 5 minut se zarovná na čas serveru. Jinak čas přijetí na serveru.
 */
export function effectivePerformedAt(value: string | null | undefined, now: Date): Date {
  if (!value) return now;
  const at = new Date(value);
  const ms = at.getTime();
  if (Number.isNaN(ms)) return now;
  if (ms > now.getTime() + 5 * 60_000) return now;
  if (ms < now.getTime() - SYNC_POLICY.performedAtMaxAgeDays * 86_400_000) return now;
  return ms > now.getTime() ? now : at;
}

/** Id záznamu nebo úpravy přidělené aplikací (UUID, cuid). */
export const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
