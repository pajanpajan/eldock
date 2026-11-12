"use server";

import { z } from "zod";

import type { EtimFrame } from "@/lib/panel-builder/abb-etim.generated";
import { catalogEans, etimFramesFor } from "@/server/catalog-data";

import type { ActionResult } from "./workflow";

// Fáze 104: katalogová data ze serveru jen po kouscích a jen přihlášeným – EAN položek vlastního kusovníku a rámečky
// zvolené řady (celé importy ETIM jsou `server-only`, do klientského bundlu se nedostanou).

// Přihlášení se ověří až při volání – modul importují klientské komponenty galerie (i v testech bez databáze)
const hasCatalogSession = async () => (await import("@/server/catalog-access")).hasCatalogSession();

const itemsSchema = z.array(z.object({ code: z.string().trim().min(1).max(80), box: z.boolean().optional() })).max(500);

/** EAN objednacích čísel položek kusovníku 2D půdorysu (přístroje ABB ETIM 9.0, krabice KOPOS). */
export async function catalogEansAction(items: z.input<typeof itemsSchema>): Promise<ActionResult<Record<string, string>>> {
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: "Neplatný seznam položek kusovníku." };
  if (!(await hasCatalogSession())) return { ok: false, error: "Objednací údaje výrobců jsou jen pro přihlášené." };
  return { ok: true, data: catalogEans(parsed.data) };
}

/** Rámečky 1R–5R barvy řady podle oficiálních dat ABB ETIM 9.0 (galerie designových řad). */
export async function etimFramesAction(key: string): Promise<ActionResult<EtimFrame[] | null>> {
  if (!z.string().min(3).max(120).safeParse(key).success) return { ok: false, error: "Neplatná řada." };
  if (!(await hasCatalogSession())) return { ok: false, error: "Objednací údaje výrobců jsou jen pro přihlášené." };
  return { ok: true, data: etimFramesFor(key) };
}
