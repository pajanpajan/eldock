import { describe, expect, it } from "vitest";

import { BUS_LEG_CABLE } from "@/engine/cable-routing";
import { circuitDesignations, groupUnderRcds } from "@/engine/floorplan-bridge";
import { wallSegments } from "@/engine/wall-routing";

import { CUSTOM_APPLIANCE_ITEM, applianceOverride, builtinAppliance, parseApplianceSpec } from "./appliances";
import { circuitTag, coresOf, readableAngle, tickMarks } from "./cad-notation";
import { DXF_LAYERS, dxfText, floorplanDxf, pathToPolylines } from "./dxf-export";
import { distanceToFixture, fixtureGeometry, inBasinBand, resizeFixture } from "./fixtures";
import { analyzeDraft, buildPlan, emptyDraft, frameAxis, paletteFor, paletteItem, parseDraft, roomAt, snapToWall, wallRotation, type EditorElement, type EditorRoom, type FloorplanDraft } from "./floorplan-editor";
import { floorplanNorms } from "./floorplan-norms";
import { pointInRoom, roomWalls, snapAngle } from "./room-geometry";
import { displayRoutes } from "./route-display";
import { dragSegment, insertJog, insetWallRoute, reanchor, segmentAxis } from "./route-edit";
import { ABB_FREEATHOME_URL, ABB_ZONI_URL, familyLink, seriesLink } from "./series-links";
import { PRODUCT_FAMILIES, productById } from "./smart-catalog";

const el = (id: string, item: string, x: number, y: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Kuchyně", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
const room = (name: string, x: number, y: number, w: number, h: number, points?: { x: number; y: number }[]): EditorRoom => ({ id: `m-${name}`, name, x, y, w, h, ...(points ? { points } : {}) });
const near = (actual: number, expected: number, tolerance = 1) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
/** Všechny úseky lomené čáry jsou vodorovné nebo svislé (úhly 90°). */
const orthogonal = (points: { x: number; y: number }[]) => points.slice(1).every((point, index) => segmentAxis(points[index], point) !== "slanted");

describe("fáze 63 – ruční posun úseků trasy v osách X / Y a kolmo k šikmé stěně", () => {
  const route = [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 2000, y: 1000 },
  ];

  it("vodorovný úsek se posouvá jen v ose Y, sousední svislý se natáhne a k pevnému konci vede kolmá spojka", () => {
    const moved = dragSegment(route, 2, { x: 300, y: -400 }, { snap: 50 });
    expect(moved).toEqual([
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 600 },
      { x: 2000, y: 600 },
      { x: 2000, y: 1000 },
    ]);
    expect(orthogonal(moved)).toBe(true);
  });

  it("svislý úsek se posouvá jen v ose X (posun v ose Y se ignoruje), oba vodorovní sousedé se natáhnou", () => {
    const moved = dragSegment(route, 1, { x: 260, y: 999 }, { snap: 50 });
    expect(moved).toEqual([
      { x: 0, y: 0 },
      { x: 1250, y: 0 },
      { x: 1250, y: 1000 },
      { x: 2000, y: 1000 },
    ]);
    expect(orthogonal(moved)).toBe(true);
  });

  it("šikmý úsek (u šikmé stěny 45°) se posune kolmo ke svému směru a zůstane se stěnou rovnoběžný", () => {
    const slanted = [
      { x: 0, y: 0 },
      { x: 1000, y: 1000 },
      { x: 2000, y: 1000 },
    ];
    const moved = dragSegment(slanted, 0, { x: 0, y: 100 });
    // Začátek trasy (rozváděč / prvek) zůstává, posunutý úsek je rovnoběžný s původním
    expect(moved[0]).toEqual({ x: 0, y: 0 });
    const [a, b] = [moved[1], moved[2]];
    near(b.x - a.x, 1000);
    near(b.y - a.y, 1000);
    // Vzdálenost od původní přímky y = x = průmět tažení do normály (100 / √2)
    near(Math.abs(a.x - a.y) / Math.SQRT2, 100 / Math.SQRT2);
    expect(moved[moved.length - 1]).toEqual({ x: 2000, y: 1000 });
  });

  it("nepatrné tažení trasu nezmění; dvojklik vloží ortogonální odskok (dva lomy po 90°)", () => {
    expect(dragSegment(route, 2, { x: 0, y: 10 }, { snap: 50 })).toEqual(route);
    const jog = insertJog(
      [
        { x: 0, y: 0 },
        { x: 3000, y: 0 },
      ],
      0,
      { x: 1500, y: 20 },
    );
    expect(jog).toEqual([
      { x: 0, y: 0 },
      { x: 1200, y: 0 },
      { x: 1200, y: 300 },
      { x: 1800, y: 300 },
      { x: 1800, y: 0 },
      { x: 3000, y: 0 },
    ]);
    expect(orthogonal(jog)).toBe(true);
  });

  it("upravená trasa se po posunu prvku přichytí k novým koncovým bodům a zůstane pravoúhlá", () => {
    const edited = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
    ];
    expect(reanchor(edited, { x: 0, y: 200 }, { x: 1300, y: 1000 })).toEqual([
      { x: 0, y: 200 },
      { x: 1300, y: 200 },
      { x: 1300, y: 1000 },
    ]);
  });
});

