"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { turnkeyConfigSchema, type FactoryTestInput } from "@/lib/panel-builder/turnkey-manufacturing";

import type { ActionResult } from "./workflow";

// Fáze 106: výroba rozváděče na klíč – poptávka firmy AI Panel Builderu, kroky výrobce v portálu /vyroba-rozvadecu
// (přijetí, kusová zkouška, dokončení s uzamčením Verze 1.0) a správa výrobců ve velínu. Databáze a sezení se načtou až
// při volání (modul importují klientské komponenty).

const id = z.string().min(1).max(64);

const deps = async () => {
  const [{ prisma }, services, guards] = await Promise.all([import("@/lib/prisma"), import("@/server/services/manufacturing"), import("@/server/panel-guards")]);
  return { prisma, services, guards };
};

const orderInput = z.object({
  projectId: id,
  manufacturerId: id.nullable(),
  region: z.string().min(3).max(60),
  config: turnkeyConfigSchema,
  contactName: z.string().trim().min(3).max(80),
  contactEmail: z.string().trim().email().max(120),
  contactPhone: z.string().trim().max(40).optional(),
  deliveryAddress: z.string().trim().max(200).optional(),
  note: z.string().trim().max(1000).optional(),
});

/** 🏭 Poptávka výroby na klíč – orientační kalkulace se spočte na serveru, QR štítek se zarezervuje z registru. */
export async function createManufacturingOrderAction(input: z.input<typeof orderInput>): Promise<ActionResult<{ number: string; qrSerial: string }>> {
  const parsed = orderInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte kontakt a výběr výrobce." };
  const { prisma, services, guards } = await deps();
  try {
    const company = await guards.guardProject(parsed.data.projectId);
    const { turnkeyEstimateOf } = await import("@/server/turnkey-data");
    const { estimate, blockers } = await turnkeyEstimateOf(parsed.data.projectId);
    if (blockers.length) return { ok: false, error: `Před výrobou doplňte: ${blockers.join(" ")}` };
    const order = await services.createManufacturingOrder(prisma, { ...parsed.data, companyId: company.id, estimate });
    const { notifyManufacturers } = await import("@/server/turnkey-data");
    await notifyManufacturers(order.id).catch((error) => console.error("[eldock] Oznámení výrobcům se nepodařilo odeslat:", error));
    revalidatePath(`/panel-builder/${parsed.data.projectId}`, "layout");
    return { ok: true, data: { number: order.number, qrSerial: order.qrSerial } };
  } catch (error) {
    return guards.actionFailure(error, "Poptávku výroby se nepodařilo odeslat.");
  }
}

// ---------------------------------------------------------------------------------------------------------------------
//  Portál výrobce
// ---------------------------------------------------------------------------------------------------------------------

const manufacturerOf = async () => (await import("@/server/manufacturer-session")).getManufacturer();

export async function signInManufacturerAction(email: string, code: string): Promise<ActionResult<{ name: string }>> {
  if (!z.string().email().safeParse(email.trim()).success || code.trim().length < 6) return { ok: false, error: "Zadejte e-mail a přístupový kód z velínu ELDOCK." };
  const { prisma, services } = await deps();
  const manufacturer = await services.authenticateManufacturer(prisma, email, code);
  if (!manufacturer) return { ok: false, error: "E-mail nebo přístupový kód nesouhlasí (nebo výrobce není aktivní)." };
  await (await import("@/server/manufacturer-session")).signInManufacturer(manufacturer.id);
  return { ok: true, data: { name: manufacturer.name } };
}

export async function signOutManufacturerAction(): Promise<ActionResult<null>> {
  await (await import("@/server/manufacturer-session")).signOutManufacturer();
  return { ok: true, data: null };
}

/** ✅ Přijmout zakázku do výroby (cena a termín). */
export async function acceptManufacturingOrderAction(orderId: string, priceCzk: number, days: number): Promise<ActionResult<{ number: string }>> {
  const manufacturer = await manufacturerOf();
  if (!manufacturer) return { ok: false, error: "Přihlaste se do portálu výrobců." };
  const { prisma, services, guards } = await deps();
  try {
    const result = await services.acceptManufacturingOrder(prisma, { orderId, manufacturerId: manufacturer.id, priceCzk, days });
    revalidatePath("/vyroba-rozvadecu", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return guards.actionFailure(error, "Zakázku se nepodařilo přijmout.");
  }
}

/** 🧪 Výstupní kusová zkouška výrobce. */
export async function recordFactoryTestAction(orderId: string, test: FactoryTestInput): Promise<ActionResult<{ issues: string[] }>> {
  const manufacturer = await manufacturerOf();
  if (!manufacturer) return { ok: false, error: "Přihlaste se do portálu výrobců." };
  const { prisma, services, guards } = await deps();
  try {
    const result = await services.recordFactoryTest(prisma, { orderId, manufacturerId: manufacturer.id, test });
    revalidatePath("/vyroba-rozvadecu", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return guards.actionFailure(error, "Protokol kusové zkoušky se nepodařilo uložit.");
  }
}

/** 🔒 Dokončit výrobu, uzamknout Verzi 1.0 pod QR štítkem a expedovat. */
export async function completeManufacturingOrderAction(orderId: string): Promise<ActionResult<{ version: string; serial: string }>> {
  const manufacturer = await manufacturerOf();
  if (!manufacturer) return { ok: false, error: "Přihlaste se do portálu výrobců." };
  const { guards } = await deps();
  try {
    const { completeOrder } = await import("@/server/turnkey-data");
    const result = await completeOrder(orderId, manufacturer.id);
    revalidatePath("/vyroba-rozvadecu", "layout");
    revalidatePath(`/q/${result.serial}`);
    return { ok: true, data: { version: result.version, serial: result.serial } };
  } catch (error) {
    return guards.actionFailure(error, "Dokončení výroby a uzamčení dokumentace se nepodařilo.");
  }
}

// ---------------------------------------------------------------------------------------------------------------------
//  Velín – zasmluvnění výrobci
// ---------------------------------------------------------------------------------------------------------------------

const manufacturerInput = z.object({ name: z.string().trim().min(3).max(120), email: z.string().trim().email().max(120), region: z.string().min(3).max(60), ico: z.string().trim().max(12).optional(), phone: z.string().trim().max(40).optional(), leadDays: z.coerce.number().int().min(1).max(60).optional() });

export async function createManufacturerAction(input: z.input<typeof manufacturerInput>): Promise<ActionResult<{ name: string; email: string; code: string }>> {
  if (!(await (await import("@/server/superadmin-session")).isSuperadmin())) return { ok: false, error: "Jen pro velín." };
  const parsed = manufacturerInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zadejte název, e-mail a kraj výrobce." };
  const { prisma, services, guards } = await deps();
  try {
    const created = await services.createManufacturer(prisma, parsed.data);
    revalidatePath("/superadmin");
    return { ok: true, data: { name: created.name, email: created.email, code: created.code } };
  } catch (error) {
    return guards.actionFailure(error, "Výrobce se nepodařilo uložit.");
  }
}

export async function setManufacturerActiveAction(manufacturerId: string, active: boolean): Promise<ActionResult<null>> {
  if (!(await (await import("@/server/superadmin-session")).isSuperadmin())) return { ok: false, error: "Jen pro velín." };
  const { prisma } = await deps();
  await prisma.panelManufacturer.update({ where: { id: manufacturerId }, data: { active } });
  revalidatePath("/superadmin");
  return { ok: true, data: null };
}
