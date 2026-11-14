"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { ItemConfig } from "@/lib/panel-builder/configurator";
import { MAX_RAIL_MODULES, MAX_RAILS, MIN_RAIL_MODULES } from "@/lib/panel-builder/rails";
import { actionFailure, guardCompany, guardEditableItem, guardEditableProject } from "@/server/panel-guards";
import { analyzeRailDetail, insertNextTo, moveItem } from "@/server/services/panel-design";
import { analyzeRailPhoto } from "@/server/services/geminiPanelService";
import { addItemWiring, searchWiringDevices, setItemWiringQuantity, setProjectFan, type WiringHit } from "@/server/services/panel-wiring";
import { assertPanelFiles } from "@/server/file-access";
import { readStoredFile } from "@/server/storage";
import { saveRoutineTest, setStandardEdition } from "@/server/services/panel-design";
import { ROUTINE_TEST_POINTS } from "@/lib/legislation-2027";
import { listEnclosures, moveRail, placeComponents, placeLintDevices, previewConfig, releaseEnclosureLimit, saveApplianceLibrary, saveCircuitChips, selectEnclosure, setCompanyBranding, setEnvironment, setRailCapacity, type ConfigPreview } from "@/server/services/panel-design";
import { MAX_CHIPS, type ChipSet } from "@/lib/panel-builder/circuit-chips";
import { applyProjectLayout, previewProjectLayouts, setAllRailCapacities, setRailComb, setRailFields } from "@/server/services/panel-design";
import { isCombSetting, type CombSetting } from "@/lib/panel-builder/comb-busbars";
import { LAYOUT_CONCEPTS } from "@/lib/panel-builder/rail-layout";
import type { LayoutChoice, LayoutPreviewDto } from "@/lib/panel-builder/layout-options";
import { MAX_APPLIANCES, parseApplianceList } from "@/lib/panel-builder/appliances";

import type { ActionResult } from "./workflow";

// Návrh rozváděče od nuly (fáze 43): lišty, osazení z kaskádového menu, skříně a razítko firmy.

const id = z.string().min(1).max(64);
const rail = z.number().int().min(1).max(MAX_RAILS);
const text = (max: number) => z.string().max(max).nullable().optional();

const configSchema = z.object({
  category: z.enum(["MCB", "RCD", "RCBO", "MAIN_SWITCH", "SPD", "CONTACTOR", "RELAY", "SMART_HOME", "OTHER", "ACCESSORY"]),
  manufacturer: z.string().trim().max(40).nullable(),
  poles: z.string().max(8),
  // Fáze 81: Loxone Power Supply & Backup má 18 M
  modules: z.number().positive().max(24),
  ratedCurrentA: z.number().positive().max(6300).nullable(),
  curve: text(2),
  breakingCapacityKa: z.number().positive().max(100).nullable().optional(),
  rcdType: text(3),
  rcdSensitivityMa: z.number().int().positive().max(1000).nullable().optional(),
  spdType: text(8),
  surgeCurrentKa: z.number().positive().max(200).nullable().optional(),
  contactConfig: text(10),
  coilVoltage: text(12),
  relaySubtype: text(20),
  moduleSubtype: text(24),
  power: text(12),
  // Fáze 81: chytrá domácnost – systém, funkce aktoru a počet kanálů
  smartSystem: text(24),
  smartRole: text(16),
  channels: z.number().int().positive().max(256).nullable().optional(),
});

/** Šířka DIN lišty v modulech (preset nebo − / +). */
export async function setRailCapacityAction(projectId: string, railIndex: number, modules: number): Promise<ActionResult<{ overflow: number }>> {
  if (!id.safeParse(projectId).success || !rail.safeParse(railIndex).success || !z.number().int().min(MIN_RAIL_MODULES).max(MAX_RAIL_MODULES).safeParse(modules).success) {
    return { ok: false, error: `Šířka lišty musí být ${MIN_RAIL_MODULES}–${MAX_RAIL_MODULES} modulů.` };
  }
  try {
    await guardEditableProject(projectId);
    const result = await setRailCapacity(prisma, projectId, railIndex, modules);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: { overflow: result.overflow } };
  } catch (error) {
    return actionFailure(error, "Šířku lišty se nepodařilo změnit.");
  }
}

