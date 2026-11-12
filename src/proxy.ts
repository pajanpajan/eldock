import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE, PANEL_AUTH_COOKIE, SUPERADMIN_COOKIE, companyIdOf, isAuthBypassed, isSuperadminToken, verifyAuthToken } from "@/lib/auth";
import { APP_HOME, isPlantRoute } from "@/lib/routes";

/**
 * Přihlašovací brána se dvěma oddělenými produkty (fáze 41):
 * - veřejné: úvodní stránka `/`, ukázka elaborátu `/ukazka-elaboratu`, video-návody `/navody`, SEO soubory, `/login`, registrace závodu `/register-plant`, přihlášení / registrace
 *   AI Panel Builderu `/panel-builder/auth` a dotaz do registru ARES `/api/ares`;
 * - AI Panel Builder (`/panel-builder/*`) jen s přihlášenou firmou (cookie `eldock-pb`), jinak `/panel-builder/auth`;
 * - Správa závodů (`PLANT_ROUTE_PREFIXES`) jen s přihlášením do závodu (cookie `digitry-auth`), jinak `/login`;
 *   ostatní adresy (veřejné soubory, neexistující stránky) projdou a Next.js vrátí soubor nebo 404 (fáze 54).
 * - velín `/superadmin` jen s cookie `eldock-superadmin` (fáze 50), jinak `/superadmin/login`.
 * API přijme přihlášení do závodu; firma Panel Builderu a velín smí jen nahrávat a číst soubory (fáze 68: čtení
 * souboru povolí jen jeho vlastník – registr `StoredFile`).
 */
// Fáze 48: veřejná ukázka elaborátu a SEO soubory (sitemap.xml, náhled odkazu opengraph-image)
// Fáze 54: právní stránky (zásady zpracování osobních údajů, obchodní podmínky)
// Fáze 67: obnova a nastavení hesla (pozvánka zaměstnance) bez přihlášení
// Fáze 87: video-návody `/navody` a jejich MP4 / náhledy v `public/tutorials` (odkaz pro kolegy elektrikáře)
// Fáze 96: veřejná vstupní stránka a katalog AI Panel Builderu a SEO vstupní stránky – 200 bez přihlášení i pro roboty
// vyhledávačů (přihlášení vyžaduje až uložení vlastního projektu, tisk s razítkem a další stránky Panel Builderu)
const PUBLIC_PATHS = new Set(["/", "/login", "/register-plant", "/panel-builder", "/panel-builder/auth", "/panel-builder/catalog", "/api/ares", "/ukazka-elaboratu", "/navody", "/ai-panel-builder", "/2d-pudorys-elektroinstalace", "/vypocet-otepleni-rozvadece", "/kusova-zkouska-rozvadece", "/prumyslova-udrzba-a-revize", "/ochrana-osobnich-udaju", "/obchodni-podminky", "/sitemap.xml", "/robots.txt", "/superadmin/login", "/api/consent", "/api/telemetry", "/newsletter/potvrzeni", "/newsletter/odhlaseni", "/api/newsletter/unsubscribe", "/zapomenute-heslo", "/api/catalog-images/manifest", "/prezentace"]);
// Fáze 92: nahrané produktové fotky řad a jejich manifest nejsou tajné (galerie řad všem uživatelům)
// Fáze 103: karta QR štítku /q/EL-… (technik u rozváděče bez přihlášení) a portál projektantů ELDOCK Poolu (vlastní
// přihlášení e-mailem a přístupovým kódem; odevzdání souborů ověřuje /api/pool/ samo)
const PUBLIC_PREFIXES = ["/opengraph-image", "/brands/", "/api/brand-logo/", "/nastavit-heslo/", "/tutorials/", "/api/catalog-images/file/", "/q/", "/portal-projektantu", "/api/pool/"];
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
  // Loga výrobců (fáze 51) nejsou tajná – soubory public/brands a /api/brand-logo bez přihlášení
  if (PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();
  // Cron (avízo lhůt revizí) se ověřuje vlastním tajným tokenem v Route Handleru.
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();
  // Fáze 96: oznámení stránek vyhledávačům (IndexNow) po nasazení – tajný token / velín ověří Route Handler
  if (pathname === "/api/seo/ping") return NextResponse.next();
  // Fáze 70: API synchronizace aplikací (Windows, iOS, Android) ověřuje token zařízení samo; soubory s tokenem
  // zařízení (`Authorization: Bearer`) vydá /api/files podle vlastníka firmy zařízení.
  if (pathname.startsWith("/api/sync/")) return NextResponse.next();
  if (pathname.startsWith("/api/files/") && /^Bearer\s/i.test(request.headers.get("authorization") ?? "")) return NextResponse.next();
  // Fáze 71: předběžný dotaz CORS rozhraní aplikace před stažením s tokenem (sám hlavičku Authorization nenese)
  if (pathname.startsWith("/api/files/") && request.method === "OPTIONS" && /(^|[\s,])authorization($|[\s,])/i.test(request.headers.get("access-control-request-headers") ?? "")) return NextResponse.next();

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
    // Fáze 68: nahrání a soubory pustí brána každému přihlášení – o přístupu k souboru rozhoduje jeho vlastník
    // (registr `StoredFile` v GET /api/files): firma Panel Builderu tak vidí i své logo a razítko, velín vše.
    // Fáze 69: export dat firmy (Panel Builder a velín) – oprávnění ověří route handler
    // Fáze 92: nahrání fotky do katalogu řad – oprávnění velínu ověří route handler
    const fileApi = pathname === "/api/uploads" || pathname.startsWith("/api/files/") || pathname === "/api/data-export" || pathname === "/api/catalog-images/upload";
    if (plant || ((company || superadmin) && fileApi)) return NextResponse.next();
    // Fáze 103: registr QR štítků ELDOCK – API jen pro velín (route handler ověří cookie velínu znovu)
    if (superadmin && pathname === "/api/qr-labels") return NextResponse.next();
    return NextResponse.json({ error: "Nepřihlášeno – přihlaste se na /login." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  if (plant) {
    const response = NextResponse.next();
    if (pathname.startsWith("/demo-docs/")) response.headers.set("Cache-Control", DEMO_DOCS_CACHE);
    return response;
  }
  // Fáze 54: na přihlášení vedou jen trasy Správy závodů; cokoli jiného (veřejný soubor nebo neexistující adresa)
  // projde do Next.js, který vrátí soubor nebo 404 – žádné 307 na /login pro /llms.txt a překlepy.
  if (!isPlantRoute(pathname)) return NextResponse.next();
  return redirectTo(request, "/login", pathname === APP_HOME ? undefined : pathname + search);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt).*)"],
};
