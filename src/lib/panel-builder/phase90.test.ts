import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DeviceMockup } from "@/components/panel-builder/floorplan/SeriesGallery";
import { FixtureShape } from "@/components/panel-builder/floorplan/FixtureShape";

import { ABB_SERIES_2026 } from "./abb-catalog-2026";
import { ARCH_LAYER, archDrawing, clipToPolygon, snapOpening } from "./architecture";
import { floorplanDxf } from "./dxf-export";
import { FIXTURES, clampFixture, fixtureGeometry, isArchitecture, resizeFixture } from "./fixtures";
import { PALETTE, PALETTE_GROUPS, emptyDraft, parseDraft, type EditorElement, type EditorRoom, type FloorplanDraft } from "./floorplan-editor";
import { BATH_ZONE_TOP_MM, floorplanNorms } from "./floorplan-norms";
import { initialStep, resumeStep, wizardStatus, type WizardProgress } from "./floorplan-wizard";
import { addRoomBySize, nextRoomPreset, ROOM_SEQUENCE } from "./room-builder";
import { decentoCircles } from "./series-look";
import { compileFloorplanBom } from "./wiring-bom";
import { appearanceLabel, hasFrameChoice, isMonoblockSeries, seriesColors } from "./wiring-designs";

const el = (id: string, item: string, x: number, y: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Koupelna", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
const room = (name: string, x: number, y: number, w: number, h: number): EditorRoom => ({ id: `r-${name}`, name, x, y, w, h });

/** Koupelna 3 × 2,5 m s vanou 1700 × 750 u horní stěny (hrana vany x 150–1850, y 0–750). */
const bathroom = (elements: EditorElement[]): FloorplanDraft => ({ ...emptyDraft(), rooms: [room("Koupelna", 0, 0, 3000, 2500)], elements: [el("rh", "panel", 2900, 2400), el("vana", "bath", 1000, 375), ...elements] });

describe("fáze 90 – koupelnové zóny (ČSN 33 2000-7-701 ed. 2) a umyvadlový prostor (ČSN 33 2130 ed. 4)", () => {
  it("vývod motoru žaluzie ZAL_M ve 2450 mm a okenní kontakt MAG nad vanou nevyhodí chybu zóny 0–2", () => {
    const issues = floorplanNorms(bathroom([el("zal", "blind-motor", 1000, 0), el("mag", "window-contact", 1200, 0), el("vod", "water-sensor", 1900, 400), el("hlv", "heating-head", 2000, 700)]));
    expect(issues.some((issue) => issue.rule === "bath-zone")).toBe(false);
    // Spínač výš než 2,25 m (nad zónami 1 a 2) se nehlásí, ve výšce 2,25 m ještě ano
    expect(floorplanNorms(bathroom([el("s", "switch-1", 2100, 400, { mountHeightMm: 2300 })])).some((issue) => issue.rule === "bath-zone")).toBe(false);
    expect(floorplanNorms(bathroom([el("s", "switch-1", 2100, 400, { mountHeightMm: BATH_ZONE_TOP_MM })])).find((issue) => issue.rule === "bath-zone")?.elementIds).toEqual(["s"]);
  });

  it("hláška zóny jmenuje přístroj, jeho výšku a vzdálenost od vany", () => {
    const one = floorplanNorms(bathroom([el("z", "socket", 2280, 400)])).find((issue) => issue.rule === "bath-zone")!;
    expect(one.text).toBe("1. NP: Jednozásuvka (výška 300 mm) zasahuje do zóny 2 koupelny (43 cm od vany, min. 60 cm) – v zóně 0–2 nesmí být zásuvky ani spínače 230 V, přesuňte ji dál.");
    expect(one.source).toContain("čl. 701.32");
    // Nad vanou = zóna 1; dva přístroje = výčet
    expect(floorplanNorms(bathroom([el("z", "socket", 1000, 300)])).find((issue) => issue.rule === "bath-zone")!.text).toContain("zasahuje do zóny 1 koupelny (nad vanou, min. 60 cm)");
    const two = floorplanNorms(bathroom([el("z", "socket", 2280, 400), el("s", "switch-1", 1000, 1000)])).find((issue) => issue.rule === "bath-zone")!;
    expect(two.text).toContain("2× zásuvka / spínač v zóně 0–2 koupelny");
    expect(two.text).toContain("Jednozásuvka (výška 300 mm, 43 cm od vany)");
    expect(two.text).toMatch(/Vypínač č\. 1 \(jednopólový\) \(výška \d+ mm, 25 cm od vany\)/);
  });

  it("umyvadlo UMY a dvojumyvadlo DUM: umyvadlový prostor se kreslí (pás + 0,2 m, doporučených 0,4 m, popisek) a hlídá", () => {
    const basin = el("u", "basin", 1000, 225);
    const svg = renderToStaticMarkup(createElement("svg", null, createElement(FixtureShape, { element: basin, active: false, onPaper: true, unit: 300, interactive: false, clip: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 2500 }, { x: 0, y: 2500 }] })));
    expect(svg).toContain('data-testid="fixture-band"');
    expect(svg).toContain('data-testid="fixture-band-recommended"');
    expect(svg).toContain('data-testid="fixture-wash-area"');
    expect(svg).toContain("UMYVADLOVÝ PROSTOR");
    // Zóny ořízne obrys místnosti (nepřesahují za stěnu na fasádu)
    expect(svg).toContain("<clipPath");
    expect(svg).toContain('data-clipped="true"');
    expect(renderToStaticMarkup(createElement("svg", null, createElement(FixtureShape, { element: el("d", "double-basin", 1000, 225), active: false, onPaper: true, unit: 300, interactive: false })))).toContain("UMYVADLOVÝ PROSTOR");

    const draft: FloorplanDraft = { ...emptyDraft(), rooms: [room("Koupelna", 0, 0, 3000, 2500)], elements: [el("rh", "panel", 2900, 2400), basin, el("nad", "socket", 1100, 0), el("vedle", "switch-1", 1400, 0, { mountHeightMm: 1000 }), el("vedle44", "switch-ip44", 1410, 0, { mountHeightMm: 1000 })] };
    const issues = floorplanNorms(draft);
    const area = issues.find((issue) => issue.rule === "basin-area")!;
    expect(area.elementIds).toEqual(["nad"]);
    expect(area.text).toContain("Jednozásuvka (výška 300 mm) leží v umyvadlovém prostoru");
    expect(area.source).toContain("ČSN 33 2130 ed. 4");
    // Těsně u hrany pod 1,2 m jen přístroj bez krytí IP44
    expect(issues.find((issue) => issue.rule === "basin-band")?.elementIds).toEqual(["vedle"]);
  });

  it("koupelna jen s WC dál chce vanu, sprchu nebo umyvadlo (WC zóny nemá)", () => {
    const draft: FloorplanDraft = { ...emptyDraft(), elements: [el("wc", "arch-wc", 500, 500), el("z", "ip44-socket", 900, 0)] };
    expect(floorplanNorms(draft).some((issue) => issue.rule === "fixture-missing")).toBe(true);
  });
});

