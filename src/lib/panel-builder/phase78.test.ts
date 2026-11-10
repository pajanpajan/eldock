import { describe, expect, it } from "vitest";

import { catalogImageEntry, catalogSlug, productImage, renderCatalogImages, seriesForFolder } from "./catalog-images";
import { backgroundUrls, buildEldockFile, eldockFileName, parseEldockFile, replaceBackgroundUrls } from "./eldock-file";
import { emptyDraft, parseDraft, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { MAX_TEMPLATES, addTemplate, emptyLibrary, favoritesFirst, newestLibrary, parseFloorplanLibrary, removeTemplate, templatesFor, toggleFavorite } from "./floorplan-library";
import { seriesPhoto } from "./series-photos";

const el = (id: string, item: string, x: number, y: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Obývák", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });

describe("fáze 78 – šablony sestav a oblíbené", () => {
  it("šablona sestavy: název, pořadí pozic, kontrola 5R, stejná se nezdvojí, smazání odebere i hvězdičku", () => {
    const first = addTemplate(emptyLibrary(), ["double-socket", "data-socket"], "Sestava TV stěna 3R", 1000);
    if ("error" in first) throw new Error(first.error);
    expect(first.template).toMatchObject({ label: "Sestava TV stěna 3R", members: ["double-socket", "data-socket"] });
    expect(first.library.updatedAt).toBe(1000);
    const again = addTemplate(first.library, ["double-socket", "data-socket"], "Sestava TV stěna 3R", 2000);
    expect("library" in again && again.library.templates).toHaveLength(1);
    // 3× dvojzásuvka = 6 pozic > 5R
    expect(addTemplate(emptyLibrary(), ["double-socket", "double-socket", "double-socket"], "Moc")).toHaveProperty("error");
    expect(addTemplate(emptyLibrary(), ["socket"], "Jedna")).toHaveProperty("error");
    const starred = toggleFavorite(first.library, `template:${first.template.id}`, 3000);
    expect(starred.favorites).toEqual([`template:${first.template.id}`]);
    expect(removeTemplate(starred, first.template.id, 4000)).toMatchObject({ templates: [], favorites: [] });
  });

  it("knihovna z prohlížeče i z firmy: neznámé přístroje a neplatné sestavy zahodí, vyhrává novější, limit šablon", () => {
    const parsed = parseFloorplanLibrary(JSON.stringify({ templates: [{ id: "a", label: " U postele 3R ", members: ["socket", "switch-1", "socket"], createdAt: 5 }, { id: "b", label: "Špatná", members: ["neexistuje", "socket"] }, { id: "a", label: "Duplicitní id", members: ["socket", "socket"] }], favorites: ["item:socket", "nesmysl", "item:socket"], updatedAt: 7 }))!;
    expect(parsed.templates.map((template) => template.label)).toEqual(["U postele 3R"]);
    expect(parsed.favorites).toEqual(["item:socket"]);
    expect(parseFloorplanLibrary("{")).toBeNull();
    expect(newestLibrary(parsed, { ...emptyLibrary(), updatedAt: 9 }).updatedAt).toBe(9);
    expect(newestLibrary(null, null)).toEqual(emptyLibrary());
    let library = emptyLibrary();
    for (let index = 0; index < MAX_TEMPLATES; index++) {
      const result = addTemplate(library, ["socket", "socket"], `Šablona ${index}`, index + 1);
      if ("error" in result) throw new Error(result.error);
      library = result.library;
    }
    expect(addTemplate(library, ["socket", "socket"], "Další")).toHaveProperty("error");
    // Šablony jen s přístroji dostupnými na úrovni instalace
    expect(templatesFor([{ members: ["socket", "bus-2"] }, { members: ["socket", "switch-1"] }], new Set(["socket", "switch-1"]))).toEqual([{ members: ["socket", "switch-1"] }]);
  });

  it("oblíbené nahoru v pořadí katalogu, po odebrání hvězdičky zpět na původní místo (originalSortIndex)", () => {
    const entries = ["a", "b", "c", "d", "e"];
    const key = (id: string) => `item:${id}`;
    expect(favoritesFirst(entries, key, ["item:d", "item:b"])).toEqual(["b", "d", "a", "c", "e"]);
    expect(favoritesFirst(entries, key, ["item:b"])).toEqual(["b", "a", "c", "d", "e"]);
    expect(favoritesFirst(entries, key, [])).toEqual(entries);
    const library = toggleFavorite(toggleFavorite(emptyLibrary(), "item:d", 1), "item:d", 2);
    expect(library.favorites).toEqual([]);
    expect(toggleFavorite(emptyLibrary(), "bez prefixu", 1).favorites).toEqual([]);
  });
});

describe("fáze 78 – soubor projektu .eldock.json", () => {
  const draft = (): FloorplanDraft => {
    const base = parseDraft({
      ...emptyDraft(),
      background: { url: "/api/files/photos/a.jpg", widthPx: 3200, heightPx: 2000, rotation: 90, crop: { x: 10, y: 20, w: 1500, h: 900 }, pagePt: null },
      calibration: { state: "verified", referenceMm: 5000, check: { measuredMm: 3010, expectedMm: 3000, deviationPct: 0.33 }, drawingScale: 100, scaleDeviationPct: 0.5, at: 1 },
      rooms: [{ id: "m1", name: "Obývák", x: 0, y: 0, w: 5000, h: 4000 }],
      elements: [el("rh", "panel", 300, 2000), el("l1", "ceiling-light", 2500, 2000, { light: { dimmable: true, powerW: 30, load: "dali", control: "dali", cct: true, color: "rgbw" } }), el("z1", "socket", 2000, 0, { series: "ABB|Levit", color: "abb-levit-w" })],
      routeEdits: { "panel>l1": [{ x: 300, y: 1000 }, { x: 2500, y: 1000 }] },
    })!;
    // Druhé podlaží s vlastním podkladem (list podlaží, ne celý nákres)
    const upper = { id: "f2", name: "2. NP", levelMm: 3000, background: { ...base.background!, url: "/api/files/photos/b.jpg" }, calibration: base.calibration, mmPerPx: base.mmPerPx, widthMm: base.widthMm, heightMm: base.heightMm, rooms: [], elements: [el("z9", "socket", 1000, 0, { room: "Pokoj" })], frames: [], annotations: [] };
    return parseDraft({ ...base, otherFloors: [upper] })!;
  };

  it("export → import vrátí stejný nákres (podlaží, podklady, kalibrace, volby svítidel, trasy, řady a barvy) i šablony", () => {
    const original = draft();
    expect(backgroundUrls(original)).toEqual(["/api/files/photos/a.jpg", "/api/files/photos/b.jpg"]);
    const file = buildEldockFile({ meta: { code: "FP-003", name: "RD Novákovi", customerName: "Novák", installationSite: "Liberec" }, draft: original, templates: [{ id: "t1", label: "TV 3R", members: ["double-socket", "data-socket"], createdAt: 1 }], assets: { "/api/files/photos/a.jpg": "data:image/jpeg;base64,AAAA", "/api/files/photos/b.jpg": "data:image/jpeg;base64,BBBB" }, now: new Date("2026-11-10T08:00:00Z") });
    const parsed = parseEldockFile(JSON.stringify(file));
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.file.draft).toEqual(parseDraft(original));
    expect(parsed.file.draft.routeEdits).toEqual({ "panel>l1": [{ x: 300, y: 1000 }, { x: 2500, y: 1000 }] });
    expect(parsed.file.draft.elements.find((element) => element.id === "l1")?.light).toMatchObject({ cct: true, color: "rgbw", control: "dali" });
    expect(parsed.file.draft.otherFloors[0].background?.url).toBe("/api/files/photos/b.jpg");
    expect(parsed.file.meta).toEqual({ code: "FP-003", name: "RD Novákovi", customerName: "Novák", installationSite: "Liberec" });
    expect(parsed.file.templates.map((template) => template.label)).toEqual(["TV 3R"]);
    expect(Object.keys(parsed.file.assets)).toHaveLength(2);
    // Podklady po nahrání do úložiště firmy dostanou nové adresy na všech podlažích
    const moved = replaceBackgroundUrls(parsed.file.draft, new Map([["/api/files/photos/a.jpg", "/api/files/photos/x.jpg"], ["/api/files/photos/b.jpg", "/api/files/photos/y.jpg"]]));
    expect(backgroundUrls(moved)).toEqual(["/api/files/photos/x.jpg", "/api/files/photos/y.jpg"]);
    expect(eldockFileName("RD: Novák / přízemí")).toBe("RD Novák přízemí.eldock.json");
  });

  it("cizí, poškozený nebo novější soubor srozumitelnou chybou; podklad, který není obrázek, se nepřevezme", () => {
    expect(parseEldockFile("nic")).toEqual({ error: "Soubor není platný projekt Eldock (.eldock.json)." });
    expect(parseEldockFile(JSON.stringify({ format: "jiny" }))).toHaveProperty("error");
    expect(parseEldockFile(JSON.stringify({ format: "eldock-floorplan", schemaVersion: 99, draft: emptyDraft() }))).toHaveProperty("error");
    const parsed = parseEldockFile(JSON.stringify({ format: "eldock-floorplan", schemaVersion: 1, draft: emptyDraft(), assets: { "/api/files/photos/a.jpg": "data:text/html;base64,PHNjcmlwdD4=" } }));
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.file.assets).toEqual({});
    expect(parsed.file.meta.name).toBe("Půdorys ze souboru");
  });
});

