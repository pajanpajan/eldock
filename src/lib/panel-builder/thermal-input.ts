// Projekt rozváděče (řádky z databáze) → vstupy výpočtu oteplení. Sdílí krok 3 i dokumentace.

import type { ComponentCategory, EnclosureMaterial, EnclosureType } from "@/generated/prisma/enums";
import type { ThermalDevice, ThermalEnclosure } from "@/lib/thermalCalculation";

export interface ThermalProjectInput {
  heightMm: number;
  widthMm: number;
  depthMm: number;
  enclosureType: EnclosureType;
  enclosureMaterial: EnclosureMaterial;
  ipRating: string;
  ambientTempC: number;
  simultaneityFactor: number;
  internalWiringLossW: number;
}

export interface ThermalItemInput {
  id: string;
  designation: string;
  circuitLabel: string;
  parentItemId: string | null;
  phaseAssignment: string | null;
  operatingCurrentA: number | null;
  catalogComponent: { category: ComponentCategory; poles: string; ratedCurrentA: number; powerLossWatts: number; typeCode: string; description: string } | null;
}

export const thermalEnclosure = (project: Omit<ThermalProjectInput, "enclosureMaterial" | "ipRating">): ThermalEnclosure => ({
  heightMm: project.heightMm,
  widthMm: project.widthMm,
  depthMm: project.depthMm,
  installation: project.enclosureType,
  ambientTempC: project.ambientTempC,
  simultaneityFactor: project.simultaneityFactor,
  internalWiringLossW: project.internalWiringLossW,
});

export const thermalDevices = (items: readonly ThermalItemInput[]): ThermalDevice[] =>
  items.map((item) => ({
    id: item.id,
    designation: item.designation,
    typeCode: item.catalogComponent?.typeCode ?? "nerozpoznáno",
    description: item.catalogComponent?.description ?? item.circuitLabel,
    category: item.catalogComponent?.category ?? null,
    poles: item.catalogComponent?.poles ?? null,
    ratedCurrentA: item.catalogComponent?.ratedCurrentA ?? 0,
    ratedLossW: item.catalogComponent?.powerLossWatts ?? 0,
    operatingCurrentA: item.operatingCurrentA,
    parentItemId: item.parentItemId,
    phaseAssignment: item.phaseAssignment,
  }));
