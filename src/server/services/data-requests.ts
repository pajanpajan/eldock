import { rm, stat, unlink } from "node:fs/promises";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { toCsv } from "@/lib/csv";
import { CLOSURE_GRACE_DAYS } from "@/lib/data-requests";
import { isRegistrableUpload, uploadSegments } from "@/lib/file-ownership";
import { resolveUploadPath } from "@/lib/files";
import { TESTER_COMPANY } from "@/lib/registered-company";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { ZipWriter } from "@/server/zip";

import { extractUploadUrls } from "./upload-references";

// Fáze 69 (GDPR): export dat firmy (čl. 20, u Správy závodů i vrácení dat zpracovatelem – čl. 28 odst. 3 písm. g),
// vlastní údaje uživatele (čl. 15), odebrání zaměstnance s anonymizací účtu a zrušení účtu firmy s výmazem po lhůtě.
// Každá žádost se zapíše do `DataRequest` (bez osobních údajů) jako doklad o vyřízení.

export { CLOSURE_GRACE_DAYS };

const DAY_MS = 24 * 60 * 60 * 1000;
export const EXPORT_FORMAT = "eldock-export";
export const EXPORT_VERSION = 1;

/** Kdo žádost podal (role, ne jméno). */
export type DataRequester = "company-admin" | "panel-company" | "superadmin" | "user";

/** Náhradní e-mail odebraného zaměstnance / zrušené firmy (původní e-mail jde znovu použít). */
export const removedUserEmail = (userId: string) => `odebrany-${userId}@eldock.invalid`;
export const closedCompanyEmail = (companyId: string) => `zruseno-${companyId}@eldock.invalid`;
export const anonymousName = (userId: string) => `Bývalý zaměstnanec ${userId.slice(-4).toUpperCase()}`;

/** Uživatel do exportu – bez otisku hesla, tajemství a záložních kódů dvoufázového ověření. */
function exportUser(user: { id: string; name: string; email: string; role: string; accountType: string | null; title: string | null; phone: string | null; company: string | null; homePlantId: string | null; createdAt: Date; lastLoginAt: Date | null; disabledAt: Date | null; passwordHash: string | null; mustChangePassword: boolean; totpEnabledAt: Date | null }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountType: user.accountType,
    title: user.title,
    phone: user.phone,
    department: user.company,
    homePlantId: user.homePlantId,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    disabledAt: user.disabledAt,
    passwordSet: !!user.passwordHash,
    mustChangePassword: user.mustChangePassword,
    twoFactorEnabled: !!user.totpEnabledAt,
  };
}

async function activeCompany(prisma: PrismaClient, companyId: string) {
  const company = await prisma.registeredCompany.findUnique({ where: { id: companyId } });
  if (!company || company.closedAt) throw new WorkflowError("NOT_FOUND", "Firma nebyla nalezena.");
  return company;
}

const companyFields = (company: { id: string; companyName: string; ico: string; productScope: "PANEL_BUILDER" | "PLANT_MANAGEMENT" }) => ({ companyId: company.id, companyName: company.companyName, companyIco: company.ico, productScope: company.productScope });

// ---------------------------------------------------------------------------
//  Export dat firmy
// ---------------------------------------------------------------------------

export interface CompanyExportData {
  company: { id: string; companyName: string; ico: string; productScope: "PANEL_BUILDER" | "PLANT_MANAGEMENT" };
  /** Název souboru v `data/` → záznamy. */
  sections: Record<string, unknown[]>;
  /** Soubory firmy v registru (i nepřipojené). */
  registryFiles: { url: string; kind: string; originalName: string | null; sizeBytes: number; sha256: string | null; createdAt: Date }[];
}

