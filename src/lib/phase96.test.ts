import { readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { proxy } from "@/proxy";

import { parseSitemap, payloadFor, readKey } from "../../scripts/seo-indexnow-ping.mjs";
import { INDEXNOW_ENDPOINTS, INDEXNOW_KEY, INDEXNOW_KEY_LOCATION, indexNowPayload, pingIndexNow, publicUrls } from "./indexnow";
import { PUBLIC_PAGES, SEARCH_BOTS, faqJsonLd, siteJsonLd } from "./seo";
import { SEO_LANDINGS } from "./seo-landings";
import { footerSections } from "./site-map";

// Fáze 96: viditelnost ve vyhledávačích – veřejné stránky bez přihlášení, 5 SEO vstupních stránek, robots.txt,
// sitemap.xml s prioritami, JSON-LD a IndexNow (Seznam.cz, Bing).

const LANDINGS = ["/ai-panel-builder", "/2d-pudorys-elektroinstalace", "/vypocet-otepleni-rozvadece", "/kusova-zkouska-rozvadece", "/prumyslova-udrzba-a-revize"];

describe("fáze 96 – SEO vstupní stránky a mapa webu", () => {
  it("5 vstupních stránek s H1, sekcemi H2 / H3, srovnávací tabulkou, FAQ a odkazem z patičky", () => {
    expect(SEO_LANDINGS.map((landing) => landing.path)).toEqual(LANDINGS);
    for (const landing of SEO_LANDINGS) {
      expect(landing.h1.length, landing.id).toBeGreaterThan(30);
      expect(landing.seoDescription.length, landing.id).toBeLessThanOrEqual(320);
      expect(landing.sections.length).toBeGreaterThanOrEqual(2);
      expect(landing.sections.every((section) => section.items.length >= 2)).toBe(true);
      expect(landing.table.rows.every((row) => row.length === landing.table.head.length)).toBe(true);
      expect(landing.faq.length).toBeGreaterThanOrEqual(4);
      expect(landing.related.every((id) => SEO_LANDINGS.some((other) => other.id === id && other.id !== landing.id))).toBe(true);
    }
    const footer = footerSections({ showcase: true }).find((section) => section.title === "Nástroje a návody")!;
    expect(footer.links.map((link) => link.href)).toEqual([...LANDINGS, "/panel-builder/catalog", "/navody"]);
  });

  it("sitemap.xml: priorita 1,0 úvod, 0,95 veřejný AI Panel Builder, katalog, ukázka, návody a 5 vstupních stránek", () => {
    const entries = new Map(sitemap().map((entry) => [entry.url, entry.priority]));
    expect(entries.get("https://eldock.cz")).toBe(1);
    for (const pathname of ["/panel-builder", ...LANDINGS, "/ukazka-elaboratu", "/panel-builder/catalog", "/navody"]) expect(entries.get(`https://eldock.cz${pathname}`), pathname).toBe(0.95);
  });

  it("robots.txt: Allow / pro všechny klíčové roboty vč. AI vyhledávačů, Disallow jen /api/ a /superadmin, sitemap a host", () => {
    const result = robots();
    const rules = result.rules as { userAgent: string; allow: string; disallow: string[] }[];
    expect(rules.map((rule) => rule.userAgent)).toEqual(["*", "Googlebot", "SeznamBot", "bingbot", "OAI-SearchBot", "GPTBot", "PerplexityBot", "ClaudeBot"]);
    expect(rules.every((rule) => rule.allow === "/" && rule.disallow.join() === "/api/,/superadmin")).toBe(true);
    expect(result).toMatchObject({ sitemap: "https://eldock.cz/sitemap.xml", host: "https://eldock.cz" });
    expect(SEARCH_BOTS).toHaveLength(8);
  });

  it("JSON-LD: SoftwareApplication ELDOCK (BusinessApplication / CADSoftware, Web, cs-CZ, zdarma), WebSite a FAQPage", () => {
    const graph = siteJsonLd()["@graph"] as Record<string, unknown>[];
    expect(graph.find((node) => node["@type"] === "SoftwareApplication")).toMatchObject({ name: "ELDOCK", applicationCategory: "BusinessApplication", applicationSubCategory: "CADSoftware", operatingSystem: "Web", inLanguage: "cs-CZ", offers: { price: "0", priceCurrency: "CZK" } });
    expect(graph.find((node) => node["@type"] === "WebSite")).toMatchObject({ url: "https://eldock.cz", inLanguage: "cs-CZ" });
    const faq = faqJsonLd(SEO_LANDINGS[0].faq, "https://eldock.cz/ai-panel-builder");
    expect(faq).toMatchObject({ "@type": "FAQPage", mainEntity: expect.arrayContaining([expect.objectContaining({ "@type": "Question", acceptedAnswer: expect.objectContaining({ "@type": "Answer" }) })]) });
  });
});

describe("fáze 96 – brána bez přihlášení (robot vyhledávače)", () => {
  it("veřejné stránky, katalog, robots.txt, sitemap.xml a klíč IndexNow projdou bez přesměrování; editor půdorysu dál vyžaduje firmu", async () => {
    const googlebot = { headers: { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" } };
    for (const pathname of ["/", "/panel-builder", "/panel-builder/catalog", ...LANDINGS, "/navody", "/ukazka-elaboratu", "/robots.txt", "/sitemap.xml", `/${INDEXNOW_KEY}.txt`, "/api/seo/ping"]) {
      const response = await proxy(new NextRequest(`https://eldock.cz${pathname}`, googlebot));
      expect(response.status, pathname).toBe(200);
      expect(response.headers.get("location"), pathname).toBeNull();
    }
    const editor = await proxy(new NextRequest("https://eldock.cz/panel-builder/floorplan", googlebot));
    expect(editor.status).toBe(307);
    expect(editor.headers.get("location")).toContain("/panel-builder/auth");
    expect(PUBLIC_PAGES.map((page) => page.path)).toEqual(expect.arrayContaining(["/panel-builder", "/panel-builder/catalog", ...LANDINGS]));
  });
});

describe("fáze 96 – IndexNow (Seznam.cz, Bing)", () => {
  it("klíč 32 znaků hex ve veřejném souboru public/<klíč>.txt se stejným obsahem; skript ho najde", () => {
    expect(INDEXNOW_KEY).toMatch(/^[0-9a-f]{32}$/);
    expect(readFileSync(path.join(process.cwd(), "public", `${INDEXNOW_KEY}.txt`), "utf8").trim()).toBe(INDEXNOW_KEY);
    expect(readKey()).toBe(INDEXNOW_KEY);
    expect(INDEXNOW_KEY_LOCATION).toBe(`https://eldock.cz/${INDEXNOW_KEY}.txt`);
  });

  it("payload: host, key, keyLocation a jen adresy vlastního webu; skript čte <loc> ze sitemapy", () => {
    expect(indexNowPayload(["https://eldock.cz", "https://eldock.cz/navody", "https://jiny.example/x", "https://eldock.cz"])).toEqual({ host: "eldock.cz", key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_LOCATION, urlList: ["https://eldock.cz", "https://eldock.cz/navody"] });
    const xml = "<urlset><url><loc>https://eldock.cz</loc></url><url><loc> https://eldock.cz/ai-panel-builder </loc></url><url><loc>https://eldock.cz/panel-builder/catalog?brand=ABB&amp;group=mcb</loc></url></urlset>";
    expect(parseSitemap(xml)).toEqual(["https://eldock.cz", "https://eldock.cz/ai-panel-builder", "https://eldock.cz/panel-builder/catalog?brand=ABB&group=mcb"]);
    expect(payloadFor("https://eldock.cz", INDEXNOW_KEY, parseSitemap(xml))).toMatchObject({ host: "eldock.cz", keyLocation: `https://eldock.cz/${INDEXNOW_KEY}.txt`, urlList: expect.arrayContaining(["https://eldock.cz/ai-panel-builder"]) });
  });

  it("ping: POST se seznamem adres a GET s úvodní stránkou na search.seznam.cz/indexnow i api.indexnow.org", async () => {
    const calls: { url: string; method: string; body: unknown }[] = [];
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response("", { status: init?.method === "POST" ? 202 : 200 });
    }) as typeof fetch;
    const results = await pingIndexNow(publicUrls(), fetcher);
    expect(results.map((result) => [result.endpoint, result.method, result.status, result.ok])).toEqual([
      [INDEXNOW_ENDPOINTS[0], "POST", 202, true],
      [INDEXNOW_ENDPOINTS[0], "GET", 200, true],
      [INDEXNOW_ENDPOINTS[1], "POST", 202, true],
      [INDEXNOW_ENDPOINTS[1], "GET", 200, true],
    ]);
    expect(calls[0]).toMatchObject({ url: "https://search.seznam.cz/indexnow", method: "POST", body: { host: "eldock.cz", key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_LOCATION } });
    expect((calls[0].body as { urlList: string[] }).urlList).toEqual(expect.arrayContaining(LANDINGS.map((pathname) => `https://eldock.cz${pathname}`)));
    expect(calls[1].url).toBe(`https://search.seznam.cz/indexnow?url=${encodeURIComponent("https://eldock.cz")}&key=${INDEXNOW_KEY}`);
  });
});
