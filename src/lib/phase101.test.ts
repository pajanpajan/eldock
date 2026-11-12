import { describe, expect, it } from "vitest";

import { ETIM_FRAMES, ETIM_GTIN, ETIM_SMART } from "./panel-builder/abb-etim.generated";
import { KOPOS_BOX_DATA } from "./panel-builder/brand-etim.generated";
import { DEMO_SCENARIOS, demoDraft } from "./panel-builder/demo-scenarios";
import { analyzeDraft, emptyDraft, type EditorElement } from "./panel-builder/floorplan-editor";
import { bomOrderLabel, bomTable, compileFloorplanBom, type WiringBomRow } from "./panel-builder/wiring-bom";
import { assembliesFor, assemblyGangs, dissolveFrame, frameNeighbors, frameOf, joinNeighbors, placeAssembly, resizeFrame, setFrameOrientation, setFrameSlot } from "./panel-builder/floorplan-frames";
import { DEFAULT_PITCH_CONFIG, PITCH_PLAN, PITCH_SLIDE_COUNT, parsePitchConfig, planText } from "./pitch";
import { pitchLiveData } from "./pitch-live";

/** Kontrolní číslice EAN-13 (GS1): váhy 1 / 3 zleva, 13. číslice doplní součet na násobek 10. */
export function validEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (index % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

const el = (id: string, item: string, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x: 0, y: 0, room: "Obývák", mountHeightMm: null, frameUnits: 1, series: null, color: null, rotation: 0, scale: null, controls: [], ...extra });

const bomOf = (draft: ReturnType<typeof demoDraft>) => {
  const analysis = analyzeDraft(draft);
  return compileFloorplanBom(draft, { installation: draft.installation, cables: analysis.summary.byCable, cableEnds: {} });
};

const texts = (rows: readonly WiringBomRow[]) => [...rows.flatMap((row) => [row.name, row.appearance, bomOrderLabel(row)]), ...bomTable(rows).flat().map(String)];

// Fáze 101: kusovník domovní instalace bez slova „doplnit“ – objednací čísla a EAN jen z oficiálních dat výrobců,
// kde výrobce číslo nevede, pravdivý popis původu položky (nic vymyšleného).
describe("kusovník 2D půdorysu – žádné „doplnit“, platné EAN-13", () => {
  it("kontrolní číslice EAN-13", () => {
    expect([validEan13("8595090553083"), validEan13("4011395180075"), validEan13("8595090553084"), validEan13("859509055308")]).toEqual([true, true, false, false]);
  });

  it("demo scénáře: ani jeden řádek ani tabulka CSV / XLSX neobsahuje „doplnit“", () => {
    for (const scenario of DEMO_SCENARIOS) {
      const rows = bomOf(demoDraft(scenario.id));
      expect(rows.length, scenario.id).toBeGreaterThan(5);
      for (const text of texts(rows)) expect(text, `${scenario.id}: ${text}`).not.toMatch(/doplnit/i);
    }
  });

  it("nově vložené zásuvky, vypínače, světla a kabely v prázdném výkresu – bez „doplnit“", () => {
    const draft = { ...emptyDraft(), elements: [el("z1", "socket"), el("z2", "double-socket"), el("u", "usb-socket"), el("l", "ceiling-light"), el("s", "switch-1", { controls: ["l"] }), el("s6", "switch-6"), el("d", "data-socket")] };
    const rows = compileFloorplanBom(draft, { installation: "classic", cables: [{ cable: "CYKY-J 3x1,5", meters: 24 }, { cable: "CYKY-J 3x2,5", meters: 31.5 }] });
    expect(rows.some((row) => row.category === "Kabely")).toBe(true);
    for (const text of texts(rows)) expect(text, text).not.toMatch(/doplnit/i);
    // Kabel bez objednacího čísla výrobce → typové označení, výrobce podle nabídky velkoobchodu
    expect(bomOrderLabel(rows.find((row) => row.category === "Kabely")!)).toBe("typové označení – výrobce dle nabídky");
  });

  it("každý EAN v kusovníku i v datech výrobců (ABB ETIM 9.0, KOPOS) má platnou kontrolní číslici", () => {
    const eans = [
      ...DEMO_SCENARIOS.flatMap((scenario) => bomOf(demoDraft(scenario.id)).flatMap((row) => (row.ean ? [row.ean] : []))),
      ...Object.values(ETIM_GTIN),
      ...Object.values(ETIM_FRAMES).flatMap((frames) => frames.flatMap((frame) => (frame.gtin ? [frame.gtin] : []))),
      ...Object.values(ETIM_SMART).flatMap((smart) => (smart.gtin ? [smart.gtin] : [])),
      ...Object.values(KOPOS_BOX_DATA).flatMap((box) => (box.ean ? [box.ean] : [])),
    ];
    expect(eans.length).toBeGreaterThan(500);
    const invalid = eans.filter((ean) => !validEan13(ean));
    expect(invalid).toEqual([]);
  });

  it("přístroje řady ABB ve vzorovém RD mají objednací číslo i EAN z ETIM (kromě položek, které řada nevede)", () => {
    const rows = bomOf(demoDraft("rd-4kk"));
    const devices = rows.filter((row) => !["Kabely", "Bezpečnostní a zdravotnické prvky", "Instalační krabice"].includes(row.category));
    // Datová zásuvka RJ45 (keystone dle výrobce kabeláže) a zásuvka IP44 nejsou v datech ETIM řady Levit
    const notInSeries = devices.filter((row) => !row.mpn).map((row) => row.name);
    for (const name of notInSeries) expect(name).toMatch(/RJ45|IP44/);
    for (const row of devices.filter((row) => row.mpn)) {
      expect(row.ean, row.mpn!).toBeTruthy();
      expect(validEan13(row.ean!), row.ean).toBe(true);
    }
    expect(devices.filter((row) => row.mpn && row.ean).length).toBeGreaterThanOrEqual(4);
  });
});

