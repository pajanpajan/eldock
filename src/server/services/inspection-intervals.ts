// Fáze 66: podklady pro lhůtu revize zařízení (NV 190/2022 Sb., příloha č. 4; ČSN 33 1600 ed. 2, tab. 1) a zkrácení
// delších lhůt a platností revizí VTZ a LPS na zákonné maximum. Zkracuje se jen u závazných lhůt (VTZ, LPS) a nikdy
// se nic neprodlužuje; původní platnost ze zprávy zůstane v `InspectionRecord.validUntilOriginal`. Záměrně bez `server-only`.

import type { EquipmentType, InstallationKind } from "@/generated/prisma/enums";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { DEADLINE_TYPES, computeValidUntil } from "@/lib/inspection";
import { BUILDING_RULE_FIELDS, RULE_FIELDS, inspectionRuleFor, intervalIssue, ruleInputFrom, ruleKindOf, variantsFor } from "@/lib/inspection-rules";
import { WorkflowError } from "@/lib/workflow/state-machine";

import type { Tx } from "./workflow";

export interface InspectionSettingsInput {
  equipmentId: string;
  /** Lhůta pravidelné revize [měsíce]; bez ní nejdelší lhůta podle pravidla. */
  intervalMonths?: number | null;
  /** Kódy vnějších vlivů z protokolu („AA5, AD4, BE2 – …“). */
  externalInfluences?: string | null;
  installationKind?: InstallationKind;
  lpsCritical?: boolean;
  preventiveMaintenance?: boolean;
  usageGroup?: string | null;
  protectionClass?: string | null;
  handHeld?: boolean;
  /** Budova zařízení podle PBŘ umožňuje přítomnost více než 200 osob – platí pro celou budovu. */
  crowdOver200?: boolean;
  /** Fáze 93: varianta zdravotnické kategorie (`variantsFor`). */
  inspectionVariant?: string | null;
}

const settingsSelect = {
  id: true,
  tag: true,
  ...RULE_FIELDS,
  floor: { select: { building: { select: { id: true, ...BUILDING_RULE_FIELDS } } } },
} as const;

const cleanText = (value: string | null | undefined, max: number) => value?.replace(/\s+/g, " ").trim().slice(0, max) || null;
const normalizeGroup = (value: string | null | undefined) => (value && /^[A-E]$/i.test(value.trim()) ? value.trim().toUpperCase() : null);
const normalizeClass = (value: string | null | undefined) => (value === "I" || value === "II" || value === "III" ? value : null);

