// Fáze 104: ochrana know-how a katalogových dat ELDOCK proti automatizovanému stahování (scraping) – blokace známých
// kopírovacích robotů mimo veřejné SEO stránky a omezení četnosti požadavků na katalogová, výpočtová a exportní rozhraní
// podle IP adresy. Limiter drží okna v paměti procesu (jedna instance aplikace za Caddy). Čistá logika bez Next.js.

/**
 * Programy na kopírování celých webů a skriptovací klienti (HTTrack, WebCopier, Teleport Pro, SiteSnagger, Offline
 * Explorer, python-requests a příbuzné nástroje). Vyhledávače a AI vyhledávače sem nepatří – ty řídí robots.txt.
 */
export const SCRAPER_AGENT_PATTERN =
  /httrack|webcopier|teleport ?pro|\bteleport\/|sitesnagger|offline ?explorer|python-requests|python-urllib|aiohttp|scrapy|webzip|webstripper|webreaper|websucker|sitesucker|black ?widow|\bwget\//i;

/** Jména robotů pro robots.txt (slušné kopírovací programy pravidlo dodrží, ostatní zastaví brána). */
export const SCRAPER_ROBOTS = ["HTTrack", "WebCopier", "Teleport", "TeleportPro", "SiteSnagger", "Offline Explorer", "WebZIP", "WebStripper", "WebReaper", "SiteSucker", "BlackWidow", "Wget", "Scrapy", "python-requests"] as const;

export const isScraperAgent = (userAgent: string | null | undefined): boolean => Boolean(userAgent && SCRAPER_AGENT_PATTERN.test(userAgent));

/** Veřejné SEO stránky a soubory pro vyhledávače – na nich se roboti neblokují (obsah je určený k indexaci). */
export function isSeoPath(pathname: string, seoPaths: ReadonlySet<string>): boolean {
  return seoPaths.has(pathname) || pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname === "/llms.txt" || pathname.startsWith("/opengraph-image");
}

/** Limity na IP adresu za minutu: běžná API 60, těžké exporty 15, obrázky katalogu 600, výpočty Panel Builderu 240. */
export const RATE_LIMITS = {
  api: { limit: 60, windowMs: 60_000 },
  export: { limit: 15, windowMs: 60_000 },
  media: { limit: 600, windowMs: 60_000 },
  actions: { limit: 240, windowMs: 60_000 },
  // Fáze 107: veřejné odeslání kontaktní zprávy s printscreeny
  contact: { limit: 10, windowMs: 60_000 },
} as const;

export type RateBucket = keyof typeof RATE_LIMITS;

const EXPORT_PATH = /^\/api\/data-export$|^\/superadmin\/(leads-export|newsletter-export)$|^\/superadmin\/qr-stitky\/[^/]+\/zpl$|^\/api\/pool\/package\/|^\/api\/vyroba\/package\//;
const API_PATH = /^\/api\/(catalog|panel-builder|qr-labels|ares)/;

/**
 * Limit, do kterého požadavek patří (null = bez omezení): exporty (ZIP s daty firmy, CSV kontaktů a odběratelů, ZPL
 * série štítků, balíček podkladů poolu), obrázky katalogu, katalogová a výpočtová API (`/api/catalog*`,
 * `/api/panel-builder*`, `/api/qr-labels*`, `/api/ares*`) a katalog prvků, serverové akce AI Panel Builderu a 2D půdorysu.
 */
export function rateBucketOf(input: { pathname: string; method: string; action: boolean }): RateBucket | null {
  const { pathname } = input;
  if (EXPORT_PATH.test(pathname)) return "export";
  if (pathname === "/api/contact" && input.method === "POST") return "contact";
  if (pathname.startsWith("/api/catalog-images/file/") || pathname.startsWith("/api/brand-logo/") || pathname.startsWith("/api/pool/preview/")) return "media";
  if (API_PATH.test(pathname)) return "api";
  if (input.action && input.method === "POST" && (pathname === "/panel-builder" || pathname.startsWith("/panel-builder/"))) return "actions";
  if (pathname === "/panel-builder/catalog" || pathname.startsWith("/panel-builder/catalog/")) return "api";
  return null;
}

/** Limiter s pevným oknem: `hit` vrátí null (projde), nebo počet sekund, za které se okno uvolní (429 Retry-After). */
export function createRateLimiter(maxKeys = 20_000) {
  const windows = new Map<string, { start: number; count: number }>();
  const prune = (now: number) => {
    for (const [key, entry] of windows) if (now - entry.start >= 60_000) windows.delete(key);
    if (windows.size >= maxKeys) windows.clear();
  };
  return {
    hit(bucket: RateBucket, key: string, now = Date.now()): number | null {
      const rule = RATE_LIMITS[bucket];
      const id = `${bucket}:${key}`;
      const entry = windows.get(id);
      if (!entry || now - entry.start >= rule.windowMs) {
        if (windows.size >= maxKeys) prune(now);
        windows.set(id, { start: now, count: 1 });
        return null;
      }
      entry.count += 1;
      return entry.count > rule.limit ? Math.max(1, Math.ceil((entry.start + rule.windowMs - now) / 1000)) : null;
    },
    size: () => windows.size,
  };
}

/**
 * IP klienta za reverzní proxy Caddy (první adresa v X-Forwarded-For, jinak X-Real-IP). Bez hlaviček = přímý požadavek
 * na kontejner (healthcheck, vývoj, E2E) – ten se neomezuje; na produkci jde každý požadavek přes Caddy.
 */
export function clientIpOf(headers: { get(name: string): string | null }): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || null;
}

/** Hláška blokace kopírovacího robota (HTTP 403). */
export const SCRAPER_BLOCKED_TEXT = "Automatizované vytěžování (scraping) a kopírování obsahu ELDOCK je zakázáno – databáze prvků a výpočtové algoritmy chrání zák. č. 121/2000 Sb.";
