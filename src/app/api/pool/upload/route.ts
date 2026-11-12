import path from "node:path";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { storeUpload } from "@/server/file-access";
import { getPoolDesigner } from "@/server/pool-session";
import { plantOwnerOfTask, submitPoolRevision } from "@/server/services/redlines";

const MB = 1024 * 1024;
const CAD_EXTENSIONS = [".zip", ".7z", ".rar", ".dwg", ".dxf"];
const error = (message: string, status = 400) => Response.json({ error: message }, { status });

/**
 * Fáze 103: odevzdání překresleného schématu z portálu ELDOCK Poolu (multipart: `taskId`, `pdf`, volitelně `cad`
 * a `summary`). Nové čisté PDF = nová revize schématu zařízení (čeká na schválení údržbou), zdrojový CAD se uloží
 * k úkolu. Soubory patří firmě závodu (vidí je jen údržba závodu).
 */
export async function POST(request: Request) {
  const designer = await getPoolDesigner();
  if (!designer) return error("Přihlaste se do portálu projektantů.", 401);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("Očekáván formulář multipart/form-data.");
  }
  const taskId = String(form.get("taskId") ?? "");
  const pdf = form.get("pdf");
  const cad = form.get("cad");
  const summary = String(form.get("summary") ?? "").slice(0, 2000);
  if (!taskId || !(pdf instanceof File) || !pdf.size) return error("Nahrajte nové čisté PDF schéma.");
  const task = await prisma.redlineTask.findFirst({ where: { id: taskId, mode: "POOL", claimedById: designer.id, status: "CLAIMED" }, select: { id: true } });
  if (!task) return error("Úkol nemáte přijatý nebo už je odevzdaný.", 403);
  if (pdf.size > 25 * MB || path.extname(pdf.name).toLowerCase() !== ".pdf") return error("Schéma nahrajte jako PDF do 25 MB.");
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  if (pdfBytes.subarray(0, 5).toString("latin1") !== "%PDF-") return error("Soubor schématu není PDF.");
  const cadFile = cad instanceof File && cad.size ? cad : null;
  if (cadFile && (cadFile.size > 50 * MB || !CAD_EXTENSIONS.includes(path.extname(cadFile.name).toLowerCase()))) return error("Zdrojový CAD nahrajte jako DWG / DXF nebo zabalený projekt ZIP / 7Z / RAR (PC|SCHEMATIC, EPLAN) do 50 MB.");

  try {
    const owner = await plantOwnerOfTask(prisma, taskId);
    const stored = await storeUpload({ dir: "revisions", extension: ".pdf", data: pdfBytes, owner, originalName: pdf.name });
    const cadStored = cadFile ? await storeUpload({ dir: "attachments", extension: path.extname(cadFile.name).toLowerCase(), data: Buffer.from(await cadFile.arrayBuffer()), owner, originalName: cadFile.name }) : null;
    const revision = await submitPoolRevision(prisma, { taskId, designerId: designer.id, pdfUrl: stored.url, cadUrl: cadStored?.url ?? null, summary });
    return Response.json({ version: revision.version }, { status: 201 });
  } catch (caught) {
    if (caught instanceof WorkflowError) return error(caught.message, 409);
    console.error(caught);
    return error("Odevzdání se nepodařilo – zkuste to prosím znovu.", 500);
  }
}