/** Všechna data firmy jako seznamy záznamů (bez hesel a tajemství). */
export async function companyExportData(prisma: PrismaClient, companyId: string): Promise<CompanyExportData> {
  const company = await activeCompany(prisma, companyId);
  const { passwordHash: _secret, ...companyRecord } = company;
  void _secret;
  const users = await prisma.user.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } });
  const sections: Record<string, unknown[]> = { firma: [companyRecord], uzivatele: users.map(exportUser) };

  if (company.productScope === "PLANT_MANAGEMENT" && company.plantId) {
    const plantId = company.plantId;
    const eq = { equipment: { floor: { building: { plantId } } } };
    const [plant, buildings, floors, equipment, revisions, bomItems, references, changeRequests, events, attachments, inspections, defects, temporaryMods, documents, softwareBackups, components, compliance, notifications] = await Promise.all([
      prisma.plant.findMany({ where: { id: plantId } }),
      prisma.building.findMany({ where: { plantId }, orderBy: { code: "asc" } }),
      prisma.floor.findMany({ where: { building: { plantId } }, orderBy: [{ buildingId: "asc" }, { level: "asc" }] }),
      prisma.equipment.findMany({ where: { floor: { building: { plantId } } }, orderBy: { tag: "asc" } }),
      prisma.documentRevision.findMany({ where: eq, orderBy: { createdAt: "asc" } }),
      prisma.bomItem.findMany({ where: { revision: eq } }),
      prisma.schematicReference.findMany({ where: { revision: eq } }),
      prisma.changeRequest.findMany({ where: eq, orderBy: { submittedAt: "asc" } }),
      prisma.changeRequestEvent.findMany({ where: { changeRequest: eq }, orderBy: { createdAt: "asc" } }),
      prisma.attachment.findMany({ where: { changeRequest: eq } }),
      prisma.inspectionRecord.findMany({ where: eq, orderBy: { inspectionDate: "asc" } }),
      prisma.inspectionDefect.findMany({ where: eq }),
      prisma.temporaryModification.findMany({ where: eq }),
      prisma.equipmentDocument.findMany({ where: eq }),
      prisma.softwareBackup.findMany({ where: eq }),
      prisma.monitoredComponent.findMany({ where: eq }),
      prisma.complianceDocument.findMany({ where: eq }),
      prisma.notificationLog.findMany({ where: { plantId }, orderBy: { createdAt: "asc" } }),
    ]);
    Object.assign(sections, {
      zavod: plant,
      budovy: buildings,
      patra: floors,
      zarizeni: equipment,
      "revize-dokumentace": revisions,
      kusovniky: bomItems,
      "odkazy-ve-schematech": references,
      "zmeny-pozadavky": changeRequests,
      "zmeny-udalosti": events,
      "zmeny-prilohy": attachments,
      "revize-vtz": inspections,
      "revize-zavady": defects,
      provizoria: temporaryMods,
      "navody-a-datasheety": documents,
      "zalohy-software": softwareBackups,
      "zivotnost-soucastek": components,
      "dokumenty-shody": compliance,
      "avizo-lhut": notifications,
    });
  }

  if (company.productScope === "PANEL_BUILDER") {
    const [projects, items, wiring, floorplans, versions, orders, feedback] = await Promise.all([
      prisma.panelBoardProject.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
      prisma.panelBoardItem.findMany({ where: { project: { companyId } } }),
      prisma.panelItemWiring.findMany({ where: { item: { project: { companyId } } } }),
      prisma.floorplan.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
      prisma.floorplanVersion.findMany({ where: { floorplan: { companyId } }, orderBy: { createdAt: "asc" } }),
      prisma.creditOrder.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
      prisma.aiFeedbackReport.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
    ]);
    Object.assign(sections, { "projekty-rozvadecu": projects, "projekty-pristroje": items, "projekty-domovni-pristroje": wiring, pudorysy: floorplans, "pudorysy-verze": versions, "objednavky-kreditu": orders, "hlaseni-ai": feedback });
  }

  sections["bezpecnostni-denik"] = await prisma.securityEvent.findMany({ where: { companyId }, orderBy: { createdAt: "asc" }, select: { kind: true, userId: true, actorId: true, email: true, detail: true, createdAt: true } });
  const registryFiles = await prisma.storedFile.findMany({ where: { companyId, deletedAt: null }, orderBy: { createdAt: "asc" }, select: { url: true, kind: true, originalName: true, sizeBytes: true, sha256: true, createdAt: true } });
  return { company: { id: company.id, companyName: company.companyName, ico: company.ico, productScope: company.productScope }, sections, registryFiles };
}

const isoDay = (value: Date | null | undefined) => (value ? value.toISOString().slice(0, 10) : "");

