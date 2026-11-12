"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { actionFailure, guardCompany } from "@/server/panel-guards";
import { createCreditOrder } from "@/server/services/credits";

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
