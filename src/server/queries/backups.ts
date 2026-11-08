import "server-only";

import { prisma } from "@/lib/prisma";
import { backupConfig, publicBackupConfig } from "@/server/backup/config";
import { listLocalSnapshots, parseBackupSummary } from "@/server/services/backup";
import { registryStats } from "@/server/services/file-registry";

// Velín → Zálohy a data (fáze 68): stav záloh, nastavení bez tajných údajů, místní snímky a registr souborů.

/** Záloha je „stará“, když poslední úspěšná proběhla před víc než 36 hodinami (nebo nikdy). */
export const STALE_BACKUP_MS = 36 * 60 * 60 * 1000;

export async function getBackupOverview(now: Date = new Date()) {
  const config = backupConfig();
  const [runs, lastOk, local, registry, offsiteGroups] = await Promise.all([
    prisma.maintenanceRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
    prisma.maintenanceRun.findFirst({ where: { kind: "BACKUP", status: { in: ["OK", "WARNING"] } }, orderBy: { startedAt: "desc" } }),
    listLocalSnapshots(config.dir),
    registryStats(prisma),
    prisma.backupObject.groupBy({ by: ["kind"], _count: { _all: true }, _sum: { storedBytes: true } }),
  ]);
  const offsite = Object.fromEntries(offsiteGroups.map((group) => [group.kind, { objects: group._count._all, bytes: group._sum.storedBytes ?? 0 }]));
  return {
    config: publicBackupConfig(config),
    runs: runs.map((run) => ({ ...run, summary: run.kind === "BACKUP" ? parseBackupSummary(run.summaryJson) : null, retention: run.kind === "RETENTION" && run.summaryJson ? (JSON.parse(run.summaryJson) as Record<string, number>) : null })),
    lastOk: lastOk ? { startedAt: lastOk.startedAt, status: lastOk.status, summary: parseBackupSummary(lastOk.summaryJson) } : null,
    stale: !lastOk || now.getTime() - lastOk.startedAt.getTime() > STALE_BACKUP_MS,
    running: runs.some((run) => run.status === "RUNNING"),
    local: local.slice(0, 10),
    registry,
    offsite: { db: offsite.db ?? { objects: 0, bytes: 0 }, file: offsite.file ?? { objects: 0, bytes: 0 } },
  };
}

export type BackupOverview = Awaited<ReturnType<typeof getBackupOverview>>;
