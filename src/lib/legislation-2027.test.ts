import { describe, expect, it } from "vitest";

import { batteryPassportRows, parseBatteryPassport, passportRequired, sohWarning } from "./battery-passport";
import { documentsForComponent, formatFileSize, normalizeComponentTag, previewKind } from "./equipment-documents";
import { inspectionRuleFor } from "./inspection-rules";
import { protocolBatteryPassport } from "./inspection-protocol";
import { FIVE_SAFETY_RULES, LOTO_ROLES, QR_LEGAL_NOTE, ROUTINE_TEST_POINTS, SAFETY_IMPACT, STANDARD_EDITIONS, emptyRoutineTest, minInsulationMOhm, parseRoutineTest, routineTestVerdict, standardEditionOf } from "./legislation-2027";
import { SAFETY_CHECKSUM_PATTERN, formatSoftwareVersion, groupBackupsByUnit, hasSoftwareTab, nextSoftwareVersion, normalizeChecksum } from "./software-backups";

describe("verzování záloh SW / parametrů", () => {
  it("první záloha v1.0, Minor +0.1, Major +1.0 od nejvyšší existující verze", () => {
    expect(nextSoftwareVersion([], "minor")).toEqual({ major: 1, minor: 0 });
    expect(nextSoftwareVersion([], "major")).toEqual({ major: 1, minor: 0 });
    const existing = [{ major: 1, minor: 0 }, { major: 1, minor: 2 }, { major: 1, minor: 1 }];
    expect(nextSoftwareVersion(existing, "minor")).toEqual({ major: 1, minor: 3 });
    expect(nextSoftwareVersion(existing, "major")).toEqual({ major: 2, minor: 0 });
    expect(formatSoftwareVersion({ major: 2, minor: 0 })).toBe("v2.0");
  });

  it("seskupení podle řídicích uzlů: aktivní verze a historie od nejnovější (i po rollbacku)", () => {
    const row = (id: string, targetUnit: string, major: number, minor: number, status: "ACTIVE" | "ARCHIVED") => ({ id, targetUnit, major, minor, status, createdAt: "2026-01-01" });
    const groups = groupBackupsByUnit([row("a", "PLC -A1", 1, 0, "ARCHIVED"), row("b", "PLC -A1", 1, 2, "ARCHIVED"), row("c", "PLC -A1", 1, 1, "ACTIVE"), row("d", "Měnič -U1", 1, 0, "ACTIVE")]);
    expect(groups.map((group) => group.unit)).toEqual(["Měnič -U1", "PLC -A1"]);
    expect(groups[1].active?.id).toBe("c");
    expect(groups[1].history.map((backup) => backup.id)).toEqual(["b", "a"]);
  });

  it("kontrolní součet bezpečnostního programu a záložka jen u strojů a rozváděčů", () => {
    expect(normalizeChecksum("0x8f4a2c91")).toBe("CRC: 0x8F4A-2C91");
    expect(SAFETY_CHECKSUM_PATTERN.test("CRC: 0x8F4A-2C91")).toBe(true);
    expect(SAFETY_CHECKSUM_PATTERN.test("F-Signature: 1A2B-3C4D")).toBe(true);
    expect(SAFETY_CHECKSUM_PATTERN.test("nevím")).toBe(false);
    expect(hasSoftwareTab("ROBOT_CELL")).toBe(true);
    expect(hasSoftwareTab("APPLIANCE")).toBe(false);
  });
});

describe("knihovna návodů a datasheetů", () => {
  it("označení komponenty bez ohledu na zápis a vazba na prvek schématu", () => {
    expect(normalizeComponentTag(" k4 ")).toBe("-K4");
    expect(normalizeComponentTag("=A1-UC2")).toBe("-UC2");
    expect(normalizeComponentTag("")).toBeNull();
    const docs = [
      { componentTag: "-K4", title: "Starý", createdAt: "2025-01-01" },
      { componentTag: "K4", title: "Nový", createdAt: "2026-01-01" },
      { componentTag: "-U1", title: "Měnič", createdAt: "2026-01-01" },
    ];
    expect(documentsForComponent(docs, "-K4").map((doc) => doc.title)).toEqual(["Nový", "Starý"]);
    expect(documentsForComponent(docs, null)).toEqual([]);
    expect(formatFileSize(1_258_291)).toBe("1,2 MB");
    expect(previewKind("Návod.PDF")).toBe("pdf");
    expect(previewKind("zaloha.zap19")).toBeNull();
  });
});

