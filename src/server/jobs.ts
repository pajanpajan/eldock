import path from "node:path";

import type { PrismaClient } from "@/generated/prisma/client";
import type { MaintenanceTrigger } from "@/generated/prisma/enums";
import { backupConfig, type BackupConfig } from "@/server/backup/config";
import { runBackup } from "@/server/services/backup";
import { executeDueClosures } from "@/server/services/data-requests";
import { runRetention } from "@/server/services/retention";
import { sendDueMonthlyReports } from "@/server/services/revision-signing";
import { sendDuePurchaseReports } from "@/server/services/lifespan-report";
import { creditSubscriptions } from "@/server/services/credits";
import { brandEnv } from "@/lib/auth";
import { smtpTransportFromEnv } from "@/server/mailer";

// Plánovač údržby v procesu aplikace (fáze 68): jednou denně po čase `ELDOCK_BACKUP_TIME` (Europe/Prague) záloha,
// retence a (fáze 69) výmaz účtů firem po lhůtě. Spouští ho `src/instrumentation.ts` jen v produkčním serveru; běh se
// pozná podle `MaintenanceRun`, takže restart aplikace dnešní údržbu nezopakuje. Neúspěšný krok zkusí ještě dvakrát
// týž den. `ELDOCK_BACKUP=0` vypne jen zálohu – retence a výmazy běží dál.

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

/** Výmaz účtů firem, kterým uplynula lhůta (fáze 69) – záznam běhu jen tehdy, když nějaký výmaz čeká. */
export async function runErasure(prisma: PrismaClient, trigger: MaintenanceTrigger, input: { storageRoot: string; now: Date }) {
  const due = await prisma.dataRequest.count({ where: { kind: "COMPANY_CLOSURE", status: "PENDING", scheduledAt: { lte: input.now } } });
  if (!due) return null;
  const run = await prisma.maintenanceRun.create({ data: { kind: "ERASURE", trigger, startedAt: input.now } });
  const results = await executeDueClosures(prisma, input);
  const failed = results.filter((result) => result.status === "FAILED").length;
  return prisma.maintenanceRun.update({
    where: { id: run.id },
    data: { status: failed ? (failed === results.length ? "FAILED" : "WARNING") : "OK", finishedAt: new Date(), summaryJson: JSON.stringify({ closures: results.length, failed, companies: results.map((result) => result.companyName) }) },
  });
}

/** Denní údržba: záloha (je-li zapnutá), retence a výmaz účtů po lhůtě – každé jednou denně; vrací, co se spustilo. */
export async function runDueMaintenance(context: JobContext, trigger: MaintenanceTrigger = "SCHEDULE") {
  const config = context.config ?? backupConfig();
  const now = context.now?.() ?? new Date();
  const recent = await context.prisma.maintenanceRun.findMany({ where: { kind: { in: ["BACKUP", "RETENTION"] }, trigger, startedAt: { gte: new Date(now.getTime() - 36 * 60 * 60 * 1000) } }, select: { kind: true, status: true, startedAt: true } });
  const storageRoot = context.storageRoot ?? defaultStorageRoot();
  const backupDue = config.scheduleEnabled && isBackupDue(now, config.time, recent.filter((run) => run.kind === "BACKUP"));
  const dailyDue = isBackupDue(now, config.time, recent.filter((run) => run.kind === "RETENTION"));
  const backup = backupDue ? await runBackup({ prisma: context.prisma, config, storageRoot, now: context.now, log: context.log }, trigger) : null;
  const retention = dailyDue ? await runRetention(context.prisma, trigger, now) : null;
  const erasure = dailyDue ? await runErasure(context.prisma, trigger, { storageRoot, now }) : null;
  // Fáze 108: 1. den v měsíci kontrolní report revizí pod číslem osvědčení TIČR (jednou za měsíc a profil)
  if (dailyDue) {
    try {
      const sent = await sendDueMonthlyReports(context.prisma, { now, origin: brandEnv("PUBLIC_URL") ?? "https://eldock.cz", transport: smtpTransportFromEnv() });
      if (sent.length) context.log?.(`[eldock] Měsíční report TIČR: ${sent.length} profilů`);
    } catch (error) {
      context.log?.(`[eldock] Měsíční report TIČR selhal: ${error instanceof Error ? error.message : String(error)}`);
    }
    // Fáze 116: nákupní report prediktivní údržby oddělení nákupu (při prvním varování / měsíčně / čtvrtletně)
    try {
      const purchase = await sendDuePurchaseReports(context.prisma, { now, origin: brandEnv("PUBLIC_URL") ?? "https://eldock.cz", transport: smtpTransportFromEnv() });
      if (purchase.length) context.log?.(`[eldock] Nákupní report součástek: ${purchase.length} závodů`);
    } catch (error) {
      context.log?.(`[eldock] Nákupní report součástek selhal: ${error instanceof Error ? error.message : String(error)}`);
    }
    // Fáze 111: měsíční kredity předplatného ELDOCK PRO (100 kreditů každý měsíc, dokud předplatné běží)
    try {
      const credited = await creditSubscriptions(context.prisma, now);
      if (credited.credited) context.log?.(`[eldock] Kredity předplatného PRO: ${credited.credited} firem`);
    } catch (error) {
      context.log?.(`[eldock] Kredity předplatného selhaly: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (backup || retention) context.log?.(`[eldock] Denní údržba: záloha ${backup?.status ?? "vypnutá"}, retence ${retention?.status ?? "–"}${erasure ? `, výmaz účtů ${erasure.status}` : ""}.`);
  return { backup, retention, erasure };
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
