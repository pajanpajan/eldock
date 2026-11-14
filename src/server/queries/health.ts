import "server-only";

import { cache } from "react";

import type { EquipmentType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  checkCable,
  designCurrents,
  feederCableOf,
  toCableNode,
  type PowerCableNode,
} from "@/lib/cable-sizing";
import { plantLifespanRows } from "@/server/services/lifespan-report";

// Fáze 53: prediktivní údržba – sledované součástky a přívodní kabely (ČSN 33 2000-5-52 ed. 2).

const cableSelect = {
  id: true,
  tag: true,
  name: true,
  type: true,
  fedFromEquipmentId: true,
  ratedCurrent: true,
  nominalCurrentA: true,
  measuredCurrentA: true,
  feederCableType: true,
  feederConductorMaterial: true,
  feederCrossSectionMm2: true,
  feederParallelRuns: true,
  feederLengthM: true,
  feederInstallMethod: true,
  feederGroupingCount: true,
  feederAmbientTempC: true,
  feederUpstreamBreakerA: true,
} as const;

/** Strom napájení závodu s kabelovými pasporty (simulátor, pavouk napájení, hlídač). */
export const getPlantCableNodes = cache(
  async (plantId: string): Promise<PowerCableNode[]> => {
    const rows = await prisma.equipment.findMany({
      where: { floor: { building: { plantId } } },
      select: cableSelect,
    });
    return rows.map(toCableNode);
  },
);

/** Stav přívodních kabelů závodu: id zařízení → výsledek kontroly. */
export async function getPlantCableChecks(plantId: string) {
  const nodes = await getPlantCableNodes(plantId);
  const currents = designCurrents(nodes);
  return new Map(
    nodes
      .filter((node) => node.cable)
      .map((node) => [
        node.id,
        {
          tag: node.tag,
          cable: node.cable!,
          check: checkCable(node.cable!, currents.get(node.id) ?? 0),
        },
      ]),
  );
}

/** Data záložky Diagnostika: provozní profil, sledované součástky a přívodní kabel zařízení. */
export async function getEquipmentHealth(equipmentId: string, plantId: string) {
  const [equipment, components, nodes] = await Promise.all([
    prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: {
        ...cableSelect,
        shiftRegime: true,
        internalTempC: true,
        fedFrom: { select: { tag: true } },
      },
    }),
    prisma.monitoredComponent.findMany({
      where: { equipmentId },
      orderBy: [{ designation: "asc" }],
    }),
    getPlantCableNodes(plantId),
  ]);
  if (!equipment) return null;
  const currents = designCurrents(nodes);
  const cable = feederCableOf(equipment);
  const designCurrentA = currents.get(equipment.id) ?? 0;
  return {
    profile: {
      shiftRegime: equipment.shiftRegime,
      internalTempC: equipment.internalTempC,
    },
    components,
    feeder: {
      parentTag: equipment.fedFrom?.tag ?? null,
      cable,
      nominalCurrentA: equipment.nominalCurrentA,
      measuredCurrentA: equipment.measuredCurrentA,
      designCurrentA,
      check: cable ? checkCable(cable, designCurrentA) : null,
    },
    nodes,
  };
}

export type EquipmentHealth = NonNullable<
  Awaited<ReturnType<typeof getEquipmentHealth>>
>;

/**
 * Souhrn pro hlídač lhůt a přehled areálu: součástky před koncem životnosti (plánovat / kritické – fáze 116 včetně
 * dílů kusovníku s automatickým modelem) a přetížené nebo nejištěné kabely. Jen zařízení ve výřezu účtu.
 */
export const getPredictiveSummary = cache(
  async (plantId: string, types?: readonly EquipmentType[] | null) => {
    const now = new Date();
    const typeFilter = types ? { type: { in: [...types] } } : {};
    const [{ rows }, checks] = await Promise.all([
      plantLifespanRows(prisma, plantId, now, types ?? null),
      getPlantCableChecks(plantId),
    ]);
    const visible = types
      ? new Set(
          (
            await prisma.equipment.findMany({
              where: { floor: { building: { plantId } }, ...typeFilter },
              select: { id: true },
            })
          ).map((row) => row.id),
        )
      : null;
    const wearing = rows
      .filter((row) => row.status !== "OK")
      .sort((a, b) => b.wearPercent - a.wearPercent)
      .map((row) => ({
        id: `${row.equipmentId}|${row.designation}`,
        equipmentId: row.equipmentId,
        tag: row.tag,
        designation: row.designation,
        name: row.description,
        status: row.status,
        wearPercent: row.wearPercent,
        missingStock: row.missingStock,
      }));
    const cables = [...checks.entries()]
      .filter(
        ([id, entry]) =>
          entry.check.status === "CRITICAL" && (!visible || visible.has(id)),
      )
      .map(([id, entry]) => ({
        equipmentId: id,
        tag: entry.tag,
        loadPercent: entry.check.loadPercent,
        protectedOk: entry.check.protectedOk,
        izA: entry.check.izA,
      }));
    return { components: wearing, cables };
  },
);

export type PredictiveSummary = Awaited<
  ReturnType<typeof getPredictiveSummary>
>;