describe("fáze 63 – trasy podél stěn v odsazení 200 mm a polygonální místnosti se šikmými stěnami", () => {
  const walls = roomWalls(room("Obývák", 0, 0, 4000, 3000)).map((wall) => ({ ...wall, room: "Obývák" }));

  it("úsek na stěně se odsadí 200 mm do místnosti, k prvkům vede kolmá odbočka, roh je průsečík", () => {
    expect(
      insetWallRoute(
        [
          { x: 1000, y: 0 },
          { x: 3000, y: 0 },
        ],
        walls,
      ),
    ).toEqual([
      { x: 1000, y: 0 },
      { x: 1000, y: 200 },
      { x: 3000, y: 200 },
      { x: 3000, y: 0 },
    ]);
    expect(
      insetWallRoute(
        [
          { x: 1000, y: 0 },
          { x: 4000, y: 0 },
          { x: 4000, y: 1500 },
        ],
        walls,
      ),
    ).toEqual([
      { x: 1000, y: 0 },
      { x: 1000, y: 200 },
      { x: 3800, y: 200 },
      { x: 3800, y: 1500 },
      { x: 4000, y: 1500 },
    ]);
  });

  // Místnost s šikmou stěnou 45° (x + y = 6000) v pravém dolním rohu
  const polygon = room("Pokoj", 0, 0, 4000, 4000, [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 2000 },
    { x: 2000, y: 4000 },
    { x: 0, y: 4000 },
  ]);

  it("bod v mnohoúhelníku, nejbližší šikmá stěna: přicvaknutí kolmým průmětem a natočení značky 135°", () => {
    expect(pointInRoom(polygon, 2900, 2900)).toBe(true);
    expect(pointInRoom(polygon, 3500, 3500)).toBe(false);
    expect(roomAt([polygon], 3500, 3500)).toBeNull();
    expect(wallRotation(polygon, 2900, 2900)).toBe(135);
    expect(snapToWall(polygon, 2900, 2900)).toEqual({ x: 3000, y: 3000 });
    // Víceramček u šikmé stěny leží v ose stěny
    near(frameAxis(135).x, -Math.SQRT1_2, 0.001);
    near(frameAxis(135).y, Math.SQRT1_2, 0.001);
    expect(frameAxis(90)).toEqual({ x: 0, y: 1 });
    expect(frameAxis(180)).toEqual({ x: 1, y: 0 });
  });

  it("kreslení rohů: přichycení úhlu na 0° / 45° / 90° se zachováním délky", () => {
    expect(snapAngle({ x: 0, y: 0 }, { x: 1000, y: 80 })).toEqual({ x: 1000, y: 0 });
    const diagonal = snapAngle({ x: 0, y: 0 }, { x: 1000, y: 900 });
    expect(diagonal.x).toBe(diagonal.y);
    expect(snapAngle({ x: 0, y: 0 }, { x: 30, y: 1200 })).toEqual({ x: 0, y: 1200 });
  });

  it("šikmé stěny vstupují do grafu stěn a trasa k zásuvce u šikmé stěny vede v její ose s kolmou odbočkou", () => {
    const segments = wallSegments([polygon]);
    expect(segments).toHaveLength(5);
    expect(segments.some((segment) => segment.x1 !== segment.x2 && segment.y1 !== segment.y2)).toBe(true);
    const draft: FloorplanDraft = { ...emptyDraft(), rooms: [polygon], elements: [el("rh", "panel", 200, 200, { room: "Pokoj" }), el("s1", "socket", 3000, 3000, { room: "Pokoj", rotation: 135 })] };
    const analysis = analyzeDraft(draft);
    const routes = displayRoutes(draft, analysis);
    const leg = routes.circuits[0].legs[0];
    // Poslední úsek k zásuvce je kolmý na šikmou stěnu (směr normály ±(1, 1))
    const [a, b] = leg.points.slice(-2);
    near(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    near(Math.hypot(b.x - a.x, b.y - a.y), 200);
    // Předposlední úsek je rovnoběžný se šikmou stěnou (směr ±(1, −1))
    const [c, d] = leg.points.slice(-3, -1);
    near(d.x - c.x, -(d.y - c.y));
  });
});