/** Pořadí lišt: šipka nahoru / dolů. */
export async function moveRailAction(projectId: string, railIndex: number, direction: -1 | 1): Promise<ActionResult<{ rail: number }>> {
  if (!id.safeParse(projectId).success || !rail.safeParse(railIndex).success || (direction !== -1 && direction !== 1)) return { ok: false, error: "Neplatný přesun lišty." };
  try {
    await guardEditableProject(projectId);
    const result = await moveRail(prisma, projectId, railIndex, direction);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Lištu se nepodařilo přesunout.");
  }
}

/** Fáze 112: propojovací hřeben lišty (Auto / 3f / 1f / Vyp). */
export async function setRailCombAction(projectId: string, railIndex: number, setting: CombSetting): Promise<ActionResult<{ rail: number; setting: CombSetting }>> {
  if (!id.safeParse(projectId).success || !rail.safeParse(railIndex).success || !isCombSetting(setting)) return { ok: false, error: "Neplatná volba hřebenu." };
  try {
    await guardEditableProject(projectId);
    const result = await setRailComb(prisma, projectId, railIndex, setting);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Hřeben lišty se nepodařilo nastavit.");
  }
}

const placeSchema = z.object({
  projectId: id,
  config: configSchema,
  rail,
  count: z.number().int().min(1).max(24),
  position: z.number().int().min(1).max(200).nullable().optional(),
  circuitLabel: z.string().max(80).optional(),
});

/** Drag & drop / „➕ Vložit na aktivní lištu“ (1× / +3× / +6×). */
export async function placeComponentsAction(input: z.input<typeof placeSchema>): Promise<ActionResult<{ ids: string[]; placed: number; requested: number; typeCode: string }>> {
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatné osazení přístroje." };
  try {
    await guardEditableProject(parsed.data.projectId);
    const { projectId, ...rest } = parsed.data;
    const result = await placeComponents(prisma, projectId, { ...rest, config: rest.config as ItemConfig });
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Přístroj se nepodařilo vložit na lištu.");
  }
}

/** Fáze 93: oprava Elektro-linteru 1 klikem – doplnění přístrojů (CENTRAL STOP, elektroměr MID, okruh B) na lišty. */
const lintDevicesSchema = z.object({ projectId: id, devices: z.array(z.object({ config: configSchema, label: z.string().trim().max(160) })).min(1).max(6) });

export async function placeLintDevicesAction(input: z.input<typeof lintDevicesSchema>): Promise<ActionResult<{ placed: number }>> {
  const parsed = lintDevicesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatná oprava rozváděče." };
  try {
    await guardEditableProject(parsed.data.projectId);
    const placed = await placeLintDevices(prisma, parsed.data.projectId, parsed.data.devices.map((device) => ({ config: device.config as ItemConfig, label: device.label.slice(0, 80) })));
    revalidatePath(`/panel-builder/${parsed.data.projectId}`, "layout");
    return { ok: true, data: { placed: placed.length } };
  } catch (error) {
    return actionFailure(error, "Přístroje se nepodařilo doplnit na lištu.");
  }
}

/** Živá karta „Přiřazený přístroj k osazení“ (přesný typ, MPN, Pv a příslušenství z databáze). */
export async function previewConfigAction(config: z.input<typeof configSchema>): Promise<ActionResult<ConfigPreview>> {
  const parsed = configSchema.safeParse(config);
  if (!parsed.success) return { ok: false, error: "Neplatná konfigurace." };
  try {
    await guardCompany();
    return { ok: true, data: await previewConfig(prisma, parsed.data as ItemConfig) };
  } catch (error) {
    return actionFailure(error, "Náhled přístroje se nepodařilo načíst.");
  }
}

