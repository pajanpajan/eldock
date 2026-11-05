"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { actionFailure, guardCompany, guardProject } from "@/server/panel-guards";
import { createAiFeedback, createCreditOrder } from "@/server/services/credits";

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

const feedbackSchema = z.object({ projectId: z.string().min(1).max(64), message: z.string().trim().min(3).max(2000) });

/** 🐛 Nahlásit chybu AI: poznámka testera + fotka a snímek lišt a prvků projektu. */
export async function reportAiFeedbackAction(input: z.input<typeof feedbackSchema>): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Napište krátký popis chyby (aspoň 3 znaky)." };
  try {
    const company = await guardProject(parsed.data.projectId);
    await createAiFeedback(prisma, company.id, parsed.data.projectId, parsed.data.message);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "Hlášení se nepodařilo odeslat.");
  }
}
