import { SYNC_API, SYNC_API_VERSION, SYNC_PLATFORMS, SYNC_POLICY, SYNC_SCHEMA_VERSION } from "@/lib/sync";
import { syncJson, syncPreflight } from "@/server/sync/http";

/**
 * Fáze 70: informace o serveru pro aplikace (bez přihlášení) – aplikace po naskenování QR ověří, že na adrese běží
 * Eldock s podporovanou verzí API (cloud i server závodu ve fázi 71). Protokol: `docs/SYNC_API.md`.
 */
export function GET() {
  return syncJson({
    api: SYNC_API,
    version: SYNC_API_VERSION,
    schema: SYNC_SCHEMA_VERSION,
    name: "Eldock",
    serverTime: new Date().toISOString(),
    pairing: { codeLength: 8, ttlMinutes: SYNC_POLICY.pairingTtlMinutes },
    platforms: SYNC_PLATFORMS,
  });
}

/** Fáze 71: předběžný dotaz CORS z rozhraní aplikací. */
export function OPTIONS() {
  return syncPreflight("GET");
}