describe("fáze 78 – oficiální náhledy výrobců (public/catalog-images)", () => {
  const license = { source: "ABB – partnerská fotobanka", license: "souhlas výrobce" };

  it("složka výrobce a řady → klíč řady; díl a barva z názvu souboru, výrobek chytré domácnosti podle id", () => {
    expect(catalogSlug("Time Arbo")).toBe("time-arbo");
    expect(catalogSlug("Nová Unica")).toBe("nova-unica");
    expect(seriesForFolder("abb", "tango")).toBe("ABB|Tango");
    expect(seriesForFolder("abb", "neexistuje")).toBeNull();
    expect(catalogImageEntry("abb", "tango", "rada-switch.webp", license)).toEqual({ series: "ABB|Tango", part: "switch", src: "/catalog-images/abb/tango/rada-switch.webp", ...license });
    expect(catalogImageEntry("abb", "tango", "abb-tango-n-socket.png", license)).toMatchObject({ color: "abb-tango-n", part: "socket" });
    expect(catalogImageEntry("abb", "tango", "fotka.webp", license)).toBeNull();
    expect(catalogImageEntry("abb", "tango", "rada-switch.gif", license)).toBeNull();
    expect(catalogImageEntry("loxone", "smart", "lox-presence.webp", license)).toMatchObject({ series: "smart", color: "lox-presence", part: "product" });
    const images = [catalogImageEntry("loxone", "smart", "lox-presence.webp", license)!, catalogImageEntry("abb", "tango", "rada-switch.webp", license)!];
    expect(productImage("lox-presence", images)?.src).toBe("/catalog-images/loxone/smart/lox-presence.webp");
    expect(productImage("jiny", images)).toBeNull();
    // Manifest v pořadí adres (stabilní výstup skriptu)
    expect(renderCatalogImages(images).indexOf("/catalog-images/abb/")).toBeLessThan(renderCatalogImages(images).indexOf("/catalog-images/loxone/"));
  });

  it("fotka řady v galerii: přesná barva, jinak fotka řady bez barvy, jinak vektorový náhled", () => {
    const photos = [
      { series: "ABB|Tango", part: "switch" as const, src: "/a.webp", source: "x", license: "y" },
      { series: "ABB|Tango", color: "abb-tango-n", part: "switch" as const, src: "/b.webp", source: "x", license: "y" },
    ];
    expect(seriesPhoto("ABB|Tango", "abb-tango-n", "switch", photos)?.src).toBe("/b.webp");
    expect(seriesPhoto("ABB|Tango", "jina", "switch", photos)?.src).toBe("/a.webp");
    expect(seriesPhoto("ABB|Tango", "jina", "socket", photos)).toBeNull();
  });
});