describe("fáze 63 – ruční úprava trasy mění délku kabelu, ne pořadí prvků", () => {
  const base = (): FloorplanDraft => ({ ...emptyDraft(), elements: [el("rh", "panel", 500, 500), el("s1", "socket", 3000, 500)] });

  it("upravený úsek rozváděč → zásuvka: lomená čára z úpravy a delší metráž o objížďku × rezerva", () => {
    const draft = base();
    const before = analyzeDraft(draft).summary.circuits[0];
    expect(before.route.segments[0].horizontalMm).toBe(2500);
    const detour = [
      { x: 500, y: 500 },
      { x: 500, y: 1500 },
      { x: 3000, y: 1500 },
      { x: 3000, y: 500 },
    ];
    const after = analyzeDraft({ ...draft, routeEdits: { "panel>s1": detour } }).summary.circuits[0];
    const segment = after.route.segments[0];
    expect(segment.edited).toBe(true);
    expect(segment.horizontalMm).toBe(4500);
    expect(segment.points?.map(({ x, y }) => ({ x, y }))).toEqual(detour);
    const slack = 1 + draft.profile.slackPercent / 100;
    near(after.lengthsM.OPTIMIZED - before.lengthsM.OPTIMIZED, 2 * slack, 0.15);
    // Úprava se uloží v nákresu a přežije načtení
    expect(parseDraft(JSON.parse(JSON.stringify({ ...draft, routeEdits: { "panel>s1": detour, "špatný klíč": detour } })))?.routeEdits).toEqual({ "panel>s1": detour });
  });
});

