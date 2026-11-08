// Start serveru (Next.js `register` se volá jednou při startu instance). Fáze 68: plánovač denní zálohy a retence –
// jen v běžícím produkčním serveru Node.js (ne při `next build`, ne v dev / E2E), `ELDOCK_BACKUP=0` ho vypne.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const [{ backupConfig }, { startMaintenanceScheduler }, { prisma }] = await Promise.all([import("./server/backup/config"), import("./server/jobs"), import("./lib/prisma")]);
  const config = backupConfig();
  if (!config.scheduleEnabled) return;
  for (const issue of config.issues) console.warn(`[eldock] Zálohy: ${issue}`);
  startMaintenanceScheduler({ prisma, config, log: (message) => console.log(message) });
  console.log(`[eldock] Denní záloha a retence v ${String(config.time.hour).padStart(2, "0")}:${String(config.time.minute).padStart(2, "0")} (Europe/Prague), místní snímky v ${config.dir}${config.s3 && config.secret ? `, mimo server ${config.s3.endpoint}/${config.s3.bucket}` : ""}.`);
}
