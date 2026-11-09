// Fáze 71: tvary odpovědí synchronizačního API v1 (docs/SYNC_API.md) pro aplikace – drží se serveru
// (`server/services/sync.ts`, `server/sync/mutations.ts`), test `sync-client.test.ts` je ověřuje proti trasám API.

import type { SyncMutationType } from "@/lib/sync";

export type SyncPlatformName = "WINDOWS" | "IOS" | "ANDROID" | "PLANT_SERVER" | "OTHER";

/** `GET /api/sync/v1` – informace o serveru (bez přihlášení). */
export interface SyncInfo {
  api: string;
  version: number;
  schema: number;
  name: string;
  serverTime: string;
  pairing: { codeLength: number; ttlMinutes: number };
  platforms: string[];
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  title: string | null;
  accountType: string;
  accountLabel: string;
  permissions: string[];
  layers: string[];
  /** Výřez kategorií zařízení (`null` = vše). */
  visibleTypes: string[] | null;
}

/** `GET /api/sync/v1/session` (a `session` v odpovědi párování). */
export interface SyncSession {
  api: string;
  version: number;
  schema: number;
  serverTime: string;
  scope: string;
  device: { id: string; name: string; platform: string; appVersion: string | null; pairedAt: string; lastPullAt: string | null; lastPushAt: string | null };
  user: SessionUser;
  company: { id: string; name: string; ico: string };
  plants: Array<{ id: string; code: string; name: string; city: string | null }>;
  features: Record<string, unknown>;
  entities: string[];
  mutations: string[];
  policy: { staleAfterHours: number; idleExpiryDays: number; maxBatch: number; defaultPageSize: number; maxPageSize: number; tombstoneDays: number };
  journal: { head: number };
}

export interface PairResponse {
  token: string;
  device: { id: string; name: string; platform: string; createdAt: string };
  session: SyncSession;
}

export interface ChangeEntry {
  entity: string;
  id: string;
  op: "upsert" | "delete";
  seq: number;
  data?: Record<string, unknown>;
}

export interface FileInfo {
  sha256: string | null;
  size: number;
  mime: string;
}

/** `GET /api/sync/v1/changes` – stránka žurnálu změn. */
export interface ChangesPage {
  cursor: number;
  hasMore: boolean;
  reset: boolean;
  scope: string;
  changes: ChangeEntry[];
  files: Record<string, FileInfo>;
  serverTime: string;
}

/** Úprava odesílaná v `POST /api/sync/v1/mutations`. */
export interface WireMutation {
  id: string;
  type: SyncMutationType;
  payload: unknown;
  performedAt: string;
  baseUpdatedAt?: string | null;
}

export interface MutationResult {
  id: string;
  status: "applied" | "rejected" | "error";
  duplicate?: boolean;
  code?: string;
  message?: string;
  entity?: string;
  entityId?: string;
  result?: Record<string, unknown>;
}

/** `POST /api/sync/v1/files` – nahraný soubor. */
export interface UploadedFile {
  url: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
  deduplicated: boolean;
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string };
}