/** CSV pro Excel: zařízení a revize VTZ (doplněk k JSON). */
function exportCsv(sections: Record<string, unknown[]>) {
  const files: Record<string, string> = {};
  const floors = new Map((sections.patra as { id: string; name: string; buildingId: string }[] | undefined)?.map((floor) => [floor.id, floor]) ?? []);
  const buildings = new Map((sections.budovy as { id: string; name: string }[] | undefined)?.map((building) => [building.id, building]) ?? []);
  const equipment = (sections.zarizeni as { id: string; tag: string; name: string; type: string; status: string; floorId: string; manufacturer?: string | null; serialNumber?: string | null }[] | undefined) ?? [];
  if (equipment.length) {
    files["csv/zarizeni.csv"] = toCsv([
      ["Ev. číslo", "Název", "Typ", "Stav", "Budova", "Patro", "Výrobce", "Výrobní číslo", "ID"],
      ...equipment.map((item) => {
        const floor = floors.get(item.floorId);
        return [item.tag, item.name, item.type, item.status, floor ? (buildings.get(floor.buildingId)?.name ?? "") : "", floor?.name ?? "", item.manufacturer ?? "", item.serialNumber ?? "", item.id];
      }),
    ]);
  }
  const inspections = (sections["revize-vtz"] as { equipmentId: string; inspectionDate: Date; type: string; result: string; validUntil: Date | null; inspectorName?: string | null; reportNumber?: string | null }[] | undefined) ?? [];
  if (inspections.length) {
    const tags = new Map(equipment.map((item) => [item.id, item.tag]));
    files["csv/revize-vtz.csv"] = toCsv([
      ["Ev. číslo zařízení", "Datum revize", "Druh", "Výsledek", "Platnost do", "Revizní technik", "Číslo zprávy"],
      ...inspections.map((record) => [tags.get(record.equipmentId) ?? record.equipmentId, isoDay(record.inspectionDate), record.type, record.result, isoDay(record.validUntil), record.inspectorName ?? "", record.reportNumber ?? ""]),
    ]);
  }
  return files;
}

export interface ExportResult {
  bytes: number;
  records: number;
  files: number;
  missingFiles: number;
  fileName: string;
}

/** Název ZIP exportu `eldock-export-<IČO>-<datum>.zip`. */
export const exportFileName = (ico: string, now: Date) => `eldock-export-${ico.replace(/\W/g, "") || "firma"}-${isoDay(now)}.zip`;

