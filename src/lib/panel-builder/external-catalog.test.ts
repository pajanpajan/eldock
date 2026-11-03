import { describe, expect, it } from "vitest";

import { crc32, buildXlsx } from "../xlsx";
import { whitenToTransparent } from "../image-alpha";
import { compactProduct, deriveRelations, dinArchetypeId, externalArticleNumber, externalManufacturer, externalModules, mapExternalProduct, payloadsFromSql, type ExternalProduct } from "./external-catalog";

const mcb: ExternalProduct = {
  manufacturer: "EATON",
  series: "xPole PL7",
  category: "MCB",
  mpn: "262701",
  type_designation: "PL7-B16/1",
  ean: "4015082627010",
  name_cs: "Jistič PL7-B16/1, 1P, B16, 10 kA",
  current_kind: "AC",
  poles: "1P",
  in_a: 16,
  icn_ka: 10,
  trip_characteristic: "B",
  p_loss_w: 2.4,
  width_modules: 1,
  width_mm: 17.5,
  mounting: ["din_th35"],
  features: { energy_limiting_class: "3" },
};

describe("most na externí databázi prvků ai-panel-builder", () => {
  it("jistič → CatalogComponent (výrobce, MPN s prefixem, archetyp, fasety, hledání)", () => {
    const mapped = mapExternalProduct(mcb);
    expect(mapped.kind).toBe("component");
    if (mapped.kind !== "component") return;
    expect(mapped.data).toMatchObject({
      manufacturer: "Eaton",
      articleNumber: "EATON:262701",
      typeCode: "PL7-B16/1",
      category: "MCB",
      poles: "1P",
      ratedCurrentA: 16,
      trippingCurve: "B",
      breakingCapacityKa: 10,
      powerLossWatts: 2.4,
      modulesCount: 1,
      archetypeId: "din_mcb_1M_1P",
      dataSource: "SEED_CATALOG",
      externalSource: "ai-panel-builder",
    });
    expect(JSON.parse(mapped.data.facetsJson)).toMatchObject({ energy_limiting_class: "3", current_kind: "AC" });
    expect(mapped.data.searchText).toContain("pl7");
  });

  it("chránič, SPD, relé s cívkou a příslušenství; chybějící Pv = odhad IEC", () => {
    const rcd = mapExternalProduct({ ...mcb, category: "RCD", mpn: "2CSF204101R1400", type_designation: "F204 AC-40/0,03", poles: "4P", in_a: 40, idn_ma: 30, rcd_type: "AC", rcd_time_class: "instant", trip_characteristic: null, p_loss_w: null, width_modules: 4 });
    expect(rcd.kind === "component" && rcd.data).toMatchObject({ category: "RCD", rcdType: "AC", rcdSensitivityMa: 30, articleNumber: "2CSF204101R1400", dataSource: "IEC_ESTIMATE", archetypeId: "din_rcd_4M_4P" });
    const selective = mapExternalProduct({ ...mcb, category: "RCD", poles: "4P", idn_ma: 300, rcd_type: "A", rcd_time_class: "S" });
    expect(selective.kind === "component" && selective.data.rcdType).toBe("S");
    const spd = mapExternalProduct({ ...mcb, manufacturer: "HAKEL", category: "SPD", mpn: "10970", poles: "1P", in_a: null, features: { spd_type: "T1", spd_in_ka: 50 } });
    expect(spd.kind === "component" && spd.data).toMatchObject({ manufacturer: "Hakel", spdType: "T1", surgeCurrentKa: 50, articleNumber: "HAKEL:10970" });
    const relay = mapExternalProduct({ ...mcb, manufacturer: "ELKOEP", category: "RELAY", mpn: "7078", features: { relay_kind: "timer", contacts_co: 1 }, coil: { uc_v: 230, uc_kind: "AC" } });
    expect(relay.kind === "component" && relay.data).toMatchObject({ manufacturer: "Elko EP", relaySubtype: "TIMER", coilVoltage: "230V AC", contactConfig: "1CO" });
    const aux = mapExternalProduct({ ...mcb, category: "AUX_CONTACT", mpn: "286052", width_modules: 0.5 });
    expect(aux.kind === "component" && aux.data).toMatchObject({ category: "OTHER", moduleSubtype: "AUX_CONTACT", modulesCount: 0.5, archetypeId: "din_accessory_0.5M_1P" });
  });

  it("rozvodnice → PanelEnclosure, kompaktní jistič a skříně bez rozložení přeskočí", () => {
    const board = mapExternalProduct({ manufacturer: "EATON", series: "BC", category: "DISTRIBUTION_BOARD", mpn: "280347", type_designation: "BC-A-1/13-A", name_cs: "Rozvodnice BC-A-1/13-A", width_mm: 250, height_mm: 225, depth_mm: 94, enclosure: { rows: 1, modules_per_row: 13, installation: "surface", ip_code: "IP30", p_max_w: 22 } });
    expect(board.kind === "enclosure" && board.data).toMatchObject({ manufacturer: "Eaton", model: "BC-A-1/13-A", rows: 1, modulesPerRow: 13, totalModules: 13, installation: "SURFACE", ipRating: "IP30", pMaxW: 22, dataSource: "EXTERNAL" });
    expect(mapExternalProduct({ ...mcb, category: "DISTRIBUTION_BOARD", enclosure: null }).kind).toBe("skip");
    expect(mapExternalProduct({ ...mcb, category: "MCCB" }).kind).toBe("skip");
  });

  it("pomocné převody: archetypy, šířka, objednací číslo, výrobce", () => {
    expect(dinArchetypeId("RCBO", 1, "1P+N")).toBe("din_rcbo_1M_1PN");
    expect(dinArchetypeId("RELAY", 1, null)).toBe("din_relay_1M");
    expect(dinArchetypeId("BUSBAR", null, "3P")).toBe("din_busbar");
    expect(externalModules({ width_modules: null, width_mm: 35, mounting: ["din_th35"] })).toBe(2);
    expect(externalModules({ width_modules: 55.4, width_mm: 970, mounting: [] })).toBe(1);
    expect(externalArticleNumber("OEZ", "OEZ:37376")).toBe("OEZ:37376");
    expect(externalArticleNumber("ABB", "2CDS251001R0165")).toBe("2CDS251001R0165");
    expect(externalManufacturer("MEANWELL")).toBe("Mean Well");
    expect(externalManufacturer("FOOBAR")).toBe("Foobar");
  });

  it("vazby příslušenství: PL7 → spouště a kontakty (katalog), OEZ jistič → hřeben stejných pólů (odvozeno)", () => {
    const products: ExternalProduct[] = [
      mcb,
      { ...mcb, category: "AUX_CONTACT", series: "PL7 příslušenství", mpn: "286052" },
      { ...mcb, category: "SHUNT_TRIP", series: "PL7 příslušenství", mpn: "248438" },
      { ...mcb, manufacturer: "OEZ", series: "LTN", mpn: "LTN-16B-1", poles: "1P" },
      { ...mcb, manufacturer: "OEZ", series: "S1L", category: "BUSBAR", mpn: "OEZ:37376", poles: "1P" },
      { ...mcb, manufacturer: "OEZ", series: "S3L", category: "BUSBAR", mpn: "OEZ:37400", poles: "3P" },
    ];
    const relations = deriveRelations(products);
    expect(relations.filter((relation) => relation.parent === "EATON|262701").map((relation) => [relation.child, relation.relationType, relation.verified])).toEqual([
      ["EATON|286052", "SIDE_UNSPECIFIED", true],
      ["EATON|248438", "SIDE_UNSPECIFIED", true],
    ]);
    expect(relations.filter((relation) => relation.parent === "OEZ|LTN-16B-1").map((relation) => [relation.child, relation.relationType, relation.basis])).toEqual([["OEZ|OEZ:37376", "COMPATIBLE_BUSBAR", "derived"]]);
  });

  it("záznamy z SQL seedu a kompaktní export bez grafiky", () => {
    const sql = `begin;\nselect catalog_upsert_product($catalog$${JSON.stringify({ ...mcb, graphics: { single_line: { svg: "<svg/>" } }, source: { basis: "x" } })}$catalog$);\nselect catalog_upsert_product(` + "$catalog${nesmysl$catalog$" + `);\ncommit;`;
    const products = payloadsFromSql(sql);
    expect(products).toHaveLength(1);
    const compact = compactProduct(products[0] as ExternalProduct & Record<string, unknown>) as unknown as Record<string, unknown>;
    expect(compact.graphics).toBeUndefined();
    expect(compact.source).toBeUndefined();
    expect(compact.mpn).toBe("262701");
  });
});

describe("pomocné formáty exportu", () => {
  it("CRC-32 a platný ZIP / XLSX", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    const xlsx = buildXlsx("Popisky", [["Značení", "Šířka"], ["-F1", 17.5]]);
    expect([...xlsx.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const text = new TextDecoder().decode(xlsx);
    expect(text).toContain("xl/worksheets/sheet1.xml");
    expect(text).toContain("<v>17.5</v>");
    expect(text).toContain("Značení");
  });

  it("razítko: bílé pozadí → průhledné, tah zůstane", () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255, 20, 40, 160, 255, 200, 200, 200, 255]);
    expect(whitenToTransparent(data)).toBe(1);
    expect(data[3]).toBe(0);
    expect(data[7]).toBe(255);
    expect(data[11]).toBeGreaterThan(0);
    expect(data[11]).toBeLessThan(255);
  });
});