describe("fáze 90 – průvodce: krok 1 bez automatického přeskoku, krokové karty, další místnost", () => {
  it("vytvoření místnosti v kroku 1 nepřepne průvodce na krok 2 (ani po přemontování editoru)", () => {
    let draft = emptyDraft();
    let step = resumeStep(null, draft);
    expect(step).toBe(1);
    for (const [index, name] of ["Obývací pokoj", "Kuchyň", "Ložnice"].entries()) {
      draft = addRoomBySize(draft, { name, w: 4000, h: 3000, id: `m${index}` }).draft;
      // Nový půdorys po prvním uložení dostane id a editor se přemontuje – krok se vezme z relace prohlížeče
      step = resumeStep(step, draft);
      expect(step).toBe(1);
    }
    expect(draft.rooms).toHaveLength(3);
    // Bez uloženého kroku (jiná karta prohlížeče) zůstává výchozí krok podle obsahu
    expect(resumeStep(null, draft)).toBe(initialStep(draft));
    expect(resumeStep("4", draft)).toBe(2);
  });

  it("krokové karty: živý podtitul a fajfka u hotových kroků", () => {
    const base: WizardProgress = { rooms: 3, scale: "ok", design: "ABB Levit · bílá", elements: 0, panel: false, circuits: 0, cableM: 0, project: false };
    const first = wizardStatus(base, 1);
    expect(first[0]).toEqual({ id: 1, subtitle: "3 místnosti · měřítko OK", done: true });
    expect(first[1]).toEqual({ id: 2, subtitle: "ABB Levit · bílá", done: false });
    expect(wizardStatus({ ...base, rooms: 1, scale: "missing" }, 1)[0]).toEqual({ id: 1, subtitle: "1 místnost · měřítko nezkalibrováno", done: false });
    expect(wizardStatus({ ...base, rooms: 5 }, 1)[0].subtitle).toBe("5 místností · měřítko OK");
    const later = wizardStatus({ ...base, elements: 12, panel: true, circuits: 6, cableM: 84.4 }, 5);
    expect(later.map((step) => step.done)).toEqual([true, true, true, true, false]);
    expect(later[2].subtitle).toBe("12 prvků · RH osazen");
    expect(later[3].subtitle).toBe("6 okruhů · 84 m kabelu");
    expect(wizardStatus({ ...base, project: true }, 5)[4]).toEqual({ id: 5, subtitle: "rozváděč vygenerován", done: true });
  });

  it("po vytvoření místnosti se předvyplní další typ (obývací pokoj → kuchyň → ložnice → koupelna …)", () => {
    expect(nextRoomPreset([]).name).toBe("Obývací pokoj");
    expect(nextRoomPreset(["Obývací pokoj"], "Obývací pokoj").name).toBe("Kuchyň");
    expect(nextRoomPreset(["Obývací pokoj", "Kuchyň"], "Kuchyň").name).toBe("Ložnice");
    expect(nextRoomPreset(["Obývací pokoj", "Kuchyň", "Ložnice"], "Ložnice").name).toBe("Koupelna");
    expect(nextRoomPreset(["Obývací pokoj", "Kuchyň", "Ložnice", "Koupelna"], "Koupelna").name).toBe("Chodba / Zádveří");
    // Obývák + KK zastoupí obývací pokoj i kuchyň; po přemontování (bez poslední) první chybějící
    expect(nextRoomPreset(["Obývák + KK"], "Obývák + KK").name).toBe("Ložnice");
    expect(nextRoomPreset(["Ložnice", "Obývací pokoj"]).name).toBe("Kuchyň");
    // Všechny typy už jsou: další ložnice za ložnicí (dostane číslo)
    expect(nextRoomPreset([...ROOM_SEQUENCE], "Kuchyň").name).toBe("Ložnice");
    expect(nextRoomPreset(["Kuchyň"], "Kuchyň").w).toBe(4000);
  });
});