describe("fáze 63 – zařizovací předměty ve skutečném rozměru, zóny a pás u umyvadla", () => {
  it("vana natočená o 90°: obrys, vzdálenost od hrany, změna rozměru za stranu drží protilehlou stranu", () => {
    const bath = el("v", "bath", 2000, 1000, { room: "Koupelna", rotation: 90 });
    const geometry = fixtureGeometry(bath)!;
    near(geometry.corners[0].x, 2375);
    near(geometry.corners[0].y, 150);
    near(distanceToFixture(geometry, 2875, 1000), 500);
    const straight = el("v2", "bath", 2000, 1000, { room: "Koupelna" });
    expect(resizeFixture(straight, "e", { x: 3000, y: 1000 })).toEqual({ x: 2075, y: 1000, sizeMm: { w: 1850, d: 750 } });
    // Natočená o 90°: strana „e“ leží v ose +y, horní hrana (150) zůstává
    const turned = resizeFixture(bath, "e", { x: 2000, y: 2000 })!;
    expect(turned.sizeMm).toEqual({ w: 1850, d: 750 });
    near(turned.y - 1850 / 2, 150);
    expect(resizeFixture(straight, "se", { x: 2100, y: 900 })!.sizeMm).toEqual({ w: 950, d: 300 });
  });

  it("umyvadlo 600 × 450: pás nad a pod umyvadlem v šíři + 0,2 m na každou stranu ke stěně", () => {
    const basin = fixtureGeometry(el("u", "basin", 1000, 225, { room: "Koupelna" }))!;
    expect(inBasinBand(basin, 1000, 0)).toBe(true);
    expect(inBasinBand(basin, 1450, 0)).toBe(true);
    expect(inBasinBand(basin, 1600, 0)).toBe(false);
    expect(fixtureGeometry(el("d", "double-basin", 0, 0))!.w).toBe(1200);
  });

  it("normový hlídač: zásuvka nad umyvadlem a spínač v zóně 2 zvětšené vany", () => {
    const draft: FloorplanDraft = {
      ...emptyDraft(),
      rooms: [room("Koupelna", 0, 0, 3000, 2500)],
      elements: [
        el("rh", "panel", 2900, 2400, { room: "Koupelna" }),
        el("u", "basin", 1000, 225, { room: "Koupelna" }),
        el("z", "ip44-socket", 1100, 0, { room: "Koupelna" }),
        el("v", "bath", 1500, 2000, { room: "Koupelna", sizeMm: { w: 1800, d: 800 } }),
        el("s", "switch-ip44", 2700, 2000, { room: "Koupelna" }),
      ],
    };
    const issues = floorplanNorms(draft);
    // Fáze 74: zásuvka přímo nad umyvadlem = v umývacím prostoru (průmět umyvadla ke stěně)
    const area = issues.find((issue) => issue.rule === "basin-area");
    expect(area?.elementIds).toEqual(["z"]);
    expect(area?.source).toContain("ČSN 33 2130");
    // Hrana vany 1800 mm sahá do x = 2400; spínač 30 cm od hrany je v zóně 2
    const zone = issues.find((issue) => issue.rule === "bath-zone");
    expect(zone?.elementIds).toEqual(["s"]);
    expect(zone?.text).toContain("30 cm");
    // Bez zvětšení vany (1700 mm) je spínač 35 cm od hrany – pořád v zóně, po posunu o metr mimo
    expect(floorplanNorms({ ...draft, elements: draft.elements.map((element) => (element.id === "s" ? { ...element, x: 3600 } : element)) }).some((issue) => issue.rule === "bath-zone")).toBe(false);
  });
});

describe("fáze 63 – knihovna samostatných spotřebičů a okruhy podle zadání", () => {
  const kitchen = room("Kuchyně", 0, 0, 5000, 4000);
  const plan = (elements: EditorElement[], appliances: FloorplanDraft["appliances"]) => analyzeDraft({ ...emptyDraft(), rooms: [kitchen], elements: [el("rh", "panel", 100, 100), ...elements], appliances }).circuits;

  it("přejmenovaná trouba s jističem B20 a kabelem 3×4: vlastní okruh přesně podle zadání", () => {
    const spec = parseApplianceSpec({ ...builtinAppliance("oven"), label: "Pečicí a parní trouba", symbol: "pt", ratedA: 20, cable: "CYKY-J 3×4", heightMm: 800 })!;
    expect(spec.symbol).toBe("PT");
    expect(applianceOverride(builtinAppliance("oven"))).toBeUndefined();
    const circuits = plan([el("t", "oven", 2000, 0)], [spec]);
    const oven = circuits.circuits.find((circuit) => circuit.nodeIds.includes("t"))!;
    expect(oven.label).toBe("Pečicí a parní trouba – Kuchyně");
    expect(oven.protection).toMatchObject({ device: "MCB", poles: "1P", curve: "B", ratedA: 20 });
    expect(oven.cable).toBe("CYKY-J 3x4");
    expect(oven.rcd).toBe("A30");
  });

  it("vlastní 3f spotřebič s chráničem typ F a jednofázový s RCBO: skupiny chráničů a označení jističů", () => {
    const sauna = parseApplianceSpec({ id: "ap-sauna", label: "Saunová kamna 3f", symbol: "SA", powerW: 9000, poles: 3, ratedA: 16, curve: "B", rcd: "F", cable: "CYKY-J 5×2,5", heightMm: 300, simultaneity: 1 })!;
    const gate = parseApplianceSpec({ id: "ap-gate", label: "Brána", symbol: "BR", powerW: 600, poles: 1, ratedA: 10, curve: "B", rcd: "RCBO", cable: "CYKY-J 3×1,5", heightMm: null, simultaneity: 0.5 })!;
    expect(parseApplianceSpec({ ...gate, poles: 3 })?.rcd).toBe("A");
    const circuits = plan([el("k", CUSTOM_APPLIANCE_ITEM, 3000, 0, { appliance: "ap-sauna" }), el("b", CUSTOM_APPLIANCE_ITEM, 4000, 0, { appliance: "ap-gate" })], [sauna, gate]).circuits;
    const saunaCircuit = circuits.find((circuit) => circuit.nodeIds.includes("k"))!;
    expect(saunaCircuit).toMatchObject({ phases: 3, rcd: "F30", kind: "cooktop" });
    expect(groupUnderRcds(circuits).find((group) => group.type === "F")?.circuitIds).toEqual([saunaCircuit.id]);
    const gateCircuit = circuits.find((circuit) => circuit.nodeIds.includes("b"))!;
    expect(gateCircuit.protection.device).toBe("RCBO");
    expect(circuitDesignations(circuits)[gateCircuit.id]).toBe("-FA1");
    expect(circuitDesignations(circuits)[saunaCircuit.id]).toMatch(/^-F\d+$/);
  });
});

