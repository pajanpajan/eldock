import "server-only";

import { WorkflowError, type WorkflowErrorCode } from "@/lib/workflow/state-machine";
import { prisma } from "@/lib/prisma";
import { SyncError, authenticateDevice, type DeviceContext } from "@/server/services/sync";

// Fáze 70: společné části Route Handlerů `/api/sync/v1/*` – token zařízení z hlavičky, odpovědi bez cache a chyby
// ve tvaru `{ error: { code, message } }` (protokol `docs/SYNC_API.md`).

/**
 * Fáze 71: API synchronizace volá přímo rozhraní aplikací (Electron, WebView mobilních aplikací) z jiného původu.
 * Ověření jen tokenem v hlavičce `Authorization`, cookies API nečte → `*` nic neprozradí: prohlížeč s `*` nepustí
 * požadavek s cookies (`credentials: "include"`) a cizí stránka bez tokenu dostane jen 401.
 */
export const SYNC_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "X-Content-SHA256, ETag, Content-Disposition, Content-Length",
} as const;

const NO_STORE = { "Cache-Control": "no-store", ...SYNC_CORS_HEADERS };

/** Předběžný dotaz CORS (`OPTIONS`) před požadavkem s tokenem nebo tělem JSON. */
export function syncPreflight(methods: string) {
  return new Response(null, {
    status: 204,
    headers: {
      ...SYNC_CORS_HEADERS,
      "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Content-SHA256, If-None-Match",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export function syncJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: NO_STORE });
}

export function syncError(code: string, message: string, status: number) {
  return syncJson({ error: { code, message } }, status);
}

/** Token zařízení z hlavičky `Authorization: Bearer <token>`. */
export function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}

const WORKFLOW_STATUS: Record<WorkflowErrorCode, number> = { VALIDATION: 400, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, INVALID_STATE: 409, INVARIANT: 409 };

export function syncErrorResponse(error: unknown) {
  if (error instanceof SyncError) return syncError(error.code, error.message, error.status);
  if (error instanceof WorkflowError) return syncError(error.code, error.message, WORKFLOW_STATUS[error.code]);
  console.error("[sync] Chyba API synchronizace:", error);
  return syncError("SERVER_ERROR", "Server požadavek nezpracoval – zkuste to znovu.", 500);
}

export const UNPAIRED_MESSAGE = "Zařízení není spárované, bylo odpojeno nebo vypršelo – spárujte ho znovu v „Můj účet“ → „Aplikace a zařízení“.";

/** Požadavek se spárovaným zařízením: neplatný token = 401, chyby služeb = 4xx s českou hláškou. */
export async function withDevice(request: Request, handler: (ctx: DeviceContext) => Promise<Response>): Promise<Response> {
  try {
    const ctx = await authenticateDevice(prisma, bearerToken(request));
    if (!ctx) return syncError("UNAUTHORIZED", UNPAIRED_MESSAGE, 401);
    return await handler(ctx);
  } catch (error) {
    return syncErrorResponse(error);
  }
}

/** Tělo JSON požadavku s limitem velikosti (fronta úprav se zákresy nejvýš pár MB). */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new SyncError("BAD_REQUEST", `Požadavek je příliš velký (nejvýš ${Math.round(maxBytes / 1024 / 1024)} MB) – pošlete méně úprav najednou.`, 413);
  const text = await request.text();
  if (Buffer.byteLength(text) > maxBytes) throw new SyncError("BAD_REQUEST", `Požadavek je příliš velký (nejvýš ${Math.round(maxBytes / 1024 / 1024)} MB) – pošlete méně úprav najednou.`, 413);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SyncError("BAD_REQUEST", "Tělo požadavku není platný JSON.", 400);
  }
}
