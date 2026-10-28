// Smoke test celé smyčky workflow nad KOPIÍ databáze (dev.db zůstane beze změny):
// submit → assign → upload → reject → upload → approve, s kontrolou invariantů po každém kroku.
// Spuštění: `npm run smoke`.
import "dotenv/config";

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { OPEN_STATUSES, WorkflowError, deriveEquipmentStatus } from "../src/lib/workflow/state-machine";
import * as workflow from "../src/server/services/workflow";

const ROOT = process.cwd();
const DEV_DB = path.join(ROOT, (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, ""));
const SMOKE_DB = path.join(ROOT, "smoke.db");
const EQUIPMENT_ID = "eq-r-ml-01";

const MAINTENANCE: workflow.Actor = { id: "user-novak", role: "MAINTENANCE" };
const CAE: workflow.Actor = { id: "user-kral", role: "CAE_ENGINEER" };

const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const ok = (message: string) => console.log(`  ✔ ${message}`);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Kontrola selhala: ${message}`);
}

function cleanup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(SMOKE_DB + suffix, { force: true });
}

async function main() {
  if (!existsSync(DEV_DB)) throw new Error(`Databáze ${DEV_DB} neexistuje – spusťte npm run db:reset.`);
  const devHash = hash(DEV_DB);
  cleanup();
  copyFileSync(DEV_DB, SMOKE_DB);
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${SMOKE_DB}` }) });

  async function checkInvariants(step: string) {
    const [equipment, open, active] = await Promise.all([
      prisma.equipment.findUniqueOrThrow({ where: { id: EQUIPMENT_ID } }),
      prisma.changeRequest.findMany({ where: { equipmentId: EQUIPMENT_ID, status: { in: [...OPEN_STATUSES] } } }),
      prisma.documentRevision.count({ where: { equipmentId: EQUIPMENT_ID, status: "ACTIVE" } }),
    ]);
    assert(open.length <= 1, `${step}: max. 1 otevřený požadavek`);
    assert(active === 1, `${step}: právě 1 platná revize (je ${active})`);
    assert(equipment.status === deriveEquipmentStatus(open[0]?.status), `${step}: stav zařízení odpovídá požadavku`);
    return { equipment, open: open[0] ?? null };
  }

  async function expectError(promise: Promise<unknown>, code: string, step: string) {
    try {
      await promise;
    } catch (error) {
      assert(error instanceof WorkflowError && error.code === code, `${step}: čekána chyba ${code}, přišlo ${String(error)}`);
      return;
    }
    throw new Error(`Kontrola selhala: ${step} měl skončit chybou ${code}`);
  }

  try {
    console.log(`Smoke test workflow nad kopií databáze (${path.basename(SMOKE_DB)})`);
    await checkInvariants("výchozí stav");

    const cr = await workflow.submitChangeRequest(prisma, MAINTENANCE, {
      equipmentId: EQUIPMENT_ID,
      priority: "HIGH",
      note: "Smoke test: vyměněn jistič F3.",
      markupData: JSON.stringify({ version: 1, sheet: 1, strokes: [{ tool: "pen", color: "#ef4444", width: 0.004, points: [[0.2, 0.3, 0.5], [0.25, 0.35, 0.5]] }] }),
    });
    let state = await checkInvariants("submit");
    assert(state.equipment.status === "PENDING_UPDATE", "submit: zařízení 🟠");
    assert(/^ZM-\d{4}-\d{4}$/.test(cr.number), "submit: číslo ticketu");
    ok(`Údržba zadala změnu ${cr.number} → zařízení PENDING_UPDATE`);

    await expectError(workflow.submitChangeRequest(prisma, MAINTENANCE, { equipmentId: EQUIPMENT_ID, note: "druhý" }), "CONFLICT", "druhý požadavek");
    await expectError(workflow.approveRevision(prisma, MAINTENANCE, { changeRequestId: cr.id }), "INVALID_STATE", "schválení bez revize");
    await expectError(workflow.assignChangeRequest(prisma, MAINTENANCE, { changeRequestId: cr.id }), "FORBIDDEN", "převzetí údržbou");
    ok("Nepovolené akce odmítnuty (druhý požadavek, schválení bez revize, převzetí údržbou)");

    await workflow.assignChangeRequest(prisma, CAE, { changeRequestId: cr.id });
    state = await checkInvariants("assign");
    assert(state.open?.status === "IN_PROGRESS" && state.open.assigneeId === CAE.id, "assign: IN_PROGRESS + řešitel");
    ok("CAE převzal požadavek → IN_PROGRESS");

    const first = await workflow.uploadRevision(prisma, CAE, {
      changeRequestId: cr.id,
      schematicUrl: "/api/files/revisions/seed/R-ML-01-v1.2.svg",
      schematicFormat: "SVG",
      summary: "Jistič F3 nahrazen typem C20.",
    });
    state = await checkInvariants("upload 1");
    assert(state.equipment.status === "WAITING_APPROVAL", "upload: zařízení 🔵");
    assert(first.version === "v1.3", `upload: číslo verze v1.3 (je ${first.version})`);
    const bomCount = await prisma.bomItem.count({ where: { revisionId: first.id } });
    assert(bomCount > 0, "upload: kusovník zkopírován z platné revize");
    ok(`CAE nahrál ${first.version} (BOM ${bomCount} položek) → WAITING_APPROVAL`);

    await expectError(workflow.rejectRevision(prisma, MAINTENANCE, { changeRequestId: cr.id, comment: " " }), "VALIDATION", "vrácení bez komentáře");
    await workflow.rejectRevision(prisma, MAINTENANCE, { changeRequestId: cr.id, comment: "Chybí přečíslování svorek." });
    state = await checkInvariants("reject");
    assert(state.equipment.status === "PENDING_UPDATE" && state.open?.status === "IN_PROGRESS", "reject: zpět 🟠 / IN_PROGRESS");
    const rejected = await prisma.documentRevision.findUniqueOrThrow({ where: { id: first.id } });
    assert(rejected.status === "REJECTED" && rejected.rejectionComment, "reject: revize REJECTED s důvodem");
    ok(`Údržba vrátila ${first.version} s komentářem → IN_PROGRESS`);

    const second = await workflow.uploadRevision(prisma, CAE, {
      changeRequestId: cr.id,
      schematicUrl: "/api/files/revisions/seed/R-ML-01-v1.2.svg",
      schematicFormat: "SVG",
      summary: "Jistič F3 C20, přečíslovány svorky X2.",
    });
    await checkInvariants("upload 2");
    assert(second.version === "v1.4", `upload 2: zamítnutá v1.3 si číslo ponechala → v1.4 (je ${second.version})`);
    ok(`CAE nahrál opravenou ${second.version} → WAITING_APPROVAL`);

    const previousActive = await prisma.documentRevision.findFirstOrThrow({ where: { equipmentId: EQUIPMENT_ID, status: "ACTIVE" } });
    await workflow.approveRevision(prisma, MAINTENANCE, { changeRequestId: cr.id });
    state = await checkInvariants("approve");
    assert(state.equipment.status === "ACTIVE" && state.open === null, "approve: zařízení 🟢, žádný otevřený požadavek");
    const [archived, approved, closed] = await Promise.all([
      prisma.documentRevision.findUniqueOrThrow({ where: { id: previousActive.id } }),
      prisma.documentRevision.findUniqueOrThrow({ where: { id: second.id } }),
      prisma.changeRequest.findUniqueOrThrow({ where: { id: cr.id }, include: { events: { orderBy: { createdAt: "asc" } } } }),
    ]);
    assert(archived.status === "ARCHIVED", "approve: předchozí revize v archivu");
    assert(approved.status === "ACTIVE" && approved.approverId === MAINTENANCE.id, "approve: nová revize platná se schvalovatelem");
    assert(closed.status === "APPROVED" && closed.closedAt, "approve: požadavek uzavřen");
    const events = closed.events.map((event) => event.type).join(" → ");
    assert(
      events === "SUBMITTED → ASSIGNED → REVISION_UPLOADED → REJECTED → REVISION_UPLOADED → APPROVED",
      `události v pořadí (jsou: ${events})`,
    );
    ok(`Údržba schválila ${second.version}: ${previousActive.version} ARCHIVED, ${first.version} REJECTED, ${second.version} ACTIVE`);
    ok(`Timeline: ${events}`);

    const cancelCr = await workflow.submitChangeRequest(prisma, MAINTENANCE, { equipmentId: EQUIPMENT_ID, note: "Smoke test: storno." });
    await workflow.cancelChangeRequest(prisma, CAE, { changeRequestId: cancelCr.id, comment: "Duplicitní hlášení." });
    state = await checkInvariants("cancel");
    assert(state.equipment.status === "ACTIVE", "cancel: zařízení zpět 🟢");
    ok(`Storno ${cancelCr.number} → zařízení ACTIVE`);
  } finally {
    await prisma.$disconnect();
    cleanup();
  }

  assert(hash(DEV_DB) === devHash, "dev.db zůstala beze změny");
  ok("Kopie smazána, dev.db beze změny");
  console.log("Smoke test prošel.");
}

main().catch((error) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