/** Zapíše export firmy do ZIP `targetPath`: data/*.json, csv/*.csv, soubory/…, manifest.json a README.txt. */
export async function writeCompanyExport(prisma: PrismaClient, input: { companyId: string; storageRoot: string; targetPath: string; requestedBy: DataRequester; now?: Date }): Promise<ExportResult> {
  const now = input.now ?? new Date();
  const data = await companyExportData(prisma, input.companyId);
  const zip = new ZipWriter(input.targetPath, now);
  try {
    let records = 0;
    for (const [name, rows] of Object.entries(data.sections)) {
      records += rows.length;
      await zip.addBuffer(`data/${name}.json`, JSON.stringify(rows, null, 2));
    }
    for (const [name, csv] of Object.entries(exportCsv(data.sections))) await zip.addBuffer(name, csv);

    // Soubory: vše z registru firmy + soubory, na které data firmy odkazují (vzorové seed/ ne)
    const referenced = extractUploadUrls([JSON.stringify(data.sections)]);
    const registry = new Map(data.registryFiles.map((file) => [file.url, file]));
    const urls = [...new Set([...registry.keys(), ...referenced])].filter(isRegistrableUpload).sort();
    const index: unknown[] = [];
    let missing = 0;
    for (const url of urls) {
      const segments = uploadSegments(url)!;
      const filePath = resolveUploadPath(input.storageRoot, segments);
      const exists = filePath ? await stat(filePath).then((info) => info.isFile()).catch(() => false) : false;
      if (!filePath || !exists) {
        missing++;
        continue;
      }
      const entry = `soubory/${segments.join("/")}`;
      await zip.addFile(entry, filePath);
      const info = registry.get(url);
      index.push({ url, path: entry, kind: segments[0], originalName: info?.originalName ?? null, sizeBytes: info?.sizeBytes ?? null, sha256: info?.sha256 ?? null, createdAt: info?.createdAt ?? null });
    }
    await zip.addBuffer("data/soubory.json", JSON.stringify(index, null, 2));
    const counts = Object.fromEntries(Object.entries(data.sections).map(([name, rows]) => [name, rows.length]));
    await zip.addBuffer(
      "manifest.json",
      JSON.stringify({ format: EXPORT_FORMAT, version: EXPORT_VERSION, createdAt: now, company: { name: data.company.companyName, ico: data.company.ico, product: data.company.productScope }, counts, files: index.length, missingFiles: missing }, null, 2),
    );
    await zip.addBuffer(
      "README.txt",
      [
        "Export dat z platformy ELDOCK",
        `Firma: ${data.company.companyName} (IČO ${data.company.ico})`,
        `Vytvořeno: ${now.toISOString()}`,
        "",
        "Obsah archivu:",
        "  manifest.json  – souhrn exportu (počty záznamů a souborů)",
        "  data/*.json    – všechna data firmy ve strojově čitelném formátu JSON (UTF-8), jeden soubor na druh záznamů",
        "  csv/*.csv      – přehled zařízení a revizí pro Excel (oddělovač středník, UTF-8)",
        "  soubory/       – nahrané fotky, revize, zprávy, dokumenty a zálohy SW (seznam s otisky SHA-256 v data/soubory.json)",
        "",
        "Hesla, jejich otisky ani tajemství dvoufázového ověření se neexportují. Identifikátory (id) propojují záznamy",
        "mezi soubory (např. zařízení → floorId → patra → buildingId → budovy).",
        "",
      ].join("\r\n"),
    );
    const bytes = await zip.close();
    const summary = { records, files: index.length, missingFiles: missing, bytes };
    await prisma.dataRequest.create({ data: { kind: "COMPANY_EXPORT", status: "DONE", ...companyFields(data.company), requestedBy: input.requestedBy, requestedAt: now, completedAt: now, summaryJson: JSON.stringify(summary) } });
    if (data.company.productScope === "PLANT_MANAGEMENT") await prisma.securityEvent.create({ data: { kind: "DATA_EXPORTED", companyId: data.company.id, detail: `export dat firmy (${index.length} souborů)` } });
    return { ...summary, fileName: exportFileName(data.company.ico, now) };
  } catch (error) {
    zip.destroy();
    await rm(input.targetPath, { force: true });
    throw error;
  }
}

// ---------------------------------------------------------------------------
//  Vlastní údaje uživatele (čl. 15)
// ---------------------------------------------------------------------------

export async function personalExportData(prisma: PrismaClient, userId: string, now: Date = new Date()) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { registeredCompany: { select: { companyName: true, ico: true } } } });
  if (!user || !user.accountType) throw new WorkflowError("NOT_FOUND", "Účet nebyl nalezen.");
  const [sessions, events, reported, assigned, authored, approved, actions, attachments, documents, backups] = await Promise.all([
    prisma.userSession.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { device: true, createdAt: true, lastSeenAt: true, expiresAt: true, revokedAt: true } }),
    prisma.securityEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { kind: true, createdAt: true, detail: true } }),
    prisma.changeRequest.count({ where: { reporterId: userId } }),
    prisma.changeRequest.count({ where: { assigneeId: userId } }),
    prisma.documentRevision.count({ where: { authorId: userId } }),
    prisma.documentRevision.count({ where: { approverId: userId } }),
    prisma.changeRequestEvent.count({ where: { actorId: userId } }),
    prisma.attachment.count({ where: { uploadedById: userId } }),
    prisma.equipmentDocument.count({ where: { uploadedById: userId } }),
    prisma.softwareBackup.count({ where: { authorId: userId } }),
  ]);
  return {
    format: "eldock-osobni-udaje",
    version: 1,
    createdAt: now,
    user: exportUser(user),
    company: user.registeredCompany,
    sessions,
    securityEvents: events,
    records: { changeRequestsReported: reported, changeRequestsAssigned: assigned, revisionsAuthored: authored, revisionsApproved: approved, workflowActions: actions, attachmentsUploaded: attachments, documentsUploaded: documents, softwareBackups: backups },
    note: "Záznamy, které jste ve firmě vytvořili (změny, revize, přílohy), jsou součástí dokumentace firmy – jejich úplný export má správce firmy (Administrace → Data firmy).",
  };
}

