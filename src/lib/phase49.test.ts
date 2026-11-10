import { describe, expect, it } from "vitest";

import { analyzeDraft, buildPlan, emptyDraft, parseDraft, parseLength, recalibrate, roomAt, switchingFor, type EditorElement } from "@/lib/panel-builder/floorplan-editor";
import { pickWiringDevice, type PickableDevice } from "@/lib/panel-builder/wiring-picker";

const el = (id: string, item: string, x: number, y: number, room = "Obývák", patch: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], ...patch }) as EditorElement;

describe("2D editor půdorysu – model nákresu", () => {
  it("kalibrace na 2 kliky: délka z textu a přepočet měřítka i prvků", () => {
    expect(parseLength("4500 mm")).toBe(4500);
    expect(parseLength("4,5 m")).toBe(4500);
    expect(parseLength("4.5")).toBe(4500);
    expect(parseLength("450 cm")).toBe(4500);
    expect(parseLength("x")).toBeNull();
    const draft = { ...emptyDraft(), mmPerPx: 10, elements: [el("a", "socket", 1000, 2000)] };
    const calibrated = recalibrate(draft, 3000, 4500);
    expect(calibrated.mmPerPx).toBe(15);
    expect(calibrated.elements[0]).toMatchObject({ x: 1500, y: 3000 });
    // Fáze 83: výchozí čistý rastr 20 m → po kalibraci 1,5× = 30 m
    expect(calibrated.widthMm).toBe(30_000);
  });

  it("načtení nákresu odfiltruje neplatné prvky a cizí URL podkladu", () => {
    const parsed = parseDraft({ ...emptyDraft(), background: { url: "https://evil.example/x.png", widthPx: 10, heightPx: 10 }, elements: [el("a", "socket", 0, 0), { ...el("b", "neznamy", 0, 0) }, el("c", "socket", 0, 0, " ", { frameUnits: 9 })] });
    expect(parsed?.background).toBeNull();
    expect(parsed?.elements.map((element) => element.id)).toEqual(["a", "c"]);
    expect(parsed?.elements[1]).toMatchObject({ room: "Místnost", frameUnits: 5 });
    expect(parseDraft({ version: 2 })).toBeNull();
  });

  it("řazení podle počtu ovládacích míst a místnost podle obdélníku", () => {
    expect([1, 2, 3, 4].map(switchingFor)).toEqual(["1", "6 + 6", "6 + 6 + 1× 7", "6 + 6 + 2× 7"]);
    const rooms = [{ id: "a", name: "Byt", x: 0, y: 0, w: 10_000, h: 10_000 }, { id: "b", name: "Koupelna", x: 1000, y: 1000, w: 2000, h: 2000 }];
    expect(roomAt(rooms, 1500, 1500)?.name).toBe("Koupelna");
    expect(roomAt(rooms, 8000, 8000)?.name).toBe("Byt");
    expect(roomAt(rooms, 20_000, 0)).toBeNull();
  });

  it("vícenásobný rámeček = víc uzlů ve stejné krabici; párování vypínačů určuje ovládání místnosti", () => {
    const draft = {
      ...emptyDraft(),
      elements: [el("rh", "panel", 0, 0, "Chodba"), el("z", "double-socket", 3000, 0, "Obývák", { frameUnits: 3 }), el("l", "ceiling-light", 4000, 2000), el("s1", "switch-6", 1000, 0, "Obývák", { controls: ["l"] }), el("s2", "switch-6", 6000, 0, "Obývák", { controls: ["l"] })],
    };
    const build = buildPlan(draft);
    expect(build.plan.nodes.filter((node) => node.kind === "double_socket").map((node) => node.frame)).toEqual(["z", "z", "z"]);
    expect(build.plan.rooms.find((room) => room.name === "Obývák")?.lighting).toEqual({ groups: 1, switchCount: 2 });
    expect(build.switchLinks).toHaveLength(2);
    const { summary } = analyzeDraft(draft);
    expect(summary.byCable.map((row) => row.cable)).toContain("CYKY-O 3×1,5");
    expect(() => buildPlan({ ...draft, elements: draft.elements.slice(1) })).toThrow(/rozváděč/);
  });

  it("režim vedení z nákresu mění zvolené trasy; zásuvka nad linkou jde vrchem", () => {
    const draft = { ...emptyDraft(), elements: [el("rh", "panel", 0, 0), el("k", "worktop-socket", 4000, 0, "Kuchyně"), el("z", "socket", 0, 4000)] };
    const optimized = analyzeDraft(draft).summary;
    expect(optimized.circuits.every((row) => row.ok)).toBe(true);
    const bottom = analyzeDraft({ ...draft, mode: "BOTTOM" }).summary;
    expect(bottom.circuits.every((row) => row.routing === "BOTTOM")).toBe(true);
    expect(optimized.totals).toEqual(bottom.totals);
  });
});

describe("výběr domovního přístroje z řady", () => {
  const device = (id: string, category: string, title: string, features: Record<string, unknown> = {}, frameUnits: number | null = null): PickableDevice => ({ id, manufacturer: "ABB", series: "Levit", category, title, frameUnits, ipRating: null, featuresJson: JSON.stringify(features) });
  const devices = [
    device("usb", "WD_SOCKET", "ABB Levit zásuvka s USB nabíječkou"),
    device("z-ivory", "WD_SOCKET", "ABB Levit zásuvka slonová kost", { wd_color_family: "ivory" }),
    device("z-white", "WD_SOCKET", "ABB Levit zásuvka bílá", { wd_color_family: "white" }),
    device("dz", "WD_SOCKET", "ABB Levit dvojzásuvka bílá", { wd_color_family: "white" }),
    device("z44", "WD_SOCKET", "ABB Levit zásuvka IP44 bílá", { wd_color_family: "white", wd_ip: "IP44" }),
    device("s6", "WD_SWITCH", "ABB Levit vypínač č.6 bílá", { wd_switch_no: "6", wd_color_family: "white" }),
    device("r2", "WD_FRAME", "ABB Levit rámeček 2násobný bílá", { wd_color_family: "white" }, 2),
  ];

  it("zásuvka / dvojzásuvka / IP44, vypínač podle řazení a rámeček podle počtu míst; bílá má přednost", () => {
    expect(pickWiringDevice(devices, { kind: "socket" })?.id).toBe("z-white");
    expect(pickWiringDevice(devices, { kind: "socket", double: true })?.id).toBe("dz");
    expect(pickWiringDevice(devices, { kind: "socket", ip44: true })?.id).toBe("z44");
    expect(pickWiringDevice(devices, { kind: "switch", switchNo: "6" })?.id).toBe("s6");
    expect(pickWiringDevice(devices, { kind: "switch", switchNo: "7" })).toBeNull();
    expect(pickWiringDevice(devices, { kind: "frame", units: 2 })?.id).toBe("r2");
  });
});