/** Skříně vybraného výrobce (seznam se zobrazí až po volbě výrobce). */
export async function listEnclosuresAction(manufacturer: string): Promise<ActionResult<Awaited<ReturnType<typeof listEnclosures>>>> {
  if (!z.string().trim().min(1).max(40).safeParse(manufacturer).success) return { ok: false, error: "Vyberte výrobce skříně." };
  try {
    await guardCompany();
    return { ok: true, data: await listEnclosures(prisma, manufacturer) };
  } catch (error) {
    return actionFailure(error, "Skříně se nepodařilo načíst.");
  }
}

/** Kliknutím na skříň se rozměry, model a P_max propíšou do projektu a výpočtu oteplení. */
export async function selectEnclosureAction(projectId: string, enclosureId: string): Promise<ActionResult<{ enclosureModel: string }>> {
  if (!id.safeParse(projectId).success || !id.safeParse(enclosureId).success) return { ok: false, error: "Neplatná skříň." };
  try {
    await guardEditableProject(projectId);
    const project = await selectEnclosure(prisma, projectId, enclosureId);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: { enclosureModel: project.enclosureModel } };
  } catch (error) {
    return actionFailure(error, "Skříň se nepodařilo vybrat.");
  }
}

/** Fáze 85: uvolnění omezení lišt skříní zvolenou při zakládání projektu. */
export async function releaseEnclosureLimitAction(projectId: string): Promise<ActionResult<{ released: true }>> {
  if (!id.safeParse(projectId).success) return { ok: false, error: "Neplatný projekt." };
  try {
    await guardEditableProject(projectId);
    await releaseEnclosureLimit(prisma, projectId);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: { released: true } };
  } catch (error) {
    return actionFailure(error, "Omezení skříně se nepodařilo uvolnit.");
  }
}

const imageUrl = z
  .string()
  .max(300)
  .regex(/^\/api\/files\/(photos|documents)\/[\w./-]+\.(png|jpe?g|svg|webp)$/i)
  .nullable()
  .optional();

/** Logo a razítko firmy v profilu (propisují se do dokumentace kroku 5). */
export async function setCompanyBrandingAction(input: { logoUrl?: string | null; stampUrl?: string | null }): Promise<ActionResult<{ logoUrl: string | null; stampUrl: string | null }>> {
  const parsed = z.object({ logoUrl: imageUrl, stampUrl: imageUrl }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nahrajte obrázek PNG, JPG nebo SVG." };
  try {
    const company = await guardCompany();
    await assertPanelFiles(company.id, [parsed.data.logoUrl, parsed.data.stampUrl]);
    const result = await setCompanyBranding(prisma, company.id, parsed.data);
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: { logoUrl: result.logoUrl, stampUrl: result.stampUrl } };
  } catch (error) {
    return actionFailure(error, "Logo nebo razítko se nepodařilo uložit.");
  }
}

/** Prostředí instalace (ČSN 33 2000-5-51 ed. 3) – nastaví i teplotu okolí pro oteplení. */
export async function setEnvironmentAction(projectId: string, environment: string): Promise<ActionResult<{ ambientTempC: number }>> {
  if (!id.safeParse(projectId).success || !z.string().max(20).safeParse(environment).success) return { ok: false, error: "Neplatné prostředí." };
  try {
    await guardEditableProject(projectId);
    const result = await setEnvironment(prisma, projectId, environment);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: { ambientTempC: result.ambientTempC } };
  } catch (error) {
    return actionFailure(error, "Prostředí se nepodařilo uložit.");
  }
}

const chipSchema = z.object({
  updatedAt: z.number().int().nonnegative(),
  chips: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        label: z.string().trim().min(1).max(40),
        numbered: z.boolean().optional(),
        preset: z
          .object({
            category: z.enum(["MCB", "RCD", "RCBO", "MAIN_SWITCH", "SPD", "CONTACTOR", "RELAY", "SMART_HOME", "OTHER", "ACCESSORY"]),
            poles: z.string().max(8).optional(),
            curve: z.string().max(2).optional(),
            ratedCurrentA: z.number().positive().max(6300).optional(),
          })
          .nullable()
          .optional(),
      }),
    )
    .max(MAX_CHIPS),
});

