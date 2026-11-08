import path from "node:path";

import type { PrismaClient } from "@/generated/prisma/client";
import type { MaintenanceTrigger } from "@/generated/prisma/enums";
import { backupConfig, type BackupConfig } from "@/server/backup/config";
import { runBackup } from "@/server/services/backup";
import { runRetention } from "@/server/services/retention";

// Plánovač údržby v procesu aplikace (fáze 68): jednou denně po čase `ELDOCK_BACKUP_TIME` (Europe/Prague) záloha
// a retence. Spouští ho `src/instrumentation.ts` jen v produkčním serveru; běh se pozná podle `MaintenanceRun`,
// takže restart aplikace dnešní zálohu nezopakuje. Neúspěšnou zálohu zkusí ještě dvakrát týž den.

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const FIRST_CHECK_MS = 60 * 1000;
const MAX_ATTEMPTS_PER_DAY = 3;

const PRAGUE = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Pražský den `YYYY-MM-DD` a minuta dne. */
export function pragueClock(date: Date) {
  const parts = Object.fromEntries(PRAGUE.formatToParts(date).map((part) => [part.type, part.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Má plánovač teď spustit denní zálohu? (po nastaveném čase, dnes ještě neproběhla úspěšně, nejvýš 3 pokusy) */
export function isBackupDue(now: Date, time: BackupConfig["time"], todaysRuns: readonly { status: string; startedAt: Date }[]): boolean {
  const clock = pragueClock(now);
  if (clock.minuteOfDay < time.hour * 60 + time.minute) return false;
  const today = todaysRuns.filter((run) => pragueClock(run.startedAt).day === clock.day);
  if (today.some((run) => run.status === "OK" || run.status === "WARNING" || run.status === "RUNNING")) return false;
  return today.length < MAX_ATTEMPTS_PER_DAY;
}

export interface JobContext {
  prisma: PrismaClient;
  config?: BackupConfig;
  storageRoot?: string;
  now?: () => Date;
  log?: (message: string) => void;
}

/** Denní údržba: záloha (pokud je čas) a po ní retence – vrací, co se spustilo. */
export async function runDueMaintenance(context: JobContext, trigger: MaintenanceTrigger = "SCHEDULE") {
  const config = context.config ?? backupConfig();
  const now = context.now?.() ?? new Date();
  const recent = await context.prisma.maintenanceRun.findMany({ where: { kind: "BACKUP", trigger, startedAt: { gte: new Date(now.getTime() - 36 * 60 * 60 * 1000) } }, select: { status: true, startedAt: true } });
  if (!isBackupDue(now, config.time, recent)) return { backup: null, retention: null };
  const backup = await runBackup({ prisma: context.prisma, config, storageRoot: context.storageRoot ?? defaultStorageRoot(), now: context.now, log: context.log }, trigger);
  const retention = await runRetention(context.prisma, trigger, now);
  context.log?.(`[eldock] Denní údržba: záloha ${backup.status}, retence ${retention.status}.`);
  return { backup, retention };
}

export const defaultStorageRoot = () => path.join(process.cwd(), "storage", "uploads");

let timer: ReturnType<typeof setInterval> | null = null;
let busy = false;

/** Spustí plánovač (jednou za proces). Kontrola každých 10 minut, první minutu po startu. */
export function startMaintenanceScheduler(context: JobContext) {
  if (timer) return;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await runDueMaintenance(context);
    } catch (error) {
      context.log?.(`[eldock] Plánovač údržby: ${error instanceof Error ? error.message : error}`);
    } finally {
      busy = false;
    }
  };
  timer = setInterval(() => void tick(), CHECK_INTERVAL_MS);
  timer.unref?.();
  setTimeout(() => void tick(), FIRST_CHECK_MS).unref?.();
}

/** Ruční záloha z velínu: běží na pozadí (odpověď hned), stav ukáže velín z `MaintenanceRun`. */
export function startManualBackup(context: JobContext) {
  if (busy) throw new Error("Záloha nebo údržba už běží – počkejte na její dokončení.");
  busy = true;
  const config = context.config ?? backupConfig();
  void runBackup({ prisma: context.prisma, config, storageRoot: context.storageRoot ?? defaultStorageRoot(), log: context.log }, "MANUAL")
    .catch((error) => context.log?.(`[eldock] Ruční záloha: ${error instanceof Error ? error.message : error}`))
    .finally(() => {
      busy = false;
    });
}
