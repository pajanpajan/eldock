import { describe, expect, it } from "vitest";

import { splitDefects, splitProvision } from "./defects";
import { defaultScopeNote, documentsUsedText, isReportType, previousEvaluationText, reportDefaults } from "./inspection-report";
import { inspectionRuleFor } from "./inspection-rules";
import { certificateIssues, isHighVoltage, normalizeScope, scopeFromLicense } from "./inspector-certificate";

// Fáze 66: osvědčení revizního technika (zákon 250/2021 Sb., § 11 a § 17; NV 190/2022 Sb., příloha č. 5),
// náležitosti zprávy o revizi (NV 190/2022 Sb., § 10 odst. 1) a závady s porušeným ustanovením.

const d = (iso: string) => new Date(`${iso}T10:00:00.000Z`);
const switchboard = inspectionRuleFor({ type: "SWITCHBOARD", buildingType: "PRODUCTION" });
const lps = inspectionRuleFor({ type: "LIGHTNING_ROD" });
const base = { scope: "E2A", validUntil: d("2028-06-30"), inspectionDate: d("2026-11-08"), rule: switchboard, equipment: { type: "SWITCHBOARD" as const, ratedVoltage: "400 V AC / 50 Hz" } };

describe("osvědčení revizního technika", () => {
  it("rozsah z formuláře i ze staršího čísla osvědčení", () => {
    expect(normalizeScope("e2/a")).toBe("E2A");
    expect(normalizeScope(" E1 B ")).toBe("E1B");
    expect(normalizeScope("E4A")).toBeNull();
    expect(scopeFromLicense("TIČR č. E-0815/2021 (E1A)")).toBe("E1A");
    expect(scopeFromLicense("Certifikát ČSN EN ISO 9712 TT2 č. 0391")).toBeNull();
  });

  it("vysoké napětí nad 1 kV AC / 1,5 kV DC", () => {
    expect(isHighVoltage("TRANSFORMER", "22 kV / 0,4 kV")).toBe(true);
    expect(isHighVoltage("TRANSFORMER", null)).toBe(true);
    expect(isHighVoltage("SWITCHBOARD", "400 V AC / 50 Hz")).toBe(false);
    expect(isHighVoltage("SWITCHBOARD", "1500 V DC")).toBe(false);
    expect(isHighVoltage("SWITCHBOARD", "1,8 kV DC")).toBe(true);
  });

  it("v pořádku jen platné osvědčení v odpovídajícím rozsahu (§ 17)", () => {
    expect(certificateIssues(base)).toEqual([]);
    expect(certificateIssues({ ...base, scope: null })[0]).toContain("rozsah osvědčení");
    expect(certificateIssues({ ...base, validUntil: null })[0]).toContain("platnost osvědčení");
    expect(certificateIssues({ ...base, validUntil: d("2026-11-07") })[0]).toContain("neplatilo");
    expect(certificateIssues({ ...base, scope: "E3A" })[0]).toContain("E3 opravňuje jen");
    expect(certificateIssues({ ...base, equipment: { type: "TRANSFORMER", ratedVoltage: "22 kV / 0,4 kV" } })[0]).toContain("vysokého napětí");
    expect(certificateIssues({ ...base, scope: "E1A", equipment: { type: "TRANSFORMER", ratedVoltage: "22 kV / 0,4 kV" } })).toEqual([]);
    expect(certificateIssues({ ...base, equipment: { type: "SWITCHBOARD", externalInfluences: "AA5, BE3 – lakovna" } })[0]).toContain("rozlišovacím znakem B");
    expect(certificateIssues({ ...base, scope: "E2B", equipment: { type: "SWITCHBOARD", externalInfluences: "BE3" } })).toEqual([]);
  });

  it("hromosvod revizi stačí E3, spotřebiče osvědčení VTZ nevyžadují", () => {
    expect(certificateIssues({ ...base, scope: "E3A", rule: lps, equipment: { type: "LIGHTNING_ROD" } })).toEqual([]);
    expect(certificateIssues({ ...base, scope: null, validUntil: null, rule: inspectionRuleFor({ type: "APPLIANCE" }), equipment: { type: "APPLIANCE" } })).toEqual([]);
  });
});

