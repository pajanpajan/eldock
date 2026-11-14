// Fáze 116: životnost součástek napárovaná na kusovník platné revize (záložka Kusovník & Životnost, Diagnostika,
// hlavička stroje) a 📦 souhrnný nákupní report za celý závod včetně automatického e-mailu oddělení nákupu.
// Služby dostávají `prisma` (testy nad SQLite, denní údržba) – stránky volají tenké dotazy v `server/queries/lifespan`.

import type { PrismaClient } from "@/generated/prisma/client";
import type { EquipmentType } from "@/generated/prisma/enums";
import { baselineInstalledAt, pairBomLifespan, stockOf, type BomLine, type LifespanRow, type StoredComponent } from "@/lib/bom-lifespan";
import { assessComponent, type LifespanAssessment, type WearCategory } from "@/lib/component-lifespan";
import {
  PURCHASE_SETTINGS_KEY,
  alertKeyOf,
  generateLifespanPurchaseReport,
  parsePurchaseSettings,
  purchaseMailText,
  purchaseReportDue,
  purchaseTable,
  reportKeys,
  type PurchaseInputRow,
  type PurchaseReport,
  type PurchaseSettings,
} from "@/lib/lifespan-purchase";
import { WorkflowError } from "@/lib/workflow/state-machine";
import type { MailTransport } from "@/server/mailer";

import { deliverMail } from "./revision-signing";

export const componentSelect = {
  id: true,
  designation: true,
  name: true,
  manufacturer: true,
  modelNumber: true,
  wearCategory: true,
  installedAt: true,
  cyclesPerHour: true,
  manualCyclesOffset: true,
  maxElectricalCycles: true,
  maxOperatingHours: true,
  maxCalendarMonths: true,
  replacementStockCount: true,
  alertLeadDays: true,
  hoursReading: true,
  hoursReadingAt: true,
  quantity: true,
  source: true,
  notes: true,
} as const;

export const toStored = (row: Omit<StoredComponent, "wearCategory"> & { wearCategory: string }): StoredComponent => ({ ...row, wearCategory: row.wearCategory as WearCategory });

/** Sklad náhradních dílů závodu: klíč MPN → kusy. */
export async function plantStock(prisma: PrismaClient, plantId: string): Promise<Map<string, number>> {
  const rows = await prisma.sparePartStock.findMany({ where: { plantId }, select: { partKey: true, quantity: true } });
  return new Map(rows.map((row) => [row.partKey, row.quantity]));
}

export interface AssessedRow {
  row: LifespanRow;
  assessment: LifespanAssessment | null;
  stock: number;
  alertLeadDays: number;
}

export function assessRows(rows: readonly LifespanRow[], context: { profile: { shiftRegime: number; internalTempC: number | null }; alertDays: number; stock: ReadonlyMap<string, number>; now: Date }): AssessedRow[] {
  return rows.map((row) => {
    const stock = stockOf(row, context.stock);
    const alertLeadDays = row.alertLeadDays ?? context.alertDays;
    return {
      row,
      stock,
      alertLeadDays,
      assessment: row.model ? assessComponent({ ...row.model, replacementStockCount: stock }, context.profile, context.now, { alertLeadDays }) : null,
    };
  });
}

/** Revize, jejíž kusovník platí: platná (ACTIVE), jinak nejnovější. */
export function pickRevision<T extends { id: string; status: string; major: number; minor: number }>(revisions: readonly T[]): T | null {
  return revisions.find((revision) => revision.status === "ACTIVE") ?? [...revisions].sort((a, b) => b.major - a.major || b.minor - a.minor)[0] ?? null;
}

const toBomLine = (item: BomLine): BomLine => ({ id: item.id, position: item.position, designation: item.designation, description: item.description, manufacturer: item.manufacturer, partNumber: item.partNumber, quantity: item.quantity, unit: item.unit, note: item.note ?? null });

/** Řádky životnosti jednoho stroje / rozváděče (kusovník zvolené revize, jinak platné). */
export async function equipmentLifespan(prisma: PrismaClient, equipmentId: string, options: { revisionId?: string | null; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      tag: true,
      yearInstalled: true,
      createdAt: true,
      shiftRegime: true,
      internalTempC: true,
      lifespanAlertDays: true,
      floor: { select: { building: { select: { plantId: true } } } },
      revisions: { select: { id: true, status: true, major: true, minor: true } },
      monitoredComponents: { select: componentSelect, orderBy: { designation: "asc" } },
    },
  });
  if (!equipment) return null;
  const revision = (options.revisionId ? equipment.revisions.find((candidate) => candidate.id === options.revisionId) : null) ?? pickRevision(equipment.revisions);
  const plantId = equipment.floor.building.plantId;
  const [bom, stock] = await Promise.all([
    revision ? prisma.bomItem.findMany({ where: { revisionId: revision.id }, orderBy: { position: "asc" } }) : Promise.resolve([]),
    plantStock(prisma, plantId),
  ]);
  const rows = pairBomLifespan(bom.map(toBomLine), equipment.monitoredComponents.map(toStored), baselineInstalledAt(equipment));
  const profile = { shiftRegime: equipment.shiftRegime, internalTempC: equipment.internalTempC };
  return {
    equipmentId: equipment.id,
    tag: equipment.tag,
    plantId,
    revisionId: revision?.id ?? null,
    profile,
    alertDays: equipment.lifespanAlertDays,
    baseline: baselineInstalledAt(equipment),
    rows: assessRows(rows, { profile, alertDays: equipment.lifespanAlertDays, stock, now }),
  };
}

