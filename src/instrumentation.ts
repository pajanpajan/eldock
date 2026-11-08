// Start serveru (Next.js `register` se volá jednou při startu instance). Fáze 70: triggery žurnálu změn pro aplikace
// (všude kromě `next build` – i dev a E2E). Fáze 68–69: plánovač denní zálohy, retence a výmazu účtů po lhůtě – jen
// v běžícím produkčním serveru Node.js (ne v dev / E2E); `ELDOCK_BACKUP=0` vypne jen zálohu.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const [{ ensureSyncTriggers }, { prisma: client, prismaReady }] = await Promise.all([import("./server/sync/journal"), import("./lib/prisma")]);
    // Nejdřív PRAGMA (WAL, cizí klíče) – uvnitř transakce by změnit nešly
    await prismaReady;
    const report = await ensureSyncTriggers(client);
    if (report.created.length || report.backfilled) console.log(`[eldock] Žurnál změn pro aplikace: triggerů ${report.created.length}, doplněno ${report.backfilled} záznamů${report.repaired.length ? `, přežurnálováno ${report.repaired.join(", ")}` : ""}.`);
  } catch (error) {
    console.error("[eldock] Žurnál změn pro aplikace se nepodařilo připravit:", error);
  }
  if (process.env.NODE_ENV !== "production") return;
  const [{ backupConfig }, { startMaintenanceScheduler }, { prisma }] = await Promise.all([import("./server/backup/config"), import("./server/jobs"), import("./lib/prisma")]);
  const config = backupConfig();
  for (const issue of config.issues) console.warn(`[eldock] Zálohy: ${issue}`);
  startMaintenanceScheduler({ prisma, config, log: (message) => console.log(message) });
  const time = `${String(config.time.hour).padStart(2, "0")}:${String(config.time.minute).padStart(2, "0")}`;
  console.log(
    config.scheduleEnabled
      ? `[eldock] Denní záloha, retence a výmazy v ${time} (Europe/Prague), místní snímky v ${config.dir}${config.s3 && config.secret ? `, mimo server ${config.s3.endpoint}/${config.s3.bucket}` : ""}.`
      : `[eldock] Denní retence a výmazy v ${time} (Europe/Prague); záloha vypnutá (ELDOCK_BACKUP=0).`,
  );
}
