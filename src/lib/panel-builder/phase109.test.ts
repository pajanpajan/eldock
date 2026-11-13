import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SmartHomeDeviceIllustration } from "@/components/panel-builder/SmartHomeDeviceIllustration";

import { COUNTER_RAISED_TEXT, applyCounterHeights } from "./counter-heights";
import { PALETTE, allElements, emptyDraft, parseDraft, placesOnce, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { convertInstallationMode, defaultSmartOptions, switchProjectVariant, variantList, variantMetrics } from "./installation-mode-converter";
import { OPENING_HEIGHTS, buildScene } from "./pseudo3d";
import { mpnOf } from "./smart-datasheet";
import { FAH_PANELS, FAH_ROOM_PANELS, withVariant } from "./smart-panels";
import { canvasStroke, parseSymbolColor, serializeSymbolColor, symbolCategory, symbolInk, uniformColor } from "./symbol-colors";

// Fáze 109: 2D půdorys – viditelnost a barvy značek, 3D náhled, vkládání nábytku po kusech, výška u kuchyňské linky,
// barvy a objednací čísla panelů ABB a převod Klasická 230 V ⇄ Chytrá domácnost se zachováním obou variant.

const el = (id: string, item: string, patch: Partial<EditorElement> = {}): EditorElement => ({ id, item, x: 1500, y: 1500, room: "Obývací pokoj", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...patch });

/** Klasický byt: obývák (dvě světla, vypínače u dveří, žaluzie), chodba se schodišťovým zapojením 3 míst a koupelna. */
function classicFlat(): FloorplanDraft {
  return {
    ...emptyDraft(),
    rooms: [
      { id: "r1", name: "Obývací pokoj", x: 1000, y: 1000, w: 5000, h: 4000 },
      { id: "r2", name: "Chodba", x: 6000, y: 1000, w: 6000, h: 1500 },
      { id: "r3", name: "Koupelna", x: 6000, y: 2500, w: 2500, h: 2500 },
    ],
    elements: [
      el("rh", "panel", { x: 6100, y: 1100, room: "Chodba" }),
      el("l1", "ceiling-light", { x: 3500, y: 3000 }),
      el("l2", "ceiling-light", { x: 2000, y: 2000 }),
      el("s1", "switch-1", { x: 1100, y: 4800, controls: ["l1"] }),
      el("s2", "switch-1", { x: 1250, y: 4800, controls: ["l2"] }),
      el("bl", "blind", { x: 1400, y: 4800 }),
      el("lc", "ceiling-light", { x: 9000, y: 1700, room: "Chodba" }),
      el("c1", "switch-6", { x: 6200, y: 2400, room: "Chodba", controls: ["lc"] }),
      el("c2", "switch-7", { x: 9000, y: 2400, room: "Chodba", controls: ["lc"] }),
      el("c3", "switch-6", { x: 11800, y: 2400, room: "Chodba", controls: ["lc"] }),
    ],
  };
}

describe("fáze 109 – převod Klasická 230 V ⇄ Chytrá domácnost se zachováním variant", () => {
  it("klasický návrh → Smart Home: tlačítka 24 V DC, sloučení u dveří, hvězda + sběrnice, původní návrh v projectVariants", () => {
    const draft = classicFlat();
    const result = convertInstallationMode(draft, { target: "smart", options: defaultSmartOptions("abb_freeathome") }, 1000);
    if (!result.ok) throw new Error(result.error);
    const smart = result.draft;
    expect(smart.installation).toBe("bus_loxone");
    expect(smart.smartSystem).toBe("abb_freeathome");
    expect(smart.series).toBe("ABB|Zoni");
    // Vypínače u dveří obýváku (2 světla) → jedno dvoukanálové tlačítko se společným párováním
    const merged = smart.elements.filter((element) => element.room === "Obývací pokoj" && element.item.startsWith("bus-") && element.item !== "bus-blind");
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ item: "bus-2", controls: ["l1", "l2"] });
    // Světlo + žaluzie u týchž dveří → společný víceramček
    expect(smart.elements.find((element) => element.id === "bl")?.item).toBe("bus-blind");
    expect(smart.frames.some((frame) => frame.members.includes("bl") && frame.members.includes(merged[0].id))).toBe(true);
    // Schodišťové zapojení 3 míst → 3 sběrnicová tlačítka se stejným světlem
    expect(smart.elements.filter((element) => element.room === "Chodba" && element.item === "bus-1").map((element) => element.controls)).toEqual([["lc"], ["lc"], ["lc"]]);
    // Původní návrh zůstal jako varianta 1, aktivní je varianta 2
    expect(result.variant).toMatchObject({ id: "v2", label: "🤖 Varianta 2: Smart Home – ABB-free@home®", installation: "bus_loxone" });
    expect(smart.projectVariants).toHaveLength(1);
    expect(smart.projectVariants?.[0]).toMatchObject({ id: "v1", label: "⚡ Varianta 1: Klasická 230 V (Původní)", installation: "classic" });
    expect(smart.projectVariants?.[0].snapshot.floors[0].elements.map((element) => element.item)).toEqual(draft.elements.map((element) => element.item));
    expect(variantList(smart).map((variant) => [variant.id, variant.active])).toEqual([
      ["v1", false],
      ["v2", true],
    ]);
    expect(result.summary.lines.join(" ")).toContain("hvězdu do rozváděče + sběrnice 24 V DC");
  });

  it("přepnutí variant jedním klikem vrátí původní návrh beze změny a převedený zůstane uložený (i po uložení a načtení)", () => {
    const draft = classicFlat();
    const result = convertInstallationMode(draft, { target: "smart", options: defaultSmartOptions("loxone") }, 1000);
    if (!result.ok) throw new Error(result.error);
    const stored = parseDraft(JSON.parse(JSON.stringify(result.draft)));
    expect(stored?.activeVariant?.id).toBe("v2");
    expect(stored?.projectVariants?.[0].id).toBe("v1");
    const back = switchProjectVariant(stored!, "v1", 2000);
    expect(back.installation).toBe("classic");
    expect(back.elements.map(({ id, item, controls }) => ({ id, item, controls }))).toEqual(draft.elements.map(({ id, item, controls }) => ({ id, item, controls })));
    expect(back.activeVariant?.id).toBe("v1");
    expect(back.projectVariants?.map((variant) => variant.id)).toEqual(["v2"]);
    const again = switchProjectVariant(back, "v2", 3000);
    expect(again.installation).toBe("bus_loxone");
    expect(again.smartSystem).toBe("loxone");
    expect(again.elements.some((element) => element.item === "bus-2")).toBe(true);
  });

  it("volitelně stmívání hlavních světel a čidla přítomnosti v chodbě a koupelně", () => {
    const result = convertInstallationMode(classicFlat(), { target: "smart", options: { ...defaultSmartOptions(), dimMainLights: true, addPresence: true } }, 1000);
    if (!result.ok) throw new Error(result.error);
    const lights = result.draft.elements.filter((element) => element.room === "Obývací pokoj" && element.item === "ceiling-light");
    expect(lights.every((element) => element.light?.dimmable)).toBe(true);
    expect(result.draft.elements.filter((element) => element.item === "bus-presence").map((element) => element.room).sort()).toEqual(["Chodba", "Koupelna"]);
  });

  it("Smart Home → klasická 230 V: řazení podle počtu ovládacích míst (1 / 5 / 6 / 7), varianta s klasickou řadou", () => {
    const smart = convertInstallationMode(classicFlat(), { target: "smart", options: { ...defaultSmartOptions(), mergeDoorControls: false } }, 1000);
    if (!smart.ok) throw new Error(smart.error);
    const classic = convertInstallationMode(smart.draft, { target: "classic", options: { series: "ABB|Levit" } }, 2000);
    if (!classic.ok) throw new Error(classic.error);
    expect(classic.draft.installation).toBe("classic");
    expect(classic.draft.series).toBe("ABB|Levit");
    const item = (id: string) => classic.draft.elements.find((element) => element.id === id)?.item;
    expect([item("c1"), item("c2"), item("c3")]).toEqual(["switch-6", "switch-7", "switch-6"]);
    expect([item("s1"), item("s2"), item("bl")]).toEqual(["switch-1", "switch-1", "blind"]);
    expect(classic.variant.label).toBe("⚡ Varianta 3: Klasická 230 V");
    expect(classic.draft.projectVariants?.map((variant) => variant.id).sort()).toEqual(["v1", "v2"]);
    // Převod návrhu, který už je klasický, se odmítne
    expect(convertInstallationMode(classicFlat(), { target: "classic", options: { series: null } })).toMatchObject({ ok: false });
  });

  it("ukazatel rozdílu variant: metráž kabelů a cena práce z generátoru nabídky", () => {
    const result = convertInstallationMode(classicFlat(), { target: "smart", options: defaultSmartOptions() }, 1000);
    if (!result.ok) throw new Error(result.error);
    const smart = variantMetrics(result.draft);
    const classic = variantMetrics(switchProjectVariant(result.draft, "v1"));
    expect(smart.cableM).toBeGreaterThan(0);
    expect(classic.cableM).toBeGreaterThan(0);
    expect(smart.laborCzk).toBeGreaterThan(0);
    expect(smart.cableM).not.toBe(classic.cableM);
  });
});

