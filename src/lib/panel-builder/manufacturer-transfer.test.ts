import { describe, expect, it } from "vitest";

import type { CatalogLike, ItemConfig } from "./configurator";
import { planTransfer, reflowRails, transferSummary, type TransferItem } from "./manufacturer-transfer";

const part = (id: string, manufacturer: string, typeCode: string, extra: Partial<CatalogLike>): CatalogLike => ({
  id,
  manufacturer,
  typeCode,
  articleNumber: id,
  category: "MCB",
  poles: "1P",
  ratedCurrentA: 16,
  trippingCurve: "B",
  breakingCapacityKa: 6,
  rcdType: null,
  rcdSensitivityMa: null,
  spdType: null,
  surgeCurrentKa: null,
  contactConfig: null,
  coilVoltage: null,
  relaySubtype: null,
  moduleSubtype: null,
  modulesCount: 1,
  ...extra,
});

const catalog = [
  part("e-b16", "Eaton", "PL6-B16/1", {}),
  part("e-c20", "Eaton", "PL6-C20/1", { ratedCurrentA: 20, trippingCurve: "C" }),
  part("e-rcbo", "Eaton", "PKNM-10/1N/B/003-A", { category: "RCBO", poles: "1P+N", ratedCurrentA: 10, rcdType: "A", rcdSensitivityMa: 30, modulesCount: 1 }),
  part("e-rcd", "Eaton", "PF7-40/4/003-A", { category: "RCD", poles: "4P", ratedCurrentA: 40, trippingCurve: null, rcdType: "A", rcdSensitivityMa: 30, modulesCount: 4 }),
  part("a-b16", "ABB", "S201-B16", {}),
];

const cfg = (config: Partial<ItemConfig> & Pick<ItemConfig, "category" | "poles" | "modules">): ItemConfig => ({ manufacturer: "ABB", ratedCurrentA: null, ...config });
const item = (id: string, designation: string, config: ItemConfig | null, modulesWidth: number, component = "ABB X"): TransferItem => ({ id, designation, circuitLabel: `Okruh ${designation}`, modulesWidth, config, component: { manufacturer: component.split(" ")[0], typeCode: component.split(" ")[1] } });

describe("fáze 60 – převod rozváděče na jiného výrobce", () => {
  it("stejné hodnoty u nového výrobce: jistič, chránič, jističochránič (jiná šířka), chybějící kus = odhad, systémový prvek zůstává", () => {
    const rows = planTransfer(
      [
        item("1", "-FI1", cfg({ category: "RCD", poles: "4P", modules: 4, ratedCurrentA: 40, rcdType: "A", rcdSensitivityMa: 30 }), 4, "ABB F204"),
        item("2", "-F1", cfg({ category: "MCB", poles: "1P", modules: 1, ratedCurrentA: 16, curve: "B" }), 1, "ABB S201-B16"),
        item("3", "-FA1", cfg({ category: "RCBO", poles: "1P+N", modules: 2, ratedCurrentA: 10, curve: "B", rcdType: "A", rcdSensitivityMa: 30 }), 2, "ABB DS201"),
        item("4", "-F2", cfg({ category: "MCB", poles: "3P", modules: 3, ratedCurrentA: 25, curve: "B" }), 3, "ABB S203-B25"),
        item("5", "-A1", cfg({ category: "OTHER", poles: "1P", modules: 9, moduleSubtype: "PLC" }), 9, "Loxone Miniserver"),
      ],
      catalog,
      "Eaton",
    );
    expect(rows.map((row) => [row.designation, row.status, row.to])).toEqual([
      ["-FI1", "exact", "Eaton PF7-40/4/003-A"],
      ["-F1", "exact", "Eaton PL6-B16/1"],
      ["-FA1", "width", "Eaton PKNM-10/1N/B/003-A"],
      ["-F2", "estimate", expect.stringContaining("Eaton Jistič 3P B25")],
      ["-A1", "keep", "Loxone Miniserver"],
    ]);
    expect(rows[2]).toMatchObject({ modulesFrom: 2, modulesTo: 1, config: expect.objectContaining({ manufacturer: "Eaton", rcdType: "A", rcdSensitivityMa: 30, ratedCurrentA: 10 }) });
    expect(transferSummary(rows)).toMatchObject({ exact: 2, width: 1, estimate: 1, keep: 1, changed: 4 });
  });

  it("přeplněná lišta po změně šířek: konec lišty přejde na další / novou lištu, pořadí zůstane", () => {
    const result = reflowRails([4, 4], [
      { id: "a", rail: 1, position: 1, width: 2 },
      { id: "b", rail: 1, position: 2, width: 2 },
      { id: "c", rail: 1, position: 3, width: 1 },
      { id: "d", rail: 2, position: 1, width: 4 },
    ]);
    expect(result.moved).toBe(2);
    expect(result.capacities).toEqual([4, 4, 4]);
    expect(result.slots.map((slot) => `${slot.id}:${slot.rail}/${slot.position}`)).toEqual(["a:1/1", "b:1/2", "c:2/1", "d:3/1"]);
  });
});
