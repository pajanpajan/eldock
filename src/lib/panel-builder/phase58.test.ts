import { describe, expect, it } from "vitest";

import { PUBLIC_PAGES } from "@/lib/seo";
import { SEGMENTS, breadcrumbJsonLd, footerSections, siteNav } from "@/lib/site-map";

import { datasheetLinks, isLocalPdf, isSafeDatasheetUrl, primaryDatasheetLink } from "./datasheets";
import { renderSingleLineDiagramSvg, type DrawingItem } from "./drawings";
import { SYMBOLS, SYMBOL_KINDS, drawSymbol, symbolKindOf, symbolLegend, symbolPreviewSvg } from "./iec-symbols";

describe("fáze 58 – značky přístrojů dle ČSN EN 60617", () => {
  it("druh značky podle kategorie a podtypu; neznámý prvek nikdy jako jistič", () => {
    expect(symbolKindOf({ category: "MCB" })).toBe("MCB");
    expect(symbolKindOf({ category: "RCBO" })).toBe("RCBO");
    expect(symbolKindOf({ category: null })).toBe("GENERIC");
    expect(symbolKindOf(null)).toBe("GENERIC");
    expect(symbolKindOf({ category: "MAIN_SWITCH", description: "Hlavní vypínač 3P 40 A" })).toBe("SWITCH_DISCONNECTOR");
    expect(symbolKindOf({ category: "MAIN_SWITCH", description: "Odpojovač 3P" })).toBe("DISCONNECTOR");
    expect(symbolKindOf({ category: "MAIN_SWITCH", description: "Pojistkový odpojovač OPV10" })).toBe("FUSE_DISCONNECTOR");
    expect(symbolKindOf({ category: "OTHER", moduleSubtype: "FUSE_DISCONNECTOR" })).toBe("FUSE_DISCONNECTOR");
    expect(symbolKindOf({ category: "RELAY", relaySubtype: "IMPULSE" })).toBe("RELAY_IMPULSE");
    expect(symbolKindOf({ category: "RELAY", relaySubtype: "STAIRCASE" })).toBe("RELAY_STAIRCASE");
    expect(symbolKindOf({ category: "RELAY", relaySubtype: "TIMER" })).toBe("RELAY_TIMER");
    expect(symbolKindOf({ category: "RELAY", relaySubtype: null })).toBe("RELAY");
    expect(symbolKindOf({ category: "PSU", moduleSubtype: "BELL_TRANSFORMER" })).toBe("TRANSFORMER");
    expect(symbolKindOf({ category: "OTHER", moduleSubtype: "METER" })).toBe("METER");
  });

  it("kresba nese značky funkce na pevném kontaktu a spouště (jistič ×, odpínač čárka + kroužek, stykač půlkroužek, chránič IΔ + toroid)", () => {
    const mcb = drawSymbol("MCB", 100, 0);
    expect(mcb).toContain('x1="96" y1="8" x2="104" y2="16"'); // křížek funkce jističe
    expect(mcb).toContain("a3 3 0 0 1 0 6"); // elektromagnetická spoušť
    const rcd = drawSymbol("RCD", 100, 0);
    expect(rcd).toContain("<ellipse");
    expect(rcd).toContain("IΔ");
    expect(rcd).not.toContain('x1="96" y1="8"'); // chránič bez funkce jističe
    expect(drawSymbol("RCBO", 100, 0)).toContain('x1="96" y1="8" x2="104" y2="16"');
    expect(drawSymbol("SWITCH_DISCONNECTOR", 100, 0)).toMatch(/<circle cx="100" cy="11.4" r="2.3"/);
    expect(drawSymbol("CONTACTOR", 100, 0)).toContain("A4 4 0 0 0 100 16");
    expect(drawSymbol("RELAY_STAIRCASE", 100, 0)).toContain('width="5" height="11" fill="#111"'); // zpožděný odpad = vyplněné pole
    expect(drawSymbol("SPD", 100, 0)).toContain(">U</text>");
    expect(drawSymbol("METER", 100, 0)).toContain(">Wh</text>");
  });

  it("každá značka má popis a normu, náhled je samostatné SVG a legenda obsahuje jen použité značky", () => {
    for (const kind of SYMBOL_KINDS) {
      expect(SYMBOLS[kind].norm).toMatch(/^ČSN EN 60617/);
      expect(symbolPreviewSvg(kind)).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    }
    expect(symbolLegend(["RCD", "MCB", "MCB"]).map((row) => row.kind)).toEqual(["MCB", "RCD"]);
  });

  it("jednopólové schéma kreslí značku z katalogu a s cívkou / spouští rozšíří rozteč", () => {
    const item = (id: string, designation: string, patch: Partial<DrawingItem>): DrawingItem => ({ id, designation, typeCode: "T", category: "MCB", poles: "1P", dinRailIndex: 1, positionOnRail: 1, modulesWidth: 1, parentItemId: null, fedFromIncomer: true, phaseAssignment: "L1", circuitLabel: "Okruh", ...patch });
    const plain = renderSingleLineDiagramSvg([item("a", "-F1", {}), item("b", "-F2", { positionOnRail: 2 })], { incomer: "Přívod", network: "TN-S" });
    const relay = renderSingleLineDiagramSvg([item("a", "-F1", {}), item("b", "-K1", { positionOnRail: 2, category: "RELAY", symbol: "RELAY_IMPULSE" })], { incomer: "Přívod", network: "TN-S" });
    const width = (svg: string) => Number(/viewBox="0 0 (\d+)/.exec(svg)?.[1]);
    expect(width(relay)).toBeGreaterThan(width(plain));
    expect(relay).toContain("L"); // značka relé se vykreslila
  });
});

describe("fáze 58 – datasheet ke každému přístroji", () => {
  it("uložený datasheet je ověřený a první, bez něj stránka výrobce podle obj. čísla a vyhledání", () => {
    const stored = datasheetLinks({ manufacturer: "Siemens", articleNumber: "5SY6116-7", datasheetUrl: "https://www.siemens.com/product?5SY6116-7" });
    expect(stored[0]).toMatchObject({ kind: "datasheet", verified: true });
    const abb = datasheetLinks({ manufacturer: "ABB", articleNumber: "ABB:2CDS251001R0164" });
    expect(abb.map((link) => link.kind)).toEqual(["product", "search"]);
    expect(abb[0].url).toBe("https://new.abb.com/products/2CDS251001R0164");
    expect(abb.every((link) => !link.verified)).toBe(true);
    expect(primaryDatasheetLink({ manufacturer: "Neznámý", articleNumber: "X-1" }).kind).toBe("search");
  });

  it("odkazy jen http(s) nebo vlastní soubory; PDF v Eldocku se zobrazí v náhledu", () => {
    expect(isSafeDatasheetUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeDatasheetUrl("/api/files/documents/a.pdf")).toBe(true);
    expect(isLocalPdf("/api/files/documents/a.pdf")).toBe(true);
    expect(isLocalPdf("https://example.com/a.pdf")).toBe(false);
    expect(datasheetLinks({ manufacturer: "ABB", articleNumber: "X", datasheetUrl: "javascript:alert(1)" })[0].kind).toBe("product");
  });
});

describe("fáze 58 – mapa webu", () => {
  it("úvodní stránka rozcestí na domovní elektroinstalace a průmysl, obě jsou v navigaci, patičce i sitemap.xml", () => {
    expect(siteNav({ showcase: false }).map((link) => link.href)).toEqual(["/domovni-elektroinstalace", "/prumysl", "/#novinky", "/#kontakt"]);
    expect(siteNav({ showcase: true }).map((link) => link.href)).toContain("/ukazka-elaboratu");
    const footer = footerSections({ showcase: true }).flatMap((section) => section.links.map((link) => link.href));
    expect(footer).toEqual(expect.arrayContaining([SEGMENTS.domov.path, SEGMENTS.prumysl.path, "/prumysl#udrzba", "/register-plant", "/ochrana-osobnich-udaju"]));
    expect(PUBLIC_PAGES.map((page) => page.path)).toEqual(expect.arrayContaining(["/domovni-elektroinstalace", "/prumysl"]));
    expect(breadcrumbJsonLd([{ href: "/", label: "Úvod" }, { href: "/prumysl", label: "Průmysl" }]).itemListElement[1]).toMatchObject({ position: 2, item: "https://eldock.cz/prumysl" });
  });
});