const applianceSchema = z.object({ specs: z.array(z.unknown()).max(MAX_APPLIANCES), updatedAt: z.number().int().nonnegative() });

/** Fáze 63: knihovna samostatných spotřebičů 2D půdorysu – synchronizace z prohlížeče do firmy (novější vyhrává). */
export async function saveApplianceLibraryAction(input: z.input<typeof applianceSchema>): Promise<ActionResult<{ saved: boolean }>> {
  const parsed = applianceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatná knihovna spotřebičů." };
  try {
    const company = await guardCompany();
    const result = await saveApplianceLibrary(prisma, company.id, { specs: parseApplianceList(parsed.data.specs), updatedAt: parsed.data.updatedAt });
    return { ok: true, data: { saved: result.saved } };
  } catch (error) {
    return actionFailure(error, "Knihovnu spotřebičů se nepodařilo uložit.");
  }
}

/** Štítky funkce obvodu – synchronizace z prohlížeče do firmy (novější vyhrává). */
export async function saveCircuitChipsAction(input: z.input<typeof chipSchema>): Promise<ActionResult<{ saved: boolean; set: ChipSet }>> {
  const parsed = chipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatné štítky." };
  try {
    const company = await guardCompany();
    return { ok: true, data: await saveCircuitChips(prisma, company.id, parsed.data as ChipSet) };
  } catch (error) {
    return actionFailure(error, "Štítky se nepodařilo uložit.");
  }
}

/** Edice normy rozváděče (krok 1 a krok 5) – propisuje se do Listu 5 a 6 dokumentace. */
export async function setStandardEditionAction(projectId: string, edition: string): Promise<ActionResult> {
  if (!id.safeParse(projectId).success || !z.string().max(30).safeParse(edition).success) return { ok: false, error: "Neplatná norma." };
  try {
    await guardEditableProject(projectId);
    await setStandardEdition(prisma, projectId, edition);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "Normu se nepodařilo změnit.");
  }
}

const result = z.enum(["PASS", "FAIL"]).nullable();
const routineSchema = z.object({
  points: z.object(Object.fromEntries(ROUTINE_TEST_POINTS.map((point) => [point.id, result])) as Record<(typeof ROUTINE_TEST_POINTS)[number]["id"], typeof result>),
  insulationMOhm: z.number().min(0).max(100_000).nullable(),
  testedBy: z.string().max(120),
  testedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  note: z.string().max(1000),
});

/** Protokol o kusové zkoušce – autosave z kroku 5. */
export async function saveRoutineTestAction(projectId: string, test: z.input<typeof routineSchema>): Promise<ActionResult<{ verdict: string; missing: string[] }>> {
  const parsed = routineSchema.safeParse(test);
  if (!id.safeParse(projectId).success || !parsed.success) return { ok: false, error: "Neplatný protokol kusové zkoušky." };
  try {
    await guardEditableProject(projectId, { allowPending: true });
    const saved = await saveRoutineTest(prisma, projectId, parsed.data);
    revalidatePath(`/panel-builder/${projectId}/documentation`);
    return { ok: true, data: { verdict: saved.verdict, missing: saved.missing } };
  } catch (error) {
    return actionFailure(error, "Protokol se nepodařilo uložit.");
  }
}

/** „➕ Přidat prvek vpravo“ / „📑 Duplikovat prvek“ vedle vybraného přístroje. */
export async function insertNextToAction(itemId: string, mode: "blank" | "duplicate"): Promise<ActionResult<{ id: string }>> {
  if (!id.safeParse(itemId).success || (mode !== "blank" && mode !== "duplicate")) return { ok: false, error: "Neplatný prvek." };
  try {
    await guardEditableItem(itemId);
    const result = await insertNextTo(prisma, itemId, mode);
    revalidatePath(`/panel-builder/${result.projectId}`, "layout");
    return { ok: true, data: { id: result.id } };
  } catch (error) {
    return actionFailure(error, mode === "duplicate" ? "Prvek se nepodařilo duplikovat." : "Prvek se nepodařilo přidat.");
  }
}

