import { randomBytes, randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { PrismaClient } from "@/generated/prisma/client";
import { DEMO_OWNER, companyOwner, type FileOwner } from "@/lib/file-ownership";
import { parseMarkup } from "@/lib/markup";
import { accessCode, cadFormatLabel, markupSvg, routeSchema, type RouteInput } from "@/lib/redline-marketplace";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { hashPassword, verifyPassword } from "@/server/password";
import { readStoredFile } from "@/server/storage";
import { ZipWriter } from "@/server/zip";

import { uploadRevision } from "./workflow";

// Fáze 103: Červenka k překreslení – cesta A (firemní projektant závodu), cesta B (ELDOCK Pool – „kdo první přijme“).
// Přijetí úkolu je atomické: `updateMany` jen nad stavem OPEN – druhý projektant dostane „úkol už přijal …“.
// Odevzdání z portálu = nová revize schématu přes stávající workflow (údržba ji schválí → stará verze do archivu).

/** Předání Červenky k překreslení (údržba / vedoucí údržby při odeslání zákresu). */
export async function routeChangeRequest(prisma: PrismaClient, input: RouteInput) {
  const parsed = routeSchema.safeParse(input);
  if (!parsed.success) throw new WorkflowError("VALIDATION", parsed.error.issues[0]?.message ?? "Zkontrolujte údaje úkolu.");
  const data = parsed.data;
  const request = await prisma.changeRequest.findUnique({ where: { id: data.changeRequestId }, select: { id: true, status: true, equipment: { select: { floor: { select: { building: { select: { plant: { select: { designerName: true, designerEmail: true } } } } } } } } } });
  if (!request) throw new WorkflowError("NOT_FOUND", "Změnový požadavek nebyl nalezen.");
  if (request.status === "APPROVED" || request.status === "CANCELLED") throw new WorkflowError("VALIDATION", "Uzavřený požadavek už nejde předat.");
  const plant = request.equipment.floor.building.plant;
  const dueAt = data.dueAt ? new Date(`${data.dueAt}T16:00:00Z`) : null;
  const common = { mode: data.mode, status: "OPEN", description: data.description?.trim() || null, dueAt };
  // Cesta A bez vyplněného projektanta = fronta CAE Back-Office závodu (projektant se doplní v Nastavení závodu)
  const task =
    data.mode === "INTERNAL_DESIGNER"
      ? { ...common, internalName: plant.designerName, internalEmail: plant.designerEmail, format: "PDF", sheets: 1, rewardCzk: null }
      : { ...common, format: data.format, sheets: data.sheets, rewardCzk: data.rewardCzk, internalName: null, internalEmail: null };
  return prisma.redlineTask.upsert({ where: { changeRequestId: request.id }, create: { changeRequestId: request.id, ...task }, update: { ...task, claimedById: null, claimedAt: null } });
}

/**
 * E-mail firemnímu projektantovi (cesta A): podklady (odkaz na ticket se schématem a vrstvou Červenky), popis změny a
 * termín. Jen u závodu registrované firmy – sdílené obchodní demo e-maily neposílá (adresu může vyplnit kdokoli).
 */
export async function notifyInternalDesigner(prisma: PrismaClient, taskId: string, options: { origin: string; send: ((message: { to: string[]; subject: string; html: string; text: string }) => Promise<void>) | null }) {
  const task = await prisma.redlineTask.findUnique({
    where: { id: taskId },
    select: { mode: true, internalEmail: true, internalName: true, description: true, dueAt: true, changeRequest: { select: { id: true, number: true, note: true, voiceTranscript: true, equipment: { select: { tag: true, name: true, floor: { select: { building: { select: { plant: { select: { name: true, _count: { select: { registeredCompanies: { where: { productScope: "PLANT_MANAGEMENT" } } } } } } } } } } } } } } },
  });
  if (!task || task.mode !== "INTERNAL_DESIGNER" || !task.internalEmail || !options.send) return false;
  const plant = task.changeRequest.equipment.floor.building.plant;
  if (!plant._count.registeredCompanies) return false;
  const request = task.changeRequest;
  const url = `${options.origin}/cae/tickets/${request.id}`;
  const due = task.dueAt ? task.dueAt.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" }) : "bez termínu";
  const note = task.description ?? request.note ?? request.voiceTranscript ?? "—";
  const subject = `Červenka ${request.number} k překreslení – ${request.equipment.tag} (${plant.name})`;
  const text = `Dobrý den${task.internalName ? `, ${task.internalName}` : ""},\n\núdržba závodu ${plant.name} předala k čistému překreslení změnu ${request.number} na zařízení ${request.equipment.tag} – ${request.equipment.name}.\nPopis změny: ${note}\nPožadovaný termín: ${due}\n\nPůvodní schéma s vrstvou Červenky a fotkami: ${url}\nPo překreslení nahrajte novou revizi schématu v ticketu – údržba ji schválí.\n\nELDOCK`;
  const html = `<p>Dobrý den${task.internalName ? `, ${escapeHtml(task.internalName)}` : ""},</p><p>údržba závodu <strong>${escapeHtml(plant.name)}</strong> předala k čistému překreslení změnu <strong>${escapeHtml(request.number)}</strong> na zařízení ${escapeHtml(request.equipment.tag)} – ${escapeHtml(request.equipment.name)}.</p><p>Popis změny: ${escapeHtml(note)}<br>Požadovaný termín: ${escapeHtml(due)}</p><p><a href="${url}">Původní schéma s vrstvou Červenky a fotkami</a> – po překreslení nahrajte novou revizi schématu v ticketu, údržba ji schválí.</p><p>ELDOCK</p>`;
  await options.send({ to: [task.internalEmail], subject, html, text });
  return true;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

const taskInclude = {
  claimedBy: { select: { id: true, name: true } },
  changeRequest: {
    select: {
      id: true,
      number: true,
      markupData: true,
      markupSheet: true,
      note: true,
      voiceTranscript: true,
      submittedAt: true,
      _count: { select: { attachments: true } },
      baseRevision: { select: { version: true, schematicFormat: true } },
      equipment: { select: { tag: true, name: true, type: true, floor: { select: { building: { select: { plant: { select: { customerName: true, name: true } } } } } } } },
    },
  },
} as const;

/** Volné, přijaté a odevzdané úkoly poolu (portál projektantů) – nejnovější první. */
export async function poolTasks(prisma: PrismaClient) {
  return prisma.redlineTask.findMany({ where: { mode: "POOL", status: { in: ["OPEN", "CLAIMED", "SUBMITTED", "DONE"] } }, orderBy: { createdAt: "desc" }, take: 200, include: taskInclude });
}

export type PoolTask = Awaited<ReturnType<typeof poolTasks>>[number];

/** Počet změn v zákresu Červenky (tahy pera) – do karty úkolu. */
export const markupChanges = (task: PoolTask) => parseMarkup(task.changeRequest.markupData)?.strokes.length ?? 0;

/** ✋ Přijímám úkol – první projektant vyhrává, ostatním se úkol zamkne. */
export async function claimTask(prisma: PrismaClient, taskId: string, designerId: string, now = new Date()) {
  const designer = await prisma.poolDesigner.findFirst({ where: { id: designerId, active: true }, select: { id: true } });
  if (!designer) throw new WorkflowError("FORBIDDEN", "Projektant není ve schváleném seznamu ELDOCK Poolu.");
  const { count } = await prisma.redlineTask.updateMany({ where: { id: taskId, mode: "POOL", status: "OPEN" }, data: { status: "CLAIMED", claimedById: designer.id, claimedAt: now } });
  if (!count) {
    const task = await prisma.redlineTask.findUnique({ where: { id: taskId }, select: { claimedBy: { select: { name: true } } } });
    throw new WorkflowError("CONFLICT", task?.claimedBy ? `Úkol už přijal projektant ${task.claimedBy.name}.` : "Úkol už není volný.");
  }
}

/** Úkol přijatý tímto projektantem (balíček podkladů, odevzdání). */
async function claimedTask(prisma: PrismaClient, taskId: string, designerId: string) {
  const task = await prisma.redlineTask.findUnique({ where: { id: taskId }, include: { ...taskInclude, changeRequest: { select: { ...taskInclude.changeRequest.select, equipmentId: true, attachments: { select: { url: true, fileName: true, type: true } } } } } });
  if (!task || task.mode !== "POOL" || task.claimedById !== designerId) throw new WorkflowError("FORBIDDEN", "Úkol nepřijal tento projektant.");
  return task;
}

/**
 * Balíček podkladů jedním klikem (ZIP): platné schéma zařízení, vrstva Červenky (SVG), fotky a komentář údržbáře.
 * Jen pro projektanta, který úkol přijal.
 */
export async function taskPackage(prisma: PrismaClient, taskId: string, designerId: string, now = new Date()): Promise<{ fileName: string; bytes: Buffer }> {
  const task = await claimedTask(prisma, taskId, designerId);
  const request = task.changeRequest;
  const active = await prisma.documentRevision.findFirst({ where: { equipmentId: request.equipmentId, status: "ACTIVE" }, select: { version: true, schematicUrl: true, schematicFormat: true } });
  const target = path.join(tmpdir(), `eldock-pool-${randomUUID()}.zip`);
  const zip = new ZipWriter(target, now);
  try {
    if (active) {
      const file = await readStoredFile(active.schematicUrl);
      if (file) await zip.addBuffer(`1-puvodni-schema-${active.version}${path.extname(active.schematicUrl) || (active.schematicFormat === "PDF" ? ".pdf" : ".svg")}`, file.bytes);
    }
    const markup = parseMarkup(request.markupData);
    if (markup) await zip.addBuffer(`2-cervenka-list-${markup.sheet}.svg`, markupSvg(markup, `${request.number} · ${request.equipment.tag}`));
    let index = 0;
    for (const attachment of request.attachments) {
      const file = await readStoredFile(attachment.url);
      if (!file) continue;
      index += 1;
      await zip.addBuffer(`3-foto-${index}${path.extname(attachment.url) || ".jpg"}`, file.bytes);
    }
    const lines = [
      `Změna ${request.number} – ${request.equipment.tag} · ${request.equipment.name}`,
      `Firma / závod: ${request.equipment.floor.building.plant.customerName} – ${request.equipment.floor.building.plant.name}`,
      `Požadovaný formát: ${cadFormatLabel(task.format)}, listů: ${task.sheets}`,
      `Odměna: ${task.rewardCzk ? `${task.rewardCzk} Kč bez DPH` : "dle dohody"} · termín: ${task.dueAt ? task.dueAt.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" }) : "bez termínu"}`,
      "",
      `Komentář údržbáře: ${task.description ?? request.note ?? "—"}`,
      request.voiceTranscript ? `Přepis hlasové poznámky: ${request.voiceTranscript}` : "",
      "",
      "Po překreslení nahrajte v portálu https://eldock.cz/portal-projektantu nové čisté PDF schéma (a zdrojový CAD soubor).",
    ];
    await zip.addBuffer("0-zadani.txt", lines.filter((line, position) => line || position > 0).join("\r\n"));
    await zip.close();
    return { fileName: `eldock-${request.number}-podklady.zip`, bytes: await readFile(target) };
  } finally {
    await rm(target, { force: true });
  }
}

/** Technický účet projektanta poolu ve workflow (autor revize = jméno projektanta, bez přihlášení do závodu). */
async function ensurePoolUser(prisma: PrismaClient, designer: { id: string; name: string }) {
  const email = `pool-${designer.id}@pool.eldock.invalid`;
  return prisma.user.upsert({ where: { email }, create: { email, name: `${designer.name} (ELDOCK Pool)`, role: "CAE_ENGINEER", company: "ELDOCK Pool projektantů" }, update: { name: `${designer.name} (ELDOCK Pool)` }, select: { id: true } });
}

/** Vlastník nahraných souborů = firma závodu (jinak obchodní demo) – soubory pak uvidí jen údržba závodu. */
export async function plantOwnerOfTask(prisma: PrismaClient, taskId: string): Promise<FileOwner> {
  const task = await prisma.redlineTask.findUnique({ where: { id: taskId }, select: { changeRequest: { select: { equipment: { select: { floor: { select: { building: { select: { plantId: true } } } } } } } } } });
  const plantId = task?.changeRequest.equipment.floor.building.plantId;
  const company = plantId ? await prisma.registeredCompany.findFirst({ where: { plantId, productScope: "PLANT_MANAGEMENT" }, select: { id: true } }) : null;
  return company ? companyOwner(company.id) : DEMO_OWNER;
}

/**
 * Odevzdání překresleného schématu z portálu: nová revize (např. v1.1) přes workflow – čeká na schválení údržbou;
 * po schválení jde dosavadní platná revize do archivu (NEAKTUÁLNÍ) a Červenka je „✅ Zapracováno do dokumentace“.
 */
export async function submitPoolRevision(prisma: PrismaClient, input: { taskId: string; designerId: string; pdfUrl: string; cadUrl?: string | null; summary: string }) {
  const task = await claimedTask(prisma, input.taskId, input.designerId);
  if (task.status !== "CLAIMED") throw new WorkflowError("VALIDATION", task.status === "SUBMITTED" ? "Překreslení už je odevzdané – čeká na schválení údržbou." : "Úkol už je uzavřený.");
  const designer = await prisma.poolDesigner.findUnique({ where: { id: input.designerId }, select: { id: true, name: true } });
  if (!designer) throw new WorkflowError("FORBIDDEN", "Projektant nebyl nalezen.");
  const user = await ensurePoolUser(prisma, designer);
  const summary = input.summary.trim() || `Překresleno podle Červenky ${task.changeRequest.number} (ELDOCK Pool – ${designer.name}).`;
  const revision = await uploadRevision(prisma, { id: user.id, role: "CAE_ENGINEER" }, { changeRequestId: task.changeRequest.id, schematicUrl: input.pdfUrl, schematicFormat: "PDF", summary, sheetCount: task.sheets });
  await prisma.redlineTask.update({ where: { id: task.id }, data: { resultPdfUrl: input.pdfUrl, resultCadUrl: input.cadUrl ?? null } });
  return revision;
}

/** Schválený projektant poolu – přístupový kód se ukáže jen jednou (ukládá se jen jeho otisk). */
export async function createPoolDesigner(prisma: PrismaClient, input: { name: string; email: string }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new WorkflowError("VALIDATION", "Zadejte jméno a platný e-mail projektanta.");
  const code = accessCode((size) => randomBytes(size));
  const designer = await prisma.poolDesigner.upsert({ where: { email }, create: { name, email, accessHash: await hashPassword(code) }, update: { name, active: true, accessHash: await hashPassword(code) } });
  return { id: designer.id, name, email, code };
}

/** Přihlášení projektanta do portálu (e-mail + přístupový kód). */
export async function authenticateDesigner(prisma: PrismaClient, email: string, code: string) {
  const designer = await prisma.poolDesigner.findUnique({ where: { email: email.trim().toLowerCase() } });
  return designer?.active && (await verifyPassword(code.trim().toUpperCase(), designer.accessHash)) ? { id: designer.id, name: designer.name } : null;
}
