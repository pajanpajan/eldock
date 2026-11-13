"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PERMISSION_LABELS } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { TESTER_COMPANY, companyManufacturer } from "@/lib/registered-company";
import { WorkflowError } from "@/lib/workflow/state-machine";
import type { RevisionRecord } from "@/lib/revision-import";
import { storePlantFile } from "@/server/file-access";
import { actionFailure, guardCompany } from "@/server/panel-guards";
import { readRevisionTable, revisionFileKind } from "@/server/revision-files";
import { chargeNewSwitchboard, refundCharge, settleSwitchboardCharge } from "@/server/services/credits";
import { getHlidacMode } from "@/server/services/hlidac";
import { createProjectFromRevision } from "@/server/services/panel-projects";
import { MAX_IMPORT_ROWS, importRevisionAppliances, readTablePhoto } from "@/server/services/revision-import";
import { recordSwitchboard } from "@/server/services/telemetry";
import { getCurrentAccount } from "@/server/session";
import { assertTenantAccess } from "@/server/tenant";

import type { ActionResult } from "./workflow";

// Fáze 112: „📥 Importovat z existující revize nebo měřicího přístroje“ – AI Panel Builder (rozváděč z okruhů),
// Revize a Hlídač revizí (spotřebiče do místnosti s převzatou revizí).

const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** Kdo importuje: firma AI Panel Builderu, nebo účet Správy závodů s revizemi / Studiem. */
async function assertImporter(context: "panel" | "plant") {
  if (context === "panel") return void (await guardCompany());
  const account = await getCurrentAccount();
  if (!account.can("recordInspection") && !account.can("studio")) {
    throw new WorkflowError("FORBIDDEN", `Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS.recordInspection} nebo ${PERMISSION_LABELS.studio}.`);
  }
}

/** Soubor (CSV / TSV / XLSX / XML / DOCX) nebo fotka tabulky → řádky tabulky k náhledu a přiřazení sloupců. */
export async function readRevisionFileAction(form: FormData): Promise<ActionResult<{ rows: string[][]; kind: string }>> {
  try {
    const context = form.get("context") === "panel" ? "panel" : "plant";
    await assertImporter(context);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return { ok: false, error: "Vyberte soubor s tabulkou." };
    if (file.size > MAX_FILE_BYTES) return { ok: false, error: "Soubor je větší než 8 MB." };
    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = revisionFileKind(file.name, buffer);
    if (kind === "pdf") return { ok: false, error: "PDF se čte přímo v prohlížeči – zkuste soubor nahrát znovu." };
    if (kind === "image") {
      const rows = await readTablePhoto({ bytes: buffer, mimeType: file.type || "image/jpeg" });
      return { ok: true, data: { rows, kind } };
    }
    const rows = readRevisionTable(file.name, buffer);
    if (!rows.length) return { ok: false, error: "V souboru není žádná tabulka." };
    return { ok: true, data: { rows: rows.slice(0, 2000), kind: kind ?? "csv" } };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    if (error instanceof Error && /ZIP|tabulk|Podporované/.test(error.message)) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Soubor se nepodařilo přečíst." };
  }
}

const recordSchema = z.object({
  line: z.number().int().min(0).max(100_000),
  designation: z.string().max(80),
  name: z.string().max(200),
  location: z.string().max(120),
  protection: z.string().max(80),
  cable: z.string().max(80),
  risoMOhm: z.number().finite().min(0).max(1e7).nullable(),
  risoAbove: z.boolean(),
  zsOhm: z.number().finite().min(0).max(1e6).nullable(),
  rpeOhm: z.number().finite().min(0).max(1e6).nullable(),
  taMs: z.number().finite().min(0).max(1e6).nullable(),
  serialNumber: z.string().max(80),
  result: z.enum(["PASS", "FAIL"]).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  instrument: z.string().max(120),
});