/** Fáze 59: přesun přístroje na pozici / jinou lištu (strom a konfigurace zůstávají). */
export async function moveItemAction(itemId: string, target: { rail: number; position: number }): Promise<ActionResult<{ rail: number; position: number }>> {
  const parsed = z.object({ rail, position: z.number().int().min(1).max(200) }).safeParse(target);
  if (!id.safeParse(itemId).success || !parsed.success) return { ok: false, error: "Neplatný přesun přístroje." };
  try {
    await guardEditableItem(itemId);
    const result = await moveItem(prisma, itemId, parsed.data.rail, parsed.data.position);
    revalidatePath(`/panel-builder/${result.projectId}`, "layout");
    return { ok: true, data: { rail: result.rail, position: result.position } };
  } catch (error) {
    return actionFailure(error, "Přístroj se nepodařilo přesunout.");
  }
}

const photoUrl = z.string().max(300).regex(/^\/api\/files\/photos\/[\w./-]+$/);

/** Pravidlo F: detailní fotka DIN lišty / sekce – AI přečte přístroje lišty z ostrého detailu. */
export async function analyzeRailDetailAction(projectId: string, railIndex: number, url: string): Promise<ActionResult<{ mode: string; total: number; unresolved: number; warning?: string }>> {
  if (!id.safeParse(projectId).success || !rail.safeParse(railIndex).success || !photoUrl.safeParse(url).success) return { ok: false, error: "Neplatná fotka lišty." };
  try {
    const company = await guardEditableProject(projectId);
    await assertPanelFiles(company.id, [url]);
    const result = await analyzeRailDetail(prisma, projectId, railIndex, url, { analyze: analyzeRailPhoto, readPhoto: readStoredFile });
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Detailní fotku lišty se nepodařilo zpracovat.");
  }
}

// ---------------------------------------------------------------------------
//  Fáze 47: domovní instalace obvodu a ventilátor skříně
// ---------------------------------------------------------------------------

/** Našeptávač katalogu domovní instalace (vypínače, zásuvky, rámečky). */
export async function searchWiringAction(query: string): Promise<ActionResult<WiringHit[]>> {
  if (typeof query !== "string" || query.length > 120) return { ok: false, error: "Neplatný dotaz." };
  try {
    await guardCompany();
    return { ok: true, data: await searchWiringDevices(prisma, query) };
  } catch (error) {
    return actionFailure(error, "Hledání v katalogu domovní instalace selhalo.");
  }
}

const wiringSchema = z.object({ wiringDeviceId: id, quantity: z.number().int().min(1).max(200), room: z.string().max(80).nullish() });

/** Přiřadí vypínač / zásuvku k obvodu (prvku rozváděče). */
export async function addItemWiringAction(itemId: string, input: z.input<typeof wiringSchema>): Promise<ActionResult> {
  const parsed = wiringSchema.safeParse(input);
  if (!id.safeParse(itemId).success || !parsed.success) return { ok: false, error: "Neplatný přístroj domovní instalace." };
  try {
    await guardEditableItem(itemId);
    await addItemWiring(prisma, itemId, parsed.data);
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "Přístroj se nepodařilo přiřadit.");
  }
}

/** Změna počtu kusů přiřazeného přístroje (0 = odebrat). */
export async function setItemWiringQuantityAction(itemId: string, wiringId: string, quantity: number): Promise<ActionResult> {
  if (!id.safeParse(itemId).success || !id.safeParse(wiringId).success || !z.number().int().min(0).max(200).safeParse(quantity).success) return { ok: false, error: "Neplatný počet." };
  try {
    await guardEditableItem(itemId);
    await setItemWiringQuantity(prisma, itemId, wiringId, quantity);
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "Počet se nepodařilo uložit.");
  }
}

