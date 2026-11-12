import { describe, expect, it } from "vitest";

import { emptyDraft, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import {
  FRAME_ASSEMBLIES,
  addToFrame,
  assembliesFor,
  assemblyError,
  assemblyLabel,
  createFrame,
  frameableItems,
  framePitch,
  moveInFrame,
  placeAssembly,
  rotateFrame,
} from "./floorplan-frames";

const el = (id: string, item: string, x: number, y: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Kuchyně", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
const byId = (draft: FloorplanDraft, id: string) => draft.elements.find((element) => element.id === id)!;
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);

describe("fáze 62 – sestava ve víceramečku jedním klikem z palety", () => {
  const draft = (): FloorplanDraft => ({ ...emptyDraft(), series: "ABB|Zoni", color: "abb-zoni-500" });
  const at = { x: 3000, y: 0, rotation: 0 as const, room: "Obývák", series: "ABB|Zoni", color: "abb-zoni-500" };

  it("3× jednozásuvka: tři přístroje v jednom rámečku 3R, střed sestavy v místě kliknutí, přisazené v rozteči", () => {
    const result = placeAssembly(draft(), ["socket", "socket", "socket"], at, ["a", "b", "c"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ids).toEqual(["a", "b", "c"]);
    expect(result.gangs).toBe(3);
    expect(result.draft.frames).toEqual([{ id: result.frameId, members: ["a", "b", "c"] }]);
    const [a, b, c] = ["a", "b", "c"].map((id) => byId(result.draft, id));
    const pitch = framePitch(draft(), { scale: null });
    near(b.x, 3000);
    near(b.x - a.x, pitch);
    near(c.x - b.x, pitch);
    expect(new Set([a.y, b.y, c.y])).toEqual(new Set([0]));
    expect([a, b, c].every((element) => element.room === "Obývák" && element.series === "ABB|Zoni" && element.rotation === 0)).toBe(true);
  });

  it("vypínač + 2 zásuvky: pořadí sestavy, zásuvky ve výšce vypínače; natočení 90° = sestava svisle", () => {
    const result = placeAssembly(draft(), ["switch-1", "socket", "socket"], { ...at, rotation: 90 }, ["s", "z1", "z2"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.frames[0].members).toEqual(["s", "z1", "z2"]);
    const members = ["s", "z1", "z2"].map((id) => byId(result.draft, id));
    expect(new Set(members.map((element) => element.x))).toEqual(new Set([3000]));
    expect(members[1].y).toBeGreaterThan(members[0].y);
    expect(members.every((element) => (element.mountHeightMm ?? 1050) === 1050)).toBe(true);
  });

  it("limity sestavy: alespoň 2 přístroje, nejvýš 5 pozic (dvojzásuvka = 2), svítidlo do rámečku nejde", () => {
    expect(placeAssembly(draft(), ["socket"], at)).toMatchObject({ ok: false, error: expect.stringContaining("alespoň 2") });
    expect(placeAssembly(draft(), ["double-socket", "double-socket", "double-socket"], at)).toMatchObject({ ok: false, error: expect.stringContaining("nejvýš 5") });
    expect(placeAssembly(draft(), ["socket", "ceiling-light"], at)).toMatchObject({ ok: false, error: expect.stringContaining("Stropní svítidlo") });
    expect(assemblyError(["double-socket", "double-socket", "socket"])).toBeNull();
    expect(assemblyLabel(["switch-1", "socket", "socket"])).toBe("Vypínač č. 1 + 2× Jednozásuvka");
  });

  it("hotové sestavy podle úrovně instalace: vypínače 230 V jen klasicky, sběrnicová tlačítka jen na sběrnici", () => {
    for (const assembly of FRAME_ASSEMBLIES) expect(assemblyError(assembly.members)).toBeNull();
    const classic = assembliesFor("classic").map((assembly) => assembly.id);
    expect(classic).toEqual(expect.arrayContaining(["set-2z", "set-3z", "set-4z", "set-2s1", "set-s1-z-v", "set-z-rj", "set-tv", "set-bed"]));
    expect(classic).not.toContain("set-b2-z");
    const bus = assembliesFor("bus_loxone").map((assembly) => assembly.id);
    expect(bus).toEqual(expect.arrayContaining(["set-2z", "set-b2-z"]));
    expect(bus).not.toContain("set-2s1");
    expect(frameableItems("bus_loxone").map((item) => item.id)).not.toContain("bus-presence");
    expect(frameableItems("smart_retrofit").map((item) => item.id)).not.toContain("wireless-1");
  });
});

describe("fáze 62 – ▦+ přidání přístroje do rámečku a stabilní poloha rámečku", () => {
  it("zásuvka → 2R → 3R: kotva drží místo, nový přístroj přisazený na konec; plný rámeček (5R) další nepřijme", () => {
    const base: FloorplanDraft = { ...emptyDraft(), elements: [el("z1", "socket", 1000, 0), el("l1", "ceiling-light", 0, 2000)] };
    const pitch = framePitch(base, { scale: null });
    const two = addToFrame(base, "z1", "socket", "z2");
    expect(two.ok).toBe(true);
    if (!two.ok) return;
    expect(two.draft.frames[0].members).toEqual(["z1", "z2"]);
    expect(byId(two.draft, "z1").x).toBe(1000);
    near(byId(two.draft, "z2").x, 1000 + pitch);
    const three = addToFrame(two.draft, "z1", "switch-1", "s1");
    expect(three.ok).toBe(true);
    if (!three.ok) return;
    expect(three.draft.frames).toHaveLength(1);
    expect(three.draft.frames[0].members).toEqual(["z1", "z2", "s1"]);
    expect(three.gangs).toBe(3);
    const five = addToFrame(three.draft, "z2", "double-socket", "d1");
    expect(five.ok && five.gangs).toBe(5);
    if (!five.ok) return;
    expect(addToFrame(five.draft, "z1", "socket", "z9")).toMatchObject({ ok: false, error: expect.stringContaining("nejvýš 5") });
    expect(addToFrame(base, "l1", "socket")).toMatchObject({ ok: false, error: expect.stringContaining("Stropní svítidlo") });
  });

  it("dvojzásuvka jako kotva: rámeček se při otáčení ani při posunu v rámečku neposouvá", () => {
    const base: FloorplanDraft = { ...emptyDraft(), elements: [el("d1", "double-socket", 1000, 0), el("z1", "socket", 1600, 0)] };
    const framed = createFrame(base, ["d1", "z1"]);
    expect(framed.ok).toBe(true);
    if (!framed.ok) return;
    expect(byId(framed.draft, "d1").x).toBe(1000);
    const positions = (draft: FloorplanDraft) => draft.elements.map((element) => [element.id, element.x, element.y, element.rotation]);
    let turned = framed.draft;
    for (let index = 0; index < 4; index++) turned = rotateFrame(turned, framed.frameId);
    expect(positions(turned)).toEqual(positions(framed.draft));
    // Výměna pořadí: začátek rámečku zůstává (první pozice dvojzásuvky = první pozice jednozásuvky)
    const pitch = framePitch(base, { scale: null });
    const swapped = moveInFrame(framed.draft, "z1", -1);
    near(byId(swapped, "z1").x, 1000 - pitch / 2);
    const back = moveInFrame(swapped, "z1", 1);
    expect(positions(back)).toEqual(positions(framed.draft));
  });
});
