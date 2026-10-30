import type { PrismaClient } from "@/generated/prisma/client";
import { newQrToken } from "@/lib/qr-label";
import { WorkflowError } from "@/lib/workflow/state-machine";

// Vizuální karta zařízení: fotografie a kód QR štítku.

async function assertEquipment(prisma: PrismaClient, equipmentId: string) {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: { id: true } });
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení neexistuje.");
}

/** Nastaví (nebo odebere) fotografii zařízení. */
export async function setEquipmentPhoto(prisma: PrismaClient, equipmentId: string, photoUrl: string | null) {
  await assertEquipment(prisma, equipmentId);
  return prisma.equipment.update({ where: { id: equipmentId }, data: { photoUrl }, select: { id: true, photoUrl: true } });
}

/** Přegeneruje kód QR štítku – původní fyzický štítek tím přestane platit. */
export async function regenerateQrToken(prisma: PrismaClient, equipmentId: string) {
  await assertEquipment(prisma, equipmentId);
  // Kolize 40bitového kódu je krajně nepravděpodobná, unikátní index ji přesto zachytí.
  for (let attempt = 0; attempt < 5; attempt++) {
    const qrToken = newQrToken();
    if (await prisma.equipment.findUnique({ where: { qrToken }, select: { id: true } })) continue;
    return prisma.equipment.update({ where: { id: equipmentId }, data: { qrToken }, select: { id: true, qrToken: true } });
  }
  throw new WorkflowError("CONFLICT", "Nový kód štítku se nepodařilo vygenerovat. Zkuste to znovu.");
}
