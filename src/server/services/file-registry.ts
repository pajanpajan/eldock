import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

import type { PrismaClient } from "@/generated/prisma/client";
import { CLAIM_MESSAGES, DEMO_OWNER, claimVerdict, companyOwner, isRegistrableUpload, ownerColumns, ownerKey, type FileOwner } from "@/lib/file-ownership";
import { contentTypeFor } from "@/lib/files";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { listUploads, uploadReferenceRows, type ReferenceRow } from "./upload-references";

// Registr nahraných souborů (fáze 68): zápis vlastníka a otisku, označení smazaných souborů, doplnění registru
// pro soubory nahrané před fází 68 a přehled pro velín.

export const sha256Hex = (data: Buffer | Uint8Array) => createHash("sha256").update(data).digest("hex");

/** SHA-256 souboru po částech (velké zálohy SW bez načtení celého souboru do paměti). */
export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

export interface RegisterFileInput {
  url: string;
  kind: string;
  /** SHARED vzniká jen doplněním registru (starší soubor s více vlastníky nebo z tabulky bez vlastníka). */
  owner: FileOwner | "SHARED";
  uploadedById?: string | null;
  sizeBytes: number;
  sha256?: string | null;
  mimeType: string;
  originalName?: string | null;
  source?: "upload" | "server" | "registry";
  createdAt?: Date;
}

const registryColumns = (owner: RegisterFileInput["owner"]) => (owner === "SHARED" ? { ownerKind: "SHARED" as const, companyId: null } : ownerColumns(owner));

/** Zapíše soubor do registru (stejná adresa podruhé = beze změny – registr nikdy nepřepíše vlastníka). */
/**
 * Záznam smí uložit jen soubor svého vlastníka (vzorové, veřejné a sdílené soubory kdokoli) – sdílí serverové akce
 * (`assertFilesOwnedBy`) i úpravy z aplikací (fáze 70). `strict: false` = neznámý soubor projde.
 */
export async function assertFileClaims(prisma: PrismaClient, urls: Iterable<string | null | undefined>, owner: FileOwner, options: { strict?: boolean } = {}) {
  const list = [...new Set([...urls].filter((url): url is string => !!url))];
  if (!list.length) return;
  const lookup = list.filter(isRegistrableUpload);
  const files = lookup.length ? await prisma.storedFile.findMany({ where: { url: { in: lookup } }, select: { url: true, ownerKind: true, companyId: true, deletedAt: true } }) : [];
  const byUrl = new Map(files.map((file) => [file.url, file]));
  for (const url of list) {
    const verdict = claimVerdict(owner, url, byUrl.get(url) ?? null, options);
    if (verdict !== "ok") throw new WorkflowError(verdict === "foreign" ? "FORBIDDEN" : "VALIDATION", CLAIM_MESSAGES[verdict]);
  }
}

export function registerFile(prisma: PrismaClient, input: RegisterFileInput) {
  const data = {
    url: input.url,
    kind: input.kind,
    ...registryColumns(input.owner),
    uploadedById: input.uploadedById ?? null,
    sizeBytes: input.sizeBytes,
    sha256: input.sha256 ?? null,
    mimeType: input.mimeType,
    originalName: input.originalName ? input.originalName.slice(0, 200) : null,
    source: input.source ?? "upload",
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
  };
  return prisma.storedFile.upsert({ where: { url: input.url }, create: data, update: {} });
}

/** Soubory smazané z úložiště: číst je už nejde a záloha mimo server je po 30 dnech odstraní. */
export async function markFilesDeleted(prisma: PrismaClient, urls: readonly string[], now: Date = new Date()) {
  if (!urls.length) return 0;
  const result = await prisma.storedFile.updateMany({ where: { url: { in: [...new Set(urls)] }, deletedAt: null }, data: { deletedAt: now } });
  return result.count;
}

// ---------------------------------------------------------------------------
//  Doplnění registru pro starší soubory (`npm run storage:registry`, entrypoint před startem aplikace)
// ---------------------------------------------------------------------------

/** Vlastník řádku: závod (převede se na firmu / demo), přímo vlastník, nebo sdílený. */
type RowOwner = { plantId: string } | { owner: FileOwner } | "shared";
type Resolver = (prisma: PrismaClient, ids: string[]) => Promise<[string, RowOwner][]>;

