import { describe, expect, it } from "vitest";

import { emptyDraft, parseDraft, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { applyNormFix, floorplanNorms } from "./floorplan-norms";
import { MOUNTING_BOXES, boxNeed, compileBoxUsage, pickBox, resolveBox } from "./mounting-boxes-catalog";
import { bomBoxRows, bomTable, compileFloorplanBom } from "./wiring-bom";

// Fáze 91: instalační krabice – katalog výrobců, potřebná hloubka u prvku, hlídač hloubky a souhrn do kusovníku

const el = (id: string, item: string, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x: 1000, y: 1000, room: "Obývací pokoj", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
const drawing = (elements: EditorElement[], extra: Partial<FloorplanDraft> = {}): FloorplanDraft => ({ ...emptyDraft(), elements, ...extra });

describe("fáze 91 – potřebná hloubka instalační krabice", () => {
  it("stmívač, termostat a datová zásuvka chtějí hlubokou krabici KPR 68 (zdivo) / KPR 68/71L (SDK)", () => {
    for (const item of ["dimmer", "thermostat", "data-socket", "usb-socket", "surge-socket"]) {
      const draft = drawing([el("x", item)]);
      expect(boxNeed(draft, draft.elements[0])).toMatchObject({ kind: "deep", minDepthMm: 66 });
      expect(resolveBox(draft, draft.elements[0]).box?.code).toBe("KPR 68_KA");
      const sdk = drawing([el("x", item)], { wallType: "drywall" });
      expect(resolveBox(sdk, sdk.elements[0]).box?.code).toBe("KPR 68/71L_NA");
    }
  });

  it("vypínač v klasické instalaci = hluboká krabice kvůli WAGO svorkám, koncová zásuvka mělká KU 68-45, rozbočovací hluboká", () => {
    const draft = drawing([el("s", "switch-1"), el("z", "socket")]);
    expect(boxNeed(draft, draft.elements[0]).reasons).toContain("WAGO svorky pro rozbočení ke svítidlům za strojkem");
    expect(resolveBox(draft, draft.elements[1]).box).toMatchObject({ type: "KU 68-45", depthMm: 45 });
    expect(boxNeed(draft, draft.elements[1], { cableEnds: 2 }).kind).toBe("shallow");
    expect(boxNeed(draft, draft.elements[1], { cableEnds: 3 })).toMatchObject({ kind: "deep", reasons: ["rozbočení – v krabici končí 3 kabely"] });
  });

  it("bezdrátový aktor do krabičky a modul pod vypínač = krabice s prostorem pro elektroniku (KOPOS 70 mm, Kaiser Electronic-Dose)", () => {
    const actor = drawing([el("a", "bus-1", { product: "fah-wl-act-1" })], { installation: "bus_loxone" });
    expect(boxNeed(actor, actor.elements[0])).toMatchObject({ kind: "electronics", minDepthMm: 66 });
    expect(resolveBox(actor, actor.elements[0]).box?.code).toBe("KPR 68-70_KA");
    const kaiser = { ...actor, boxMaker: "kaiser" as const };
    expect(resolveBox(kaiser, kaiser.elements[0]).box).toMatchObject({ code: "1068-05", type: "Electronic-Dose UP¹" });
    const retrofit = drawing([el("l", "ceiling-light"), el("s", "switch-1", { controls: ["l"] })], { installation: "smart_retrofit" });
    expect(boxNeed(retrofit, retrofit.elements[1]).kind).toBe("electronics");
  });

  it("nástěnné řady, místnost s nástěnnou montáží a bezdrátové tlačítko bez krabice; fasáda ETICS = KEZ / MDZ", () => {
    const garant = drawing([el("z", "socket")], { series: "ABB|Garant (IP44)", color: "abb-garant-bila" });
    expect(resolveBox(garant, garant.elements[0]).kind).toBe("surface");
    const outdoor = drawing([el("z", "socket", { room: "Terasa" })], { rooms: [{ id: "t", name: "Terasa", x: 0, y: 0, w: 3000, h: 3000, wallType: "surface" }] });
    expect(resolveBox(outdoor, outdoor.elements[0]).kind).toBe("surface");
    const wireless = drawing([el("w", "wireless-1")], { installation: "smart_retrofit" });
    expect(resolveBox(wireless, wireless.elements[0]).kind).toBe("none");
    const facade = drawing([el("z", "ip44-socket", { room: "Fasáda" }), el("l", "wall-light", { room: "Fasáda" })], { rooms: [{ id: "f", name: "Fasáda", x: 0, y: 0, w: 3000, h: 3000, wallType: "etics" }] });
    const usage = compileBoxUsage(facade);
    expect(usage.map((line) => line.box?.code)).toEqual(expect.arrayContaining(["KEZ_KB", "MDZ_KB"]));
  });
});

describe("fáze 91 – hlídač hloubky krabičky", () => {
  it("ruční mělká 45 mm krabice u stmívače → varování s doporučením a opravou jedním klikem", () => {
    const draft = drawing([el("d", "dimmer", { box: "shallow" })]);
    const resolved = resolveBox(draft, draft.elements[0]);
    expect(resolved).toMatchObject({ kind: "shallow", tooShallow: true });
    const issue = floorplanNorms(draft).find((candidate) => candidate.rule === "box-depth");
    expect(issue?.level).toBe("warning");
    expect(issue?.text).toContain("Nedostatečná hloubka krabičky u Stmívač v místnosti Obývací pokoj: zvolena krabice 45 mm (KOPOS Kolín KU 68-45)");
    expect(issue?.text).toContain("vyžaduje min. 66 mm! Doporučujeme hlubokou krabici KOPOS Kolín KPR 68 (do zdiva) nebo KPR 68/71L (do sádrokartonu / dutých příček).");
    expect(issue?.fix?.label).toBe("Opravit na hlubokou krabici (1 klik)");
    const fixed = applyNormFix(draft, issue!);
    expect(fixed.elements[0].box).toBeUndefined();
    expect(resolveBox(fixed, fixed.elements[0]).box?.code).toBe("KPR 68_KA");
    expect(floorplanNorms(fixed).some((candidate) => candidate.rule === "box-depth")).toBe(false);
  });

  it("mělká krabice u aktoru do krabičky → oprava na krabici s prostorem pro elektroniku; hlubší ruční volba nevaruje", () => {
    const actor = drawing([el("a", "bus-1", { product: "fah-wl-act-1", box: "shallow" })], { installation: "bus_loxone" });
    expect(floorplanNorms(actor).find((candidate) => candidate.rule === "box-depth")?.fix?.label).toBe("Opravit na krabici s prostorem pro elektroniku (1 klik)");
    const deeper = drawing([el("z", "socket", { box: "deep" })]);
    expect(resolveBox(deeper, deeper.elements[0]).tooShallow).toBe(false);
    expect(floorplanNorms(deeper).some((candidate) => candidate.rule === "box-depth")).toBe(false);
  });
});

describe("fáze 91 – katalog krabic a kusovník", () => {
  it("katalog obsahuje jen ověřené typy (bez vymyšlených KUP 68 / KP E68 / KP 64/FD u KOPOS)", () => {
    const kopos = MOUNTING_BOXES.filter((box) => box.maker === "kopos").map((box) => box.type);
    expect(kopos).toEqual(expect.arrayContaining(["KU 68-45", "KPR 68", "KPR 68-70", "KP 64/2", "KP 64/5", "KPL 64-45/LD", "KPR 68/71L", "KPRL 68-70/LD", "KEZ", "MDZ"]));
    for (const invented of ["KUP 68", "KP E68", "KP 64/FD", "KPR 68/L", "KEZ KB"]) expect(kopos).not.toContain(invented);
    for (const box of MOUNTING_BOXES) expect(box.source).toMatch(/^https:\/\//);
    expect(pickBox("obo", "masonry", "electronics")?.code).toBe("2003702");
    expect(pickBox("schneider", "masonry", "deep")).toBeNull();
  });

  it("víceramček 3R zásuvek = jedna KP 64/3, s hlubokou pozicí spojované krabice po 71 mm; tabulka krabic v CSV", () => {
    const sockets = ["a", "b", "c"].map((id, index) => el(id, "socket", { x: 1000 + index * 80 }));
    const triple = drawing(sockets, { frames: [{ id: "r", members: ["a", "b", "c"] }] });
    expect(compileBoxUsage(triple).map((line) => [line.box?.code, line.quantity])).toEqual([["KP 64/3_KA", 1]]);
    const mixed = drawing([el("s", "switch-1", { x: 1000 }), el("z", "socket", { x: 1080 }), el("y", "socket", { x: 1160 })], { frames: [{ id: "r", members: ["s", "z", "y"] }] });
    expect(compileBoxUsage(mixed).map((line) => [line.box?.code, line.quantity])).toEqual([["KPR 68_KA", 1], ["KU 68-45_KA", 2]]);
    const bom = compileFloorplanBom(mixed, { installation: "classic" });
    expect(bomBoxRows(bom).map((row) => row.box)).toEqual(expect.arrayContaining([expect.objectContaining({ maker: "KOPOS Kolín", type: "KPR 68", depthMm: 66 })]));
    const table = bomTable(bom);
    const title = table.findIndex((row) => String(row[0]).startsWith("📦 Doporučené instalační krabičky"));
    expect(title).toBeGreaterThan(0);
    expect(table[title + 1]).toEqual(["Výrobce", "Typové označení", "Objednací kód / katalogové číslo", "Hloubka (mm)", "Určení / prostředí", "Počet ks"]);
  });

  it("nákres si pamatuje výrobce krabic, konstrukci stěn místnosti a ruční volbu krabice", () => {
    const draft = drawing([el("d", "dimmer", { box: "deep" })], { boxMaker: "kaiser", wallType: "drywall", rooms: [{ id: "k", name: "Koupelna", x: 0, y: 0, w: 2000, h: 2000, wallType: "timber" }] });
    const parsed = parseDraft(JSON.parse(JSON.stringify(draft)))!;
    expect(parsed).toMatchObject({ boxMaker: "kaiser", wallType: "drywall" });
    expect(parsed.rooms[0].wallType).toBe("timber");
    expect(parsed.elements[0].box).toBe("deep");
    expect(parseDraft({ ...JSON.parse(JSON.stringify(emptyDraft())), boxMaker: "nic" })?.boxMaker).toBe("kopos");
  });
});