type RecordInput = z.infer<typeof recordSchema>;
const toRecords = (rows: readonly RecordInput[]): RevisionRecord[] => rows.map((row) => ({ ...row, date: row.date ? new Date(`${row.date}T12:00:00Z`) : null }));

const panelSchema = z.object({
  name: z.string().trim().min(1).max(120),
  customerName: z.string().trim().max(120).nullable().optional(),
  supplySystem: z.enum(["3F_TNCS", "3F_TNS", "3F_TT", "1F_TNS", "1F_TNCS"]).optional(),
  records: z.array(recordSchema).min(1).max(MAX_IMPORT_ROWS),
});

/** Okruhy ze staré revizní zprávy → nový rozváděč v AI Panel Builderu (zkušební projekt nebo 15 kreditů). */
export async function createRevisionPanelProjectAction(input: z.input<typeof panelSchema>): Promise<ActionResult<{ id: string; devices: number; circuits: number; enclosure: string | null; warnings: string[] }>> {
  const parsed = panelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte název rozváděče a importované okruhy." };
  try {
    const company = await guardCompany();
    const charge = await chargeNewSwitchboard(prisma, company.id);
    try {
      const result = await createProjectFromRevision(prisma, {
        name: parsed.data.name,
        customerName: parsed.data.customerName ?? null,
        ...(parsed.data.supplySystem ? { supplySystem: parsed.data.supplySystem } : {}),
        records: toRecords(parsed.data.records),
        companyId: company.id,
        manufacturerInfo: companyManufacturer(company),
      });
      await settleSwitchboardCharge(prisma, charge, [result.id]);
      await recordSwitchboard(prisma, { projectId: result.id, companyId: company.id === TESTER_COMPANY.id ? null : company.id, source: "schedule" });
      revalidatePath("/panel-builder", "layout");
      return { ok: true, data: { id: result.id, devices: result.devices, circuits: result.circuits, enclosure: result.enclosure, warnings: result.warnings } };
    } catch (error) {
      await refundCharge(prisma, charge);
      throw error;
    }
  } catch (error) {
    return actionFailure(error, "Rozváděč z importu se nepodařilo vytvořit.");
  }
}

const applianceSchema = z.object({
  floorId: z.string().min(1).max(64),
  room: z.string().trim().min(1).max(120),
  inspectorName: z.string().trim().min(1).max(120),
  inspectorLicense: z.string().trim().min(1).max(120),
  source: z.string().max(80).nullable().optional(),
  records: z.array(recordSchema).min(1).max(MAX_IMPORT_ROWS),
});

/** Spotřebiče z tabulky / exportu přístroje → místnost patra (Hlídač revizí, Revize) s převzatou revizí. */
export async function importRevisionAppliancesAction(input: z.input<typeof applianceSchema>): Promise<ActionResult<{ created: number; inspections: number; skipped: { line: number; reason: string }[]; tags: string[] }>> {
  const parsed = applianceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Vyberte patro a místnost a zkontrolujte importované řádky." };
  try {
    await assertImporter("plant");
    await assertTenantAccess({ floorId: parsed.data.floorId });
    const floor = await prisma.floor.findUnique({ where: { id: parsed.data.floorId }, select: { building: { select: { plantId: true } } } });
    if (!floor) throw new WorkflowError("NOT_FOUND", "Patro nebylo nalezeno.");
    const result = await importRevisionAppliances(prisma, {
      floorId: parsed.data.floorId,
      room: parsed.data.room,
      records: toRecords(parsed.data.records),
      mode: await getHlidacMode(prisma, floor.building.plantId),
      inspector: { name: parsed.data.inspectorName, license: parsed.data.inspectorLicense },
      source: parsed.data.source ?? null,
      saveReport: async (svg) => (await storePlantFile("documents", ".svg", svg)).url,
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { created: result.created.length, inspections: result.inspections, skipped: result.skipped, tags: result.created.map((row) => row.tag) } };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Import spotřebičů se nepodařil." };
  }
}