describe("prezentace – 8 slidů a živá data", () => {
  it("8 slidů, plán využití s výchozím i vlastním textem", () => {
    expect(PITCH_SLIDE_COUNT).toBe(8);
    expect(PITCH_PLAN.map((item) => item.title)).toEqual(["Pilotní nasazení a obchodní vstup na trh ČR/SK", "Datová a velkoobchodní integrace", "Vývoj navazujících modulů"]);
    expect(parsePitchConfig(null).plan).toEqual(["", "", ""]);
    const config = parsePitchConfig(JSON.stringify({ plan: ["Vlastní text", 5, "y".repeat(900)] }));
    expect(config.plan[0]).toBe("Vlastní text");
    expect(config.plan[1]).toBe("");
    expect(config.plan[2]).toHaveLength(400);
    expect(planText(config, 0)).toBe("Vlastní text");
    expect(planText(DEFAULT_PITCH_CONFIG, 2)).toContain("VRZ dle ČSN 33 2000-6 ed. 2");
  });

  it("živá data slidů = výpočet aplikace (kusovník RD 4+kk s MPN / EAN, vzorová hala IFC4, 6 listů PDF, Síť / DA / UPS)", () => {
    const live = pitchLiveData();
    expect(live.bom.length).toBeGreaterThanOrEqual(3);
    for (const row of live.bom) expect(row.ean && validEan13(row.ean), row.mpn).toBe(true);
    expect(live.bomStats.circuits).toBeGreaterThan(5);
    expect(live.bomStats.cableM).toBeGreaterThan(100);
    expect(live.bim).toMatchObject({ buildings: 1, storeys: 2, dimensions: "84,0 × 42,5 m", boards: 3 });
    expect(live.bim.sources.map((source) => source.tag)).toEqual(["TR1", "DA1", "UPS1"]);
    expect(live.sheets).toHaveLength(6);
    expect(live.tiers).toHaveLength(3);
  });
});

