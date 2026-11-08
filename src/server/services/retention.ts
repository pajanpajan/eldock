import type { PrismaClient } from "@/generated/prisma/client";
import type { MaintenanceTrigger } from "@/generated/prisma/enums";

// Retence (fáze 68): jak dlouho se drží záznamy o přihlášení a údržbě. Běží denně se zálohou (plánovač v procesu
// aplikace). Limit pokusů o přihlášení (15 min) ani „Můj účet“ (aktivní relace) tím nejsou dotčené.

export const RETENTION_DAYS = {
  /** Bezpečnostní deník firmy (přihlášení, chyby, změny hesla a účtů). */
  securityEvents: 365,
  /** Zrušené nebo prošlé relace přihlášení. */
  sessions: 30,
  /** Použité nebo prošlé odkazy na nastavení hesla (pozvánky, obnova). */
  authTokens: 30,
  /** Záznamy o bězích zálohy a retence. */
  maintenanceRuns: 400,
  /** Fáze 69: evidence žádostí o data (export, odebrání zaměstnance, zrušení účtu) – doklad o vyřízení. */
  dataRequests: 1095,
  /** Zrušená firma Panel Builderu s fakturačními údaji a objednávkami kreditů (doklady 10 let). */
  closedCompanies: 3653,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionSummary {
  securityEvents: number;
  sessions: number;
  authTokens: number;
  maintenanceRuns: number;
  dataRequests: number;
  closedCompanies: number;
}

/** Smaže záznamy starší než retence; vrací počty smazaných. */
export async function applyRetention(prisma: PrismaClient, now: Date = new Date()): Promise<RetentionSummary> {
  const before = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const [securityEvents, sessions, authTokens, maintenanceRuns, dataRequests, closedCompanies] = await prisma.$transaction([
    prisma.securityEvent.deleteMany({ where: { createdAt: { lt: before(RETENTION_DAYS.securityEvents) } } }),
    prisma.userSession.deleteMany({ where: { OR: [{ revokedAt: { lt: before(RETENTION_DAYS.sessions) } }, { expiresAt: { lt: before(RETENTION_DAYS.sessions) } }] } }),
    prisma.authToken.deleteMany({ where: { OR: [{ usedAt: { lt: before(RETENTION_DAYS.authTokens) } }, { expiresAt: { lt: before(RETENTION_DAYS.authTokens) } }] } }),
    prisma.maintenanceRun.deleteMany({ where: { startedAt: { lt: before(RETENTION_DAYS.maintenanceRuns) }, status: { not: "RUNNING" } } }),
    prisma.dataRequest.deleteMany({ where: { requestedAt: { lt: before(RETENTION_DAYS.dataRequests) }, status: { not: "PENDING" } } }),
    // Objednávky kreditů se smažou kaskádou s firmou – až po uplynutí lhůty pro doklady
    prisma.registeredCompany.deleteMany({ where: { closedAt: { lt: before(RETENTION_DAYS.closedCompanies) } } }),
  ]);
  return { securityEvents: securityEvents.count, sessions: sessions.count, authTokens: authTokens.count, maintenanceRuns: maintenanceRuns.count, dataRequests: dataRequests.count, closedCompanies: closedCompanies.count };
}

/** Retence jako běh údržby (záznam `MaintenanceRun` kind RETENTION). */
export async function runRetention(prisma: PrismaClient, trigger: MaintenanceTrigger, now: Date = new Date()) {
  const run = await prisma.maintenanceRun.create({ data: { kind: "RETENTION", trigger, startedAt: now } });
  try {
    const summary = await applyRetention(prisma, now);
    return prisma.maintenanceRun.update({ where: { id: run.id }, data: { status: "OK", finishedAt: new Date(), summaryJson: JSON.stringify(summary) } });
  } catch (error) {
    return prisma.maintenanceRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), error: (error instanceof Error ? error.message : String(error)).slice(0, 2000) } });
  }
}
