import { describe, expect, it } from "vitest";

import { ABB_CZ_COMPONENTS, ABB_CZ_RELATIONS } from "../../../prisma/seed-abb-cz";
import { ABB_CZ_IN_CATALOG, CATALOG } from "../../../prisma/seed-panel-builder";
import { GENERATED_CATALOG } from "../../../prisma/seed-catalog-generated";
import { doorOf, enclosureRails, enclosureSeries } from "./enclosure-choice";
import { standardEnclosureMatrix, type EnclosureLike } from "./enclosures";
import { VERIFIED_ENCLOSURES, verifiedEnclosureData } from "./verified-enclosures";

const abb = (mpn: string) => ABB_CZ_COMPONENTS.find((component) => component.articleNumber === mpn)!;
const enclosure = (mpn: string) => VERIFIED_ENCLOSURES.find((row) => row.articleNumber === mpn)!;
const count = <T,>(rows: readonly T[], key: (row: T) => string) => rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [key(row)]: (acc[key(row)] ?? 0) + 1 }), {});

describe("fáze 88 – rozvodnice ABB z katalogu ABB pro ČR", () => {
  it("Mistral41W / 41F (průhledná i plná dvířka), Mistral65 / 65H a ComfortLine CU – počty a objednací čísla", () => {
    const added = VERIFIED_ENCLOSURES.filter((row) => /^(Mistral|ComfortLine CU)/.test(row.series));
    expect(added).toHaveLength(72);
    expect(count(added, (row) => row.series)).toEqual({ Mistral41W: 16, Mistral41F: 16, Mistral65: 8, Mistral65H: 10, "ComfortLine CU (rozteč 125 mm)": 15, "ComfortLine CU (rozteč 150 mm)": 7 });
    expect(count(added.filter((row) => row.series.startsWith("Mistral41")), (row) => (/plná/.test(row.model) ? "plná" : "průhledná"))).toEqual({ průhledná: 16, plná: 16 });
    expect(new Set(added.map((row) => row.articleNumber)).size).toBe(72);
    for (const row of added) expect(row.sourceUrl).toContain(row.articleNumber.toLowerCase());
  });

  it("údaje vybraných typů podle stránek ABB CZ", () => {
    expect(enclosure("1SPE007717F1121")).toMatchObject({ model: "Mistral41W 41P18X42A (průhledná dvířka)", rows: 4, modulesPerRow: 18, totalModules: 72, widthMm: 387, heightMm: 659, depthMm: 119, ipRating: "IP41", installation: "SURFACE", material: "PLASTIC" });
    expect(enclosure("1SLM004102A1110")).toMatchObject({ series: "Mistral41F", rows: 4, modulesPerRow: 18, widthMm: 430, heightMm: 735, depthMm: 127, installation: "FLUSH" });
    expect(enclosure("1SLM006500A2210")).toMatchObject({ series: "Mistral65H", rows: 1, modulesPerRow: 4, widthMm: 152, heightMm: 202, depthMm: 117, ipRating: "IP65" });
    expect(enclosure("2CPX052622R9999")).toMatchObject({ model: "CU45V (4 pole po 12 M)", rows: 5, modulesPerRow: 48, totalModules: 240, widthMm: 1115, heightMm: 864, depthMm: 125, ipRating: "IP30", installation: "FLUSH", material: "PAINTED_STEEL" });
    expect(enclosure("2CPX052600R9999")).toMatchObject({ series: "ComfortLine CU (rozteč 150 mm)", rows: 3, modulesPerRow: 24, totalModules: 72 });
    expect(enclosureRails(enclosure("2CPX052622R9999"))).toEqual([48, 48, 48, 48, 48]);
  });

  it("dvířka náhledu podle výrobce: plná dvířka Mistralu neprůhledná", () => {
    const like = (mpn: string) => ({ ...verifiedEnclosureData(enclosure(mpn)), id: mpn }) as EnclosureLike & { description: string };
    expect(doorOf(like("1SLM004102A3103"))).toBe("opaque");
    expect(doorOf(like("1SPE007717F0421"))).toBe("transparent");
    expect(doorOf(like("1SLM004101A1203"))).toBe("transparent");
    expect(doorOf(like("1SLM004102A1103"))).toBe("opaque");
    expect(doorOf(like("2CPX052613R9999"))).toBe("opaque");
    // Kaskáda: Mistral41W z katalogu ABB před orientačním typem téhož jména
    const rows = [...VERIFIED_ENCLOSURES.map((row, index) => ({ ...verifiedEnclosureData(row), id: `v${index}` })), ...standardEnclosureMatrix().map((row, index) => ({ ...row, id: `s${index}` }))] as EnclosureLike[];
    const labels = enclosureSeries(rows.filter((row) => row.manufacturer === "ABB")).map((series) => series.label);
    expect(labels.indexOf("Mistral41W")).toBeLessThan(labels.indexOf("Mistral41W (orientační)"));
  });
});

