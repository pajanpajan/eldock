import { describe, expect, it } from "vitest";

import { normalizeCz, parsePlanQuery, removeChip, setBuilding, setTimeframe } from "./inspection-voice-parser";

// 28. 10. 2026: konec měsíce za 3 dny, listopad = dny 4–33, konec roku za 64 dní.
const NOW = new Date("2026-10-28T10:00:00Z");
const parse = (text: string) => parsePlanQuery(text, NOW);
const chips = (text: string) => parse(text).recognizedChips.map((chip) => chip.label);

describe("normalizeCz", () => {
  it("odstraní diakritiku, velká písmena a interpunkci", () => {
    expect(normalizeCz("Nářadí, prodlužováky v Hale A!")).toBe("naradi prodluzovaky v hale a");
  });
});

describe("období", () => {
  it("propadlé / po termínu / expirované → jen propadlé", () => {
    for (const text of ["Propadlé revize", "co je po termínu", "expirované spotřebiče"]) {
      expect(parse(text).timeframe).toMatchObject({ kind: "EXPIRED_ONLY", toDay: -1, includeExpired: true });
    }
  });

  it("tento měsíc včetně propadlých, pokud není řečeno jinak", () => {
    expect(parse("Propadlé a tento měsíc v celém závodě").timeframe).toMatchObject({ kind: "THIS_MONTH", fromDay: null, toDay: 3, includeExpired: true });
    expect(parse("tenhle měsíc").timeframe.includeExpired).toBe(true);
    expect(parse("tento měsíc bez propadlých").timeframe).toMatchObject({ kind: "THIS_MONTH", includeExpired: false, label: "Období: Tento měsíc" });
  });

  it("příští / následující měsíc", () => {
    expect(parse("příští měsíc").timeframe).toMatchObject({ kind: "NEXT_MONTH", fromDay: 4, toDay: 33 });
    expect(parse("následující měsíc").timeframe.kind).toBe("NEXT_MONTH");
  });

  it("názvy měsíců v 1. i 6. pádě", () => {
    expect(parse("v listopadu").timeframe).toMatchObject({ kind: "MONTH", fromDay: 4, toDay: 33, label: "Období: Listopad 2026 (+ propadlé)" });
    expect(parse("prosinec").timeframe).toMatchObject({ fromDay: 34, toDay: 64 });
    expect(parse("v říjnu").timeframe.kind).toBe("THIS_MONTH");
    expect(parse("v září").timeframe.label).toBe("Období: Září 2027 (+ propadlé)");
    expect(parse("červenec").timeframe.label).toContain("Červenec");
    expect(parse("v červnu").timeframe.label).toContain("Červen 2027");
  });

  it("do X dnů / dní, týdnů, do konce roku, tento kvartál", () => {
    expect(parse("do 30 dnů").timeframe).toMatchObject({ kind: "DAYS", toDay: 30, label: "Období: Do 30 dnů (+ propadlé)" });
    expect(parse("do 60 dní").timeframe.toDay).toBe(60);
    expect(parse("během 2 týdnů").timeframe.toDay).toBe(14);
    expect(parse("Rozváděče a stroje do konce roku").timeframe).toMatchObject({ kind: "YEAR_END", toDay: 64 });
    expect(parse("tento kvartál").timeframe).toMatchObject({ kind: "QUARTER_END", toDay: 64 });
  });

  it("bez zmínky období platí výchozí horizont 6 měsíců bez odznaku", () => {
    const query = parse("Spotřebiče v kuchyňkách");
    expect(query.timeframe).toMatchObject({ kind: "DEFAULT", toDay: 183, includeExpired: true });
    expect(query.recognizedChips.some((chip) => chip.key === "timeframe")).toBe(false);
  });
});