/** Uloží podklady lhůty a lhůtu zařízení; u VTZ a LPS odmítne delší než zákonnou a zkrátí platnost dotčených revizí. */
export async function updateInspectionSettings(prisma: PrismaClient, input: InspectionSettingsInput) {
  const equipment = await prisma.equipment.findUnique({ where: { id: input.equipmentId }, select: settingsSelect });
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
  const building = equipment.floor.building;
  const kind = ruleKindOf(equipment.type);
  const appliance = kind === "APPLIANCE" || kind === "WELDER";
  const next = {
    externalInfluences: input.externalInfluences === undefined ? equipment.externalInfluences : cleanText(input.externalInfluences, 300),
    installationKind: kind === "VTZ" ? (input.installationKind ?? equipment.installationKind) : equipment.installationKind,
    lpsCritical: kind === "LPS" ? (input.lpsCritical ?? equipment.lpsCritical) : equipment.lpsCritical,
    preventiveMaintenance: kind === "VTZ" ? (input.preventiveMaintenance ?? equipment.preventiveMaintenance) : equipment.preventiveMaintenance,
    usageGroup: kind === "APPLIANCE" && input.usageGroup !== undefined ? normalizeGroup(input.usageGroup) : equipment.usageGroup,
    protectionClass: appliance && input.protectionClass !== undefined ? normalizeClass(input.protectionClass) : equipment.protectionClass,
    handHeld: equipment.type === "APPLIANCE" ? (input.handHeld ?? equipment.handHeld) : equipment.handHeld,
    // Fáze 93: varianta jen u zdravotnických přístrojů a prostorů (jiná hodnota se ignoruje)
    inspectionVariant:
      input.inspectionVariant !== undefined && variantsFor(equipment.type).length
        ? (variantsFor(equipment.type).find((variant) => variant.id === input.inspectionVariant)?.id ?? null)
        : equipment.inspectionVariant,
  };
  const crowdOver200 = input.crowdOver200 ?? building.crowdOver200;
  const rule = inspectionRuleFor({ type: equipment.type, ...next, buildingType: building.type, crowdOver200 });
  const intervalMonths = input.intervalMonths ?? rule.months;
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1 || intervalMonths > 120) {
    throw new WorkflowError("VALIDATION", "Lhůta revize musí být 1–120 měsíců.");
  }
  if (rule.binding && intervalMonths > rule.maxMonths) {
    throw new WorkflowError("VALIDATION", `Lhůta ${intervalMonths} měsíců překračuje nejdelší zákonnou lhůtu ${rule.maxMonths} měsíců. ${rule.basis}`);
  }
  const crowdChanged = crowdOver200 !== building.crowdOver200;
  const capped = await prisma.$transaction(async (tx) => {
    if (crowdChanged) await tx.building.update({ where: { id: building.id }, data: { crowdOver200 } });
    await tx.equipment.update({ where: { id: equipment.id }, data: { ...next, inspectionIntervalMonths: intervalMonths } });
    // Kratší zákonná lhůta platí od poslední revize – zkrátí platnost revizí zařízení (u změny objektu celé budovy).
    return capInspectionIntervals(tx, crowdChanged ? { floor: { buildingId: building.id } } : { id: equipment.id });
  });
  return { rule, intervalMonths, warning: intervalIssue(intervalMonths, rule)?.message ?? null, cappedRecords: capped.records, cappedIntervals: capped.intervals };
}

export interface CapChange {
  tag: string;
  type: EquipmentType;
  /** Zkrácená lhůta zařízení: z → na [měsíce]. */
  interval?: { from: number; to: number };
  /** Počet revizí se zkrácenou platností. */
  records: number;
}

export interface CapResult {
  checked: number;
  intervals: number;
  records: number;
  changes: CapChange[];
}

/**
 * Zkrátí lhůty zařízení a platnosti výchozích / pravidelných revizí VTZ a LPS, které přesahují nejdelší zákonnou lhůtu
 * (NV 190/2022 Sb., příloha č. 4). Nic neprodlužuje; `dryRun` jen spočítá změny.
 */
export async function capInspectionIntervals(
  db: PrismaClient | Tx,
  where: Prisma.EquipmentWhereInput = {},
  options: { dryRun?: boolean } = {},
): Promise<CapResult> {
  const equipment = await db.equipment.findMany({
    where,
    orderBy: { tag: "asc" },
    select: {
      id: true,
      tag: true,
      ...RULE_FIELDS,
      floor: { select: { building: { select: BUILDING_RULE_FIELDS } } },
      inspections: {
        where: { type: { in: [...DEADLINE_TYPES] }, result: { not: "INCAPABLE" } },
        select: { id: true, inspectionDate: true, validUntil: true, validUntilOriginal: true },
      },
    },
  });
  const result: CapResult = { checked: equipment.length, intervals: 0, records: 0, changes: [] };
  for (const item of equipment) {
    const rule = inspectionRuleFor(ruleInputFrom(item, item.floor.building));
    if (!rule.binding) continue;
    const change: CapChange = { tag: item.tag, type: item.type, records: 0 };
    if (item.inspectionIntervalMonths > rule.maxMonths) {
      change.interval = { from: item.inspectionIntervalMonths, to: rule.maxMonths };
      result.intervals++;
      if (!options.dryRun) await db.equipment.update({ where: { id: item.id }, data: { inspectionIntervalMonths: rule.maxMonths } });
    }
    for (const record of item.inspections) {
      const limit = computeValidUntil(record.inspectionDate, rule.maxMonths);
      if (record.validUntil.getTime() <= limit.getTime()) continue;
      change.records++;
      result.records++;
      if (!options.dryRun) {
        await db.inspectionRecord.update({ where: { id: record.id }, data: { validUntil: limit, validUntilOriginal: record.validUntilOriginal ?? record.validUntil } });
      }
    }
    if (change.interval || change.records) result.changes.push(change);
  }
  return result;
}

