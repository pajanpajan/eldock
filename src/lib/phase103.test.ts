import { describe, expect, it } from "vitest";

import { emptyRoutineTest, routineTestVerdict, ROUTINE_TEST_POINTS } from "./legislation-2027";
import { ROOMS_LOCKED_TEXT, roomsLocked } from "./panel-builder/floorplan-phases";
import { LABEL_PURPOSES, batchRange, dots, labelZpl, qrUrl, sequenceOf, serialCode } from "./qr-label-registry";
import { accessCode, anonymizedTitle, markupSvg, redlineStatusLabel, routeSchema } from "./redline-marketplace";
import { inspectionIssues, inspectionSchema, mergeRoutineTest, nextVersion, snapshotParse, snapshotStringify, versionBadge } from "./switchboard-versions";

// Fáze 103: čisté funkce – verze dokumentace rozváděče, registr QR štítků, Červenky a zámek místností v půdorysu.

const INSPECTION = {
  inspectorName: "Ing. Jan Revizní",
  inspectorCert: "E2A č. 1234/2026",
  measuredAt: "2026-11-12",
  insulationMOhm: 550,
  insulationTestVoltage: 500,
  peContinuityOhm: 0.04,
  loopImpedanceOhm: 0.35,
  shortCircuitKa: 0.66,
  rcdTripCurrentMa: 22,
  rcdTripTimeMs: 18,
  mechanicalOk: true,
  verdict: "SAFE" as const,
  note: "Bez závad.",
};

describe("fáze 103 – verze dokumentace rozváděče", () => {
  it("první uzamčení vydá 1.0, každé další zvýší druhé číslo; neaktuální verze má červený štítek", () => {
    expect(nextVersion([])).toEqual({ major: 1, minor: 0, version: "1.0" });
    expect(nextVersion([{ major: 1, minor: 0 }])).toEqual({ major: 1, minor: 1, version: "1.1" });
    expect(nextVersion([{ major: 1, minor: 0 }, { major: 1, minor: 9 }, { major: 1, minor: 2 }]).version).toBe("1.10");
    expect(versionBadge("1.1", "LOCKED_PUBLISHED")).toBe("Verze 1.1 – AKTUÁLNÍ");
    expect(versionBadge("1.0", "SUPERSEDED", "1.1")).toBe("⚠️ NEAKTUÁLNÍ VERZE (1.0) – NAHRAZENO VERZÍ 1.1");
  });

  it("část revizního technika: vyhovující měření projde, nevyhovující hodnoty a verdikt rozváděč nevydají", () => {
    const ok = inspectionSchema.parse(INSPECTION);
    expect(inspectionIssues(ok)).toEqual([]);
    const bad = inspectionSchema.parse({ ...INSPECTION, insulationMOhm: 0.5, peContinuityOhm: 0.3, rcdTripTimeMs: 320, mechanicalOk: false, verdict: "UNSAFE" });
    expect(inspectionIssues(bad)).toHaveLength(5);
    expect(inspectionSchema.safeParse({ ...INSPECTION, inspectorCert: "" }).success).toBe(false);
    expect(inspectionSchema.safeParse({ ...INSPECTION, insulationTestVoltage: 400 }).success).toBe(false);
  });

  it("měření technika doplní body 11.4, 11.8 a 11.9 protokolu o kusové zkoušce – zbylé body potvrdí výrobce", () => {
    const saved = emptyRoutineTest();
    for (const point of ROUTINE_TEST_POINTS) if (!["protection", "mechanical", "dielectric"].includes(point.id)) saved.points[point.id] = "PASS";
    const merged = mergeRoutineTest(saved, inspectionSchema.parse(INSPECTION));
    expect(merged.points).toMatchObject({ protection: "PASS", mechanical: "PASS", dielectric: "PASS" });
    expect(merged).toMatchObject({ insulationMOhm: 550, testedBy: "Ing. Jan Revizní, E2A č. 1234/2026", testedAt: "2026-11-12" });
    expect(routineTestVerdict(merged).verdict).toBe("PASS");
    expect(routineTestVerdict(mergeRoutineTest(emptyRoutineTest(), inspectionSchema.parse(INSPECTION))).verdict).toBe("INCOMPLETE");
  });

  it("neměnný snímek zachová i nekonečna z výpočtu oteplení (JSON by z nich udělal null)", () => {
    const data = { thermal: { topTempC: Number.POSITIVE_INFINITY, margin: Number.NaN, ok: true }, rows: [1, 2], name: "RH" };
    const parsed = snapshotParse<typeof data>(snapshotStringify(data));
    expect(parsed.thermal.topTempC).toBe(Number.POSITIVE_INFINITY);
    expect(Number.isNaN(parsed.thermal.margin)).toBe(true);
    expect(parsed.rows).toEqual([1, 2]);
  });
});