describe("fáze 109 – vkládání nábytku, WC a výška u kuchyňské linky", () => {
  it("WC je jen v Koupelně (ne v Okna, dveře a nábytek); nábytek, koupelna a rozváděče se vkládají po kusech", () => {
    expect(PALETTE.filter((item) => item.group === "architecture" || item.alsoIn?.includes("architecture")).some((item) => /WC/.test(item.label))).toBe(false);
    expect(PALETTE.find((item) => item.id === "arch-wc")?.group).toBe("fixtures");
    expect(placesOnce({ group: "architecture" })).toBe(true);
    expect(placesOnce({ group: "fixtures" })).toBe(true);
    expect(placesOnce({ group: "panel" })).toBe(true);
    expect(placesOnce({ group: "sockets" })).toBe(false);
  });

  it("zásuvka u kuchyňské linky → 1150 mm; vložená linka zvedne zásuvky nad sebou; myčka si výšku nechá", () => {
    const kitchen = el("k", "arch-kitchen", { x: 3000, y: 1300, room: "Kuchyně" });
    const socket = el("z", "socket", { x: 3000, y: 1050, room: "Kuchyně" });
    const far = el("zf", "socket", { x: 3000, y: 3500, room: "Kuchyně" });
    const dishwasher = el("my", "dishwasher", { x: 2600, y: 1100, room: "Kuchyně" });
    const base = { ...emptyDraft(), elements: [kitchen, socket, far, dishwasher] };
    const placedSocket = applyCounterHeights(base, ["z"]);
    expect(placedSocket.draft.elements.find((element) => element.id === "z")?.mountHeightMm).toBe(1150);
    expect(placedSocket.draft.elements.find((element) => element.id === "zf")?.mountHeightMm).toBeNull();
    const placedCounter = applyCounterHeights({ ...base, elements: [socket, far, dishwasher, kitchen] }, ["k"]);
    expect(placedCounter.byCounter).toBe(true);
    expect(placedCounter.raised).toContain("z");
    expect(placedCounter.draft.elements.find((element) => element.id === "my")?.mountHeightMm).toBeNull();
    expect(COUNTER_RAISED_TEXT).toContain("1150 mm");
  });
});