/** Export vlastních údajů do evidence a deníku (bez obsahu). */
export async function recordPersonalExport(prisma: PrismaClient, user: { id: string; companyId: string | null }, now: Date = new Date()) {
  const company = user.companyId ? await prisma.registeredCompany.findUnique({ where: { id: user.companyId }, select: { id: true, companyName: true, ico: true, productScope: true } }) : null;
  await prisma.dataRequest.create({ data: { kind: "PERSONAL_EXPORT", status: "DONE", ...(company ? companyFields(company) : {}), requestedBy: "user", requestedAt: now, completedAt: now } });
  await prisma.securityEvent.create({ data: { kind: "DATA_EXPORTED", companyId: user.companyId, userId: user.id, actorId: user.id, detail: "export vlastních údajů" } });
}

// ---------------------------------------------------------------------------
//  Odebrání zaměstnance (anonymizace účtu)
// ---------------------------------------------------------------------------

/** Odebere zaměstnance: zruší přihlášení a kontakty, jméno ponechá v historii záznamů (nebo anonymizuje). */
export async function removeEmployee(prisma: PrismaClient, input: { companyId: string; actorId: string; userId: string; anonymizeName: boolean; now?: Date }) {
  const now = input.now ?? new Date();
  const company = await activeCompany(prisma, input.companyId);
  const user = await prisma.user.findFirst({ where: { id: input.userId, companyId: input.companyId, accountType: { not: null } } });
  if (!user) throw new WorkflowError("NOT_FOUND", "Zaměstnanec nebyl nalezen.");
  if (user.id === input.actorId) throw new WorkflowError("VALIDATION", "Sami sebe odebrat nemůžete – požádejte jiného správce firmy.");
  if (user.accountType === "PLANT_ADMIN") {
    const otherAdmins = await prisma.user.count({ where: { companyId: input.companyId, accountType: "PLANT_ADMIN", disabledAt: null, id: { not: user.id } } });
    if (!otherAdmins) throw new WorkflowError("VALIDATION", "Firma musí mít aspoň jednoho aktivního technického ředitele – nejdřív jmenujte jiného.");
  }
  const name = input.anonymizeName ? anonymousName(user.id) : user.name;
  await prisma.$transaction([
    prisma.userSession.deleteMany({ where: { userId: user.id } }),
    prisma.authToken.deleteMany({ where: { userId: user.id } }),
    prisma.securityEvent.updateMany({ where: { userId: user.id }, data: { email: null } }),
    prisma.user.update({
      where: { id: user.id },
      data: { name, email: removedUserEmail(user.id), phone: null, avatarUrl: null, title: null, passwordHash: null, passwordChangedAt: null, mustChangePassword: false, totpSecret: null, totpEnabledAt: null, totpRecoveryJson: null, accountType: null, scopeLayers: null, disabledAt: user.disabledAt ?? now },
    }),
    prisma.securityEvent.create({ data: { kind: "USER_REMOVED", companyId: input.companyId, userId: user.id, actorId: input.actorId, detail: input.anonymizeName ? "jméno anonymizováno" : "jméno ponecháno v historii záznamů" } }),
    prisma.dataRequest.create({ data: { kind: "USER_REMOVAL", status: "DONE", ...companyFields(company), requestedBy: "company-admin", requestedAt: now, completedAt: now, summaryJson: JSON.stringify({ anonymizedName: input.anonymizeName }) } }),
  ]);
  return { name };
}

// ---------------------------------------------------------------------------
//  Zrušení účtu firmy (výmaz po lhůtě)
// ---------------------------------------------------------------------------

export function pendingClosure(prisma: PrismaClient, companyId: string) {
  return prisma.dataRequest.findFirst({ where: { companyId, kind: "COMPANY_CLOSURE", status: "PENDING" }, orderBy: { requestedAt: "desc" } });
}

/** Žádost o zrušení účtu: výmaz za `CLOSURE_GRACE_DAYS` dní (opakovaná žádost vrátí tu čekající). */
export async function requestCompanyClosure(prisma: PrismaClient, input: { companyId: string; requestedBy: DataRequester; actorId?: string | null; now?: Date }) {
  const now = input.now ?? new Date();
  const company = await activeCompany(prisma, input.companyId);
  if (company.id === TESTER_COMPANY.id) throw new WorkflowError("VALIDATION", "Ukázkovou firmu Tester zrušit nejde.");
  const pending = await pendingClosure(prisma, company.id);
  if (pending) return pending;
  const request = await prisma.dataRequest.create({ data: { kind: "COMPANY_CLOSURE", status: "PENDING", ...companyFields(company), requestedBy: input.requestedBy, requestedAt: now, scheduledAt: new Date(now.getTime() + CLOSURE_GRACE_DAYS * DAY_MS) } });
  await prisma.securityEvent.create({ data: { kind: "COMPANY_CLOSURE_REQUESTED", companyId: company.id, actorId: input.actorId ?? null, detail: `výmaz dat ${isoDay(request.scheduledAt)}` } });
  return request;
}