describe("fáze 103 – registr QR štítků ELDOCK", () => {
  it("sériová čísla EL-000001 …, adresa karty a rozsah série jdou po sobě", () => {
    expect(serialCode(1)).toBe("EL-000001");
    expect(serialCode(1_000_000)).toBe("EL-1000000");
    expect(sequenceOf("el-000042")).toBe(42);
    expect(sequenceOf("EL-42")).toBeNull();
    expect(qrUrl("EL-000001")).toBe("https://eldock.cz/q/EL-000001");
    expect(batchRange(100, 100)).toMatchObject({ first: 101, last: 200 });
    expect(batchRange(100, 100).codes[99]).toBe("EL-000200");
    expect(() => batchRange(0, 0)).toThrow();
    expect(() => batchRange(0, 5001)).toThrow();
  });

  it("tři rozměry pro Zebra ZD421t (300 DPI) a ZPL s QR kódem korekce H", () => {
    expect(LABEL_PURPOSES.map((purpose) => `${purpose.widthMm}×${purpose.heightMm}`)).toEqual(["30×15", "50×25", "70×40"]);
    expect(dots(50)).toBe(591);
    const zpl = labelZpl({ code: "EL-000123", purpose: "SWITCHBOARD", companyName: "Elektro Novák s.r.o." });
    expect(zpl).toContain("^PW591");
    expect(zpl).toContain("^LL295");
    expect(zpl).toMatch(/\^BQN,2,\d+\^FDHA,https:\/\/eldock\.cz\/q\/EL-000123\^FS/);
    expect(zpl).toContain("Elektro Novák s.r.o.");
    expect(zpl.startsWith("^XA")).toBe(true);
    expect(zpl.endsWith("^XZ")).toBe(true);
    expect(labelZpl({ code: "EL-000124", purpose: "APPLIANCE" })).toContain("REVIZE ELDOCK.CZ");
  });
});

describe("fáze 103 – Červenky: firemní projektant a ELDOCK Pool", () => {
  it("stavy obou cest a anonymizovaný název úkolu", () => {
    expect(redlineStatusLabel("INTERNAL_DESIGNER", "OPEN")).toBe("Čeká na překreslení");
    expect(redlineStatusLabel("INTERNAL_DESIGNER", "CLAIMED")).toBe("Překresluje se");
    expect(redlineStatusLabel("INTERNAL_DESIGNER", "DONE")).toBe("Hotovo – nahrána nová verze schématu");
    expect(redlineStatusLabel("POOL", "OPEN")).toBe("🟢 VOLNÝ ÚKOL K PŘIJETÍ");
    expect(redlineStatusLabel("POOL", "CLAIMED", "Jana Svobodová")).toBe("🔒 Přijato projektantem Jana Svobodová");
    expect(redlineStatusLabel("POOL", "DONE")).toBe("✅ Zapracováno do dokumentace");
    expect(anonymizedTitle({ equipmentType: "SWITCHBOARD", equipmentName: "RM1 – Hlavní rozváděč", tag: "RM1", company: "Strojírny a.s." }, false)).toBe("Rozváděč RM1 (firma po přihlášení projektanta)");
    expect(anonymizedTitle({ equipmentType: "SWITCHBOARD", equipmentName: "RM1 – Hlavní rozváděč", tag: "RM1", company: "Strojírny a.s." }, true)).toBe("RM1 · RM1 – Hlavní rozváděč – Strojírny a.s.");
  });

  it("poptávka v poolu chce formát, rozsah a odměnu; přístupový kód projektanta bez zaměnitelných znaků", () => {
    expect(routeSchema.safeParse({ mode: "POOL", changeRequestId: "cr", format: "EPLAN", sheets: 1, rewardCzk: 800 }).success).toBe(true);
    expect(routeSchema.safeParse({ mode: "POOL", changeRequestId: "cr", format: "EPLAN", sheets: 1, rewardCzk: 50 }).success).toBe(false);
    expect(routeSchema.safeParse({ mode: "INTERNAL_DESIGNER", changeRequestId: "cr" }).success).toBe(true);
    const code = accessCode((size) => Uint8Array.from({ length: size }, (_, index) => index * 7));
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it("vrstva Červenky do balíčku podkladů jako SVG", () => {
    const svg = markupSvg({ sheet: 2, strokes: [{ tool: "pen", color: "#ff0000", width: 0.004, points: [[0.1, 0.1, 0.5], [0.5, 0.5, 0.5]] }, { tool: "highlighter", color: "javascript:", width: 0.02, points: [[0.2, 0.2, 1]] }] }, "ZM-2026-0001 · <RM1>");
    expect(svg).toContain('points="141.4,100.0 707.0,500.0"');
    expect(svg).toContain('stroke-opacity="0.35"');
    expect(svg).toContain("#dc2626");
    expect(svg).toContain("&lt;RM1&gt;");
  });
});

describe("fáze 103 – zámek místností 2D půdorysu", () => {
  it("v kroku 1 jsou místnosti editovatelné, v krocích 2–5 zamčené; zobrazení všeho (bez kroku) nezamyká", () => {
    expect(roomsLocked(1)).toBe(false);
    for (const phase of [2, 3, 4, 5] as const) expect(roomsLocked(phase)).toBe(true);
    expect(roomsLocked(null)).toBe(false);
    expect(ROOMS_LOCKED_TEXT).toBe("🔒 Rozvržení místností je v této fázi uzamčeno proti nechtěnému posunutí.");
  });
});
