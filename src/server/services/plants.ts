// Správa areálů (závodů): založení nového čistého areálu (přepínač závodů, Studio „nový závod od nuly“).
// Záměrně bez `server-only` (testy nad SQLite).

import type { PrismaClient } from "@/generated/prisma/client";
import { CAMPUS_LIMITS, CAMPUS_METERS } from "@/lib/campus-layout";
import { WorkflowError } from "@/lib/workflow/state-machine";

import type { Tx } from "./workflow";

export interface CreatePlantInput {
  name: string;
  code: string;
  /** Město, případně „Ulice 12, Město“ – poslední část za čárkou je město. */
  location?: string | null;
  customerName?: string | null;
  /** Rozměr pozemku v metrech (výchozí 400 × 280 m). */
  widthM?: number;
  depthM?: number;
}

/** Ověří a znormalizuje údaje nového areálu (kód je unikátní napříč závody). */
export async function preparePlant(prisma: PrismaClient | Tx, input: CreatePlantInput) {
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  if (name.length < 3) throw new WorkflowError("VALIDATION", "Zadejte název areálu.");
  if (!/^[A-Z0-9]{2,6}$/.test(code)) throw new WorkflowError("VALIDATION", "Kód areálu: 2–6 písmen nebo číslic (např. TUR).");
  const widthM = Math.round(input.widthM ?? CAMPUS_METERS.width);
  const depthM = Math.round(input.depthM ?? CAMPUS_METERS.height);
  for (const value of [widthM, depthM]) {
    if (!(value >= CAMPUS_LIMITS.min && value <= CAMPUS_LIMITS.max)) {
      throw new WorkflowError("VALIDATION", `Rozměr areálu: ${CAMPUS_LIMITS.min}–${CAMPUS_LIMITS.max} m na každou stranu.`);
    }
  }
  if (await prisma.plant.findUnique({ where: { code }, select: { id: true } })) {
    throw new WorkflowError("CONFLICT", `Areál s kódem ${code} už existuje.`);
  }
  const parts = (input.location ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const city = parts.length ? parts[parts.length - 1] : null;
  const address = parts.length > 1 ? parts.slice(0, -1).join(", ") : null;
  return { code, name, city, address, customerName: input.customerName?.trim() || name, campusWidthM: widthM, campusDepthM: depthM };
}

export async function createPlant(prisma: PrismaClient | Tx, input: CreatePlantInput) {
  return prisma.plant.create({ data: await preparePlant(prisma, input) });
}