describe("fáze 88 – modulové přístroje a příslušenství ABB z katalogu ABB pro ČR", () => {
  it("počty kusů po kategoriích a jedinečná objednací čísla", () => {
    expect(ABB_CZ_COMPONENTS).toHaveLength(290);
    expect(count(ABB_CZ_COMPONENTS, (row) => row.category)).toEqual({ MCB: 99, RCD: 22, RCBO: 58, MAIN_SWITCH: 24, SPD: 12, CONTACTOR: 8, RELAY: 23, PSU: 2, OTHER: 42 });
    expect(count(ABB_CZ_COMPONENTS.filter((row) => row.category === "OTHER"), (row) => row.moduleSubtype ?? "?")).toEqual({ METER: 5, INDICATOR: 13, AUX_CONTACT: 3, FUSE_DISCONNECTOR: 5, DIN_SOCKET: 2, BUSBAR_END_CAP: 2, BUSBAR: 12 });
    expect(new Set(ABB_CZ_COMPONENTS.map((row) => row.articleNumber)).size).toBe(290);
    for (const row of ABB_CZ_COMPONENTS) {
      expect(row.manufacturer).toBe("ABB");
      expect(row.ownCatalog).toBe(true);
      expect(row.powerLossWatts).toBeNull();
      expect(row.datasheetUrl).toMatch(/^https:\/\/nizke-napeti\.cz\.abb\.com\/.+\?mime=pdf$/);
      expect(row.datasheetUrl!.toLowerCase()).toContain(row.articleNumber.toLowerCase());
      expect(row.source).toContain(row.datasheetUrl!.replace("?mime=pdf", ""));
      expect(row.modulesCount).toBeGreaterThanOrEqual(row.moduleSubtype === "BUSBAR_END_CAP" ? 0 : 0.5);
      expect(row.description.length).toBeGreaterThan(10);
    }
  });

  it("parametry z typového označení ABB", () => {
    expect(abb("2CDS271001R0164")).toMatchObject({ typeCode: "S201M-C16", series: "System pro M compact S200M", category: "MCB", poles: "1P", ratedCurrentA: 16, trippingCurve: "C", breakingCapacityKa: 10, modulesCount: 1 });
    expect(abb("2CSF204201R3630")).toMatchObject({ typeCode: "F204 A S-63/0,3", category: "RCD", poles: "4P", ratedCurrentA: 63, rcdSensitivityMa: 300, rcdType: "S", breakingCapacityKa: 10, modulesCount: 4 });
    expect(abb("2CSF204102R1630")).toMatchObject({ series: "FH200 (Compact Home)", ratedCurrentA: 63, rcdType: "A", breakingCapacityKa: 6 });
    expect(abb("2CSF204102R1630").source).toContain("platí typové označení");
    expect(abb("2CSR274101R1204")).toMatchObject({ typeCode: "DS204 M A-C20/0,03", category: "RCBO", poles: "4P", trippingCurve: "C", ratedCurrentA: 20, rcdType: "A", rcdSensitivityMa: 30, breakingCapacityKa: 10, modulesCount: 6 });
    expect(abb("2CSR275563R1165")).toMatchObject({ typeCode: "DS301C M B16 F30", poles: "1P+N", rcdType: "F", breakingCapacityKa: 10, modulesCount: 1 });
    expect(abb("2CDD273111R0063")).toMatchObject({ typeCode: "SHD203/63", category: "MAIN_SWITCH", poles: "3P", ratedCurrentA: 63, modulesCount: 3 });
    expect(abb("2CTB803973R1100")).toMatchObject({ typeCode: "OVR T2 3N 40-275 P QS", category: "SPD", poles: "3P+N", spdType: "T2", surgeCurrentKa: 40, modulesCount: 4 });
    expect(abb("2CTB815710R1900")).toMatchObject({ spdType: "T1+T2", surgeCurrentKa: 12.5, poles: "3P+N", modulesCount: 4 });
    expect(abb("1SAE231111R0622")).toMatchObject({ typeCode: "ESB25-22N-06", category: "CONTACTOR", poles: "4P", ratedCurrentA: 25, contactConfig: "2NO+2NC", modulesCount: 2 });
    expect(abb("1SBE111111R0120")).toMatchObject({ coilVoltage: "24V AC/DC", modulesCount: 1 });
    expect(abb("2TAZ322000R2013")).toMatchObject({ typeCode: "E290-32-11/230", category: "RELAY", relaySubtype: "IMPULSE", ratedCurrentA: 32, contactConfig: "1NO+1NC" });
    expect(abb("2CSM228715R0802")).toMatchObject({ typeCode: "TM10/12", category: "PSU", moduleSubtype: "BELL_TRANSFORMER", modulesCount: 2 });
    expect(abb("2CDL230001R1060")).toMatchObject({ typeCode: "PS3/60", category: "OTHER", moduleSubtype: "BUSBAR", poles: "3P", ratedCurrentA: 63, modulesCount: 1 });
    expect(abb("2CDL200001R0001")).toMatchObject({ moduleSubtype: "BUSBAR_END_CAP", modulesCount: 0 });
    expect(abb("2CMA241695R1000")).toMatchObject({ typeCode: "D13 15-M 65", moduleSubtype: "METER", poles: "3P", ratedCurrentA: 65, modulesCount: 3 });
    expect(abb("2CMA241695R1000").description).toContain("MID");
  });

  it("seed katalogu: nové kusy a opravy orientačních řádků; přesné kusy katalogu zůstávají", () => {
    const byArticle = (article: string) => CATALOG.filter((component) => component.articleNumber === article);
    expect(new Set(CATALOG.map((component) => component.articleNumber)).size).toBe(CATALOG.length);
    // Generovaný S201-B16 má stejné objednací číslo i typ → zůstává (s Pv generovaného katalogu)
    expect(ABB_CZ_IN_CATALOG.has("2CDS251001R1165")).toBe(false);
    // Orientační F204 A-40/0,03 (objednací číslo = typ) nahradí kus z katalogu ABB pro ČR s typickou Pv generovaného řádku
    const generatedF204 = GENERATED_CATALOG.find((component) => component.manufacturer === "ABB" && component.typeCode === "F204 A-40/0,03")!;
    expect(generatedF204.articleNumber).toBe("F204 A-40/0,03");
    expect(byArticle("F204 A-40/0,03")).toHaveLength(0);
    expect(byArticle("2CSF204101R1400")[0]).toMatchObject({ typeCode: "F204 A-40/0,03", ownCatalog: true, lossEstimated: true, powerLossWatts: generatedF204.powerLossWatts });
    // Chybný generovaný „TS16/24“ s objednacím číslem TM10/12 opravený
    expect(byArticle("2CSM228715R0802")[0]).toMatchObject({ typeCode: "TM10/12", moduleSubtype: "BELL_TRANSFORMER" });
    // Nové řady (10 kA) a ruční zápis má přednost (FH204 A-40/0,03 vzorového PB-001)
    expect(byArticle("2CDS271001R0164")[0]).toMatchObject({ series: "System pro M compact S200M", ownCatalog: true });
    expect(ABB_CZ_IN_CATALOG.has("2CSF204102R1400")).toBe(false);
    expect(ABB_CZ_IN_CATALOG.size).toBeGreaterThan(150);
  });

  it("vazby příslušenství: přípojnice PSc k DS301C, krytky k přípojnicím, přídavné kontakty k E290 16 A", () => {
    const relation = (note: RegExp) => ABB_CZ_RELATIONS.find((row) => note.test(row.note))!;
    expect(relation(/PSc/)).toMatchObject({ relationType: "COMPATIBLE_BUSBAR", basis: "catalog", verified: true });
    expect(relation(/PSc/).parents).toHaveLength(32);
    expect(relation(/PSc/).children).toHaveLength(4);
    expect(relation(/16A verzi/).parents).toEqual(["2TAZ312000R2011", "2TAZ312000R2013", "2TAZ312000R2012"]);
    expect(relation(/PS-END pro/).children).toEqual(["2CDL200001R0001"]);
    expect(relation(/1 fáze/)).toMatchObject({ basis: "derived", verified: false });
  });
});
