import { describe, expect, it } from "vitest";

import { analyzeDraft, addFloor, allElements, buildPlan, emptyDraft, floorsOf, parseDraft, removeFloor, switchFloor, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { annotationSummary, autoPairLights, createFrame, dissolveFrame, frameGangs, moveInFrame, newAnnotation, orthogonal, removeElements, toggleLink, unpairedLights, wallPolygon } from "./floorplan-frames";
import { cropDraft, rotateDraft, type FloorplanBackground } from "./floorplan-pdf";
import { compileFloorplanBom } from "./wiring-bom";

const el = (id: string, item: string, x: number, y: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Kuchyně", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });

describe("fáze 59 – víceramečky z různých přístrojů s vyrovnáním a přisazením", () => {
  const base = (): FloorplanDraft => ({ ...emptyDraft(), series: "ABB|Zoni", color: "abb-zoni-500", elements: [el("z1", "socket", 1000, 0), el("s1", "switch-1", 400, 30, { rotation: 90 }), el("z2", "socket", 1650, 10)] });

  it("2 zásuvky + vypínač → rámeček 3R: pořadí podle polohy, jedna linie, stejné natočení, výška vypínače, řada kotvy", () => {
    const result = createFrame(base(), ["z1", "s1", "z2"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const frame = result.draft.frames[0];
    expect(frame.members).toEqual(["s1", "z1", "z2"]); // zleva doprava (natočení většiny = 0°)
    expect(result.gangs).toBe(3);
    const members = frame.members.map((id) => result.draft.elements.find((element) => element.id === id)!);
    expect(new Set(members.map((element) => element.y)).size).toBe(1); // vyrovnáno na jednu linii
    expect(new Set(members.map((element) => element.rotation))).toEqual(new Set([0]));
    expect(members[1].x - members[0].x).toBe(members[2].x - members[1].x); // přisazení v pravidelné rozteči
    expect(members.every((element) => (element.mountHeightMm ?? 1050) === 1050)).toBe(true); // zásuvky do výšky vypínače
  });

  it("limity: nejvýš 5 pozic (dvojzásuvka = 2), svítidlo do rámečku nejde, rozdělení a posun v rámečku", () => {
    const draft = { ...base(), elements: [...base().elements, el("d1", "double-socket", 2300, 0), el("d2", "double-socket", 2900, 0), el("l1", "ceiling-light", 0, 0)] };
    expect(createFrame(draft, ["z1", "s1", "z2", "d1"]).ok).toBe(true); // 1 + 1 + 1 + 2 = 5 pozic
    const tooMany = createFrame(draft, ["z1", "s1", "z2", "d1", "d2"]);
    expect(tooMany.ok ? null : tooMany.error).toMatch(/nejvýš 5 pozic – vybráno 7/);
    const light = createFrame(draft, ["z1", "l1"]);
    expect(light.ok ? null : light.error).toMatch(/Stropní svítidlo/);
    const ok = createFrame(draft, ["z1", "d1"]);
    expect(ok.ok && frameGangs(ok.draft, ok.draft.frames[0])).toBe(3);
    if (!ok.ok) return;
    const moved = moveInFrame(ok.draft, "d1", -1);
    expect(moved.frames[0].members).toEqual(["d1", "z1"]);
    expect(dissolveFrame(moved, moved.frames[0].id).frames).toHaveLength(0);
    // smazání člena: rámeček s jedním přístrojem zanikne
    expect(removeElements(ok.draft, ["d1"]).frames).toHaveLength(0);
  });

  it("kusovník: jeden rámeček 3R ve víceramečku místo tří 1R, dvojzásuvka v rámečku = 2 jednozásuvky", () => {
    const result = createFrame(base(), ["z1", "s1", "z2"]);
    if (!result.ok) throw new Error(result.error);
    const frames = compileFloorplanBom(result.draft).filter((row) => row.category === "Rámečky");
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ quantity: 1, mpn: "3901T-A00030 500" });
    expect(frames[0].name).toContain("3R");
    const withDouble = createFrame({ ...base(), elements: [el("d1", "double-socket", 0, 0), el("s1", "switch-1", 500, 0)] }, ["d1", "s1"]);
    if (!withDouble.ok) throw new Error(withDouble.error);
    const sockets = compileFloorplanBom(withDouble.draft).filter((row) => row.category === "Zásuvky");
    expect(sockets).toEqual([expect.objectContaining({ quantity: 2, mpn: "6619T-A06657 500" })]);
  });

  it("výpočet: krabice víceramečku v rozteči 71 mm se propojují přímo v krabici", () => {
    const result = createFrame({ ...base(), elements: [el("rh", "panel", 0, 3000), ...base().elements] }, ["z1", "s1", "z2"]);
    if (!result.ok) throw new Error(result.error);
    const build = buildPlan(result.draft);
    const nodes = ["s1", "z1", "z2"].map((id) => build.routeNodes.find((node) => node.id === id)!);
    expect(new Set(nodes.map((node) => node.frame)).size).toBe(1);
    expect(nodes[1].x - nodes[0].x).toBe(71);
    expect(nodes[2].x - nodes[1].x).toBe(71);
  });
});

describe("fáze 59 – přiřazení vypínače ke světlu", () => {
  it("automaticky nejbližší vypínač ve stejné místnosti, místnost bez vypínače zůstane v kontrole; párování z obou stran", () => {
    const draft: FloorplanDraft = {
      ...emptyDraft(),
      elements: [el("l1", "ceiling-light", 2000, 2000), el("s-far", "switch-1", 5000, 5000), el("s-near", "switch-1", 1800, 300), el("l2", "ceiling-light", 9000, 9000, { room: "Chodba" })],
    };
    expect(unpairedLights(draft).map((light) => light.id)).toEqual(["l1", "l2"]);
    const result = autoPairLights(draft);
    expect(result.paired).toBe(1);
    expect(result.skipped).toEqual(["Chodba"]);
    expect(result.draft.elements.find((element) => element.id === "s-near")!.controls).toEqual(["l1"]);
    const toggled = toggleLink(result.draft, "s-far", "l1");
    expect(toggled.elements.find((element) => element.id === "s-far")!.controls).toEqual(["l1"]);
    expect(toggleLink(toggled, "s-far", "l1").elements.find((element) => element.id === "s-far")!.controls).toEqual([]);
  });
});

describe("fáze 59 – zakreslení změn do podkladu", () => {
  it("příčka: výchozí červená šrafa a tloušťka 100 mm, pravoúhlé kreslení, obrys v tloušťce konstrukce", () => {
    const wall = newAnnotation("wall", { x: 0, y: 0 }, orthogonal({ x: 0, y: 0 }, { x: 3000, y: 120 }));
    expect(wall).toMatchObject({ kind: "wall", color: "#dc2626", hatch: "diagonal", thicknessMm: 100, y2: 0, x2: 3000 });
    expect(wallPolygon(wall).map((point) => Math.round(point.y))).toEqual([50, 50, -50, -50]);
    expect(newAnnotation("demolish", { x: 0, y: 0 })).toMatchObject({ hatch: "cross", thicknessMm: 150 });
    expect(newAnnotation("text", { x: 5, y: 5 })).toMatchObject({ text: "Text", fontMm: 250, background: true });
  });

  it("uložení, otočení a ořez nesou zakreslené změny; souhrn délek nových příček", () => {
    const background: FloorplanBackground = { url: "/api/files/photos/p.jpg", widthPx: 1000, heightPx: 800, rotation: 0, crop: null, pagePt: null };
    const wall = { ...newAnnotation("wall", { x: 1000, y: 1000 }, { x: 4000, y: 1000 }), id: "w1" };
    const text = { ...newAnnotation("text", { x: 9000, y: 7000 }), id: "t1", text: "Nová příčka SDK", bold: true, color: "#2563eb" };
    const draft: FloorplanDraft = { ...emptyDraft(), background, mmPerPx: 10, widthMm: 10_000, heightMm: 8000, annotations: [wall, text] };
    const parsed = parseDraft(JSON.parse(JSON.stringify(draft)))!;
    expect(parsed.annotations).toEqual([wall, text]);
    expect(parseDraft({ ...draft, annotations: [{ ...wall, color: "red; drop", kind: "wall" }, { id: "x", kind: "nonsense" }] })!.annotations).toEqual([{ ...wall, color: "#dc2626" }]);
    const rotated = rotateDraft(draft, 1);
    expect(rotated.annotations[0]).toMatchObject({ x: 7000, y: 1000, x2: 7000, y2: 4000 });
    const cropped = cropDraft(draft, { x: 0, y: 0, w: 5000, h: 5000 });
    expect(cropped.annotations.map((note) => note.id)).toEqual(["w1"]);
    expect(annotationSummary(draft)).toMatchObject({ newWallsM: 3, texts: 1 });
  });
});

describe("fáze 59 – vícepodlažní dům", () => {
  it("starší nákres = jedno podlaží 1. NP; přidání, přepnutí a smazání podlaží zachová prvky", () => {
    const old = parseDraft({ ...emptyDraft(), floorId: undefined, floorName: undefined, otherFloors: undefined, elements: [el("a", "socket", 0, 0)] })!;
    expect(floorsOf(old).map((floor) => floor.name)).toEqual(["1. NP"]);
    const two = addFloor(old, { name: "2. NP" });
    expect(two.floorName).toBe("2. NP");
    expect(two.floorLevelMm).toBe(3000);
    expect(two.elements).toEqual([]);
    expect(two.otherFloors[0].elements.map((element) => element.id)).toEqual(["a"]);
    const back = switchFloor({ ...two, elements: [el("b", "socket", 0, 0)] }, "f1");
    expect(back.elements.map((element) => element.id)).toEqual(["a"]);
    expect(allElements(back).map((element) => element.id).sort()).toEqual(["a", "b"]);
    expect(parseDraft(JSON.parse(JSON.stringify(back)))!.otherFloors[0].elements[0].id).toBe("b");
    expect(floorsOf(removeFloor(back, "f2"))).toHaveLength(1);
  });

  it("trasa z 2. NP vede ke stoupacímu vedení, svisle o výšku podlaží a dál k rozváděči; okruhy se nemíchají mezi podlažími", () => {
    let draft: FloorplanDraft = { ...emptyDraft(), elements: [el("rh", "panel", 0, 0, { room: "Technická" }), el("z1", "socket", 4000, 0, { room: "Obývák" }), el("l1", "ceiling-light", 4000, 3000, { room: "Obývák" }), el("s1", "switch-1", 3000, 3000, { room: "Obývák", controls: ["l1"] })] };
    draft = addFloor(draft, { name: "2. NP", levelMm: 3000 });
    draft = { ...draft, elements: [el("st", "riser", 1000, 0, { room: "Chodba" }), el("z2", "socket", 1000, 5000, { room: "Ložnice" }), el("l2", "ceiling-light", 2000, 4000, { room: "Ložnice" }), el("s2", "switch-1", 1500, 4500, { room: "Ložnice", controls: ["l2"] })] };
    const build = buildPlan(draft);
    const upstairs = build.routeNodes.find((node) => node.id === "z2")!;
    expect(upstairs.floor).toBe(draft.floorId);
    // 1 m po 1. NP ke stoupačce (výchozí = rozváděč, stoupačka 2. NP na x = 1000) + 3 m svisle + 5 m po 2. NP
    expect(build.metric.distance(build.panel, upstairs)).toBe(1000 + 3000 + 5000);
    const path = build.metric.path(build.panel, upstairs);
    expect(new Set(path.map((point) => point.floor)).size).toBe(2);
    const { circuits } = analyzeDraft(draft);
    const sockets = circuits.circuits.filter((circuit) => circuit.kind === "sockets");
    expect(sockets).toHaveLength(2); // zásuvky obou podlaží se nespojí do jednoho okruhu
    expect(sockets.map((circuit) => circuit.label).join(" ")).toMatch(/Ložnice \(2\. NP\)/);
    const lights = circuits.circuits.filter((circuit) => circuit.kind === "lighting");
    expect(lights.every((circuit) => new Set(circuit.nodeIds.map((id) => build.routeNodes.find((node) => node.id === id)!.floor)).size === 1)).toBe(true);
  });

  it("rozváděč jen jeden v domě, kusovník a soupis přes všechna podlaží", () => {
    let draft: FloorplanDraft = { ...emptyDraft(), series: "ABB|Zoni", color: "abb-zoni-500", elements: [el("rh", "panel", 0, 0), el("z1", "socket", 4000, 0)] };
    draft = addFloor(draft, { name: "2. NP" });
    draft = { ...draft, elements: [el("z2", "socket", 1000, 5000), el("z3", "socket", 2000, 5000)] };
    const sockets = compileFloorplanBom(draft).find((row) => row.category === "Zásuvky");
    expect(sockets?.quantity).toBe(3);
    expect(analyzeDraft(draft).summary.circuits.length).toBeGreaterThanOrEqual(2);
  });
});