export type EquipmentLifespan = NonNullable<Awaited<ReturnType<typeof equipmentLifespan>>>;

export type PlantLifespanRow = PurchaseInputRow & { status: LifespanAssessment["status"]; wearPercent: number; missingStock: boolean };

/**
 * Všechny sledované součástky závodu (kusovníky platných revizí + ručně sledované) s vyhodnocením – podklad
 * nákupního reportu a souhrnu prediktivní údržby. `types` = výřez účtu.
 */
export async function plantLifespanRows(prisma: PrismaClient, plantId: string, now: Date = new Date(), types: readonly EquipmentType[] | null = null) {
  const equipment = await prisma.equipment.findMany({
    where: { floor: { building: { plantId } }, ...(types ? { type: { in: [...types] } } : {}) },
    orderBy: { tag: "asc" },
    select: {
      id: true,
      tag: true,
      name: true,
      yearInstalled: true,
      createdAt: true,
      shiftRegime: true,
      internalTempC: true,
      lifespanAlertDays: true,
      floor: { select: { name: true, building: { select: { name: true } } } },
      revisions: { select: { id: true, status: true, major: true, minor: true } },
      monitoredComponents: { select: componentSelect },
    },
  });
  const chosen = new Map(equipment.map((item) => [item.id, pickRevision(item.revisions)?.id ?? null]));
  const revisionIds = [...chosen.values()].filter((id): id is string => Boolean(id));
  const [bomItems, stock] = await Promise.all([
    revisionIds.length ? prisma.bomItem.findMany({ where: { revisionId: { in: revisionIds } }, orderBy: { position: "asc" } }) : Promise.resolve([]),
    plantStock(prisma, plantId),
  ]);
  const bomByRevision = new Map<string, BomLine[]>();
  for (const item of bomItems) {
    const list = bomByRevision.get(item.revisionId);
    if (list) list.push(toBomLine(item));
    else bomByRevision.set(item.revisionId, [toBomLine(item)]);
  }
  const rows: PlantLifespanRow[] = [];
  for (const item of equipment) {
    const revisionId = chosen.get(item.id);
    const paired = pairBomLifespan(revisionId ? (bomByRevision.get(revisionId) ?? []) : [], item.monitoredComponents.map(toStored), baselineInstalledAt(item));
    const profile = { shiftRegime: item.shiftRegime, internalTempC: item.internalTempC };
    for (const { row, assessment, alertLeadDays } of assessRows(paired, { profile, alertDays: item.lifespanAlertDays, stock, now })) {
      if (!assessment) continue;
      rows.push({
        equipmentId: item.id,
        tag: item.tag,
        equipmentName: item.name,
        buildingName: item.floor.building.name,
        floorName: item.floor.name,
        designation: row.designation,
        manufacturer: row.manufacturer,
        partNumber: row.partNumber,
        description: row.description,
        quantity: row.quantity,
        remainingDays: assessment.remainingDays,
        endDate: assessment.predictedReplacementDate,
        remainingPercent: assessment.remainingPercent,
        alert: assessment.alert,
        expired: assessment.expired,
        alertLeadDays,
        estimated: row.limitSource === "estimate" || row.rateSource === "estimate",
        status: assessment.status,
        wearPercent: assessment.wearPercent,
        missingStock: assessment.missingStock,
      });
    }
  }
  return { rows, stock };
}

/** Souhrnný nákupní report závodu v nákupním výhledu (dny). */
export async function plantPurchaseReport(prisma: PrismaClient, plantId: string, horizonDays: number, now: Date = new Date(), types: readonly EquipmentType[] | null = null) {
  const { rows, stock } = await plantLifespanRows(prisma, plantId, now, types);
  return { report: generateLifespanPurchaseReport(rows, { now, horizonDays, stock }), rows };
}

// ---------------------------------------------------------------------------
//  Nastavení a e-mail oddělení nákupu
// ---------------------------------------------------------------------------

export const PURCHASE_KIND = "LIFESPAN_PURCHASE";

export async function getPurchaseSettings(prisma: PrismaClient, plantId: string): Promise<PurchaseSettings> {
  const stored = await prisma.tenantSetting.findUnique({ where: { key: PURCHASE_SETTINGS_KEY(plantId) }, select: { value: true } });
  return parsePurchaseSettings(stored?.value);
}

async function writeSettings(prisma: PrismaClient, plantId: string, settings: PurchaseSettings, userId: string | null) {
  const value = JSON.stringify(settings);
  await prisma.tenantSetting.upsert({ where: { key: PURCHASE_SETTINGS_KEY(plantId) }, create: { key: PURCHASE_SETTINGS_KEY(plantId), value, updatedById: userId }, update: { value, updatedById: userId } });
  return settings;
}