describe("normy 2027 a protokol o kusové zkoušce", () => {
  it("3 edice norem: DBO, PSC a strojní rozváděč dle Nařízení (EU) 2023/1230", () => {
    expect(STANDARD_EDITIONS.map((edition) => edition.id)).toEqual(["CSN_61439_3_ED2", "CSN_61439_2_ED3", "CSN_60204_1_ED3"]);
    expect(standardEditionOf("CSN_61439_3_ED2").norms.join(" ")).toContain("ČSN EN IEC 61439-1 ed. 3");
    expect(standardEditionOf("CSN_61439_3_ED2").directives.join(" ")).toMatch(/LVD 2014\/35\/EU.*EMC 2014\/30\/EU.*RoHS 2011\/65\/EU/);
    expect(standardEditionOf("CSN_60204_1_ED3").directives[0]).toContain("(EU) 2023/1230");
    expect(standardEditionOf("nesmysl").id).toBe("CSN_61439_3_ED2");
  });

  it("8 kontrolních bodů, R_iso ≥ 1 000 Ω/V, verdikt a bezpečné čtení JSON", () => {
    expect(ROUTINE_TEST_POINTS).toHaveLength(8);
    expect(minInsulationMOhm()).toBe(0.23);
    const test = emptyRoutineTest();
    expect(routineTestVerdict(test).verdict).toBe("INCOMPLETE");
    for (const point of ROUTINE_TEST_POINTS) test.points[point.id] = "PASS";
    test.insulationMOhm = 250;
    test.testedBy = "Ing. Petra Nová";
    expect(routineTestVerdict(test)).toMatchObject({ verdict: "PASS", missing: [], insulationOk: true });
    expect(routineTestVerdict({ ...test, insulationMOhm: 0.1 }).verdict).toBe("FAIL");
    expect(routineTestVerdict({ ...test, points: { ...test.points, ip: "FAIL" } }).verdict).toBe("FAIL");
    expect(parseRoutineTest(JSON.stringify({ points: { ip: "PASS", bad: "PASS", clearances: "MAYBE" }, insulationMOhm: -1, testedAt: "2026-13" }))).toMatchObject({ points: { ip: "PASS", clearances: null }, insulationMOhm: null, testedAt: null });
    expect(parseRoutineTest("{")).toEqual(emptyRoutineTest());
  });

  it("klasifikace zásahu, LOTO dle ČSN EN 50110-1 ed. 4, QR doložka a lhůty hromosvodů", () => {
    expect(SAFETY_IMPACT.SUBSTANTIAL_SAFETY_MOD.label).toContain("čl. 18");
    expect(FIVE_SAFETY_RULES).toHaveLength(5);
    expect(LOTO_ROLES.map((role) => role.code)).toEqual(["OOEZ", "OPŘPČ"]);
    expect(QR_LEGAL_NOTE).toBe("Digitální provozní dokumentace dle čl. 10 Nařízení (EU) 2023/1230 a ČSN EN 50110-1 ed. 4");
    // Fáze 66: lhůty LPS určuje NV 190/2022 Sb., příloha č. 4 (vydání ČSN EN IEC 62305-3 ed. 3 není ověřené)
    expect(inspectionRuleFor({ type: "LIGHTNING_ROD" })).toMatchObject({ standard: "NV 190/2022 Sb.", months: 48 });
  });
});

describe("digitální pas baterie (EU 2023/1542)", () => {
  it("čtení pasu, řádky protokolu, povinnost nad 2 kWh a varování SoH", () => {
    const json = JSON.stringify({ capacityKwh: 48, chemistry: "LiFePO4", stateOfHealthPct: 97, nominalVoltageV: 512, cellManufacturer: "CATL" });
    const passport = parseBatteryPassport(json)!;
    expect(batteryPassportRows(passport)).toEqual([
      ["Kapacita", "48 kWh"],
      ["Chemie článků", "LiFePO4"],
      ["Stav zdraví (SoH)", "97 %"],
      ["Nominální napětí", "512 V DC"],
      ["Výrobce článků", "CATL"],
    ]);
    expect(passportRequired(passport)).toBe(true);
    expect(sohWarning(passport)).toBeNull();
    expect(sohWarning({ ...passport, stateOfHealthPct: 75 })).toMatch(/konec životnosti/);
    expect(parseBatteryPassport('{"chemistry":"VRLA"}')).toBeNull();
    expect(protocolBatteryPassport({ batteryPassportJson: json })?.[0]).toEqual(["Kapacita", "48 kWh"]);
    expect(protocolBatteryPassport({ batteryPassportJson: null })).toBeNull();
  });
});