// Fáze 101: víceramček přímo v detailu prvku – 1R až 5R, obsah pozic, orientace ↔ / ↕, spojení sousedů do 35 cm.
describe("víceramček v detailu prvku (1R–5R)", () => {
  const room = { id: "r1", name: "Obývák", x: 0, y: 0, w: 600, h: 400, kind: "rect" as const };
  const base = () => ({ ...emptyDraft(), installation: "classic" as const, series: "ABB|Levit", rooms: [room as never], elements: [el("z", "socket", { x: 200, y: 4, rotation: 0 })] });

  it("1R → 3R → 5R → 2R → 1R: pozice se přidají za vybraný přístroj, ubírají se od konce, vybraný zůstává", () => {
    let draft = base() as ReturnType<typeof emptyDraft>;
    let result = resizeFrame(draft, "z", 3, ["a", "b"]);
    expect(result.ok).toBe(true);
    draft = result.ok ? result.draft : draft;
    expect(frameOf(draft, "z")?.members).toEqual(["z", "a", "b"]);
    expect(draft.elements.filter((element) => ["a", "b"].includes(element.id)).map((element) => element.item)).toEqual(["socket", "socket"]);
    result = resizeFrame(draft, "z", 5, ["c", "d"]);
    draft = result.ok ? result.draft : draft;
    expect(frameOf(draft, "z")?.members).toEqual(["z", "a", "b", "c", "d"]);
    result = resizeFrame(draft, "z", 2);
    draft = result.ok ? result.draft : draft;
    expect(frameOf(draft, "z")?.members).toEqual(["z", "a"]);
    expect(draft.elements.map((element) => element.id).sort()).toEqual(["a", "z"]);
    result = resizeFrame(draft, "z", 1);
    draft = result.ok ? result.draft : draft;
    expect(frameOf(draft, "z")).toBeNull();
    expect(draft.elements).toHaveLength(2);
  });

  it("limit řady: Decento bez víceramečku nedovolí 2R", () => {
    const draft = { ...base(), series: "ABB|Decento" } as ReturnType<typeof emptyDraft>;
    const result = resizeFrame(draft, "z", 2, ["a"]);
    expect(result.ok).toBe(false);
  });

  it("obsah pozic na 1 klik (RJ45, TV / SAT, vypínač) a svislá orientace s výškami po 71 mm", () => {
    let draft = base() as ReturnType<typeof emptyDraft>;
    const grown = resizeFrame(draft, "z", 3, ["a", "b"]);
    draft = grown.ok ? grown.draft : draft;
    const rj = setFrameSlot(draft, "a", "data-socket");
    draft = rj.ok ? rj.draft : draft;
    const tv = setFrameSlot(draft, "b", "tv-socket");
    draft = tv.ok ? tv.draft : draft;
    expect(frameOf(draft, "z")!.members.map((id) => draft.elements.find((element) => element.id === id)!.item)).toEqual(["socket", "data-socket", "tv-socket"]);
    expect(setFrameSlot(draft, "a", "ceiling-light").ok).toBe(false);
    const frameId = frameOf(draft, "z")!.id;
    const vertical = setFrameOrientation(draft, frameId, "vertical");
    expect(frameOf(vertical, "z")?.orientation).toBe("vertical");
    const heights = frameOf(vertical, "z")!.members.map((id) => vertical.elements.find((element) => element.id === id)!.mountHeightMm);
    expect(heights[0]! - heights[1]!).toBe(71);
    expect(heights[1]! - heights[2]!).toBe(71);
    // Svisle se v půdorysu kreslí pod sebou kolmo ke stěně do místnosti (stěna nahoře → dolů)
    const ys = frameOf(vertical, "z")!.members.map((id) => vertical.elements.find((element) => element.id === id)!.y);
    expect(ys[1]).toBeGreaterThan(ys[0]);
    const back = setFrameOrientation(vertical, frameId, "horizontal");
    expect(frameOf(back, "z")?.orientation).toBeUndefined();
    expect(new Set(frameOf(back, "z")!.members.map((id) => back.elements.find((element) => element.id === id)!.mountHeightMm)).size).toBe(1);
  });

  it("🔗 sousedé u stejné stěny do 35 cm se spojí, vzdálenější ne; ✂️ rozdělení", () => {
    // Souřadnice plánu v mm: vypínač přisazený vedle zásuvky (rozteč značek 234 mm), zásuvka o 80 cm dál, jiná místnost
    const draft = { ...base(), elements: [el("z", "socket", { x: 200, y: 4 }), el("s", "switch-1", { x: 434, y: 4 }), el("far", "socket", { x: 1000, y: 4 }), el("other", "socket", { x: 300, y: 4, room: "Kuchyň" })] } as ReturnType<typeof emptyDraft>;
    expect(frameNeighbors(draft, "z").map((element) => element.id)).toEqual(["s"]);
    const joined = joinNeighbors(draft, "z");
    expect(joined.ok).toBe(true);
    const next = joined.ok ? joined.draft : draft;
    expect(frameOf(next, "z")?.members.sort()).toEqual(["s", "z"]);
    expect(dissolveFrame(next, frameOf(next, "z")!.id).frames).toHaveLength(0);
  });

  it("šablony palety: zásuvky ve fázi 3, vypínače ve fázi 4, svislá sestava vypínač nad zásuvkou", () => {
    const classic = assembliesFor("classic");
    expect(classic.filter((set) => set.group === "sockets").map((set) => set.id)).toEqual(["set-2z", "set-3z", "set-4z", "set-z-rj", "set-tv"]);
    expect(classic.filter((set) => set.group === "controls").map((set) => set.id)).toEqual(expect.arrayContaining(["set-s1-z-v", "set-2s1-z", "set-s1-zal-ter", "set-bed"]));
    const tv = classic.find((set) => set.id === "set-tv")!;
    expect(assemblyGangs(tv.members)).toBe(4);
    const placed = placeAssembly(base() as ReturnType<typeof emptyDraft>, ["switch-1", "socket"], { x: 300, y: 4, rotation: 0, room: "Obývák", series: "ABB|Levit", color: null }, ["p1", "p2"], "vertical");
    expect(placed.ok && frameOf(placed.draft, "p1")?.orientation).toBe("vertical");
  });

  it("anténní zásuvka TV / SAT: koaxiální kabel místo UTP, v kusovníku jako anténní zásuvka", () => {
    const draft = { ...emptyDraft(), elements: [el("p", "panel", { x: 10, y: 10 }), el("tv", "tv-socket", { x: 300, y: 4 })] } as ReturnType<typeof emptyDraft>;
    const analysis = analyzeDraft(draft);
    expect(analysis.summary.byCable.map((row) => row.cable)).toContain("Koaxiální kabel 75 Ω (TV / SAT)");
    expect(analysis.summary.byCable.map((row) => row.cable)).not.toContain("UTP Cat6");
    const rows = compileFloorplanBom(draft, { installation: draft.installation, cables: analysis.summary.byCable, cableEnds: {} });
    expect(rows.some((row) => row.name.startsWith("Anténní zásuvka TV / SAT"))).toBe(true);
  });
});
