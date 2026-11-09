// Pomocník testů (fáze 71–72): podvržený `fetch` na Route Handlery cloudu (`/api/sync/v1/*`, `/api/files/*`) – bez
// serveru. Testovací soubor musí sám nahradit `@/lib/prisma`, `server-only` a `next/cache` (vi.mock), jinak trasy
// sahají na skutečnou databázi.

import type { FetchLike } from "@/sync-client";

export interface CloudControl {
  /** `false` = cloud nedostupný (fetch selže jako bez sítě). */
  online: boolean;
  /** Volání ve tvaru „METODA /cesta“. */
  calls: string[];
}

type Handler = (request: Request) => Response | Promise<Response>;

export async function cloudFetcher(control: CloudControl): Promise<FetchLike> {
  const [info, pair, session, changes, mutations, files, download] = await Promise.all([
    import("@/app/api/sync/v1/route"),
    import("@/app/api/sync/v1/pair/route"),
    import("@/app/api/sync/v1/session/route"),
    import("@/app/api/sync/v1/changes/route"),
    import("@/app/api/sync/v1/mutations/route"),
    import("@/app/api/sync/v1/files/route"),
    import("@/app/api/files/[...path]/route"),
  ]);
  const table: Record<string, Partial<Record<string, Handler>>> = {
    "/api/sync/v1": { GET: () => info.GET(), OPTIONS: () => info.OPTIONS() },
    "/api/sync/v1/pair": { POST: pair.POST, OPTIONS: () => pair.OPTIONS() },
    "/api/sync/v1/session": { GET: session.GET, DELETE: session.DELETE, OPTIONS: () => session.OPTIONS() },
    "/api/sync/v1/changes": { GET: changes.GET, OPTIONS: () => changes.OPTIONS() },
    "/api/sync/v1/mutations": { POST: mutations.POST, OPTIONS: () => mutations.OPTIONS() },
    "/api/sync/v1/files": { POST: files.POST, OPTIONS: () => files.OPTIONS() },
  };
  return async (input, init) => {
    if (!control.online) throw new TypeError("fetch failed");
    const request = new Request(input, init);
    const { pathname } = new URL(request.url);
    control.calls.push(`${request.method} ${pathname}`);
    const handler = table[pathname]?.[request.method];
    if (handler) return handler(request);
    if (pathname.startsWith("/api/files/")) {
      if (request.method === "OPTIONS") return download.OPTIONS();
      const segments = pathname.slice("/api/files/".length).split("/").map(decodeURIComponent);
      if (request.method === "GET") return download.GET(request, { params: Promise.resolve({ path: segments }) } as never);
    }
    return new Response("nenalezeno", { status: 404 });
  };
}
