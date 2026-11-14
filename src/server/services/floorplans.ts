// Fáze 64: 2D půdorysy uložené na serveru – seznam půdorysů firmy, průběžné ukládání s kontrolou verze (dvě okna se
// bez varování nepřepíšou), historie verzí s obnovením, koš, duplikace, převzetí nákresu z prohlížeče a otevření půdorysu
// z hotového projektu. Každá funkce dostává firmu přihlášeného uživatele – cizí půdorys je „nenalezen“.

import type { FloorplanVersionReason, PrismaClient } from "@/generated/prisma/client";
import { allElements, floorsOf, parseDraft, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { emptyLibrary, parseFloorplanLibrary, type FloorplanLibrary } from "@/lib/panel-builder/floorplan-library";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { chargeNewFloorplan, refundCharge } from "./credits";

/**
 * Největší nákres (JSON). Fáze 113: Server Action přijme 50 MB (`next.config.ts`), podklady podlaží jsou soubory
 * v úložišti (v nákresu jen odkaz) – 20 MB stačí i na desítky podlaží; větší nákres by zbytečně nafukoval historii verzí.
 */
export const MAX_DRAFT_CHARS = 20_000_000;
export const MAX_DRAFT_LABEL = "20 MB";
/** Průběžné ukládání založí snímek v historii nejvýš jednou za 10 minut. */
export const AUTO_SNAPSHOT_MS = 10 * 60_000;
/** Počet snímků historie na půdorys (starší se mažou). */
export const MAX_VERSIONS = 30;
/** Stejný nákres převzatý z prohlížeče během 24 h se znovu nezakládá (víc otevřených oken). */
export const IMPORT_DEDUP_MS = 24 * 3600_000;

export interface FloorplanMeta {
  name: string;
  customerName: string | null;
  installationSite: string | null;
}

export type SaveResult = { status: "saved" | "conflict"; version: number; savedAt: Date };

const LIST_SELECT = {
  id: true,
  code: true,
  name: true,
  customerName: true,
  installationSite: true,
  version: true,
  elementCount: true,
  roomCount: true,
  floorCount: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  // Fáze 111: licence půdorysu (zkušební / plná verze / balíček celá zakázka)
  license: true,
  project: { select: { id: true, code: true, name: true } },
} as const;

const VERSION_SELECT = { id: true, version: true, reason: true, label: true, elementCount: true, createdAt: true } as const;

const clean = (value: string | null | undefined, max = 120) => value?.trim().slice(0, max) || null;

function safeJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Uložený nákres → `FloorplanDraft` (poškozený záznam = null). */
export const readDraft = (json: string | null | undefined): FloorplanDraft | null => parseDraft(safeJson(json));

/** Nákres z klienta → ověřený `FloorplanDraft` a JSON k uložení. */
export function serializeDraft(raw: unknown): { draft: FloorplanDraft; json: string } {
  const draft = parseDraft(raw);
  if (!draft) throw new WorkflowError("VALIDATION", "Půdorys se nepodařilo načíst.");
  const json = JSON.stringify(draft);
  if (json.length > MAX_DRAFT_CHARS) throw new WorkflowError("VALIDATION", `Půdorys je příliš velký (přes ${MAX_DRAFT_LABEL}) – rozdělte ho na víc půdorysů.`);
  return { draft, json };
}

/** Souhrn pro seznam: prvky a místnosti všech podlaží. */
export function draftSummary(draft: FloorplanDraft): { elementCount: number; roomCount: number; floorCount: number } {
  const floors = floorsOf(draft);
  return { elementCount: allElements(draft).length, roomCount: floors.reduce((sum, floor) => sum + floor.rooms.length, 0), floorCount: floors.length };
}

function cleanMeta(meta: Partial<FloorplanMeta>, fallbackName: string): FloorplanMeta {
  return { name: clean(meta.name) ?? fallbackName, customerName: clean(meta.customerName), installationSite: clean(meta.installationSite) };
}

async function owned(prisma: PrismaClient, companyId: string, id: string, { deleted = false }: { deleted?: boolean } = {}) {
  const row = await prisma.floorplan.findFirst({ where: { id, companyId, deletedAt: deleted ? { not: null } : null } });
  if (!row) throw new WorkflowError("NOT_FOUND", "Půdorys nebyl nalezen.");
  return row;
}

interface SnapshotInput {
  version: number;
  reason: FloorplanVersionReason;
  label?: string | null;
  json: string;
  elementCount: number;
  at: Date;
}

/** Snímek do historie verzí; stejný nákres se stejným důvodem hned po sobě se neukládá. Drží `MAX_VERSIONS` snímků. */
async function addSnapshot(prisma: PrismaClient, floorplanId: string, input: SnapshotInput) {
  const last = await prisma.floorplanVersion.findFirst({ where: { floorplanId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { reason: true, draftJson: true } });
  if (last && last.reason === input.reason && last.draftJson === input.json && input.reason !== "MANUAL") return null;
  const created = await prisma.floorplanVersion.create({
    data: { floorplanId, version: input.version, reason: input.reason, label: clean(input.label, 160), draftJson: input.json, elementCount: input.elementCount, createdAt: input.at },
    select: VERSION_SELECT,
  });
  const old = await prisma.floorplanVersion.findMany({ where: { floorplanId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: MAX_VERSIONS, select: { id: true } });
  if (old.length) await prisma.floorplanVersion.deleteMany({ where: { id: { in: old.map((row) => row.id) } } });
  return created;
}

/** Fáze 78: další kód půdorysu firmy „FP-001“, „FP-002“ … (i půdorysy v koši – kód se neopakuje). */
export async function nextFloorplanCode(prisma: Pick<PrismaClient, "floorplan">, companyId: string): Promise<string> {
  const rows = await prisma.floorplan.findMany({ where: { companyId, code: { not: null } }, select: { code: true } });
  const max = rows.reduce((top, row) => Math.max(top, Number(/^FP-(\d+)$/.exec(row.code ?? "")?.[1] ?? 0)), 0);
  return `FP-${String(max + 1).padStart(3, "0")}`;
}

async function insertFloorplan(
  prisma: PrismaClient,
  companyId: string,
  input: { meta: FloorplanMeta; draft: FloorplanDraft; json: string; projectId?: string | null; snapshot: Pick<SnapshotInput, "reason" | "label">; at: Date; license?: string },
) {
  const summary = draftSummary(input.draft);
  // Fáze 78: kód a založení v jedné transakci (fronta SQLite – dvě založení ve firmě nedostanou stejný kód)
  const row = await prisma.$transaction(async (tx) =>
    tx.floorplan.create({
      data: { companyId, code: await nextFloorplanCode(tx, companyId), ...input.meta, draftJson: input.json, ...summary, projectId: input.projectId ?? null, ...(input.license ? { license: input.license } : {}), createdAt: input.at, updatedAt: input.at },
      select: { id: true, code: true, version: true, updatedAt: true },
    }),
  );
  await addSnapshot(prisma, row.id, { ...input.snapshot, version: row.version, json: input.json, elementCount: summary.elementCount, at: input.at });
  return { id: row.id, code: row.code, version: row.version, savedAt: row.updatedAt };
}

/** Půdorysy firmy (nejnověji upravené první); `deleted` = koš. */
export function listFloorplans(prisma: PrismaClient, companyId: string, { deleted = false }: { deleted?: boolean } = {}) {
  return prisma.floorplan.findMany({ where: { companyId, deletedAt: deleted ? { not: null } : null }, orderBy: { updatedAt: "desc" }, select: LIST_SELECT, take: 500 });
}

export type FloorplanListRow = Awaited<ReturnType<typeof listFloorplans>>[number];

/** Půdorys pro editor (bez koše); poškozený nákres = `draft: null`. */
export async function getFloorplan(prisma: PrismaClient, companyId: string, id: string) {
  const row = await prisma.floorplan.findFirst({ where: { id, companyId, deletedAt: null }, select: { ...LIST_SELECT, draftJson: true } });
  return row ? { ...row, draft: readDraft(row.draftJson) } : null;
}

/**
 * Fáze 111: založení nového půdorysu se zkušebním půdorysem (1. testovací projekt) nebo odečtem 15 kreditů; nepovedené
 * založení kredit / zkušební půdorys vrátí. Bez kreditů → prodejní modal (`PaywallError`), nákres zůstává v editoru.
 */
async function insertCharged(prisma: PrismaClient, companyId: string, input: Omit<Parameters<typeof insertFloorplan>[2], "license">) {
  const charge = await chargeNewFloorplan(prisma, companyId);
  try {
    const created = await insertFloorplan(prisma, companyId, { ...input, license: charge.plan.license });
    if (charge.transactionId) await prisma.creditTransaction.update({ where: { id: charge.transactionId }, data: { refId: created.id } });
    return { ...created, license: charge.plan.license, cost: charge.plan.cost };
  } catch (error) {
    await refundCharge(prisma, charge);
    throw error;
  }
}

/** Nový půdorys (první uložení z editoru, „Duplikovat“, převzetí). */
export async function createFloorplan(prisma: PrismaClient, companyId: string, input: { meta?: Partial<FloorplanMeta>; draft: unknown }, { now = new Date() }: { now?: Date } = {}) {
  const { draft, json } = serializeDraft(input.draft);
  return insertCharged(prisma, companyId, { meta: cleanMeta(input.meta ?? {}, "Půdorys"), draft, json, snapshot: { reason: "AUTO" }, at: now });
}

/**
 * Průběžné uložení nákresu s kontrolou verze. Jiná verze na serveru = souběh dvou oken: odmítnutý nákres se uloží
 * do historie (CONFLICT) a klient nabídne volbu. `force` = „Ponechat mou verzi“ – serverový stav jde do historie
 * (OVERWRITE) a uloží se nákres klienta.
 */
export async function saveFloorplanDraft(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  input: { baseVersion: number; draft: unknown; force?: boolean },
  { now = new Date() }: { now?: Date } = {},
): Promise<SaveResult> {
  const row = await owned(prisma, companyId, id);
  const { draft, json } = serializeDraft(input.draft);
  const summary = draftSummary(draft);
  if (row.version !== input.baseVersion) {
    if (!input.force) {
      await addSnapshot(prisma, id, { version: input.baseVersion, reason: "CONFLICT", label: "Změny z jiného okna odmítnuté kvůli souběhu", json, elementCount: summary.elementCount, at: now });
      return { status: "conflict", version: row.version, savedAt: row.updatedAt };
    }
    await addSnapshot(prisma, id, { version: row.version, reason: "OVERWRITE", label: "Přepsáno volbou „Ponechat mou verzi“", json: row.draftJson, elementCount: row.elementCount, at: now });
  }
  if (row.draftJson === json) return { status: "saved", version: row.version, savedAt: row.updatedAt };
  const version = row.version + 1;
  // Zápis jen nad přečtenou verzí – souběžné uložení mezi čtením a zápisem = souběh
  const updated = await prisma.floorplan.updateMany({ where: { id, companyId, version: row.version }, data: { draftJson: json, version, ...summary, updatedAt: now } });
  if (!updated.count) {
    const current = await owned(prisma, companyId, id);
    return { status: "conflict", version: current.version, savedAt: current.updatedAt };
  }
  const last = await prisma.floorplanVersion.findFirst({ where: { floorplanId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { createdAt: true } });
  if (!last || now.getTime() - last.createdAt.getTime() >= AUTO_SNAPSHOT_MS) await addSnapshot(prisma, id, { version, reason: "AUTO", json, elementCount: summary.elementCount, at: now });
  return { status: "saved", version, savedAt: now };
}

/**
 * Neuložené změny z prohlížeče, které vycházejí ze starší verze (půdorys se mezitím uložil jinde): bez přepsání
 * aktuálního stavu je uloží do historie verzí (CONFLICT), aby šly obnovit.
 */
export async function stashDraft(prisma: PrismaClient, companyId: string, id: string, input: { draft: unknown; baseVersion: number | null }, { now = new Date() }: { now?: Date } = {}) {
  const row = await owned(prisma, companyId, id);
  const { draft, json } = serializeDraft(input.draft);
  if (json === row.draftJson) return null;
  return addSnapshot(prisma, id, { version: input.baseVersion ?? row.version, reason: "CONFLICT", label: "Neuložené změny z prohlížeče (ze starší verze)", json, elementCount: draftSummary(draft).elementCount, at: now });
}

/** Aktuální nákres ze serveru („Načíst aktuální verzi“ po souběhu). */
export async function loadFloorplanDraft(prisma: PrismaClient, companyId: string, id: string) {
  const row = await owned(prisma, companyId, id);
  const draft = readDraft(row.draftJson);
  if (!draft) throw new WorkflowError("VALIDATION", "Uložený půdorys se nepodařilo načíst.");
  return { version: row.version, savedAt: row.updatedAt, draft };
}

/** Název, zákazník a místo stavby (nemění verzi nákresu). */
export async function updateFloorplanMeta(prisma: PrismaClient, companyId: string, id: string, meta: Partial<FloorplanMeta>) {
  const row = await owned(prisma, companyId, id);
  const next = cleanMeta(meta, row.name);
  await prisma.floorplan.update({ where: { id }, data: next });
  return next;
}

/** Kopie půdorysu („Kopie – …“) bez vazby na rozváděč a bez historie. */
export async function duplicateFloorplan(prisma: PrismaClient, companyId: string, id: string, { now = new Date() }: { now?: Date } = {}) {
  const row = await owned(prisma, companyId, id);
  const draft = readDraft(row.draftJson);
  if (!draft) throw new WorkflowError("VALIDATION", "Uložený půdorys se nepodařilo načíst.");
  const meta = { name: `Kopie – ${row.name}`.slice(0, 120), customerName: row.customerName, installationSite: row.installationSite };
  return insertCharged(prisma, companyId, { meta, draft, json: row.draftJson, snapshot: { reason: "IMPORT", label: `Kopie půdorysu „${row.name}“` }, at: now });
}

/** Smazání do koše / obnovení z koše / trvalé smazání (jen z koše). */
export async function trashFloorplan(prisma: PrismaClient, companyId: string, id: string, { now = new Date() }: { now?: Date } = {}) {
  await owned(prisma, companyId, id);
  await prisma.floorplan.update({ where: { id }, data: { deletedAt: now } });
}

export async function restoreFloorplan(prisma: PrismaClient, companyId: string, id: string) {
  await owned(prisma, companyId, id, { deleted: true });
  await prisma.floorplan.update({ where: { id }, data: { deletedAt: null } });
}

export async function purgeFloorplan(prisma: PrismaClient, companyId: string, id: string) {
  await owned(prisma, companyId, id, { deleted: true });
  await prisma.floorplan.delete({ where: { id } });
}

/** Historie verzí (nejnovější první). */
export async function listFloorplanVersions(prisma: PrismaClient, companyId: string, id: string) {
  await owned(prisma, companyId, id);
  return prisma.floorplanVersion.findMany({ where: { floorplanId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: VERSION_SELECT });
}

/** „Uložit verzi“ – snímek aktuálního uloženého stavu s vlastním popisem. */
export async function saveFloorplanVersion(prisma: PrismaClient, companyId: string, id: string, label: string | null, { now = new Date() }: { now?: Date } = {}) {
  const row = await owned(prisma, companyId, id);
  return addSnapshot(prisma, id, { version: row.version, reason: "MANUAL", label: clean(label, 80) ?? "Ručně uložená verze", json: row.draftJson, elementCount: row.elementCount, at: now });
}

/** Obnovení verze z historie: současný stav jde nejdřív do historie (RESTORE), takže i obnovení jde vrátit. */
export async function restoreFloorplanVersion(prisma: PrismaClient, companyId: string, id: string, versionId: string, { now = new Date() }: { now?: Date } = {}) {
  const row = await owned(prisma, companyId, id);
  const snapshot = await prisma.floorplanVersion.findFirst({ where: { id: versionId, floorplanId: id } });
  if (!snapshot) throw new WorkflowError("NOT_FOUND", "Verze nebyla nalezena.");
  const draft = readDraft(snapshot.draftJson);
  if (!draft) throw new WorkflowError("VALIDATION", "Verzi se nepodařilo načíst.");
  await addSnapshot(prisma, id, { version: row.version, reason: "RESTORE", label: `Stav před obnovením verze č. ${snapshot.version}`, json: row.draftJson, elementCount: row.elementCount, at: now });
  const version = row.version + 1;
  await prisma.floorplan.update({ where: { id }, data: { draftJson: snapshot.draftJson, version, ...draftSummary(draft), updatedAt: now } });
  return { version, savedAt: now, draft };
}

/**
 * Převzetí rozpracovaného nákresu z prohlížeče (do fáze 63 jediný klíč `eldock.pb.floorplan`). Stejný nákres převzatý
 * během posledních 24 h se znovu nezakládá – vrátí se existující půdorys.
 */
export async function importBrowserDraft(prisma: PrismaClient, companyId: string, input: { draft: unknown; name?: string | null }, { now = new Date() }: { now?: Date } = {}) {
  const { draft, json } = serializeDraft(input.draft);
  const existing = await prisma.floorplan.findFirst({ where: { companyId, draftJson: json, createdAt: { gte: new Date(now.getTime() - IMPORT_DEDUP_MS) } }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };
  const created = await insertCharged(prisma, companyId, { meta: cleanMeta({ name: input.name ?? undefined }, "Půdorys z prohlížeče"), draft, json, snapshot: { reason: "IMPORT", label: "Převzato z prohlížeče" }, at: now });
  return { id: created.id, created: true };
}

/**
 * „Upravit půdorys“ u hotového projektu: půdorys s vazbou na projekt, jinak nový z kopie nákresu uložené
 * při generování rozváděče (projekty z fází 49–63).
 */
export async function floorplanForProject(prisma: PrismaClient, companyId: string, projectId: string, { now = new Date() }: { now?: Date } = {}) {
  const project = await prisma.panelBoardProject.findFirst({ where: { id: projectId, companyId }, select: { id: true, code: true, name: true, customerName: true, installationSite: true, floorplanJson: true, license: true } });
  if (!project) throw new WorkflowError("NOT_FOUND", "Projekt nebyl nalezen.");
  const linked = await prisma.floorplan.findFirst({ where: { companyId, projectId, deletedAt: null }, orderBy: { updatedAt: "desc" }, select: { id: true } });
  if (linked) return { id: linked.id, created: false };
  const draft = readDraft(project.floorplanJson);
  if (!draft) throw new WorkflowError("NOT_FOUND", "Projekt nevznikl z 2D půdorysu.");
  const { json } = serializeDraft(draft);
  const meta = cleanMeta({ name: `Půdorys – ${project.name}`, customerName: project.customerName, installationSite: project.installationSite }, "Půdorys");
  // Fáze 111: půdorys zakázky rozváděče – zkušební projekt zůstává zkušební, jinak zakázka v balíčku (bez kreditu)
  const created = await insertFloorplan(prisma, companyId, { meta, draft, json, projectId: project.id, snapshot: { reason: "IMPORT", label: `Převzato z projektu ${project.code}` }, at: now, license: project.license === "TRIAL" ? "TRIAL" : "BUNDLE" });
  return { id: created.id, created: true };
}

/** Po vygenerování rozváděče: vazba půdorysu na nový projekt a snímek nákresu, ze kterého rozváděč vznikl. */
export async function linkGeneratedProject(prisma: PrismaClient, companyId: string, id: string, projectId: string, rawDraft: unknown, { now = new Date() }: { now?: Date } = {}) {
  const row = await owned(prisma, companyId, id);
  const project = await prisma.panelBoardProject.findFirst({ where: { id: projectId, companyId }, select: { code: true } });
  if (!project) throw new WorkflowError("NOT_FOUND", "Projekt nebyl nalezen.");
  const { draft, json } = serializeDraft(rawDraft);
  await prisma.floorplan.update({ where: { id }, data: { projectId } });
  await addSnapshot(prisma, id, { version: row.version, reason: "GENERATE", label: `Vygenerován rozváděč ${project.code}`, json, elementCount: draftSummary(draft).elementCount, at: now });
  return { code: project.code };
}

/** Fáze 78: knihovna 2D půdorysu firmy (šablony sestav, oblíbené) – uloží se jen novější (vyhrává `updatedAt`). */
export async function saveFloorplanLibrary(prisma: PrismaClient, companyId: string, library: unknown) {
  const next = parseFloorplanLibrary(library);
  if (!next) throw new WorkflowError("VALIDATION", "Neplatná knihovna půdorysu.");
  const company = await prisma.registeredCompany.findUnique({ where: { id: companyId }, select: { floorplanLibraryJson: true } });
  if (!company) throw new WorkflowError("NOT_FOUND", "Firma neexistuje.");
  const stored = parseFloorplanLibrary(company.floorplanLibraryJson);
  if (stored && stored.updatedAt >= next.updatedAt) return { saved: false, library: stored };
  await prisma.registeredCompany.update({ where: { id: companyId }, data: { floorplanLibraryJson: JSON.stringify(next) } });
  return { saved: true, library: next };
}

/** Knihovna firmy pro editor (bez záznamu prázdná). */
export async function floorplanLibraryOf(prisma: PrismaClient, companyId: string): Promise<FloorplanLibrary> {
  const company = await prisma.registeredCompany.findUnique({ where: { id: companyId }, select: { floorplanLibraryJson: true } });
  return parseFloorplanLibrary(company?.floorplanLibraryJson) ?? emptyLibrary();
}