// ---------------------------------------------------------------------------
//  Jednorázová oprava dat fáze 66 (značka `migration.phase66-intervals`)
// ---------------------------------------------------------------------------

export const PHASE66_MARKER = "migration.phase66-intervals";

/** Výchozí lhůty spotřebičů podle tabulky Eldocku před fází 66 (bez třídy ochrany a sloupce „držené v ruce“). */
const LEGACY_APPLIANCE: Partial<Record<EquipmentType, Record<string, number>>> = {
  POWER_TOOL: { A: 3, B: 3, C: 12, D: 12, E: 24 },
  APPLIANCE: { A: 6, B: 6, C: 24, D: 24, E: 24 },
  EXTENSION_CORD: { A: 3, B: 3, C: 12, D: 12, E: 24 },
};

/**
 * Spotřebiče, které mají dosud výchozí lhůtu staré tabulky, dostanou výchozí lhůtu ČSN 33 1600 ed. 2 podle třídy
 * ochrany (vlastní lhůty zůstanou; platnosti revizí se nemění – normová lhůta platí od příští revize).
 */
export async function refreshApplianceDefaults(db: PrismaClient | Tx, options: { dryRun?: boolean } = {}) {
  const items = await db.equipment.findMany({
    where: { type: { in: ["POWER_TOOL", "APPLIANCE", "EXTENSION_CORD"] } },
    orderBy: { tag: "asc" },
    select: { id: true, tag: true, ...RULE_FIELDS, floor: { select: { building: { select: BUILDING_RULE_FIELDS } } } },
  });
  const changes: { tag: string; from: number; to: number }[] = [];
  for (const item of items) {
    const legacy = LEGACY_APPLIANCE[item.type]?.[normalizeGroup(item.usageGroup) ?? "C"];
    const months = inspectionRuleFor(ruleInputFrom(item, item.floor.building)).months;
    if (legacy === undefined || item.inspectionIntervalMonths !== legacy || legacy === months) continue;
    changes.push({ tag: item.tag, from: legacy, to: months });
    if (!options.dryRun) await db.equipment.update({ where: { id: item.id }, data: { inspectionIntervalMonths: months } });
  }
  return changes;
}

/** Celá jednorázová oprava: zákonné maximum VTZ a LPS + nové výchozí lhůty spotřebičů. Podruhé nic nedělá (značka). */
export async function migratePhase66Intervals(prisma: PrismaClient, options: { dryRun?: boolean; force?: boolean } = {}) {
  if (!options.force && !options.dryRun) {
    const marker = await prisma.tenantSetting.findUnique({ where: { key: PHASE66_MARKER }, select: { value: true } });
    if (marker) return { skipped: true as const };
  }
  const run = async (db: PrismaClient | Tx) => ({ capped: await capInspectionIntervals(db, {}, options), appliances: await refreshApplianceDefaults(db, options) });
  if (options.dryRun) return { skipped: false as const, ...(await run(prisma)) };
  const result = await prisma.$transaction(async (tx) => {
    const done = await run(tx);
    await tx.tenantSetting.upsert({ where: { key: PHASE66_MARKER }, create: { key: PHASE66_MARKER, value: "1" }, update: { value: "1" } });
    return done;
  });
  return { skipped: false as const, ...result };
}