describe("kategorie", () => {
  it("kořeny slov bez diakritiky a v různých pádech", () => {
    expect(parse("rozvaděče").types).toEqual(["SWITCHBOARD"]);
    expect(parse("trafostanice").types).toEqual(["TRANSFORMER"]);
    expect(parse("výrobní linky").types).toEqual(["PRODUCTION_LINE"]);
    expect(parse("CNC a lisy").types).toContain("CNC_MACHINE");
    expect(parse("vrtačky a brusky").types).toEqual(["POWER_TOOL"]);
    expect(parse("konvice a mikrovlnky").types).toEqual(["APPLIANCE"]);
    expect(parse("prodlužovací buben").types).toEqual(["EXTENSION_CORD"]);
    expect(parse("svářečky").types).toEqual(["WELDER"]);
    expect(parse("hromosvody").types).toEqual(["LIGHTNING_ROD"]);
    expect(parse("nouzové osvětlení").types).toEqual(["EMERGENCY_LIGHTING"]);
  });

  it("souhrnné pojmy přenosné / pevná zařízení", () => {
    const portable = parse("přenosné spotřebiče a nářadí");
    expect(portable.instrumentGroup).toBe("PORTABLE");
    expect(portable.categories.map((category) => category.key)).toEqual(["portable"]);
    expect(portable.types).toEqual(["POWER_TOOL", "APPLIANCE", "EXTENSION_CORD", "WELDER"]);
    const fixed = parse("pevná zařízení / VTZ");
    expect(fixed.instrumentGroup).toBe("FIXED");
    expect(fixed.types).toEqual(expect.arrayContaining(["SWITCHBOARD", "PRODUCTION_LINE", "MACHINE"]));
  });

  it("název měsíce „listopad“ není lis", () => {
    expect(parse("v listopadu").types).toEqual([]);
  });
});

describe("lokace", () => {
  it("budovy, patra a zóny", () => {
    const query = parse("Nářadí v Hale A, 1. NP, dílna");
    expect(query.buildingQuery).toEqual([{ label: "Hala A", match: "hala a" }]);
    expect(query.floorQuery).toEqual([{ label: "1. NP", match: "1NP" }]);
    expect(query.zoneQuery).toEqual([{ label: "Dílna", match: "diln" }]);
    expect(parse("Energetika suterén").floorQuery[0].match).toBe("1PP");
    expect(parse("v přízemí").floorQuery[0].match).toBe("1NP");
    expect(parse("2.NP administrativa").floorQuery[0].match).toBe("2NP");
    expect(parse("v administrativě").buildingQuery[0].label).toBe("Administrativa");
  });

  it("výčet lokací spojkou = buď – nebo, vnořené = obojí", () => {
    expect(parse("Spotřebiče v kuchyňkách a administrativě").locationMode).toBe("ANY");
    expect(parse("dílna v Hale A").locationMode).toBe("ALL");
  });
});

describe("odznaky", () => {
  it("ukázkový povel vrátí čitelné odznaky", () => {
    expect(chips("Nářadí a prodlužováky v Hale A do 30 dnů")).toEqual([
      "Období: Do 30 dnů (+ propadlé)",
      "Lokace: Hala A",
      "Kategorie: Ruční nářadí",
      "Kategorie: Prodlužováky",
    ]);
    expect(chips("Propadlé a tento měsíc v celém závodě")).toEqual(["Období: Tento měsíc (+ propadlé)"]);
  });

  it("odebrání odznaku zruší kritérium", () => {
    let query = parse("Nářadí a prodlužováky v Hale A do 30 dnů");
    query = removeChip(query, "cat:tool", NOW);
    expect(query.types).toEqual(["EXTENSION_CORD"]);
    query = removeChip(query, "building:hala a", NOW);
    expect(query.buildingQuery).toEqual([]);
    query = removeChip(query, "timeframe", NOW);
    expect(query.timeframe.kind).toBe("DEFAULT");
    expect(query.recognizedChips.map((chip) => chip.key)).toEqual(["cat:cord"]);
  });

  it("přepínače období a budovy", () => {
    const query = setBuilding(setTimeframe(parse("nářadí"), "NEXT_MONTH", NOW), { label: "Energetika", match: "energetik" });
    expect(query.timeframe).toMatchObject({ kind: "NEXT_MONTH", includeExpired: false });
    expect(query.recognizedChips.map((chip) => chip.label)).toContain("Lokace: Energetika");
    expect(setTimeframe(query, "LATER", NOW).timeframe).toMatchObject({ fromDay: 34, toDay: 183 });
  });
});
