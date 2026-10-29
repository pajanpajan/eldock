// Správa areálů (závodů): založení nového čistého areálu ze Studia.
// Záměrně bez `server-only` (testy nad SQLite).

import type { PrismaClient } from "@/generated/prisma/client";
import { WorkflowError } from "@/lib/workflow/state-machine";

export interface CreatePlantInput {
  name: string;
  code: string;
  /** Město, případně „Ulice 12, Město“ – poslední část za čárkou je město. */
  location?: string | null;
  customerName?: string | null;
}

export async function createPlant(prisma: PrismaClient, input: CreatePlantInput) {
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  if (name.length < 3) throw new WorkflowError("VALIDATION", "Zadejte název areálu.");
  if (!/^[A-Z0-9]{2,6}$/.test(code)) throw new WorkflowError("VALIDATION", "Kód areálu: 2–6 písmen nebo číslic (např. TUR).");
  if (await prisma.plant.findUnique({ where: { code }, select: { id: true } })) {
    throw new WorkflowError("CONFLICT", `Areál s kódem ${code} už existuje.`);
  }
  const parts = (input.location ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const city = parts.length ? parts[parts.length - 1] : null;
  const address = parts.length > 1 ? parts.slice(0, -1).join(", ") : null;
  return prisma.plant.create({
    data: { code, name, city, address, customerName: input.customerName?.trim() || name },
  });
}
