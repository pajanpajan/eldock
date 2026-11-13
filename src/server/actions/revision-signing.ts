"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { brandEnv } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientIpOf } from "@/lib/request-guard";
import { MONTH_PATTERN, RCD_TYPES, SIGNABLE_TYPES, inspectorProfileSchema, type InspectorProfileView } from "@/lib/revision-signature";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { storePlantFile } from "@/server/file-access";
import { smtpTransportFromEnv } from "@/server/mailer";
import { assertPermission } from "@/server/permissions";
import { canAccessEquipment, plantAccessWhere } from "@/server/queries/plant";
import { getCurrentUser } from "@/server/session";
import { ipKeyOf } from "@/server/services/account-security";
import { MAX_BATCH } from "@/server/services/inspection";
import {
  assertMailQuota,
  flagMisuse,
  listInspectorProfiles,
  recordSignedRevision,
  saveInspectorProfile,
  sendMonthlyReport,
  verifySeal,
} from "@/server/services/revision-signing";
import { readStoredFile } from "@/server/storage";
import { assertEntityAccess } from "@/server/tenant";

import type { ActionResult } from "./workflow";

// Fáze 108: tenké Server Actions podepsané revize – profily techniků závodu, zápis s podpisem / PINem / pečetí,
// ověření pečeti, zneplatnění cizí revize a měsíční report TIČR. Oddělení firem: závod, zařízení, profil i záznam
// musí ležet v závodech přihlášeného uživatele.

const id = z.string().min(1).max(64);
const pin = z.string().regex(/^\d{4,8}$/, "PIN má 4–8 číslic.");
const optionalNumber = (max: number) => z.number().min(0).max(max).nullable();

async function run<T>(action: () => Promise<T>, fallback: string, revalidate = true): Promise<ActionResult<T>> {
  try {
    const data = await action();
    if (revalidate) revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Neplatná data formuláře." };
    console.error(error);
    return { ok: false, error: fallback };
  }
}

async function requestContext() {
  const [list, user] = await Promise.all([headers(), getCurrentUser()]);
  const ip = clientIpOf(list);
  return { ip, ipKey: ipKeyOf(ip), userAgent: list.get("user-agent"), actorId: user?.id ?? null, origin: brandEnv("PUBLIC_URL") ?? `https://${list.get("host") ?? "eldock.cz"}` };
}

/** Profily revizních techniků závodu (formulář revize, report TIČR). */
export async function listInspectorProfilesAction(plantId: string): Promise<ActionResult<InspectorProfileView[]>> {
  return run(
    async () => {
      await assertPermission("inspections");
      const parsed = id.parse(plantId);
      await assertEntityAccess("plant", parsed);
      return listInspectorProfiles(prisma, { plantId: parsed });
    },
    "Profily techniků se nepodařilo načíst.",
    false,
  );
}

export async function saveInspectorProfileAction(input: z.input<typeof inspectorProfileSchema>) {
  return run(async () => {
    await assertPermission("recordInspection");
    const data = inspectorProfileSchema.parse(input);
    await assertEntityAccess("plant", data.plantId);
    if (data.inspectorProfileId) await assertEntityAccess("inspectorProfile", data.inspectorProfileId);
    const context = await requestContext();
    return saveInspectorProfile(prisma, data, { ...context, createdById: context.actorId });
  }, "Profil technika se nepodařilo uložit.");
}

const measurementsSchema = z.object({
  insulationResistance: optionalNumber(100_000),
  insulationTestVoltage: z.number().int().min(50).max(5000).nullable(),
  insulationAbove: z.boolean(),
  protectiveConductorResistance: optionalNumber(100),
  loopImpedance: optionalNumber(100),
  shortCircuitA: optionalNumber(1_000_000),
  rcdRatedMa: z.number().min(6).max(1000).nullable(),
  rcdTripTimeMs: optionalNumber(5000),
  rcdType: z.enum(RCD_TYPES),
  connectionsOk: z.boolean().nullable(),
});

const signedSchema = z.object({
  equipmentIds: z.array(id).min(1).max(MAX_BATCH),
  inspectorProfileId: id,
  pin,
  type: z.enum(SIGNABLE_TYPES),
  intervalYears: z.number().int().min(1).max(4).nullable(),
  inspectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reportNumber: z.string().trim().max(60).optional().nullable(),
  extraordinaryReason: z.string().trim().max(500).optional().nullable(),
  measurements: measurementsSchema,
  result: z.enum(["CAPABLE", "CAPABLE_WITH_DEFECTS", "INCAPABLE"]),
  defectsSummary: z.string().max(4000).optional().nullable(),
  // ~300 kB PNG v base64
  signaturePng: z.string().max(420_000).optional().nullable(),
  rememberSignature: z.boolean().optional(),
  confirmMeasured: z.boolean(),
});

