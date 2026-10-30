import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE, isAuthBypassed, verifyAuthToken } from "@/lib/auth";
import { APP_HOME } from "@/lib/routes";

/**
 * Přihlašovací brána: veřejná je jen úvodní stránka `/` a `/login`. Bez platné cookie `digitry-auth` vede každá jiná stránka na `/login`
 * (s návratem `?next=`), API odpoví 401. Statické soubory, ikony a manifest PWA vyřazuje matcher.
 */
const PUBLIC_PATHS = new Set(["/", "/login"]);

/** Reálné PDF projekty (public/demo-docs): přihlášený prohlížeč je drží den, pak ověří na pozadí. */
const DEMO_DOCS_CACHE = "private, max-age=86400, stale-while-revalidate=604800";

export async function proxy(request: NextRequest) {
  if (isAuthBypassed()) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  // Cron (avízo lhůt revizí) se ověřuje vlastním tajným tokenem v Route Handleru.
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  const session = await verifyAuthToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (session) {
    const response = NextResponse.next();
    if (pathname.startsWith("/demo-docs/")) response.headers.set("Cache-Control", DEMO_DOCS_CACHE);
    return response;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Nepřihlášeno – přihlaste se na /login." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === APP_HOME ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  // Přesměrování na přihlášení se nesmí cachovat (po přihlášení musí cíl fungovat hned).
  const redirect = NextResponse.redirect(url);
  redirect.headers.set("Cache-Control", "no-store");
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt).*)"],
};
