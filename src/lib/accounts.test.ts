import { describe, expect, it } from "vitest";

import type { AccountType, EquipmentType } from "@/generated/prisma/enums";

import { ACCOUNT_ORDER, ACCOUNT_TYPES, accountLayers, can, canSeeType, equipmentScope, filterByAccount, visibleTypes } from "./accounts";
import { MAP_LAYERS } from "./map-layers";

const ALL_TYPES = MAP_LAYERS.flatMap((layer) => [...layer.types]);
const PORTABLE: EquipmentType[] = ["APPLIANCE", "POWER_TOOL", "EXTENSION_CORD", "WELDER"];
const account = (accountType: AccountType, scopeLayers: string | null = null) => ({ accountType, scopeLayers });
const items = ALL_TYPES.map((type, index) => ({ id: String(index), type }));

describe("výřezy dat 6 typů účtů", () => {
  it("ředitel a vedoucí údržby vidí vše", () => {
    expect(visibleTypes(account("PLANT_ADMIN"))).toBeNull();
    expect(visibleTypes(account("MAINTENANCE_LEAD"))).toBeNull();
    expect(equipmentScope(account("PLANT_ADMIN"))).toEqual({});
    expect(filterByAccount(account("MAINTENANCE_LEAD"), items)).toHaveLength(items.length);
  });

  it("revizní technik VTZ nikdy nedostane spotřebič ani nářadí", () => {
    const vtz = account("INSPECTOR_VTZ");
    const types = filterByAccount(vtz, items).map((item) => item.type);
    for (const type of PORTABLE) expect(types).not.toContain(type);
    expect(types).toEqual(expect.arrayContaining(["SWITCHBOARD", "TRANSFORMER", "PRODUCTION_LINE", "MACHINE", "CNC_MACHINE", "LIGHTNING_ROD", "EMERGENCY_LIGHTING"]));
    expect(equipmentScope(vtz).type?.in).not.toContain("APPLIANCE");
  });

  it("technik spotřebičů vidí výhradně přenosné spotřebiče, nářadí, prodlužováky a svářečky", () => {
    expect(new Set(visibleTypes(account("INSPECTOR_APPLIANCES")))).toEqual(new Set(PORTABLE));
    expect(canSeeType(account("INSPECTOR_APPLIANCES"), "SWITCHBOARD")).toBe(false);
  });

  it("směnový údržbář a CAE vidí jen pevná zařízení s dokumentací", () => {
    for (const type of ["MAINTENANCE_TECH", "CAE_ENGINEER"] as const) {
      const types = visibleTypes(account(type))!;
      expect(types).toEqual(expect.arrayContaining(["SWITCHBOARD", "TRANSFORMER", "PRODUCTION_LINE", "MACHINE"]));
      for (const portable of [...PORTABLE, "LIGHTNING_ROD"] as EquipmentType[]) expect(types).not.toContain(portable);
    }
    expect(ACCOUNT_TYPES.CAE_ENGINEER.showInspections).toBe(false);
  });

  it("vlastní výřez podúčtu přebije výchozí, neznámé klíče se ignorují", () => {
    expect(accountLayers(account("MAINTENANCE_TECH", "ENERGY, TOOLS, XYZ"))).toEqual(["ENERGY", "TOOLS"]);
    expect(accountLayers(account("MAINTENANCE_TECH", " "))).toEqual(["ENERGY", "MACHINES"]);
    expect(canSeeType(account("MAINTENANCE_TECH", "ENERGY,TOOLS"), "POWER_TOOL")).toBe(true);
  });
});

describe("oprávnění", () => {
  it("schvalovat revize CAE smí jen ředitel a vedoucí údržby", () => {
    expect(ACCOUNT_ORDER.filter((type) => can(account(type), "approveRevision"))).toEqual(["PLANT_ADMIN", "MAINTENANCE_LEAD"]);
  });

  it("správa podúčtů jen ředitel, Studio ředitel a vedoucí", () => {
    expect(ACCOUNT_ORDER.filter((type) => can(account(type), "manageUsers"))).toEqual(["PLANT_ADMIN"]);
    expect(ACCOUNT_ORDER.filter((type) => can(account(type), "studio"))).toEqual(["PLANT_ADMIN", "MAINTENANCE_LEAD"]);
  });

  it("CAE má workflow roli projektanta, ostatní údržby", () => {
    expect(ACCOUNT_ORDER.map((type) => ACCOUNT_TYPES[type].workflowRole)).toEqual(["MAINTENANCE", "MAINTENANCE", "MAINTENANCE", "MAINTENANCE", "MAINTENANCE", "CAE_ENGINEER"]);
  });
});