/** Ventilátor skříně v kroku oteplení (null = bez ventilátoru). */
export async function setProjectFanAction(projectId: string, fanId: string | null, count: number): Promise<ActionResult<{ fanId: string | null; fanCount: number }>> {
  if (!id.safeParse(projectId).success || (fanId !== null && !id.safeParse(fanId).success) || !z.number().int().min(1).max(6).safeParse(count).success) return { ok: false, error: "Neplatný ventilátor." };
  try {
    await guardEditableProject(projectId);
    const data = await setProjectFan(prisma, projectId, fanId, count);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data };
  } catch (error) {
    return actionFailure(error, "Ventilátor se nepodařilo uložit.");
  }
}

// ---------------------------------------------------------------------------
//  Fáze 111: 📐 Uspořádání skříně a lišt (Silnoproud / Slaboproud)
// ---------------------------------------------------------------------------

const layoutChoiceSchema = z.object({
  concept: z.enum(LAYOUT_CONCEPTS as unknown as [string, ...string[]]),
  enclosureId: id.nullable().optional(),
  secondEnclosureId: id.nullable().optional(),
  fillRows: z.boolean().optional(),
});

/** Náhled čtyř koncepcí uspořádání osazeného rozváděče se skutečnými skříněmi z databáze. */
export async function previewProjectLayoutsAction(projectId: string): Promise<ActionResult<LayoutPreviewDto>> {
  if (!id.safeParse(projectId).success) return { ok: false, error: "Neplatný projekt." };
  try {
    await guardEditableProject(projectId);
    return { ok: true, data: await previewProjectLayouts(prisma, projectId) };
  } catch (error) {
    return actionFailure(error, "Koncepce uspořádání se nepodařilo spočítat.");
  }
}

/** Přeuspořádání rozváděče podle zvolené koncepce (dva rozváděče = nový propojený projekt RH2 bez kreditu). */
export async function applyProjectLayoutAction(projectId: string, choice: LayoutChoice): Promise<ActionResult<{ rails: number; enclosure: string | null; secondId: string | null }>> {
  const parsed = layoutChoiceSchema.safeParse(choice);
  if (!id.safeParse(projectId).success || !parsed.success) return { ok: false, error: "Neplatná koncepce uspořádání." };
  try {
    await guardEditableProject(projectId);
    const result = await applyProjectLayout(prisma, projectId, parsed.data as LayoutChoice);
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: { rails: result.rails, enclosure: result.enclosure, secondId: result.secondId } };
  } catch (error) {
    return actionFailure(error, "Uspořádání se nepodařilo použít.");
  }
}

/** „Šířka všech lišt“ – všechny lišty na zvolenou šířku a přístroje znovu na lišty. */
export async function setAllRailCapacitiesAction(projectId: string, modules: number): Promise<ActionResult<{ rails: number }>> {
  if (!id.safeParse(projectId).success || !z.number().int().min(MIN_RAIL_MODULES).max(MAX_RAIL_MODULES).safeParse(modules).success) return { ok: false, error: `Šířka lišty musí být ${MIN_RAIL_MODULES}–${MAX_RAIL_MODULES} modulů.` };
  try {
    await guardEditableProject(projectId);
    const result = await setAllRailCapacities(prisma, projectId, modules);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: { rails: result.rails } };
  } catch (error) {
    return actionFailure(error, "Šířku lišt se nepodařilo změnit.");
  }
}

/** „Sloupce (Pole): 1 pole / 2 pole vedle sebe (Silnoproud | Slaboproud)“. */
export async function setRailFieldsAction(projectId: string, fields: 1 | 2, fieldARails?: number | null): Promise<ActionResult<{ fields: 1 | 2; fieldARails: number }>> {
  if (!id.safeParse(projectId).success || (fields !== 1 && fields !== 2) || (fieldARails !== undefined && fieldARails !== null && !rail.safeParse(fieldARails).success)) return { ok: false, error: "Neplatné rozdělení polí." };
  try {
    await guardEditableProject(projectId);
    const result = await setRailFields(prisma, projectId, fields, fieldARails ?? null);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: { fields: result.layout.fields, fieldARails: result.layout.fieldARails } };
  } catch (error) {
    return actionFailure(error, "Rozdělení polí se nepodařilo změnit.");
  }
}

