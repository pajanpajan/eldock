"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { actionFailure, guardCompany } from "@/server/panel-guards";
import { createCreditOrder, unlockOutput } from "@/server/services/credits";

import type { ActionResult } from "./workflow";

// AI Panel Builder (fáze 50): objednávka balíčku kreditů a hlášení chyby AI rozpoznání.

/** [ Objednat balíček ] → objednávka s variabilním symbolem (QR platba a zálohová faktura na její stránce). */
export async function createCreditOrderAction(packageCode: string): Promise<ActionResult<{ id: string; variableSymbol: string }>> {
  if (!z.string().max(40).safeParse(packageCode).success) return { ok: false, error: "Neznámý balíček." };
  try {
    const company = await guardCompany();
    const order = await createCreditOrder(prisma, company.id, packageCode);
    revalidatePath("/panel-builder/credits");
    return { ok: true, data: { id: order.id, variableSymbol: order.variableSymbol } };
  } catch (error) {
    return actionFailure(error, "Objednávku se nepodařilo založit.");
  }
}

// Fáze 107: hlášení chyby AI posílá kontaktní modal (POST /api/contact → createAiFeedback k projektu přihlášené firmy).

/**
 * Fáze 111: odemčení výstupu z prodejního modalu – plná verze zkušebního rozváděče / půdorysu (bez zkušebního označení),
 * samostatná cenová nabídka nebo CNC výrobní balíček. Bez kreditů vrátí data prodejního modalu (`paywall`).
 */
export async function unlockOutputAction(kind: "switchboard" | "floorplan" | "quote" | "cnc", id: string): Promise<ActionResult<{ cost: number; license: string; balance: number }>> {
  if (!["switchboard", "floorplan", "quote", "cnc"].includes(kind) || !z.string().min(1).max(64).safeParse(id).success) return { ok: false, error: "Neplatné odemčení." };
  try {
    const company = await guardCompany();
    const result = await unlockOutput(prisma, company.id, kind, id);
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Výstup se nepodařilo odemknout.");
  }
}