describe("fáze 109 – značky a 3D náhled", () => {
  it("🎨 Barva značek: dle typu syté barvy kategorií, kontrolní červená #ff2e2e, vlastní barva; čáry +35 % a min. 2,4 px", () => {
    expect(symbolCategory({ kind: "switch", control: "light" })).toBe("switch");
    expect(symbolCategory({ kind: "switch", control: "thermostat" })).toBe("control");
    expect(symbolInk({ mode: "type", custom: "#ffffff" }, { kind: "single_socket" }, false)).toBe("#38bdf8");
    expect(symbolInk({ mode: "type", custom: "#ffffff" }, { kind: "light" }, false)).toBe("#fde047");
    expect(symbolInk({ mode: "red", custom: "#ffffff" }, { kind: "light" }, false)).toBe("#ff2e2e");
    expect(uniformColor({ mode: "cyan", custom: "#ffffff" })).toBe("#00f0ff");
    expect(uniformColor({ mode: "type", custom: "#ffffff" })).toBeNull();
    expect(parseSymbolColor(serializeSymbolColor({ mode: "custom", custom: "#00FF88" }))).toEqual({ mode: "custom", custom: "#00ff88" });
    expect(parseSymbolColor("nesmysl")).toEqual({ mode: "type", custom: "#ff2e2e" });
    // Symbol 300 mm při 10 mm / px: tisková čára 13,6 mm (1,4 px) → na plátně aspoň 2,4 px = 24 mm
    expect(canvasStroke(300, 10)).toBe(24);
    expect(canvasStroke(300, 1)).toBeCloseTo((300 / 22) * 1.35);
  });

  it("3D: okna 900–2300 mm a dveře 0–2000 mm, termostat a čidlo jako ovladač (tyrkysově), vypínač zvlášť", () => {
    expect(OPENING_HEIGHTS.window_1.sill).toBe(900);
    expect(OPENING_HEIGHTS.window_1.sill + OPENING_HEIGHTS.window_1.height).toBe(2300);
    expect(OPENING_HEIGHTS.door_1).toEqual({ sill: 0, height: 2000 });
    const scene = buildScene({ ...emptyDraft(), elements: [el("s", "switch-1"), el("t", "thermostat"), el("q", "bus-sensor")] });
    expect(scene.elements.map((element) => [element.id, element.kind])).toEqual([
      ["s", "switch"],
      ["t", "control"],
      ["q", "control"],
    ]);
  });
});

