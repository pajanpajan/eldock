import type { PrismaClient } from "@/generated/prisma/client";
import { hasBackupTier, type PowerBackupTier } from "@/lib/power-backup";
import { WorkflowError } from "@/lib/workflow/state-machine";

// Fáze 93: zálohování napájení rozváděče a jeho přívodní trasy, kapacita zdroje zálohy a nájemní jednotka / oddělení.

export interface PowerBackupInput {
  equipmentId: string;
  tier: PowerBackupTier;
  /** Kapacita zdroje zálohy [kVA] (dieselagregát, UPS) – jen u zálohované úrovně. */
  capacityKva: number | null;
  tenantUnit: string | null;
}

const clean = (value: string | null | undefined, max: number) => value?.replace(/\s+/g, " ").trim().slice(0, max) || null;

/** Uloží úroveň zálohy (jen rozváděč / zdroj) a nájemní jednotku / oddělení (každé zařízení). */
export async function updatePowerBackup(prisma: PrismaClient, input: PowerBackupInput) {
  const equipment = await prisma.equipment.findUnique({ where: { id: input.equipmentId }, select: { id: true, type: true } });
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
  if (input.capacityKva !== null && (!Number.isFinite(input.capacityKva) || input.capacityKva <= 0 || input.capacityKva > 100_000)) {
    throw new WorkflowError("VALIDATION", "Kapacita zdroje zálohy musí být 1–100 000 kVA.");
  }
  const tiered = hasBackupTier(equipment.type);
  return prisma.equipment.update({
    where: { id: equipment.id },
    data: {
      ...(tiered ? { powerBackupTier: input.tier, backupCapacityKva: input.tier === "GRID_STANDARD" ? null : input.capacityKva } : {}),
      tenantUnit: clean(input.tenantUnit, 120),
    },
    select: { id: true, powerBackupTier: true, backupCapacityKva: true, tenantUnit: true },
  });
}