describe("fáze 90 – okna, dveře a nábytek", () => {
  it("paleta 🛋️ Okna, dveře a nábytek s 18 prvky (fáze 93: vyšetřovací lehátko LEH_Z), WC i v zařizovacích předmětech, bez okruhů a kusovníku", () => {
    expect(PALETTE_GROUPS.find((group) => group.id === "architecture")).toMatchObject({ icon: "🛋️", label: "Okna, dveře a nábytek" });
    const items = PALETTE.filter((item) => item.group === "architecture");
    expect(items.map((item) => item.symbol)).toEqual(["OKN_1", "OKN_2", "OKN_HS", "DVE_1", "DVE_2", "DVE_POS", "POST_2", "POST_1", "GAUC_L", "GAUC_R", "STUL_J", "STUL_PC", "LINKA", "OSTR", "SKRIN", "TV_ST", "WC_M", "LEH_Z"]);
    expect(items.every((item) => item.kind === "fixture" && isArchitecture(item.id) && FIXTURES[item.id].code === item.symbol)).toBe(true);
    expect(PALETTE.find((item) => item.id === "arch-wc")?.alsoIn).toEqual(["fixtures"]);
    expect(FIXTURES["arch-bed-double"]).toMatchObject({ w: 1800, d: 2000 });
    expect(FIXTURES["arch-window-1"]).toMatchObject({ w: 1000, d: 250, arch: "opening", wall: "center" });
    expect(FIXTURES["arch-door-1"]).toMatchObject({ w: 800, d: 800, wall: "inside", flip: "swing" });
    const draft: FloorplanDraft = { ...emptyDraft(), elements: items.map((item, index) => el(`a${index}`, item.id, 1000 + index * 100, 1000, { room: "Obývací pokoj" })) };
    expect(compileFloorplanBom(draft)).toEqual([]);
  });

  it("rozměr X × Y žlutým rohem i pod 0,3 m (okno 0,25 m hluboké), zrcadlení se uloží", () => {
    const window = el("o", "arch-window-1", 0, 0);
    expect(clampFixture(150, FIXTURES["arch-window-1"])).toBe(150);
    expect(clampFixture(150, FIXTURES.bath)).toBe(300);
    expect(resizeFixture(window, "s", { x: 0, y: 75 })?.sizeMm).toEqual({ w: 1000, d: 200 });
    const parsed = parseDraft({ ...emptyDraft(), elements: [el("d", "arch-door-1", 0, 0, { flip: true }), el("o", "arch-window-1", 0, 0, { sizeMm: { w: 1200, d: 200 } }), el("b", "arch-bed-double", 0, 0, { flip: true })] })!;
    expect(parsed.elements[0].flip).toBe(true);
    expect(parsed.elements[1].sizeMm).toEqual({ w: 1200, d: 200 });
    // Postel zrcadlení nemá – příznak se neuloží
    expect(parsed.elements[2].flip).toBeUndefined();
  });

  it("dveře: křídlo kolmo ke stěně a čtvrtkruhová výseč; pravé otevírání zrcadlí závěs", () => {
    const left = archDrawing("door_1", 800, 800);
    const swing = left.find((primitive) => primitive.dashed)!;
    expect(swing.points[0]).toEqual({ x: 400, y: -400 });
    expect(swing.points.at(-1)).toEqual({ x: -400, y: 400 });
    const right = archDrawing("door_1", 800, 800, true).find((primitive) => primitive.dashed)!;
    expect(right.points.at(-1)).toEqual({ x: 400, y: 400 });
    expect(fixtureGeometry(el("d", "arch-door-1", 0, 0, { flip: true }))!.flip).toBe(true);
    // Postel: obrys, čelo, matrace, 2 polštáře, přikrývka; jídelní stůl se 6 židlemi okolo
    expect(archDrawing("bed_double", 1800, 2000)).toHaveLength(7);
    expect(archDrawing("table_dining", 1800, 900).filter((primitive) => primitive.fill && primitive.closed)).toHaveLength(7);
  });

  it("okno a dveře se přichytí ke stěně místnosti – okno středem, dveře zárubní a křídlem do místnosti", () => {
    const rooms = [room("Obývací pokoj", 0, 0, 5000, 4000)];
    expect(snapOpening(rooms, { x: 1200, y: 150 }, FIXTURES["arch-window-1"], 250)).toEqual({ x: 1200, y: 0, rotation: 0 });
    expect(snapOpening(rooms, { x: 1200, y: 150 }, FIXTURES["arch-door-1"], 800)).toEqual({ x: 1200, y: 400, rotation: 0 });
    expect(snapOpening(rooms, { x: 120, y: 2000 }, FIXTURES["arch-door-1"], 800)).toEqual({ x: 400, y: 2000, rotation: 270 });
    expect(snapOpening(rooms, { x: 4900, y: 2000 }, FIXTURES["arch-window-2"], 250)).toEqual({ x: 5000, y: 2000, rotation: 90 });
    expect(snapOpening(rooms, { x: 2500, y: 3950 }, FIXTURES["arch-door-1"], 800)).toEqual({ x: 2500, y: 3600, rotation: 180 });
    expect(snapOpening(rooms, { x: 2500, y: 2000 }, FIXTURES["arch-window-1"], 250)).toBeNull();
  });

  it("DXF: vrstva ARCHITEKTURA_NABYTEK s kresbou a kódem, zóna 2 vany ořezaná stěnami koupelny", () => {
    const bed: FloorplanDraft = { ...emptyDraft(), rooms: [room("Ložnice", 0, 0, 4000, 4000)], elements: [el("b", "arch-bed-double", 2000, 1000, { room: "Ložnice" })] };
    const dxf = floorplanDxf(bed, null);
    expect(dxf).toContain(ARCH_LAYER);
    expect(dxf).toContain(String.raw`POST_2 1800 \U+00D7 2000`);
    // Čáry zóny 2 (čárkovaně) leží jen uvnitř koupelny 3 × 2,5 m – vana u horní stěny by jinak přesahovala na fasádu
    const rows = floorplanDxf(bathroom([]), null).split(/\r?\n/);
    const lines: { layer: string; dashed: boolean; y: number[] }[] = [];
    for (let index = 0; index < rows.length - 1; index += 2) {
      if (rows[index].trim() !== "0" || rows[index + 1] !== "LINE") continue;
      const entity = { layer: "", dashed: false, y: [] as number[] };
      for (let next = index + 2; next < rows.length - 1 && rows[next].trim() !== "0"; next += 2) {
        const code = rows[next].trim();
        if (code === "8") entity.layer = rows[next + 1];
        if (code === "6") entity.dashed = true;
        if (code === "20" || code === "21") entity.y.push(-Number(rows[next + 1]));
      }
      lines.push(entity);
    }
    const zone = lines.filter((line) => line.layer === "ZARIZOVACI_PREDMETY" && line.dashed);
    expect(zone.length).toBeGreaterThan(5);
    expect(zone.every((line) => line.y.every((y) => y >= -0.5 && y <= 2500.5))).toBe(true);
  });

  it("ořez lomené čáry mnohoúhelníkem", () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(clipToPolygon([{ x: -5, y: 5 }, { x: 15, y: 5 }], square)).toEqual([[{ x: 0, y: 5 }, { x: 10, y: 5 }]]);
    expect(clipToPolygon([{ x: -5, y: -5 }, { x: -1, y: -1 }], square)).toEqual([]);
    expect(clipToPolygon([{ x: 2, y: 2 }, { x: 4, y: 4 }], null)).toHaveLength(1);
  });
});