describe("fáze 63 – export DXF", () => {
  const draft = (): FloorplanDraft => ({
    ...emptyDraft(),
    rooms: [room("Kuchyně", 0, 0, 5000, 3000)],
    elements: [el("rh", "panel", 300, 2700), el("s1", "socket", 2000, 0), el("l1", "ceiling-light", 2500, 1500), el("sw", "switch-1", 4900, 1500, { controls: ["l1"], rotation: 90 }), el("v", "bath", 1500, 2400)],
    annotations: [{ id: "w1", kind: "wall", x: 2500, y: 0, x2: 2500, y2: 1200, color: "#dc2626", hatch: "diagonal", thicknessMm: 100, text: "", fontMm: 250, bold: false, background: false }],
  });

  it("R12 / AC1009 se všemi hladinami, čisté ASCII (diakritika \\U+XXXX), mm 1 : 1 s osou Y nahoru", () => {
    const current = draft();
    const text = floorplanDxf(current, analyzeDraft(current), { date: new Date(2026, 10, 7) });
    expect(text).toContain("AC1009");
    for (const layer of DXF_LAYERS) expect(text).toContain(`\r\n${layer.name}\r\n`);
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(text)).toBe(true);
    // Spodní stěna místnosti (y = 3000) je v DXF y = −3000
    expect(text).toContain("\r\n 21\r\n-3000\r\n");
    expect(text).toContain("Kuchyn\\U+011B");
    expect(text).toMatch(/Okr\. -F\d+ \\U\+00B7 CYKY-J 3\\U\+00D7/);
    expect(text.split("\r\n  0\r\nLINE\r\n").length - 1).toBeGreaterThan(40);
    expect(text).toContain("\r\n  0\r\nCIRCLE\r\n");
    expect(text.trimEnd().endsWith("EOF")).toBe(true);
  });

  it("cesty SVG značek: přímky i oblouky na lomené čáry, text s diakritikou", () => {
    expect(pathToPolylines("M0 0 H10 V10 Z")).toEqual([
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 0 },
      ],
    ]);
    const arc = pathToPolylines("M-10 0 A10 10 0 0 1 10 0")[0];
    const middle = arc[Math.floor(arc.length / 2)];
    near(middle.x, 0, 0.6);
    near(middle.y, -10, 0.6);
    expect(dxfText("Kuchyně · 3×2,5")).toBe("Kuchyn\\U+011B \\U+00B7 3\\U+00D72,5");
  });
});