const equipmentPlant = { select: { floor: { select: { building: { select: { plantId: true } } } } } } as const;
const viaEquipment = (row: { id: string; equipment: { floor: { building: { plantId: string } } } }): [string, RowOwner] => [row.id, { plantId: row.equipment.floor.building.plantId }];
const viaCompany = (row: { id: string; companyId: string | null }): [string, RowOwner] => [row.id, row.companyId ? { owner: companyOwner(row.companyId) } : "shared"];
const where = (ids: string[]) => ({ id: { in: ids } });

/**
 * Vlastník řádků podle tabulky. Tabulka, která tu není (katalog prvků, ventilátory, domovní přístroje, nastavení
 * tenantu, newsletter…), je sdílená – její soubory čte dál každé přihlášení.
 */
const RESOLVERS: Record<string, Resolver> = {
  Plant: async (_prisma, ids) => ids.map((id) => [id, { plantId: id }]),
  Building: async (prisma, ids) => (await prisma.building.findMany({ where: where(ids), select: { id: true, plantId: true } })).map((row) => [row.id, { plantId: row.plantId }]),
  Floor: async (prisma, ids) => (await prisma.floor.findMany({ where: where(ids), select: { id: true, building: { select: { plantId: true } } } })).map((row) => [row.id, { plantId: row.building.plantId }]),
  Equipment: async (prisma, ids) => (await prisma.equipment.findMany({ where: where(ids), select: { id: true, floor: { select: { building: { select: { plantId: true } } } } } })).map((row) => [row.id, { plantId: row.floor.building.plantId }]),
  ComplianceDocument: async (prisma, ids) => (await prisma.complianceDocument.findMany({ where: where(ids), select: { id: true, equipment: equipmentPlant } })).map(viaEquipment),
  InspectionRecord: async (prisma, ids) => (await prisma.inspectionRecord.findMany({ where: where(ids), select: { id: true, equipment: equipmentPlant } })).map(viaEquipment),
  DocumentRevision: async (prisma, ids) => (await prisma.documentRevision.findMany({ where: where(ids), select: { id: true, equipment: equipmentPlant } })).map(viaEquipment),
  ChangeRequest: async (prisma, ids) => (await prisma.changeRequest.findMany({ where: where(ids), select: { id: true, equipment: equipmentPlant } })).map(viaEquipment),
  InspectionDefect: async (prisma, ids) => (await prisma.inspectionDefect.findMany({ where: where(ids), select: { id: true, equipment: equipmentPlant } })).map(viaEquipment),
  TemporaryModification: async (prisma, ids) => (await prisma.temporaryModification.findMany({ where: where(ids), select: { id: true, equipment: equipmentPlant } })).map(viaEquipment),
  EquipmentDocument: async (prisma, ids) => (await prisma.equipmentDocument.findMany({ where: where(ids), select: { id: true, equipment: equipmentPlant } })).map(viaEquipment),
  SoftwareBackup: async (prisma, ids) => (await prisma.softwareBackup.findMany({ where: where(ids), select: { id: true, equipment: equipmentPlant } })).map(viaEquipment),
  MonitoredComponent: async (prisma, ids) => (await prisma.monitoredComponent.findMany({ where: where(ids), select: { id: true, equipment: equipmentPlant } })).map(viaEquipment),
  Attachment: async (prisma, ids) => (await prisma.attachment.findMany({ where: where(ids), select: { id: true, changeRequest: { select: { equipment: equipmentPlant } } } })).map((row) => viaEquipment({ id: row.id, equipment: row.changeRequest.equipment })),
  ChangeRequestEvent: async (prisma, ids) => (await prisma.changeRequestEvent.findMany({ where: where(ids), select: { id: true, changeRequest: { select: { equipment: equipmentPlant } } } })).map((row) => viaEquipment({ id: row.id, equipment: row.changeRequest.equipment })),
  BomItem: async (prisma, ids) => (await prisma.bomItem.findMany({ where: where(ids), select: { id: true, revision: { select: { equipment: equipmentPlant } } } })).map((row) => viaEquipment({ id: row.id, equipment: row.revision.equipment })),
  SchematicReference: async (prisma, ids) => (await prisma.schematicReference.findMany({ where: where(ids), select: { id: true, revision: { select: { equipment: equipmentPlant } } } })).map((row) => viaEquipment({ id: row.id, equipment: row.revision.equipment })),
  NotificationLog: async (prisma, ids) => (await prisma.notificationLog.findMany({ where: where(ids), select: { id: true, plantId: true } })).map((row) => [row.id, row.plantId ? { plantId: row.plantId } : "shared"]),
  User: async (prisma, ids) => (await prisma.user.findMany({ where: where(ids), select: { id: true, companyId: true } })).map((row) => [row.id, { owner: row.companyId ? companyOwner(row.companyId) : DEMO_OWNER }]),
  RegisteredCompany: async (_prisma, ids) => ids.map((id) => [id, { owner: companyOwner(id) }]),
  PanelBoardProject: async (prisma, ids) => (await prisma.panelBoardProject.findMany({ where: where(ids), select: { id: true, companyId: true } })).map(viaCompany),
  PanelBoardItem: async (prisma, ids) => (await prisma.panelBoardItem.findMany({ where: where(ids), select: { id: true, project: { select: { companyId: true } } } })).map((row) => viaCompany({ id: row.id, companyId: row.project.companyId })),
  Floorplan: async (prisma, ids) => (await prisma.floorplan.findMany({ where: where(ids), select: { id: true, companyId: true } })).map(viaCompany),
  FloorplanVersion: async (prisma, ids) => (await prisma.floorplanVersion.findMany({ where: where(ids), select: { id: true, floorplan: { select: { companyId: true } } } })).map((row) => viaCompany({ id: row.id, companyId: row.floorplan.companyId })),
  AiFeedbackReport: async (prisma, ids) => (await prisma.aiFeedbackReport.findMany({ where: where(ids), select: { id: true, companyId: true } })).map(viaCompany),
  CreditOrder: async (prisma, ids) => (await prisma.creditOrder.findMany({ where: where(ids), select: { id: true, companyId: true } })).map(viaCompany),
};

