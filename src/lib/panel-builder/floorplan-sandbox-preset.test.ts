import { describe, expect, it } from "vitest";

import { analyzeDraft, generationChecklist, paletteItem, type EditorElement } from "./floorplan-editor";
import { floorplanNorms } from "./floorplan-norms";
import {
  SANDBOX_BATH_LIGHT_ID,
  SANDBOX_BED_TARGET,
  SANDBOX_MAX_EXTRA_ELEMENTS,
  SANDBOX_ROOMS,
  bathDimmerOf,
  bedSocketOf,
  sandboxDraft,
  sandboxDraftIssue,
  sandboxProgress,
} from "./floorplan-sandbox-preset";
import { displayRoutes } from "./route-display";

// Fáze 92: trenažér 2D půdorysu – z 85 % hotový bungalov 4+kk a tři úkoly se samoodškrtáváním

const bedSocket = (patch: Partial<EditorElement> = {}): EditorElement => ({ id: "novy-1", item: "double-socket", x: SANDBOX_BED_TARGET.x, y: SANDBOX_BED_TARGET.y, room: "Ložnice", mountHeightMm: null, frameUnits: 2, series: null, color: null, controls: [], rotation: 0, scale: null, ...patch });

describe("fáze 92 – rozdělaný bungalov 4+kk", () => {
  it("má místnosti s nábytkem, rozváděč RH, zásuvky, světla a spotřebiče a jde rovnou generovat", () => {
    const draft = sandboxDraft();
    expect(draft.rooms.map((room) => room.name)).toEqual(SANDBOX_ROOMS.map((room) => room.name));
    const items = draft.elements.map((element) => element.item);
    for (const item of ["panel", "arch-bed-double", "arch-kitchen", "bath", "basin", "arch-wc"]) expect(items).toContain(item);
    const kinds = draft.elements.map((element) => paletteItem(element.item)?.kind);
    expect(kinds.filter((kind) => kind === "single_socket" || kind === "double_socket").length).toBeGreaterThanOrEqual(14);
    expect(kinds.filter((kind) => kind === "light").length).toBeGreaterThanOrEqual(10);
    expect(kinds.filter((kind) => kind === "appliance").length).toBeGreaterThanOrEqual(4);
    // Každý prvek leží ve své místnosti
    for (const element of draft.elements) {
      const room = draft.rooms.find((candidate) => candidate.name === element.room)!;
      expect(element.x >= room.x && element.x <= room.x + room.w && element.y >= room.y && element.y <= room.y + room.h, element.id).toBe(true);
    }
    expect(generationChecklist(draft).ready).toBe(true);
    expect(analyzeDraft(draft).circuits.circuits.length).toBeGreaterThan(8);
    // Žádná normová chyba (koupelnové zóny, umyvadlo, krytí) – trenažér začíná v pořádku
    expect(floorplanNorms(draft).filter((issue) => issue.level === "error")).toEqual([]);
    expect(sandboxDraftIssue(draft)).toBeNull();
  });

  it("úkol 1: dvojzásuvka položená ke stěně u postele se odškrtne a kabel k ní vede po stěnách", () => {
    const draft = sandboxDraft();
    expect(sandboxProgress(draft)).toMatchObject({ current: "bed-socket", count: 0 });
    // Daleko od postele se úkol neodškrtne
    expect(bedSocketOf({ elements: [...draft.elements, bedSocket({ x: 8200, y: 3000 })] })).toBeNull();
    const next = { ...draft, elements: [...draft.elements, bedSocket()] };
    expect(bedSocketOf(next)?.id).toBe("novy-1");
    expect(sandboxProgress(next)).toMatchObject({ current: "bath-dimmer", count: 1 });
    // Okruh se zásuvkou má trasu v půdorysu – lomená čára po stěnách (víc než přímka mezi dvěma body)
    const routes = displayRoutes(next, analyzeDraft(next));
    const circuit = routes.circuits.find((candidate) => candidate.elementIds.includes("novy-1"));
    expect(circuit?.legs.some((leg) => leg.to.startsWith("novy-1"))).toBe(true);
    expect(circuit?.legs.some((leg) => leg.points.length > 2)).toBe(true);
  });

  it("úkol 2: stmívatelné svítidlo v koupelně dostane stmívací kanál akčního členu ABB-free@home", () => {
    const draft = sandboxDraft();
    expect(bathDimmerOf(draft)).toBeNull();
    const dimmed = { ...draft, elements: draft.elements.map((element) => (element.id === SANDBOX_BATH_LIGHT_ID ? { ...element, light: { dimmable: true, powerW: 20, load: "led" as const } } : element)) };
    expect(sandboxProgress({ ...dimmed, elements: [...dimmed.elements, bedSocket()] })).toMatchObject({ current: "generate", count: 2 });
    expect(bathDimmerOf(dimmed)).toMatchObject({ typeCode: "DA/M.4.210.2.1" });
    expect(sandboxProgress({ ...dimmed, elements: [...dimmed.elements, bedSocket()] }, true)).toMatchObject({ current: null, count: 3 });
  });

  it("server pustí bez kreditu jen cvičný bungalov (místnosti, podklad, počet prvků)", () => {
    const draft = sandboxDraft();
    expect(sandboxDraftIssue({ ...draft, rooms: draft.rooms.map((room, index) => (index === 0 ? { ...room, w: room.w + 500 } : room)) })).toMatch(/Místnosti cvičného bungalovu/);
    expect(sandboxDraftIssue({ ...draft, rooms: draft.rooms.slice(1) })).toMatch(/Místnosti/);
    expect(sandboxDraftIssue({ ...draft, background: { src: "/x.png", widthPx: 10, heightPx: 10 } as never })).toMatch(/bez vlastního podkladu/);
    // Posun místnosti nevadí (rozměr a název zůstávají)
    expect(sandboxDraftIssue({ ...draft, rooms: draft.rooms.map((room) => ({ ...room, x: room.x + 100 })) })).toBeNull();
    const extra = Array.from({ length: SANDBOX_MAX_EXTRA_ELEMENTS + 1 }, (_, index) => bedSocket({ id: `x${index}` }));
    expect(sandboxDraftIssue({ ...draft, elements: [...draft.elements, ...extra] })).toMatch(/prvků navíc/);
  });
});