/** ⚡ Podepsaná revize jednoho zařízení i sloučeného výjezdu (jeden protokol, pečeť SHA-256). */
export async function recordSignedRevisionAction(input: z.input<typeof signedSchema>) {
  return run(async () => {
    await assertPermission("recordInspection");
    const data = signedSchema.parse(input);
    if (!(await canAccessEquipment(data.equipmentIds))) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
    await assertEntityAccess("inspectorProfile", data.inspectorProfileId);
    const context = await requestContext();
    return recordSignedRevision(prisma, data, {
      ...context,
      storeSignature: async (png) => (await storePlantFile("attachments", ".png", png)).url,
      storeReport: async (svg) => (await storePlantFile("documents", ".svg", svg)).url,
      loadFile: async (url) => (await readStoredFile(url))?.bytes ?? null,
    });
  }, "Revizi se nepodařilo podepsat. Zkuste to prosím znovu.");
}

/** Přepočet pečeti SHA-256 z uložených údajů protokolu. */
export async function verifySealAction(inspectionId: string) {
  return run(
    async () => {
      await assertPermission("inspections");
      const parsed = id.parse(inspectionId);
      await assertEntityAccess("inspection", parsed);
      return verifySeal(prisma, parsed);
    },
    "Pečeť se nepodařilo ověřit.",
    false,
  );
}

const misuseSchema = z.object({ inspectionId: id, inspectorProfileId: id, pin, note: z.string().max(500).optional().nullable() });

/** 🚨 Nahlásit zneužití / Tato revize není moje! */
export async function flagMisuseAction(input: z.input<typeof misuseSchema>) {
  return run(async () => {
    await assertPermission("recordInspection");
    const data = misuseSchema.parse(input);
    await assertEntityAccess("inspection", data.inspectionId);
    await assertEntityAccess("inspectorProfile", data.inspectorProfileId);
    return flagMisuse(prisma, data, await requestContext());
  }, "Záznam se nepodařilo zneplatnit. Zkuste to prosím znovu.");
}

const monthSchema = z.object({ inspectorProfileId: id, month: z.string().regex(MONTH_PATTERN) });

/** 📧 Odeslat kontrolní report na můj e-mail ihned (report pokrývá závody přihlášeného účtu). */
export async function sendMonthlyReportAction(input: z.input<typeof monthSchema>) {
  return run(
    async () => {
      await assertPermission("recordInspection");
      const data = monthSchema.parse(input);
      await assertEntityAccess("inspectorProfile", data.inspectorProfileId);
      const context = await requestContext();
      await assertMailQuota(prisma, context.actorId);
      return sendMonthlyReport(prisma, {
        profileId: data.inspectorProfileId,
        month: data.month,
        origin: context.origin,
        transport: smtpTransportFromEnv(),
        triggeredBy: context.actorId ?? "user",
        plant: await plantAccessWhere(),
      });
    },
    "Report se nepodařilo odeslat.",
    false,
  );
}

const monthlyToggleSchema = z.object({ inspectorProfileId: id, enabled: z.boolean() });

/** [✓] Zasílat vždy 1. den v měsíci souhrnný bezpečnostní výpis na e-mail technika. */
export async function setMonthlyEmailAction(input: z.input<typeof monthlyToggleSchema>) {
  return run(async () => {
    await assertPermission("recordInspection");
    const data = monthlyToggleSchema.parse(input);
    await assertEntityAccess("inspectorProfile", data.inspectorProfileId);
    const profile = await prisma.inspectorProfile.findUnique({ where: { id: data.inspectorProfileId }, select: { email: true } });
    if (data.enabled && !profile?.email) throw new WorkflowError("VALIDATION", "Profil technika nemá e-mail – doplňte ho v profilu.");
    await prisma.inspectorProfile.update({ where: { id: data.inspectorProfileId }, data: { monthlyEmail: data.enabled } });
    return { enabled: data.enabled };
  }, "Nastavení se nepodařilo uložit.");
}

/** Závod a profily techniků pro vybraná zařízení (formulář revize z karty, hromadné revize, výjezdu i QR). */
export async function profilesForEquipmentAction(equipmentIds: string[]) {
  return run(
    async () => {
      await assertPermission("inspections");
      const ids = z.array(id).min(1).max(MAX_BATCH).parse(equipmentIds);
      if (!(await canAccessEquipment(ids))) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
      const plants = await prisma.plant.findMany({
        where: { buildings: { some: { floors: { some: { equipment: { some: { id: { in: ids } } } } } } } },
        select: { id: true, name: true },
      });
      if (plants.length !== 1) throw new WorkflowError("VALIDATION", "Sloučená revize musí být v jednom závodě – vyberte zařízení jednoho závodu.");
      return { plantId: plants[0].id, plantName: plants[0].name, profiles: await listInspectorProfiles(prisma, { plantId: plants[0].id }) };
    },
    "Profily techniků se nepodařilo načíst.",
    false,
  );
}