/** Závod → vlastník: závod registrované firmy Správy závodů patří firmě, ostatní závody obchodnímu demu. */
async function plantOwners(prisma: PrismaClient): Promise<(plantId: string) => FileOwner> {
  const companies = await prisma.registeredCompany.findMany({ where: { productScope: "PLANT_MANAGEMENT", plantId: { not: null } }, select: { id: true, plantId: true }, orderBy: { createdAt: "asc" } });
  const byPlant = new Map<string, string>();
  for (const company of companies) if (company.plantId && !byPlant.has(company.plantId)) byPlant.set(company.plantId, company.id);
  return (plantId) => {
    const companyId = byPlant.get(plantId);
    return companyId ? companyOwner(companyId) : DEMO_OWNER;
  };
}

/**
 * Vlastník každého souboru podle řádků, které na něj odkazují: jeden vlastník = jeho soubor; víc vlastníků, řádek
 * sdílené tabulky nebo řádek bez vlastníka = sdílený. Vrací adresu → vlastník a tabulky bez pravidla (do výpisu).
 */
export async function resolveReferenceOwners(prisma: PrismaClient, rows: readonly ReferenceRow[]): Promise<{ owners: Map<string, FileOwner | "SHARED">; sharedTables: string[] }> {
  const ownerOfPlant = await plantOwners(prisma);
  const keys = new Map<string, Map<string, FileOwner | "SHARED">>();
  const sharedTables = new Set<string>();
  const byTable = new Map<string, ReferenceRow[]>();
  for (const row of rows) byTable.set(row.table, [...(byTable.get(row.table) ?? []), row]);
  for (const [table, tableRows] of byTable) {
    const resolver = RESOLVERS[table];
    if (!resolver) sharedTables.add(table);
    const ids = [...new Set(tableRows.map((row) => row.id).filter((id): id is string => !!id))];
    const resolved = new Map<string, RowOwner>(resolver ? await resolver(prisma, ids) : []);
    for (const row of tableRows) {
      const ref = row.id ? resolved.get(row.id) : undefined;
      const owner: FileOwner | "SHARED" = !ref || ref === "shared" ? "SHARED" : "plantId" in ref ? ownerOfPlant(ref.plantId) : ref.owner;
      const key = owner === "SHARED" ? "shared" : ownerKey(owner);
      for (const url of row.urls) {
        const found = keys.get(url) ?? new Map<string, FileOwner | "SHARED">();
        found.set(key, owner);
        keys.set(url, found);
      }
    }
  }
  const owners = new Map<string, FileOwner | "SHARED">();
  for (const [url, found] of keys) owners.set(url, found.size === 1 ? [...found.values()][0] : "SHARED");
  return { owners, sharedTables: [...sharedTables].sort() };
}

