import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE, PANEL_AUTH_COOKIE, SUPERADMIN_COOKIE, companyIdOf, isAuthBypassed, isSuperadminToken, verifyAuthToken } from "@/lib/auth";
import { APP_HOME } from "@/lib/routes";

/**
 * Přihlašovací brána se dvěma oddělenými produkty (fáze 41):
 * - veřejné: úvodní stránka `/`, ukázka elaborátu `/ukazka-elaboratu`, SEO soubory, `/login`, registrace závodu `/register-plant`, přihlášení / registrace
 *   AI Panel Builderu `/panel-builder/auth` a dotaz do registru ARES `/api/ares`;
 * - AI Panel Builder (`/panel-builder/*`) jen s přihlášenou firmou (cookie `eldock-pb`), jinak `/panel-builder/auth`;
 * - Správa závodů (vše ostatní) jen s přihlášením do závodu (cookie `digitry-auth`), jinak `/login`.
 * - velín `/superadmin` jen s cookie `eldock-superadmin` (fáze 50), jinak `/superadmin/login`.
 * API přijme kterékoli přihlášení; firma Panel Builderu a velín smí jen nahrávat a číst fotky.
 */
// Fáze 48: veřejná ukázka elaborátu a SEO soubory (sitemap.xml, náhled odkazu opengraph-image)
const PUBLIC_PATHS = new Set(["/", "/login", "/register-plant", "/panel-builder/auth", "/api/ares", "/ukazka-elaboratu", "/sitemap.xml", "/robots.txt", "/superadmin/login"]);
const SUPERADMIN_PREFIX = "/superadmin";
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
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/opengraph-image")) return NextResponse.next();
  // Cron (avízo lhůt revizí) se ověřuje vlastním tajným tokenem v Route Handleru.
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  // Velín /superadmin (fáze 50): jen s cookie eldock-superadmin (vlastní podpis), jinak přihlášení velínu
  const superadmin = await isSuperadminToken(request.cookies.get(SUPERADMIN_COOKIE)?.value);
  if (pathname === SUPERADMIN_PREFIX || pathname.startsWith(`${SUPERADMIN_PREFIX}/`)) {
    return superadmin ? NextResponse.next() : redirectTo(request, "/superadmin/login");
  }

  const [plantSession, panelSession] = await Promise.all([verifyAuthToken(request.cookies.get(AUTH_COOKIE)?.value), verifyAuthToken(request.cookies.get(PANEL_AUTH_COOKIE)?.value)]);
  // Token Panel Builderu podstrčený do cookie závodu neplatí (a naopak).
  const plant = plantSession && !companyIdOf(plantSession) ? plantSession : null;
  const company = companyIdOf(panelSession);

  if (pathname === PANEL_PREFIX || pathname.startsWith(`${PANEL_PREFIX}/`)) {
    return company ? NextResponse.next() : redirectTo(request, "/panel-builder/auth", pathname === PANEL_PREFIX ? undefined : pathname + search);
  }

  if (pathname.startsWith("/api/")) {
    const panelApi = pathname === "/api/uploads" || pathname.startsWith("/api/files/photos/");
    // Velín vidí fotky rozváděčů firem (hlášení chyb AI, projekty firem)
    if (plant || ((company || superadmin) && panelApi)) return NextResponse.next();
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
