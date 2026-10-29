// Správa podúčtů závodu (jen technický ředitel – kontrola oprávnění je v Server Action).
// Záměrně bez `server-only` (testy nad SQLite).

import type { AccountType } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { ACCOUNT_TYPES } from "@/lib/accounts";
import { ALL_LAYERS, type LayerKey } from "@/lib/map-layers";
import { WorkflowError } from "@/lib/workflow/state-machine";

export interface CreateSubAccountInput {
  name: string;
  email: string;
  title?: string | null;
  accountType: AccountType;
  /** Vlastní výřez kategorií; prázdné = výchozí výřez typu účtu. */
  layers?: LayerKey[];
}

export async function createSubAccount(prisma: PrismaClient, input: CreateSubAccountInput) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 3) throw new WorkflowError("VALIDATION", "Zadejte jméno a příjmení.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new WorkflowError("VALIDATION", "Zadejte platný e-mail.");
  const layers = [...new Set(input.layers ?? [])].filter((layer) => ALL_LAYERS.has(layer));
  const definition = ACCOUNT_TYPES[input.accountType];
  // Výřez shodný s výchozím se neukládá (účet sleduje případné změny výchozího výřezu).
  const custom = layers.length && !(layers.length === definition.layers.length && layers.every((layer) => definition.layers.includes(layer)));

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new WorkflowError("CONFLICT", `Účet s e-mailem ${email} už existuje.`);
  }
  const last = await prisma.user.findFirst({ where: { accountType: { not: null } }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return prisma.user.create({
    data: {
      name,
      email,
      title: input.title?.trim() || definition.label,
      role: definition.workflowRole,
      accountType: input.accountType,
      scopeLayers: custom ? layers.join(",") : null,
      company: "Podúčet závodu",
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
}
