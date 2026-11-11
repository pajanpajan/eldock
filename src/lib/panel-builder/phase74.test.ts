import { describe, expect, it } from "vitest";

import { MAIN_BOARD, buildSwitchboardFromCircuits, circuitDesignations } from "@/engine/floorplan-bridge";

import { assignBoard, boardDesignation, boardsOf, nextBoardCode, releaseBoard } from "./boards";
import { analyzeDraft, applyAppearance, circuitsOfBoard, emptyDraft, parseDraft, type EditorElement, type EditorRoom, type FloorplanDraft } from "./floorplan-editor";
import { floorplanNorms } from "./floorplan-norms";
import { compileFloorplanBom } from "./wiring-bom";
import { colorCodeFor } from "./wiring-designs";

const el = (id: string, item: string, x: number, y: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Obývák", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
const room = (name: string, x: number, y: number, w: number, h: number): EditorRoom => ({ id: `m-${name}`, name, x, y, w, h });

/** Přízemí s hlavním rozváděčem a garáž s podružným rozváděčem RP1 (vlastní zásuvky, světlo a spotřebič). */
function house(): FloorplanDraft {
  return {
    ...emptyDraft(),
    rooms: [room("Obývák", 0, 0, 6000, 4000), room("Garáž", 6000, 0, 5000, 4000)],
    elements: [
      el("rh", "panel", 300, 2000),
      el("z1", "socket", 2000, 0),
      el("z2", "double-socket", 4000, 4000),
      el("l1", "ceiling-light", 3000, 2000),
      el("rp", "subpanel", 10_700, 2000, { room: "Garáž", boardCode: "RP1", board: "RH" }),
      el("g1", "socket", 8000, 0, { room: "Garáž", board: "RP1" }),
      el("g2", "socket", 9000, 4000, { room: "Garáž", board: "RP1" }),
      el("gl", "ceiling-light", 8500, 2000, { room: "Garáž", board: "RP1" }),
      el("wb", "wallbox", 10_900, 3500, { room: "Garáž", board: "RP1" }),
      el("d1", "data-socket", 5000, 0),
    ],
  };
}

describe("fáze 74 – podružný rozváděč, okruhy po rozváděčích a datové trasy", () => {
  it("rozváděče nákresu, kód nového podružného rozváděče a doplnění chybějícího kódu při načtení", () => {
    const draft = house();
    expect(boardsOf(draft).map((board) => board.code)).toEqual(["RH", "RP1"]);
    expect(nextBoardCode(draft)).toBe("RP2");
    // Uložený podružný rozváděč bez kódu (nebo s duplicitním) dostane první volný kód
    const parsed = parseDraft({ ...draft, elements: [...draft.elements, el("rp2", "subpanel", 5000, 3800), el("rp3", "subpanel", 5500, 3800, { boardCode: "RP1" })] })!;
    expect(boardsOf(parsed).map((board) => board.code)).toEqual(["RH", "RP1", "RP2", "RP3"]);
    // Ruční přiřazení se uloží jen u elektrických prvků, ne u rozváděče
    expect(parsed.elements.find((element) => element.id === "rp")?.board).toBeUndefined();
    expect(parsed.elements.find((element) => element.id === "g1")?.board).toBe("RP1");
  });

  it("okruhy podružného rozváděče se navrhují zvlášť a vlastní číslování; hlavní rozváděč dostane přívod 3P bez chrániče", () => {
    const { circuits, build } = analyzeDraft(house());
    const rp = circuitsOfBoard(circuits, "RP1");
    const rh = circuitsOfBoard(circuits, MAIN_BOARD);
    // Garáž: zásuvky, světlo a wallbox jen v RP1, nikdy ve společném okruhu s obývákem
    expect(rp.some((circuit) => circuit.kind === "sockets" && circuit.nodeIds.every((id) => id.startsWith("g")))).toBe(true);
    expect(rp.some((circuit) => circuit.tag === "ev_charger")).toBe(true);
    expect(rh.every((circuit) => circuit.nodeIds.every((id) => !id.startsWith("g") && id !== "wb"))).toBe(true);
    expect(rp.every((circuit) => circuit.id.startsWith("RP1."))).toBe(true);
    // Podružný rozváděč stačí s jedním světelným okruhem (dva okruhy má byt v hlavním rozváděči)
    expect(rp.filter((circuit) => circuit.kind === "lighting")).toHaveLength(1);
    // Přívod: v RH, 3P, bez chrániče 30 mA, napájí RP1 a vede k jeho uzlu trasy
    const feeder = rh.find((circuit) => circuit.kind === "feeder")!;
    expect(feeder).toMatchObject({ feeds: "RP1", rcd: "none", phases: 3, protection: { device: "MCB", poles: "3P" } });
    expect(feeder.nodeIds).toEqual(["board-RP1"]);
    expect(feeder.cable).toMatch(/^CYKY-J 5x/);
    expect(feeder.protection.ratedA).toBeGreaterThanOrEqual(16);
    expect(build.boards.find((board) => board.code === "RP1")?.feederLengthMm).toBeGreaterThan(9000);
    // Okruhy RP1 počítají s úbytkem na přívodu
    expect(rp.every((circuit) => circuit.upstreamDropPct === feeder.voltageDropPct)).toBe(true);
    // Označení jističů: každý rozváděč od -F1 / -FA1
    const designations = circuitDesignations(circuits.circuits);
    const rpDesignations = rp.map((circuit) => designations[circuit.id]);
    expect(rpDesignations.some((value) => value === "-F1" || value === "-FA1")).toBe(true);
    expect(designations[feeder.id]).toMatch(/^-F\d+$/);
    expect(boardDesignation("RP1", "-F2", true)).toBe("RP1 -F2");
    expect(boardDesignation(MAIN_BOARD, "-F2", false)).toBe("-F2");
  });

  it("trasy okruhů RP1 vycházejí z RP1, přívod z RH; datová zásuvka má vlastní trasu z rozváděče", () => {
    const { circuits, summary } = analyzeDraft(house());
    const rp = new Set(circuitsOfBoard(circuits, "RP1").map((circuit) => circuit.id));
    for (const row of summary.circuits.filter((circuit) => rp.has(circuit.id))) expect(row.route.segments[0].from).toBe("panel-RP1");
    const feeder = summary.circuits.find((row) => row.id === "feeder-RP1")!;
    expect(feeder.route.segments[0]).toMatchObject({ from: "panel", to: "board-RP1" });
    expect(feeder.route.segments[0].points?.length).toBeGreaterThanOrEqual(2);
    expect(summary.dataRuns).toHaveLength(1);
    expect(summary.dataRuns[0]).toMatchObject({ nodeId: "d1", board: "RH" });
    expect(summary.dataRuns[0].route.segments[0].points?.length).toBeGreaterThanOrEqual(2);
    expect(summary.byCable.some((row) => row.cable === "UTP Cat6" && row.meters > 0)).toBe(true);
  });

  it("automaticky: podlaží s podružným rozváděčem bez hlavního → podružný; ruční přiřazení jde zrušit", () => {
    const draft = house();
    // Bez ručního přiřazení jsou prvky garáže na podlaží s hlavním rozváděčem → RH
    const auto = assignBoard(draft, ["g1", "g2", "gl", "wb"], null);
    expect(circuitsOfBoard(analyzeDraft(auto).circuits, "RP1")).toHaveLength(0);
    // 2. NP s podružným rozváděčem a bez hlavního → vše na RP2
    const upstairs: FloorplanDraft = {
      ...auto,
      otherFloors: [
        {
          id: "f2",
          name: "2. NP",
          levelMm: 3000,
          background: null,
          cad: null,
          calibration: auto.calibration,
          mmPerPx: 10,
          widthMm: 14_000,
          heightMm: 10_000,
          rooms: [room("Ložnice", 0, 0, 5000, 4000)],
          elements: [el("rp2", "subpanel", 300, 300, { room: "Ložnice", boardCode: "RP2" }), el("s1", "socket", 2000, 0, { room: "Ložnice" }), el("s2", "socket", 4000, 4000, { room: "Ložnice" })],
          frames: [],
          annotations: [],
        },
      ],
    };
    const analysis = analyzeDraft(upstairs);
    expect(circuitsOfBoard(analysis.circuits, "RP2").flatMap((circuit) => circuit.nodeIds).sort()).toEqual(["s1", "s2"]);
    // Přívod RP2 vede přes stoupací vedení (svislý úsek mezi podlažími)
    expect(analysis.build.boards.find((board) => board.code === "RP2")!.feederLengthMm).toBeGreaterThan(3000);
    // Smazaný rozváděč: ruční přiřazení k němu se zruší
    const released = releaseBoard(draft, "RP1");
    expect(released.elements.filter((element) => element.board === "RP1")).toHaveLength(0);
  });

  it("umyvadlo: umývací prostor, pás 0,2 m jen pod 1,2 m a volitelně přísnějších 0,6 m", () => {
    // Umyvadlo 600 × 450 u horní stěny: průmět x 700–1300, pás do x 1500
    const base: FloorplanDraft = {
      ...emptyDraft(),
      rooms: [room("Koupelna", 0, 0, 3000, 2500)],
      elements: [
        el("rh", "panel", 2900, 2400, { room: "Koupelna" }),
        el("u", "basin", 1000, 225, { room: "Koupelna" }),
        el("nad", "ip44-socket", 1100, 0, { room: "Koupelna" }),
        // Fáze 90: pás 0,2 m pod 1,2 m hlídá jen přístroje bez krytí IP44 – vedle klasická zásuvka, vedle44 v IP44
        el("vedle", "socket", 1400, 0, { room: "Koupelna" }),
        el("vedle44", "ip44-socket", 1400, 0, { room: "Koupelna" }),
        el("vys", "ip44-socket", 1400, 0, { room: "Koupelna", mountHeightMm: 1250 }),
        el("dal", "ip44-socket", 1700, 0, { room: "Koupelna" }),
      ],
    };
    const issues = floorplanNorms(base);
    expect(issues.find((issue) => issue.rule === "basin-area")?.elementIds).toEqual(["nad"]);
    // 10 cm od průmětu ve výšce zásuvky (pod 1,2 m) = chyba bez krytí IP44, ve výšce 1,25 m smí být těsně u hranice
    expect(issues.find((issue) => issue.rule === "basin-band")?.elementIds).toEqual(["vedle"]);
    expect(issues.find((issue) => issue.rule === "basin-band")?.text).toContain("Jednozásuvka (výška 300 mm)");
    expect(issues.some((issue) => issue.rule === "basin-strict")).toBe(false);
    // Přísnější zásada 0,6 m: zásuvka 40 cm od hrany umyvadla = upozornění (ne chyba)
    const strict = floorplanNorms({ ...base, basinZone: "strict" });
    const warning = strict.find((issue) => issue.rule === "basin-strict");
    expect(warning?.level).toBe("warning");
    expect(warning?.elementIds).toEqual(expect.arrayContaining(["dal", "vys"]));
    // Prvek nad 2,25 m (mimo výšku umývacího prostoru) se nehlásí
    expect(floorplanNorms({ ...base, elements: base.elements.map((element) => (element.id === "nad" ? { ...element, mountHeightMm: 2300 } : element)) }).some((issue) => issue.rule === "basin-area")).toBe(false);
    expect(parseDraft({ ...base, basinZone: "strict" })?.basinZone).toBe("strict");
    expect(parseDraft({ ...base, basinZone: "nic" })?.basinZone).toBe("norm");
  });

  it("barva rámečku a klapky zvlášť: objednací čísla rámečků s kódem rámečku, kryty a zásuvky s kódem klapky", () => {
    // Tango: černá klapka (N) v bílém rámečku (B)
    const draft: FloorplanDraft = { ...emptyDraft(), series: "ABB|Tango", color: "abb-tango-n", frameColor: "abb-tango-b", elements: [el("z", "socket", 1000, 0), el("s", "switch-1", 2000, 0)] };
    const bom = compileFloorplanBom(draft);
    const frames = bom.filter((row) => row.category === "Rámečky");
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((row) => row.mpn?.endsWith(" B"))).toBe(true);
    expect(bom.filter((row) => row.category === "Zásuvky" || row.category === "Kryty spínačů").every((row) => !row.mpn || row.mpn.endsWith(" N"))).toBe(true);
    expect(frames[0].appearance).toBe("ABB Tango · rámeček Bílá (B) · klapka Černá (N)");
    // Bez barvy rámečku zůstává dosavadní jedna barva
    expect(compileFloorplanBom({ ...draft, frameColor: null }).find((row) => row.category === "Rámečky")?.mpn).toMatch(/ N$/);
    // Vlastní barva rámečku prvku má přednost, „Použít na celý půdorys“ ji zruší
    const own = { ...draft, elements: draft.elements.map((element) => (element.id === "z" ? { ...element, frameColor: "abb-tango-n" } : element)) };
    expect(compileFloorplanBom(own).some((row) => row.category === "Rámečky" && row.mpn?.endsWith(" N"))).toBe(true);
    expect(applyAppearance(own).elements.every((element) => element.frameColor === undefined)).toBe(true);
    expect(colorCodeFor("241/141", "frame")).toEqual({ code: "241", split: true });
    expect(colorCodeFor("241/141", "insert")).toEqual({ code: "141", split: true });
    expect(colorCodeFor("N", "insert")).toEqual({ code: "N", split: false });
    // Načtení: neplatná barva rámečku se zahodí
    expect(parseDraft({ ...draft, frameColor: "neexistuje" })?.frameColor).toBeNull();
  });

  it("generátor rozváděče: přívod podružného rozváděče je jistič 3P za hlavním vypínačem, mimo chrániče", () => {
    const { circuits } = analyzeDraft(house());
    const board = buildSwitchboardFromCircuits({ circuits: circuitsOfBoard(circuits, MAIN_BOARD), io: circuits.io, bom: circuits.bom }, { mode: "classic", enclosures: [] });
    const feeder = board.devices.find((device) => device.circuitId === "feeder-RP1")!;
    expect(feeder).toMatchObject({ category: "MCB", poles: "3P", parentKey: "main" });
    expect(board.rcdGroups.some((group) => group.circuitIds.includes("feeder-RP1"))).toBe(false);
    // Číslování přístroje sedí s označením okruhu v půdorysu
    expect(feeder.designation).toBe(circuitDesignations(circuitsOfBoard(circuits, MAIN_BOARD))["feeder-RP1"]);
  });
});
