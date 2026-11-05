import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PRIVACY_SECTIONS } from "./legal";
import { TERMS_SECTIONS } from "./registered-company";
import { PLANT_ROUTE_PREFIXES, isPlantRoute } from "./routes";
import { PUBLIC_PAGES } from "./seo";

// Fáze 54: opravy veřejného webu – 404 místo přesměrování, právní texty a stránky.

const routeDirs = (group: string) =>
  readdirSync(path.resolve("src/app", group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

describe("fáze 54 – trasy Správy závodů a 404", () => {
  it("každá trasa skupin (app) a (print) je chráněná přihlášením (jinak by byla veřejná)", () => {
    const routes = [...routeDirs("(app)").filter((name) => name !== "login"), ...routeDirs("(print)")];
    expect(routes.length).toBeGreaterThan(5);
    for (const route of routes) expect(isPlantRoute(`/${route}`), `/${route} chybí v PLANT_ROUTE_PREFIXES`).toBe(true);
    expect(PLANT_ROUTE_PREFIXES).toContain("/demo-docs");
  });

  it("neznámé a veřejné adresy nejsou trasy aplikace (Next.js vrátí soubor nebo 404, ne přihlášení)", () => {
    for (const pathname of ["/llms.txt", "/.well-known/security.txt", "/neexistujici-stranka", "/planter", "/ochrana-osobnich-udaju", "/eldock-promo.mp4"]) {
      expect(isPlantRoute(pathname), pathname).toBe(false);
    }
    for (const pathname of ["/app", "/plant/plant-jbc", "/equipment/abc/label", "/inspections/report/1", "/demo-docs/domovni-rozvadec-rh1.pdf"]) {
      expect(isPlantRoute(pathname), pathname).toBe(true);
    }
  });
});

describe("fáze 54 – právní texty", () => {
  it("odpovědnost výrobce rozváděče odkazuje na NV 118/2016 Sb. (LVD) a 117/2016 Sb. (EMC), ne na ATEX 116/2016 Sb.", () => {
    const text = TERMS_SECTIONS.map((section) => section.text).join(" ");
    expect(text).toContain("118/2016 Sb.");
    expect(text).toContain("117/2016 Sb.");
    expect(text).not.toContain("116/2016");
  });

  it("zásady zpracování osobních údajů jmenují zpracovatele, které aplikace používá, a práva subjektu", () => {
    const text = PRIVACY_SECTIONS.flatMap((section) => [...section.paragraphs, ...(section.list ?? [])]).join(" ");
    expect(text).toContain("Hetzner");
    expect(text).toContain("Gemini");
    expect(text).toContain("www.uoou.gov.cz");
    expect(text).toContain("nezbytné cookies");
  });

  it("právní stránky jsou v sitemap.xml", () => {
    const paths = PUBLIC_PAGES.map((page) => page.path);
    expect(paths).toEqual(expect.arrayContaining(["/obchodni-podminky", "/ochrana-osobnich-udaju"]));
  });
});
