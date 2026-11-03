import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE, PANEL_AUTH_COOKIE, companyIdOf, isAuthBypassed, verifyAuthToken } from "@/lib/auth";
import { APP_HOME } from "@/lib/routes";

/**
 * Přihlašovací brána se dvěma oddělenými produkty (fáze 41):
 * - veřejné: úvodní stránka `/`, `/login`, registrace závodu `/register-plant`, přihlášení / registrace
 *   AI Panel Builderu `/panel-builder/auth` a dotaz do registru ARES `/api/ares`;
 * - AI Panel Builder (`/panel-builder/*`) jen s přihlášenou firmou (cookie `eldock-pb`), jinak `/panel-builder/auth`;
 * - Správa závodů (vše ostatní) jen s přihlášením do závodu (cookie `digitry-auth`), jinak `/login`.
 * API přijme kterékoli přihlášení; firma Panel Builderu smí jen nahrávat a číst fotky.
 */
const PUBLIC_PATHS = new Set(["/", "/login", "/register-plant", "/panel-builder/auth", "/api/ares"]);
const PANEL_PREFIX = "/panel-builder";

/** Reálné PDF projekty (public/demo-docs): přihlášený prohlížeč je drží den, pak ověří na pozadí. */
const DEMO_DOCS_CACHE = "private, max-age=86400, stale-while-revalidate=604800";

function redirectTo(request: NextRequest, pathname: string, next?: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = next ? `?next=${encodeURIComponent(next)}` : "";
  // Přesměrování na přihlášení se nesmí cachovat (po přihlášení musí cíl fungovat hned).
  const redirect = NextResponse.redirect(url);
  redirect.headers.set("Cache-Control", "no-store");
  return redirect;
}

export async function proxy(request: NextRequest) {
  if (isAuthBypassed()) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  // Cron (avízo lhůt revizí) se ověřuje vlastním tajným tokenem v Route Handleru.
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  const [plantSession, panelSession] = await Promise.all([verifyAuthToken(request.cookies.get(AUTH_COOKIE)?.value), verifyAuthToken(request.cookies.get(PANEL_AUTH_COOKIE)?.value)]);
  // Token Panel Builderu podstrčený do cookie závodu neplatí (a naopak).
  const plant = plantSession && !companyIdOf(plantSession) ? plantSession : null;
  const company = companyIdOf(panelSession);

  if (pathname === PANEL_PREFIX || pathname.startsWith(`${PANEL_PREFIX}/`)) {
    return company ? NextResponse.next() : redirectTo(request, "/panel-builder/auth", pathname === PANEL_PREFIX ? undefined : pathname + search);
  }

  if (pathname.startsWith("/api/")) {
    const panelApi = pathname === "/api/uploads" || pathname.startsWith("/api/files/photos/");
    if (plant || (company && panelApi)) return NextResponse.next();
    return NextResponse.json({ error: "Nepřihlášeno – přihlaste se na /login." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  if (plant) {
    const response = NextResponse.next();
    if (pathname.startsWith("/demo-docs/")) response.headers.set("Cache-Control", DEMO_DOCS_CACHE);
    return response;
  }
  return redirectTo(request, "/login", pathname === APP_HOME ? undefined : pathname + search);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt).*)"],
};
