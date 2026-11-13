import { readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import { proxy } from "@/proxy";

import { IP_NOTICE } from "./legal";
import { ETIM_DEVICE_DEPTHS } from "./panel-builder/abb-etim.generated";
import { BRAND_DEVICE_DEPTHS, ETIM_FRAME_LIMITS, KOPOS_BOX_DATA, KOPOS_DATA_SOURCE } from "./panel-builder/brand-etim.generated";
import { buildCatalogPublic, renderCatalogPublic } from "./panel-builder/catalog-public";
import { DEVICE_DEPTHS, KOPOS_BOXES } from "./panel-builder/catalog-public.generated";
import { emptyDraft, type EditorElement } from "./panel-builder/floorplan-editor";
import { TERMS_SECTIONS, TERMS_VERSION } from "./registered-company";
import { compileFloorplanBom } from "./panel-builder/wiring-bom";
import { RATE_LIMITS, SCRAPER_ROBOTS, clientIpOf, createRateLimiter, isScraperAgent, isSeoPath, rateBucketOf } from "./request-guard";

import { catalogEan } from "@/server/catalog-data";

// Fáze 104: ochrana know-how a katalogových dat – zdrojové mapy a hlavička X-Powered-By vypnuté, celé importy ETIM jen
// na serveru, limit požadavků podle IP, blokace kopírovacích robotů a právní doložka (zák. č. 121/2000 Sb.).

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), "utf8");
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

describe("fáze 104 – vrstva 1: build bez zdrojových map a bez X-Powered-By", () => {
  it("next.config vypíná zdrojové mapy v prohlížeči i hlavičku X-Powered-By, minifikace zůstává zapnutá", () => {
    const config = read("next.config.ts");
    expect(config).toMatch(/productionBrowserSourceMaps:\s*false/);
    expect(config).toMatch(/poweredByHeader:\s*false/);
    expect(config).not.toMatch(/minify:\s*false/);
  });
});

describe("fáze 104 – vrstva 2: katalogová data výrobců jen na serveru", () => {
  it("celé importy ETIM a index fotek jsou server-only (i jejich generátory)", () => {
    for (const file of ["abb-etim.generated.ts", "brand-etim.generated.ts", "catalog-images.generated.ts"]) expect(read("src", "lib", "panel-builder", file), file).toMatch(/^import "server-only";$/m);
    // Generátory (`npm run catalog:etim`, `catalog:parse`, `catalog:images`) zapisují stejnou hlavičku
    for (const file of ["scripts/import-abb-etim9.mjs", "scripts/parse-etim-packages.mjs", "src/lib/panel-builder/catalog-images.ts"]) expect(read(file), file).toContain(`'import "server-only";',`);
  });

  it("veřejná část (hloubky přístrojů, limity rámečků, krabice KOPOS) odpovídá importům a nemá EAN ani ceny", () => {
    const data = buildCatalogPublic({ abbDepths: ETIM_DEVICE_DEPTHS, brandDepths: BRAND_DEVICE_DEPTHS, frameLimits: ETIM_FRAME_LIMITS, kopos: KOPOS_BOX_DATA, koposSource: KOPOS_DATA_SOURCE });
    expect(read("src", "lib", "panel-builder", "catalog-public.generated.ts").replace(/\r\n/g, "\n")).toBe(renderCatalogPublic(data));
    const text = renderCatalogPublic(data);
    expect(text).not.toMatch(/\b\d{13}\b/);
    expect(text).not.toMatch(/"(ean|gtin|priceCzk)"/);
    expect(Object.keys(DEVICE_DEPTHS).length).toBeGreaterThan(10);
    // ABB ETIM 9.0 má přednost před ostatními výrobci
    for (const [key, depth] of Object.entries(ETIM_DEVICE_DEPTHS)) expect(DEVICE_DEPTHS[key], key).toMatchObject({ mpn: depth.mpn, depthMm: depth.depthMm, source: "ABB ETIM 9.0" });
    for (const [code, box] of Object.entries(KOPOS_BOXES)) {
      expect(box, code).not.toHaveProperty("ean");
      expect(box, code).not.toHaveProperty("priceCzk");
    }
  });

  it("klientské moduly nesahají na celé importy ETIM ani na index fotek", () => {
    const clientFiles = ["src/components/panel-builder/EnclosurePhoto.tsx", "src/components/panel-builder/floorplan/BoxPhoto.tsx", "src/components/panel-builder/SmartHomeDeviceCatalog.tsx", "src/components/panel-builder/floorplan/SeriesGallery.tsx", "src/components/panel-builder/floorplan/WiringBomDialog.tsx", "src/lib/panel-builder/wiring-bom.ts", "src/lib/panel-builder/mounting-boxes-catalog.ts", "src/lib/panel-builder/residential-series-catalog.ts", "src/lib/panel-builder/series-photos.ts"];
    for (const file of clientFiles) {
      const source = read(file);
      expect(source, file).not.toMatch(/from "[^"]*(abb-etim|brand-etim|catalog-images)\.generated"/);
    }
  });

  it("kusovník v prohlížeči EAN nemá, serverové výstupy ho doplní resolverem", () => {
    const el = (id: string, item: string): EditorElement => ({ id, item, x: 1000, y: 1000, room: "Obývací pokoj", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null });
    const draft = { ...emptyDraft(), series: "ABB|Tango", color: "abb-tango-b", elements: [el("z", "socket"), el("s", "switch-1")] };
    const client = compileFloorplanBom(draft, { installation: "classic" });
    const server = compileFloorplanBom(draft, { installation: "classic", ean: catalogEan });
    expect(client.some((row) => row.ean)).toBe(false);
    expect(server.some((row) => row.ean && /^\d{13}$/.test(row.ean))).toBe(true);
  });
});

