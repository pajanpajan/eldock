import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { PADES_MAX_BYTES } from "@/lib/revision-signature";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { storePlantFile } from "@/server/file-access";
import { assertPermission } from "@/server/permissions";
import { getAuthState } from "@/server/session";
import { attachPades } from "@/server/services/revision-signing";
import { assertEntityAccess } from "@/server/tenant";

const error = (message: string, status = 400) => Response.json({ error: message }, { status });

/**
 * Fáze 108 – vrstva B: nahrání protokolu podepsaného kvalifikovaným certifikátem (PAdES) k uzamčené revizi.
 * Multipart `inspectionId` + `file` (PDF do 20 MB). Route Handler kvůli limitu těla Server Action (1 MB).
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("Očekáván formulář multipart/form-data.");
  }
  const inspectionId = form.get("inspectionId");
  const file = form.get("file");
  if (typeof inspectionId !== "string" || !inspectionId || inspectionId.length > 64 || !(file instanceof File)) return error("Chybí záznam revize nebo soubor.");
  if (!/\.pdf$/i.test(file.name)) return error("Nahrajte podepsaný protokol ve formátu PDF.");
  if (file.size > PADES_MAX_BYTES) return error("Soubor je příliš velký (nejvýš 20 MB).", 413);
  if ((await getAuthState()).revoked) return error("Přihlášení vypršelo – přihlaste se znovu.", 401);

  try {
    await assertPermission("recordInspection");
    await assertEntityAccess("inspection", inspectionId);
    const result = await attachPades(
      prisma,
      { inspectionId, bytes: new Uint8Array(await file.arrayBuffer()) },
      { storePdf: async (data) => (await storePlantFile("documents", ".pdf", data)).url },
    );
    revalidatePath("/", "layout");
    return Response.json(result, { status: 201 });
  } catch (cause) {
    if (cause instanceof WorkflowError) return error(cause.message, cause.code === "FORBIDDEN" ? 403 : cause.code === "NOT_FOUND" ? 404 : cause.code === "CONFLICT" ? 409 : 400);
    console.error(cause);
    return error("Podepsaný protokol se nepodařilo nahrát.", 500);
  }
}
