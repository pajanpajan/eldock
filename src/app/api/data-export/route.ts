import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { getPanelCompany } from "@/server/panel-session";
import { personalExportData, recordPersonalExport, writeCompanyExport, type DataRequester } from "@/server/services/data-requests";
import { getAuthState, getCurrentAccount } from "@/server/session";
import { UPLOAD_ROOT } from "@/server/storage";
import { isSuperadmin } from "@/server/superadmin-session";

// Fáze 69 (GDPR): stažení dat. `?scope=me` = vlastní údaje přihlášeného uživatele firmy (JSON, čl. 15);
// `?scope=panel` = data firmy přihlášené do AI Panel Builderu; bez parametru = data firmy Správy závodů (jen technický
// ředitel registrované firmy); `?companyId=` = velín. Firmy dostanou ZIP (data/*.json, csv/, soubory/, manifest).

const error = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
const today = () => new Date().toISOString().slice(0, 10);

async function zipResponse(companyId: string, requestedBy: DataRequester) {
  const target = path.join(os.tmpdir(), `eldock-export-${companyId}-${Date.now()}.zip`);
  const result = await writeCompanyExport(prisma, { companyId, storageRoot: UPLOAD_ROOT, targetPath: target, requestedBy });
  const size = (await stat(target)).size;
  const stream = createReadStream(target);
  stream.on("close", () => void rm(target, { force: true }));
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const companyId = params.get("companyId");
    if (companyId) {
      if (!(await isSuperadmin())) return error("Export cizí firmy jen z velínu.", 403);
      return await zipResponse(companyId, "superadmin");
    }

    const scope = params.get("scope");
    if (scope === "panel") {
      const company = await getPanelCompany();
      if (!company) return error("Přihlaste se do AI Panel Builderu.", 401);
      return await zipResponse(company.id, "panel-company");
    }

    const state = await getAuthState();
    if (state.revoked || !state.user) return error("Přihlášení vypršelo – přihlaste se znovu.", 401);
    if (scope === "me") {
      const user = state.user;
      if (!user.companyId) return error("Obchodní demo nemá osobní údaje k exportu – export mají účty registrovaných firem.", 403);
      const data = await personalExportData(prisma, user.id);
      await recordPersonalExport(prisma, { id: user.id, companyId: user.companyId });
      return new Response(JSON.stringify(data, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="eldock-moje-udaje-${today()}.json"`, "Cache-Control": "no-store" },
      });
    }

    const account = await getCurrentAccount();
    if (!account.user.companyId) return error("Obchodní demo nemá data firmy k exportu.", 403);
    if (!account.can("manageUsers")) return error("Export dat firmy stahuje technický ředitel (správce firmy).", 403);
    return await zipResponse(account.user.companyId, "company-admin");
  } catch (failure) {
    if (failure instanceof WorkflowError) return error(failure.message, failure.code === "NOT_FOUND" ? 404 : 400);
    console.error(failure);
    return error("Export se nepodařilo vytvořit. Zkuste to prosím znovu.", 500);
  }
}
