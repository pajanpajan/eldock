import { describe, expect, it } from "vitest";

import { emptyDraft, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { deviceCounts, liveChecklist, plural } from "./floorplan-live-checklist";
import { panelChecklist } from "./panel-live-checklist";
import { trainerJob } from "./panel-trainer-presets";

// Fáze 92: živý samoodškrtávací tahák vlastní zakázky (2D půdorys) a tahák rozváděče (AI Panel Builder)

const el = (id: string, item: string, patch: Partial<EditorElement> = {}): EditorElement => ({ id, item, x: 1500, y: 1500, room: "Pokoj", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...patch });
const check = (draft: FloorplanDraft, generated = false) => liveChecklist(draft, { seriesLabel: "ABB Levit M · Bílá", generated, boxMaker: "KOPOS" });

describe("fáze 92 / 98 – tahák zakázky ve 2D půdorysu (5 fází průvodce)", () => {
  it("nový půdorys: body = fáze 1–5, aktuální je půdorys a místnosti", () => {
    const result = check(emptyDraft());
    expect(result.items.map((item) => [item.id, item.phase, item.ok])).toEqual([
      ["base", 1, false],
      ["panel", 2, false],
      ["sockets", 3, false],
      ["lights", 4, false],
      ["output", 5, false],
    ]);
    expect(result.items.map((item) => item.label)).toEqual(["1. Půdorys a místnosti", "2. Rozváděč, okna, dveře a nábytek", "3. Zásuvkové okruhy a spotřebiče", "4. Světla, vypínače a Smart Home", "5. Kontrola, Kusovník a Rozváděč"]);
    expect(result).toMatchObject({ done: 0, current: "base" });
  });

  it("odškrtává se samo: místnost nebo zkalibrovaný podklad, rozváděč RH, zásuvky a spotřebiče, světla s řadou, vygenerovaný rozváděč", () => {
    const rooms = { ...emptyDraft(), rooms: [{ id: "r1", name: "Pokoj", x: 1000, y: 1000, w: 4000, h: 3000 }] };
    expect(check(rooms)).toMatchObject({ done: 1, current: "panel" });
    const underlay = { ...emptyDraft(), background: { src: "/x.png" } as never, calibration: { ...emptyDraft().calibration, state: "set" as const } };
    expect(check(underlay).items[0].ok).toBe(true);
    expect(check({ ...emptyDraft(), background: { src: "/x.png" } as never }).items[0].ok).toBe(false);
    const full = { ...rooms, elements: [el("rh", "panel"), el("z1", "double-socket"), el("z2", "socket"), el("l1", "ceiling-light"), el("tr", "oven")] };
    const result = check(full);
    expect(result).toMatchObject({ done: 4, current: "output" });
    expect(result.items.find((item) => item.id === "sockets")?.detail).toBe("2 zásuvky · 1 spotřebič");
    expect(result.items.find((item) => item.id === "lights")?.detail).toBe("ABB Levit M · Bílá · 1 světlo · 0 ovladačů");
    expect(check(full, true)).toMatchObject({ done: 5, current: null });
    expect(deviceCounts(full)).toMatchObject({ sockets: 2, lights: 1, appliances: 1, rooms: 1, panel: true });
    expect(plural(14, "zásuvka", "zásuvky", "zásuvek")).toBe("14 zásuvek");
  });
});

describe("fáze 92 – tahák rozváděče", () => {
  const state = { lintIssues: 1, lintFirst: "Okruh Wallbox…", connected: true, enclosure: "ABB Mistral41W 96M", thermalOk: true, thermalTempC: 31.2 };
  it("bod 1 čeká na opravu Elektro-linteru, oteplení se odškrtne až po otevření kroku 4, elaborát po tisku", () => {
    const job = trainerJob("rd-fve");
    const rows = panelChecklist(state, {}, job);
    expect(rows.map((row) => [row.key, row.ok])).toEqual([
      ["recognition", false],
      ["tree", true],
      ["enclosure", true],
      ["thermal", false],
      ["documentation", false],
    ]);
    expect(rows[0].task).toMatch(/Opravit 1 klikem/);
    expect(rows[0].detail).toMatch(/^1 nález/);
    const done = panelChecklist({ ...state, lintIssues: 0, lintFirst: null }, { thermal: true, printed: true }, job);
    expect(done.every((row) => row.ok)).toBe(true);
    expect(done[3].detail).toBe("Vyhovuje (31,2 °C ve skříni)");
    // Vlastní zakázka bez úkolů trenažéru
    expect(panelChecklist(state, {}, null).every((row) => row.task === null)).toBe(true);
  });
});