/** Zruší čekající žádost o zrušení účtu. */
export async function cancelCompanyClosure(prisma: PrismaClient, input: { companyId: string; actorId?: string | null; now?: Date }) {
  const pending = await pendingClosure(prisma, input.companyId);
  if (!pending) throw new WorkflowError("NOT_FOUND", "Žádost o zrušení účtu nebyla nalezena.");
  const cancelled = await prisma.dataRequest.update({ where: { id: pending.id }, data: { status: "CANCELLED", cancelledAt: input.now ?? new Date() } });
  await prisma.securityEvent.create({ data: { kind: "COMPANY_CLOSURE_CANCELLED", companyId: input.companyId, actorId: input.actorId ?? null } });
  return cancelled;
}

/** Počet záznamů, které na uživatele odkazují bez kaskády (autor revize, zadavatel změny, autor události, příloha). */
async function userReferences(tx: Prisma.TransactionClient, userId: string) {
  const counts = await Promise.all([
    tx.documentRevision.count({ where: { OR: [{ authorId: userId }, { approverId: userId }] } }),
    tx.changeRequest.count({ where: { OR: [{ reporterId: userId }, { assigneeId: userId }] } }),
    tx.changeRequestEvent.count({ where: { actorId: userId } }),
    tx.attachment.count({ where: { uploadedById: userId } }),
  ]);
  return counts.reduce((sum, count) => sum + count, 0);
}

export interface ClosureSummary {
  plants: number;
  equipment: number;
  users: number;
  usersAnonymized: number;
  projects: number;
  floorplans: number;
  aiFeedback: number;
  notifications: number;
  securityEvents: number;
  files: number;
  filesRemoved: number;
  /** Firma zůstala jen s fakturačními údaji kvůli dokladům k objednávkám kreditů. */
  keptForInvoices: boolean;
}

/**
 * Výmaz účtu firmy: závod se vším (kaskáda), projekty a půdorysy Panel Builderu, hlášení AI, avíza, bezpečnostní
 * deník, uživatelé (bez odkazů smazaní, jinak anonymizovaní) a soubory firmy z disku. Firma s objednávkami kreditů
 * zůstane jen s fakturačními údaji (bez kontaktu a přihlášení), jinak se smaže.
 */