describe("závady s porušeným ustanovením (§ 10 odst. 1 písm. k)", () => {
  it("ustanovení v hranatých závorkách se nedělí podle teček", () => {
    const items = splitDefects("Chybí kryt svorek [ČSN 33 2000-4-41 ed. 3, čl. 411.2]. Chybí štítek jističe F3 [ČSN EN 61439-1 ed. 3, čl. 6.1]; uvolněná svorka PEN");
    expect(items).toEqual(["Chybí kryt svorek [ČSN 33 2000-4-41 ed. 3, čl. 411.2]", "Chybí štítek jističe F3 [ČSN EN 61439-1 ed. 3, čl. 6.1]", "uvolněná svorka PEN"]);
    expect(splitProvision(items[0])).toEqual({ description: "Chybí kryt svorek", provision: "ČSN 33 2000-4-41 ed. 3, čl. 411.2" });
    expect(splitProvision(items[2])).toEqual({ description: "uvolněná svorka PEN", provision: null });
  });
});

describe("náležitosti zprávy o revizi (§ 10 odst. 1)", () => {
  const equipment = { tag: "RM1", name: "RM1 - Hlavní rozváděč nn", type: "SWITCHBOARD" as const };

  it("jen výchozí, pravidelná a mimořádná revize", () => {
    expect(["INITIAL", "PERIODIC", "EXTRAORDINARY"].every((type) => isReportType(type as never))).toBe(true);
    expect(isReportType("THERMOVISION")).toBe(false);
    expect(isReportType("VISUAL_CHECK")).toBe(false);
  });

  it("rozsah, podklady a vyhodnocení předchozí revize z dat Eldocku", () => {
    expect(defaultScopeNote({ equipment, location: "Energetika › 1. PP", kind: "VTZ" })).toContain("RM1 – Hlavní rozváděč nn");
    expect(defaultScopeNote({ equipment: { ...equipment, type: "LIGHTNING_ROD" }, location: "Hala A", kind: "LPS" })).toContain("jímací soustava");
    const previous = {
      reportNumber: "RZ-2023-101/JBC",
      inspectionDate: d("2023-05-10"),
      result: "CAPABLE_WITH_DEFECTS" as const,
      defects: [
        { description: "Chybí štítek jističe F3", status: "OPEN" as const },
        { description: "Uvolněná svorka", status: "RESOLVED" as const },
      ],
    };
    expect(previousEvaluationText({ previous, type: "PERIODIC", activeTemporaryMods: 2 })).toBe(
      "Předchozí revize RZ-2023-101/JBC ze dne 10.05.2023: schopno bezpečného provozu s výhradou, neodstraněné závady: Chybí štítek jističe F3. Provoz a údržba: aktivní provizoria v Eldocku: 2.",
    );
    expect(previousEvaluationText({ previous: { ...previous, defects: previous.defects.map((defect) => ({ ...defect, status: "RESOLVED" as const })) }, type: "PERIODIC" })).toContain("zjištěné závady (2) jsou odstraněny");
    expect(previousEvaluationText({ previous: null, type: "INITIAL" })).toContain("Výchozí revize");
    const documents = documentsUsedText({ activeRevision: { version: "v2.1", approvedAt: d("2025-01-20"), createdAt: d("2025-01-10") }, influencesProtocol: { documentNumber: "PVV-2019-004", issuedAt: d("2019-03-01") }, previous });
    expect(documents.split("\n")).toHaveLength(3);
    expect(documents).toContain("revize v2.1 ze dne 20.01.2025");
    expect(documentsUsedText({}, true)).toContain("Vyhodnocení:");
    expect(reportDefaults({ equipment, location: "Energetika › 1. PP", kind: "VTZ", type: "PERIODIC" }).actsPerformed).toContain("ČSN 33 2000-6 ed. 2");
  });
});