export async function savePurchaseSettings(prisma: PrismaClient, plantId: string, input: Pick<PurchaseSettings, "email" | "frequency" | "horizonDays">, userId: string | null) {
  const email = input.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new WorkflowError("VALIDATION", "Zadejte platný e-mail oddělení nákupu.");
  const current = await getPurchaseSettings(prisma, plantId);
  return writeSettings(prisma, plantId, { ...current, email, frequency: input.frequency, horizonDays: input.horizonDays }, userId);
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** HTML tabulka reportu pro e-mail nákupu. */
export function purchaseMailHtml(report: PurchaseReport, input: { plantName: string; reportUrl: string }): string {
  const [head, ...rows] = purchaseTable(report);
  const cell = (value: string | number | null, tag = "td") => `<${tag} style="border:1px solid #cbd5e1;padding:4px 6px;text-align:left;vertical-align:top">${escapeHtml(value === null ? "–" : String(value))}</${tag}>`;
  return [
    `<p style="font-family:Segoe UI,Arial,sans-serif"><b>📦 Nákupní report prediktivní údržby – ${escapeHtml(input.plantName)}</b><br>Výhled nákupu +${report.horizonDays} dní · ${report.totals.lines} objednacích čísel · ${report.totals.needed} ks k výměně · <b>${report.totals.toOrder} ks nutno doobjednat</b></p>`,
    `<table style="border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:12px"><thead><tr>${head.map((value) => cell(value, "th")).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => cell(value)).join("")}</tr>`).join("")}</tbody></table>`,
    `<p style="font-family:Segoe UI,Arial,sans-serif"><a href="${escapeHtml(input.reportUrl)}">Otevřít report s exporty XLSX / CSV / PDF</a></p>`,
  ].join("");
}

/** Odešle report na e-mail nákupu (SMTP, jinak záznam v logu) a zapamatuje si, o kterých součástkách nákup ví. */
export async function sendPurchaseReport(
  prisma: PrismaClient,
  input: { plantId: string; plantName: string; report: PurchaseReport; settings: PurchaseSettings; origin: string; transport: MailTransport | null; triggeredBy: string; userId?: string | null; now?: Date },
) {
  if (!input.settings.email) throw new WorkflowError("VALIDATION", "Nejdřív vyplňte e-mail oddělení nákupu.");
  const reportUrl = `${input.origin}/nakupni-report?zavod=${encodeURIComponent(input.plantId)}&vyhled=${input.report.horizonDays}`;
  const subject = `📦 Nákupní report součástek před koncem životnosti – ${input.plantName} (${input.report.totals.toOrder} ks k doobjednání)`;
  const log = await deliverMail(prisma, {
    kind: PURCHASE_KIND,
    plantId: input.plantId,
    to: input.settings.email,
    subject,
    text: purchaseMailText(input.report, { plantName: input.plantName, reportUrl }),
    html: purchaseMailHtml(input.report, { plantName: input.plantName, reportUrl }),
    itemCount: input.report.totals.lines,
    triggeredBy: input.triggeredBy,
    transport: input.transport,
  });
  const now = input.now ?? new Date();
  await writeSettings(prisma, input.plantId, { ...input.settings, lastSentAt: now.toISOString(), notifiedKeys: [...new Set(reportKeys(input.report))].slice(0, 2000) }, input.userId ?? null);
  return { delivery: log.delivery as "SENT" | "LOGGED" | "FAILED", to: input.settings.email, subject };
}

/**
 * Denní údržba: report nákupu všech závodů s vyplněným e-mailem podle frekvence (při prvním varování / měsíčně /
 * čtvrtletně). Vrací závody, kterým se report poslal.
 */
export async function sendDuePurchaseReports(prisma: PrismaClient, input: { now: Date; origin: string; transport: MailTransport | null }) {
  const settings = await prisma.tenantSetting.findMany({ where: { key: { startsWith: "purchase-report:" } }, select: { key: true, value: true } });
  const sent: { plantId: string; delivery: string }[] = [];
  for (const entry of settings) {
    const plantId = entry.key.slice("purchase-report:".length);
    const parsed = parsePurchaseSettings(entry.value);
    if (!parsed.email) continue;
    const plant = await prisma.plant.findUnique({ where: { id: plantId }, select: { id: true, name: true } });
    if (!plant) continue;
    const { report, rows } = await plantPurchaseReport(prisma, plant.id, parsed.horizonDays, input.now);
    const alertKeys = rows.filter((row) => row.alert || row.expired).map(alertKeyOf);
    if (!purchaseReportDue(parsed, report, alertKeys, input.now).due) continue;
    const result = await sendPurchaseReport(prisma, { plantId: plant.id, plantName: plant.name, report, settings: parsed, origin: input.origin, transport: input.transport, triggeredBy: "scheduler", now: input.now });
    sent.push({ plantId: plant.id, delivery: result.delivery });
  }
  return sent;
}

export type { PurchaseReport, PurchaseSettings };
