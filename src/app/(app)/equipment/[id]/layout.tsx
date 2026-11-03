import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { canAccessPlant } from "@/server/queries/plant";

/** Karta zařízení jen v závodě, který aktuální uživatel smí vidět (fáze 41). */
export default async function EquipmentLayout({ children, params }: LayoutProps<"/equipment/[id]">) {
  const equipment = await prisma.equipment.findUnique({ where: { id: (await params).id }, select: { floor: { select: { building: { select: { plantId: true } } } } } });
  if (equipment && !(await canAccessPlant(equipment.floor.building.plantId))) notFound();
  return children;
}