export interface RegistryBackfillReport {
  /** Soubory v úložišti (bez vzorových `seed/`). */
  scanned: number;
  alreadyRegistered: number;
  registered: number;
  byOwner: { demo: number; company: number; shared: number };
  /** Soubory bez odkazu v databázi – nezapisují se (úklid `storage:cleanup` je po 24 h smaže). */
  unreferenced: number;
  /** Tabulky bez pravidla vlastníka, jejichž soubory jsou sdílené. */
  sharedTables: string[];
}

/** Doplní registr pro soubory úložiště, které v něm ještě nejsou (idempotentní; `dryRun` nic nezapíše). */
export async function backfillFileRegistry(prisma: PrismaClient, root: string, options: { dryRun?: boolean } = {}): Promise<RegistryBackfillReport> {
  const files = await listUploads(root);
  const known = new Set((await prisma.storedFile.findMany({ select: { url: true } })).map((file) => file.url));
  const missing = files.filter((file) => !known.has(file.url));
  const report: RegistryBackfillReport = { scanned: files.length, alreadyRegistered: files.length - missing.length, registered: 0, byOwner: { demo: 0, company: 0, shared: 0 }, unreferenced: 0, sharedTables: [] };
  if (!missing.length) return report;

  const wanted = new Set(missing.map((file) => file.url));
  const rows = (await uploadReferenceRows(prisma)).map((row) => ({ ...row, urls: row.urls.filter((url) => wanted.has(url)) })).filter((row) => row.urls.length);
  const { owners, sharedTables } = await resolveReferenceOwners(prisma, rows);
  report.sharedTables = sharedTables;

  for (const file of missing) {
    const owner = owners.get(file.url);
    if (!owner) {
      report.unreferenced++;
      continue;
    }
    report.byOwner[owner === "SHARED" ? "shared" : owner.kind === "COMPANY" ? "company" : "demo"]++;
    report.registered++;
    if (options.dryRun) continue;
    await registerFile(prisma, {
      url: file.url,
      kind: file.url.split("/")[3],
      owner,
      sizeBytes: file.bytes,
      sha256: await sha256File(file.filePath),
      mimeType: contentTypeFor(file.filePath),
      source: "registry",
      createdAt: new Date(file.mtimeMs),
    });
  }
  return report;
}

// ---------------------------------------------------------------------------
//  Přehled pro velín
// ---------------------------------------------------------------------------

export interface RegistryStats {
  total: number;
  bytes: number;
  byOwner: { ownerKind: string; files: number; bytes: number }[];
  companies: number;
  deleted: number;
}

/** Přehled registru pro velín: soubory a objem podle vlastníka (bez smazaných), počet firem se soubory. */
export async function registryStats(prisma: PrismaClient): Promise<RegistryStats> {
  const [groups, companies, deleted] = await Promise.all([
    prisma.storedFile.groupBy({ by: ["ownerKind"], where: { deletedAt: null }, _count: { _all: true }, _sum: { sizeBytes: true } }),
    prisma.storedFile.findMany({ where: { deletedAt: null, ownerKind: "COMPANY" }, distinct: ["companyId"], select: { companyId: true } }),
    prisma.storedFile.count({ where: { deletedAt: { not: null } } }),
  ]);
  const byOwner = groups.map((group) => ({ ownerKind: group.ownerKind, files: group._count._all, bytes: group._sum.sizeBytes ?? 0 }));
  return {
    total: byOwner.reduce((sum, group) => sum + group.files, 0),
    bytes: byOwner.reduce((sum, group) => sum + group.bytes, 0),
    byOwner,
    companies: companies.length,
    deleted,
  };
}
