import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { collectFileUrls } from "@/lib/file-ownership";
import { assertPlantFiles } from "@/server/file-access";
import { plantAccessWhere } from "@/server/queries/plant";
import { FIELD_KINDS, assertAccessible, type EntityKind } from "@/server/services/tenant-access";

// Fáze 67: oddělení firem v serverových akcích. Akce nad daty závodu ověří, že záznamy ze vstupu patří do závodu
// přihlášeného uživatele (registrovaná firma jen svůj závod, obchodní demo jen demo závody) – stránky to hlídají už
// přes `plantAccessWhere`, akce dosud ne. Cizí nebo neexistující záznam = „nenalezeno“ (nic se neprozradí).
// Fáze 70: počty záznamů sdílí s úpravami z aplikací (`services/tenant-access.ts`).

type Plant = Prisma.PlantWhereInput;

/** Ověří záznamy jednoho druhu (prázdný výběr projde). */
export async function assertEntityAccess(kind: EntityKind, value: unknown, plant?: Plant) {
  await assertAccessible(prisma, kind, value, plant ?? (await plantAccessWhere()));
}

/**
 * Ověří všechna známá pole vstupu akce (`equipmentId`, `changeRequestId`, `defectId` …). Obecné pole `id` jen když
 * akce řekne, čeho je (`{ id: "temporaryMod" }`).
 */
export async function assertTenantAccess(input: unknown, options: { id?: EntityKind } = {}) {
  if (!input || typeof input !== "object") return;
  const record = input as Record<string, unknown>;
  const plant = await plantAccessWhere();
  for (const [field, kind] of Object.entries(FIELD_KINDS)) if (field in record) await assertEntityAccess(kind, record[field], plant);
  if (options.id && "id" in record) await assertEntityAccess(options.id, record.id, plant);
  // Fáze 68: soubory ze vstupu (fotky, přílohy, zprávy, zálohy SW) jen od vlastníka účtu – cizí soubor se nepřipojí
  await assertPlantFiles(collectFileUrls(record));
}
