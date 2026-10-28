import { describe, expect, it } from "vitest";

import type { EquipmentType } from "@/generated/prisma/enums";

import type { InspectionState } from "./inspection";
import { ALL_LAYERS, DEFAULT_LAYERS, MAP_LAYERS, layerCounts, layerOf, matchesLayers } from "./map-layers";

const item = (type: EquipmentType, state: InspectionState = "VALID") => ({ type, inspection: { state } });

describe("map-layers", () => {
  it("každý typ patří právě do jedné vrstvy", () => {
    const types = MAP_LAYERS.flatMap((layer) => layer.types);
    expect(new Set(types).size).toBe(types.length);
    expect(layerOf("SWITCHBOARD")).toBe("ENERGY");
    expect(layerOf("WELDER")).toBe("TOOLS");
    expect(layerOf("EXTENSION_CORD")).toBe("APPLIANCES");
    expect(layerOf("LIGHTNING_ROD")).toBe("SAFETY");
  });

  it("výchozí zobrazení: rozváděče a stroje ano, spotřebiče ne", () => {
    expect([...DEFAULT_LAYERS]).toEqual(["ENERGY", "MACHINES"]);
    const filter = { layers: DEFAULT_LAYERS, attentionOnly: false };
    expect(matchesLayers(item("SWITCHBOARD"), filter)).toBe(true);
    expect(matchesLayers(item("APPLIANCE", "EXPIRED"), filter)).toBe(false);
  });

  it("režim ⚠️ ukáže jen 🔴 / 🟡 napříč všemi vrstvami", () => {
    const filter = { layers: new Set<never>(), attentionOnly: true };
    expect(matchesLayers(item("APPLIANCE", "EXPIRED"), filter)).toBe(true);
    expect(matchesLayers(item("POWER_TOOL", "EXPIRING"), filter)).toBe(true);
    expect(matchesLayers(item("EXTENSION_CORD", "FAILED"), filter)).toBe(true);
    expect(matchesLayers(item("SWITCHBOARD", "VALID"), filter)).toBe(false);
    expect(ALL_LAYERS.size).toBe(5);
  });

  it("spočítá kusy a upozornění ve vrstvách", () => {
    const counts = layerCounts([item("APPLIANCE", "EXPIRED"), item("APPLIANCE"), item("EXTENSION_CORD", "EXPIRING"), item("SWITCHBOARD")]);
    expect(counts.APPLIANCES).toEqual({ total: 3, attention: 2 });
    expect(counts.ENERGY).toEqual({ total: 1, attention: 0 });
    expect(counts.SAFETY).toEqual({ total: 0, attention: 0 });
  });
});