describe("fáze 109 – panely ABB-free@home: barva přepíná náhled i objednací číslo (jen ověřená čísla)", () => {
  const roomTouch = FAH_ROOM_PANELS.find((product) => product.id === "fah-roomtouch-4")!;
  const trevion = FAH_ROOM_PANELS.find((product) => product.id === "fah-trevion")!;
  const render = (product: typeof roomTouch, variant: string) => renderToStaticMarkup(createElement(SmartHomeDeviceIllustration, { product, variant, system: "abb_freeathome", tone: { frame: "#f4f4f5", insert: "#f4f4f5" } as never }));

  it("RoomTouch® 4\": černá = černý panel s RT/U12.86.1-825, bílá = bílý panel s RT/U12.86.1-811", () => {
    expect(mpnOf(withVariant(roomTouch, "black"))).toBe("2TMA310011B0003");
    expect(mpnOf(withVariant(roomTouch, "white"))).toBe("2TMA310011W0001");
    expect(render(roomTouch, "black")).toContain('data-tone="black"');
    expect(render(roomTouch, "white")).toContain('data-tone="white"');
  });

  it("Trevion® 2,4\": černý displej v černém rámečku (2TMA310011B0001), bílý bez čísla v katalogu výrobců – ne čísla ovladačů ABB-Tenton®", () => {
    expect(mpnOf(withVariant(trevion, "black"))).toBe("2TMA310011B0001");
    expect(render(trevion, "black")).toContain('data-tone="black"');
    expect(render(trevion, "white")).toContain('data-tone="white"');
    expect(render(trevion, "black")).toContain("trevion-touch-bar");
    const numbers = JSON.stringify([...FAH_ROOM_PANELS, ...FAH_PANELS]);
    for (const unverified of ["2TMA310050B0001", "2TMA310050W0001", "2CKA006220A0875", "2CKA006220A0872", "2TMA130050B0001"]) expect(numbers).not.toContain(unverified);
  });

  it("SmartTouch® 10\" a OneTouch 7\" mají černou i bílou variantu s vlastním objednacím číslem", () => {
    const smartTouch = FAH_PANELS.find((product) => product.id === "fah-smarttouch-10")!;
    const oneTouch = FAH_PANELS.find((product) => product.id === "fah-onetouch-7")!;
    expect([mpnOf(withVariant(smartTouch, "black")), mpnOf(withVariant(smartTouch, "white"))]).toEqual(["2TMA310051B0001", "2TMA310051W0001"]);
    expect([mpnOf(withVariant(oneTouch, "black")), mpnOf(withVariant(oneTouch, "white"))]).toEqual(["2TMA320051B0001", "2TMA320051W0001"]);
    expect(allElements(emptyDraft())).toEqual([]);
  });
});