describe("fáze 63 – normové značení, katalog chytré domácnosti a odkazy na výrobce", () => {
  it("rysky počtu žil, čitelný úhel a štítek okruhu", () => {
    expect(coresOf("CYKY-J 5×2,5")).toBe(5);
    expect(coresOf("CYKY-J 3x1,5")).toBe(3);
    expect(coresOf(BUS_LEG_CABLE)).toBe(4);
    expect(tickMarks({ x: 0, y: 0 }, { x: 1000, y: 0 }, 3, 100)).toHaveLength(3);
    expect(readableAngle({ x: 0, y: 0 }, { x: -10, y: 0 })).toBe(0);
    expect(readableAngle({ x: 0, y: 0 }, { x: 0, y: -10 })).toBe(90);
    expect(circuitTag("-F4", "CYKY-J 3×2,5", 14.2)).toBe("Okr. -F4 · CYKY-J 3×2,5 · 14,2 m");
  });

  it("výrobky rodin se vkládají jako sběrnicové prvky palety; bezdrátové nejdou na sběrnicovou linku", () => {
    const bus = new Set(paletteFor("bus_loxone").map((item) => item.id));
    for (const product of PRODUCT_FAMILIES.flatMap((family) => family.groups.flatMap((group) => group.products))) if (product.item) expect(bus.has(product.item), product.id).toBe(true);
    expect(productById("fah-wl-act-1")?.noBus).toBe(true);
    expect(PRODUCT_FAMILIES.map((family) => family.manufacturer)).toEqual(["ABB", "ABB", "ABB", "Loxone", "TapHome"]);
    const draft: FloorplanDraft = { ...emptyDraft(), installation: "bus_loxone", elements: [el("rh", "panel", 0, 0), el("b1", "bus-1", 1000, 0, { product: "fah-sensor-1" }), el("b2", "bus-1", 2000, 0, { product: "fah-wl-act-1" })] };
    expect(buildPlan(draft).busNodeIds).toEqual(["b1"]);
    expect(parseDraft(JSON.parse(JSON.stringify({ ...draft, elements: [...draft.elements, el("b3", "bus-2", 0, 0, { product: "neexistuje" })] })))?.elements.find((element) => element.id === "b3")?.product).toBeUndefined();
  });

  it("odkazy na weby výrobců: katalog ABB 2026 na straně řady, prospekt Zoni, ABB-free@home, Hager lumina", () => {
    expect(seriesLink("ABB|Levit")?.url).toMatch(/Katalog-ABB_Domovni-elektroinstalacni-material\.pdf#page=100$/);
    expect(seriesLink("ABB|Zoni")?.url).toBe(ABB_ZONI_URL);
    expect(seriesLink("Hager|lumina")?.url).toContain("hager.com/cz");
    expect(familyLink("abb-fah")?.url).toBe(ABB_FREEATHOME_URL);
    expect(seriesLink(null)).toBeNull();
  });

  it("nákres si pamatuje polygon, rozměr předmětu, vlastní spotřebič, natočení 45° a zobrazení CAD", () => {
    const stored = {
      ...emptyDraft(),
      cableView: "cad",
      rooms: [room("Pokoj", 0, 0, 1, 1, [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 0, y: 3000 }])],
      elements: [el("v", "bath", 1000, 1000, { rotation: 45, sizeMm: { w: 1600, d: 99999 } }), el("a", CUSTOM_APPLIANCE_ITEM, 0, 0, { appliance: "ap-1" })],
    };
    const parsed = parseDraft(JSON.parse(JSON.stringify(stored)))!;
    expect(parsed.cableView).toBe("cad");
    expect(parsed.rooms[0]).toMatchObject({ x: 0, y: 0, w: 4000, h: 3000 });
    expect(parsed.rooms[0].points).toHaveLength(3);
    expect(parsed.elements[0]).toMatchObject({ rotation: 45, sizeMm: { w: 1600, d: 4000 } });
    expect(parsed.elements[1].appliance).toBe("ap-1");
    expect(paletteItem(CUSTOM_APPLIANCE_ITEM)?.hidden).toBe(true);
    expect(paletteFor("classic").some((item) => item.id === CUSTOM_APPLIANCE_ITEM)).toBe(false);
  });
});