describe("fáze 90 – ABB Garant, Variant+, Praktik a Decento podle katalogu 2026", () => {
  const series = (name: string) => ABB_SERIES_2026.find((row) => row.name === name)!;

  it("nástěnné monobloky: skutečné barvy a strany katalogu, bez volby rámečku", () => {
    expect(series("Garant (IP44)")).toMatchObject({ page: 498, monoblock: true, ip: "IP44" });
    expect(series("Garant (IP44)").colors.map((color) => color.label)).toEqual(["Bílá", "Šedá / antracitová"]);
    expect(series("Praktik (IP44)")).toMatchObject({ page: 502, monoblock: true });
    expect(series("Praktik (IP44)").colors.map((color) => color.label)).toEqual(["Bílá", "Šedá"]);
    expect(series("Variant+ (IP54)")).toMatchObject({ page: 506, monoblock: true, ip: "IP54" });
    expect(series("Variant+ (IP54)").colors.map((color) => color.label)).toEqual(["Šedá / tmavě šedá (2-barevná IP54)", "Bílá / šedá (IP54)"]);
    // Uložené nákresy si šedou ponechají (stálé id barvy)
    expect(seriesColors("ABB|Garant (IP44)").map((color) => color.id)).toEqual(["abb-garant-bila", "abb-garant-seda"]);
    for (const key of ["ABB|Garant (IP44)", "ABB|Praktik (IP44)", "ABB|Variant+ (IP54)", "ABB|Decento"]) expect(hasFrameChoice(key)).toBe(false);
    expect(hasFrameChoice("ABB|Levit")).toBe(true);
    expect(isMonoblockSeries("ABB|Garant (IP44)")).toBe(true);
    expect(isMonoblockSeries("ABB|Decento")).toBe(false);
  });

  it("Decento: pevné dvojice porcelánu a rámečku podle katalogu (fáze 91 – bez černého dubu); rámeček se do popisu nepromítne", () => {
    expect(series("Decento").fixedPairs).toBe(true);
    expect(series("Decento").colors.map((color) => color.label)).toEqual(["Bílá (porcelán)", "Bílá / přírodní buk (50)", "Bílá / třešeň (52)", "Černá (porcelán) (N)"]);
    expect(appearanceLabel("ABB|Decento", "abb-decento-bila-porcelan", "abb-decento-52")).toBe("ABB Decento · Bílá (porcelán)");
  });

  it("náhledy: monoblok s horní vývodkou a víčkem s krytím, Decento jako samostatné kulaté přístroje s porcelánovým středem", () => {
    const garant = renderToStaticMarkup(createElement(DeviceMockup, { seriesKey: "ABB|Garant (IP44)", shape: "surface", color: series("Garant (IP44)").colors[0], items: ["socket", "socket"] }));
    expect(garant).toContain('data-testid="mockup-gland"');
    expect(garant.match(/data-testid="mockup-lid"/g)).toHaveLength(2);
    expect(garant).toContain("IP44");
    expect(renderToStaticMarkup(createElement(DeviceMockup, { seriesKey: "ABB|Variant+ (IP54)", shape: "surface", color: series("Variant+ (IP54)").colors[0], items: ["switch"] }))).toContain('data-monoblock="industrial"');
    const decento = renderToStaticMarkup(createElement(DeviceMockup, { seriesKey: "ABB|Decento", shape: "porcelain", color: series("Decento").colors[1], items: ["switch", "socket", "socket"] }));
    expect(decento).toContain('data-outline="decento"');
    // Fáze 91: jeden středový upevňovací šroubek v dutině každé zásuvky (žádné tečky po obvodu rámečku)
    expect(decento.match(/data-testid="mockup-screw"/g)).toHaveLength(2);
    expect(decento.match(/data-testid="mockup-pin"/g)).toHaveLength(2);
    expect(decento).toContain('data-testid="mockup-lever"');
    expect(decento).toContain('data-testid="mockup-glaze"');
    // Fáze 91: Decento nejde do víceramečku (Katalog ABB 2026, str. 548) – samostatné kruhy Ø 87 mm po 91 mm (mezera 4 mm)
    const circles = decentoCircles(3);
    expect(circles.map((entry) => entry.cx)).toEqual([50, 150, 250]);
    expect(circles[0].r).toBeCloseTo(47.8, 1);
    expect(circles[1].cx - circles[0].cx - circles[0].r * 2).toBeGreaterThan(4);
  });

  it("kusovník monobloku: kompletní nástěnný přístroj bez rámečku a bez krabice pod omítku", () => {
    const draft: FloorplanDraft = { ...emptyDraft(), series: "ABB|Garant (IP44)", color: "abb-garant-bila", elements: [el("z", "socket", 0, 0, { room: "Garáž" }), el("s", "switch-1", 500, 0, { room: "Garáž" })] };
    const bom = compileFloorplanBom(draft);
    expect(bom.some((row) => row.category === "Rámečky")).toBe(false);
    expect(bom.some((row) => row.category === "Instalační krabice")).toBe(false);
    expect(bom.find((row) => row.category === "Zásuvky")?.name).toBe("Zásuvka 1N nástěnná IP44 s odklápěcím víčkem – kompletní přístroj");
    expect(bom.find((row) => row.category === "Přístroje spínačů")?.name).toBe("Spínač řazení 1 nástěnný IP44 – kompletní přístroj (bez rámečku)");
    expect(bom.some((row) => row.category === "Kryty spínačů")).toBe(false);
  });
});