describe("fáze 104 – vrstva 3: limit požadavků podle IP a blokace kopírovacích robotů", () => {
  it("rozdělení cest do limitů: API katalogu / Panel Builderu / QR štítků / ARES 60, exporty 15", () => {
    const bucket = (pathname: string, method = "GET", action = false) => rateBucketOf({ pathname, method, action });
    for (const pathname of ["/api/catalog-images/lookup", "/api/catalog-images/manifest", "/api/panel-builder/export", "/api/qr-labels", "/api/qr-labels/EL-000001", "/api/ares", "/panel-builder/catalog"]) expect(bucket(pathname), pathname).toBe("api");
    for (const pathname of ["/api/data-export", "/superadmin/leads-export", "/superadmin/newsletter-export", "/superadmin/qr-stitky/abc/zpl", "/api/pool/package/xyz"]) expect(bucket(pathname), pathname).toBe("export");
    expect(bucket("/api/catalog-images/file/abb/tango/a.webp")).toBe("media");
    expect(bucket("/panel-builder/floorplan", "POST", true)).toBe("actions");
    expect(bucket("/panel-builder/floorplan", "GET")).toBeNull();
    expect(bucket("/")).toBeNull();
    expect(bucket("/api/health")).toBeNull();
    expect(RATE_LIMITS.api.limit).toBe(60);
    expect(RATE_LIMITS.export.limit).toBe(15);
  });

  it("61. požadavek API za minutu z jedné IP = 429 s Retry-After, jiná IP a nové okno projdou; 16. export = 429", () => {
    const limiter = createRateLimiter();
    const now = 1_000_000;
    for (let index = 0; index < 60; index += 1) expect(limiter.hit("api", "1.2.3.4", now + index)).toBeNull();
    expect(limiter.hit("api", "1.2.3.4", now + 100)).toBe(60);
    expect(limiter.hit("api", "5.6.7.8", now + 100)).toBeNull();
    expect(limiter.hit("api", "1.2.3.4", now + 60_000)).toBeNull();
    for (let index = 0; index < 15; index += 1) expect(limiter.hit("export", "1.2.3.4", now)).toBeNull();
    expect(limiter.hit("export", "1.2.3.4", now + 30_000)).toBe(30);
  });

  it("kopírovací roboti a skriptovací klienti ano, prohlížeče a vyhledávače ne; SEO stránky zůstávají otevřené", () => {
    for (const agent of ["Mozilla/4.5 (compatible; HTTrack 3.0x; Windows 98)", "WebCopier v4.6", "Teleport Pro/1.29", "SiteSnagger", "Offline Explorer/8.0", "python-requests/2.32.3", "Wget/1.21.4", "Scrapy/2.11 (+https://scrapy.org)"]) expect(isScraperAgent(agent), agent).toBe(true);
    for (const agent of [CHROME, "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Mozilla/5.0 (compatible; SeznamBot/4.0; +https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/)", "Mozilla/5.0 (compatible; release-check/1.0)", null]) expect(isScraperAgent(agent), String(agent)).toBe(false);
    const seo = new Set(["/", "/panel-builder"]);
    expect(isSeoPath("/", seo)).toBe(true);
    expect(isSeoPath("/robots.txt", seo)).toBe(true);
    expect(isSeoPath("/panel-builder/floorplan", seo)).toBe(false);
  });

  it("IP klienta z X-Forwarded-For (Caddy), jinak X-Real-IP; bez hlaviček se neomezuje", () => {
    expect(clientIpOf(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.2" }))).toBe("203.0.113.7");
    expect(clientIpOf(new Headers({ "x-real-ip": "198.51.100.1" }))).toBe("198.51.100.1");
    expect(clientIpOf(new Headers())).toBeNull();
  });

  it("brána: HTTrack na aplikační cestě 403, na SEO stránce projde; 61. dotaz na katalog z jedné IP = 429", async () => {
    const httrack = { headers: { "user-agent": "Mozilla/4.5 (compatible; HTTrack 3.0x; Windows 98)" } };
    const blocked = await proxy(new NextRequest("https://eldock.cz/panel-builder/floorplan", httrack));
    expect(blocked.status).toBe(403);
    expect(await blocked.text()).toContain("121/2000 Sb.");
    expect((await proxy(new NextRequest("https://eldock.cz/", httrack))).status).toBe(200);
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 20}`;
    const request = () => new NextRequest("https://eldock.cz/panel-builder/catalog", { headers: { "user-agent": CHROME, "x-forwarded-for": ip } });
    for (let index = 0; index < 60; index += 1) expect((await proxy(request())).status, String(index)).toBe(200);
    const limited = await proxy(request());
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("robots.txt zakazuje kopírovací roboty", () => {
    const rules = [robots().rules].flat();
    for (const agent of SCRAPER_ROBOTS) expect(rules.find((rule) => rule.userAgent === agent), agent).toMatchObject({ disallow: "/" });
    expect(SCRAPER_ROBOTS).toEqual(expect.arrayContaining(["HTTrack", "WebCopier", "Teleport", "SiteSnagger", "Offline Explorer", "python-requests"]));
  });
});

describe("fáze 104 – vrstva 4: právní doložka", () => {
  it("přesné znění doložky v patičce, dokumentaci a VOP 1.1", () => {
    expect(IP_NOTICE).toBe("© 2026 ELDOCK.cz – Všechna práva vyhrazena. Databáze prvků, výpočtové algoritmy a struktura dokumentace jsou chráněny autorským právem a zvláštním právem pořizovatele databáze dle zák. č. 121/2000 Sb. Automatizované vytěžování (scraping) a reverzní inženýrství je zakázáno.");
    expect(TERMS_VERSION).toMatch(/^1.[1-9]-2026-11$/);
    const section = TERMS_SECTIONS.find((entry) => entry.title.includes("Ochrana databáze"));
    expect(section?.text).toContain("121/2000 Sb.");
    expect(TERMS_SECTIONS.indexOf(section!)).toBe(TERMS_SECTIONS.findIndex((entry) => entry.title.startsWith("6.")) + 1);
    for (const file of ["src/components/landing/SiteChrome.tsx", "src/components/panel-builder/documentation/DocumentationSheets.tsx", "src/components/panel-builder/floorplan/FloorplanExport.tsx", "src/app/(print)/inspections/report/[id]/page.tsx", "src/app/(pb)/panel-builder/credits/[orderId]/invoice/page.tsx"]) expect(read(file), file).toContain("IP_NOTICE");
  });
});
