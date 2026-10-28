import type { EquipmentType } from "@/generated/prisma/enums";

import { needsAttention, type InspectionState } from "./inspection";

// Vrstvy půdorysu (Level 3): skupiny typů zařízení, které lze zapnout/vypnout, aby
// stovky spotřebičů nezahltily mapu rozváděčů. Platí pro mapu i tabulku patra.

export type LayerKey = "ENERGY" | "MACHINES" | "TOOLS" | "APPLIANCES" | "SAFETY";

export interface MapLayer {
  key: LayerKey;
  label: string;
  types: readonly EquipmentType[];
  defaultOn: boolean;
}

export const MAP_LAYERS: readonly MapLayer[] = [
  { key: "ENERGY", label: "Rozváděče a energetika", types: ["SWITCHBOARD", "TRANSFORMER", "COMPRESSOR"], defaultOn: true },
  {
    key: "MACHINES",
    label: "Výrobní stroje a linky",
    types: ["PRODUCTION_LINE", "MACHINE", "CNC_MACHINE", "ROBOT_CELL", "HVAC_UNIT", "OTHER"],
    defaultOn: true,
  },
  { key: "TOOLS", label: "Ruční nářadí a svářečky", types: ["POWER_TOOL", "WELDER"], defaultOn: false },
  { key: "APPLIANCES", label: "Spotřebiče a prodlužováky", types: ["APPLIANCE", "EXTENSION_CORD"], defaultOn: false },
  { key: "SAFETY", label: "Hromosvody a bezpečnost", types: ["LIGHTNING_ROD", "EMERGENCY_LIGHTING"], defaultOn: false },
];

export const ALL_LAYERS: ReadonlySet<LayerKey> = new Set(MAP_LAYERS.map((layer) => layer.key));
export const DEFAULT_LAYERS: ReadonlySet<LayerKey> = new Set(MAP_LAYERS.filter((layer) => layer.defaultOn).map((layer) => layer.key));

export function layerOf(type: EquipmentType): LayerKey {
  return MAP_LAYERS.find((layer) => layer.types.includes(type))?.key ?? "MACHINES";
}

interface Layered {
  type: EquipmentType;
  inspection: { state: InspectionState };
}

export interface LayerFilter {
  layers: ReadonlySet<LayerKey>;
  /** „⚠️ Zobrazit vše s propadlou / končící revizí“: všechny vrstvy, jen 🔴 / 🟡. */
  attentionOnly: boolean;
}

export function matchesLayers(item: Layered, filter: LayerFilter): boolean {
  if (filter.attentionOnly) return needsAttention(item.inspection.state);
  return filter.layers.has(layerOf(item.type));
}

/** Počty kusů ve vrstvách (celkem a s propadlou / končící revizí). */
export function layerCounts(items: readonly Layered[]): Record<LayerKey, { total: number; attention: number }> {
  const counts = Object.fromEntries(MAP_LAYERS.map((layer) => [layer.key, { total: 0, attention: 0 }])) as Record<
    LayerKey,
    { total: number; attention: number }
  >;
  for (const item of items) {
    const entry = counts[layerOf(item.type)];
    entry.total += 1;
    if (needsAttention(item.inspection.state)) entry.attention += 1;
  }
  return counts;
}