export async function executeCompanyClosure(prisma: PrismaClient, input: { companyId: string; storageRoot: string; now?: Date }): Promise<ClosureSummary> {
  const now = input.now ?? new Date();
  const company = await activeCompany(prisma, input.companyId);
  if (company.id === TESTER_COMPANY.id) throw new WorkflowError("VALIDATION", "Ukázkovou firmu Tester zrušit nejde.");
  const files = await prisma.storedFile.findMany({ where: { companyId: company.id, ownerKind: "COMPANY" }, select: { url: true } });
  const userIds = (await prisma.user.findMany({ where: { companyId: company.id }, select: { id: true } })).map((user) => user.id);
  const summary: ClosureSummary = { plants: 0, equipment: 0, users: 0, usersAnonymized: 0, projects: 0, floorplans: 0, aiFeedback: 0, notifications: 0, securityEvents: 0, files: files.length, filesRemoved: 0, keptForInvoices: false };

  await prisma.$transaction(
    async (tx) => {
      if (company.productScope === "PLANT_MANAGEMENT" && company.plantId) {
        summary.equipment = await tx.equipment.count({ where: { floor: { building: { plantId: company.plantId } } } });
        summary.notifications = (await tx.notificationLog.deleteMany({ where: { plantId: company.plantId } })).count;
        summary.plants = (await tx.plant.deleteMany({ where: { id: company.plantId } })).count;
      }
      summary.aiFeedback = (await tx.aiFeedbackReport.deleteMany({ where: { companyId: company.id } })).count;
      summary.floorplans = (await tx.floorplan.deleteMany({ where: { companyId: company.id } })).count;
      summary.projects = (await tx.panelBoardProject.deleteMany({ where: { companyId: company.id } })).count;
      summary.securityEvents = (await tx.securityEvent.deleteMany({ where: { OR: [{ companyId: company.id }, ...(userIds.length ? [{ userId: { in: userIds } }] : [])] } })).count;
      await tx.storedFile.deleteMany({ where: { companyId: company.id } });
      for (const id of userIds) {
        if (!(await userReferences(tx, id))) {
          await tx.user.delete({ where: { id } });
          summary.users++;
        } else {
          await tx.user.update({ where: { id }, data: { name: "Smazaný uživatel", email: removedUserEmail(id), phone: null, avatarUrl: null, title: null, passwordHash: null, totpSecret: null, totpEnabledAt: null, totpRecoveryJson: null, accountType: null, scopeLayers: null, companyId: null, homePlantId: null, disabledAt: now } });
          summary.usersAnonymized++;
        }
      }
      if (await tx.creditOrder.count({ where: { companyId: company.id } })) {
        await tx.registeredCompany.update({
          where: { id: company.id },
          data: { contactName: "Účet zrušen", email: closedCompanyEmail(company.id), phone: "", passwordHash: "!", authorizationNumber: null, logoUrl: null, stampUrl: null, circuitChipsJson: null, applianceLibraryJson: null, plantId: null, creditsRemaining: 0, closedAt: now },
        });
        summary.keptForInvoices = true;
      } else {
        await tx.registeredCompany.delete({ where: { id: company.id } });
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  // Soubory až po úspěšném výmazu dat (nepodaří-li se smazat, smaže je úklid úložiště – v databázi na ně nic neodkazuje)
  for (const file of files) {
    const segments = uploadSegments(file.url);
    const filePath = segments ? resolveUploadPath(input.storageRoot, segments) : null;
    if (!filePath) continue;
    try {
      await unlink(filePath);
      summary.filesRemoved++;
    } catch {
      // soubor už na disku není
    }
  }
  return summary;
}

/** Provede výmaz podle čekající žádosti a zapíše výsledek do evidence. */
async function completeClosure(prisma: PrismaClient, requestId: string, input: { companyId: string; storageRoot: string; now: Date }) {
  try {
    const summary = await executeCompanyClosure(prisma, input);
    return prisma.dataRequest.update({ where: { id: requestId }, data: { status: "DONE", completedAt: input.now, summaryJson: JSON.stringify(summary) } });
  } catch (error) {
    return prisma.dataRequest.update({ where: { id: requestId }, data: { status: "FAILED", error: (error instanceof Error ? error.message : String(error)).slice(0, 2000) } });
  }
}

/** Velín: výmaz hned (zákazník o něj výslovně požádal) – použije čekající žádost, nebo založí novou. */
export async function closeCompanyNow(prisma: PrismaClient, input: { companyId: string; storageRoot: string; now?: Date }) {
  const now = input.now ?? new Date();
  const company = await activeCompany(prisma, input.companyId);
  if (company.id === TESTER_COMPANY.id) throw new WorkflowError("VALIDATION", "Ukázkovou firmu Tester zrušit nejde.");
  const request = (await pendingClosure(prisma, company.id)) ?? (await prisma.dataRequest.create({ data: { kind: "COMPANY_CLOSURE", status: "PENDING", ...companyFields(company), requestedBy: "superadmin", requestedAt: now, scheduledAt: now } }));
  return completeClosure(prisma, request.id, { companyId: company.id, storageRoot: input.storageRoot, now });
}

/** Plánovač: výmaz všech účtů, kterým uplynula lhůta. */
export async function executeDueClosures(prisma: PrismaClient, input: { storageRoot: string; now?: Date }) {
  const now = input.now ?? new Date();
  const due = await prisma.dataRequest.findMany({ where: { kind: "COMPANY_CLOSURE", status: "PENDING", scheduledAt: { lte: now } }, orderBy: { scheduledAt: "asc" } });
  const results = [];
  for (const request of due) {
    if (!request.companyId) continue;
    results.push(await completeClosure(prisma, request.id, { companyId: request.companyId, storageRoot: input.storageRoot, now }));
  }
  return results;
}
