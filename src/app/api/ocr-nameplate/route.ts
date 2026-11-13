import { PERMISSION_LABELS } from "@/lib/accounts";
import { validateUpload } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { assertPlantFiles, plantFileOwner, storeUpload } from "@/server/file-access";
import { readNameplate, saveNameplatePhoto } from "@/server/services/nameplate";
import { getAuthState, getCurrentAccount } from "@/server/session";
import { readStoredFile } from "@/server/storage";
import { assertTenantAccess } from "@/server/tenant";
import { WorkflowError } from "@/lib/workflow/state-machine";

const error = (message: string, status = 400) => Response.json({ error: message }, { status });
const PHOTO_URL = /^\/api\/files\/photos\/[\w./-]+$/;

/**
 * Fáze 111: 📷 AI čtečka výrobního štítku. Multipart: `file` (fotka štítku – fotoaparát, soubor nebo Ctrl+V) nebo
 * `photoUrl` (už nahraná fotka), volitelně `equipmentId` (fotka se hned trvale uloží jako druhá fotka zařízení) a `text`
 * (přepsaný / zkopírovaný text štítku pro demo režim bez Gemini). Vrací přečtené údaje k potvrzení.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("Očekáván formulář multipart/form-data.");
  }
  try {
    if ((await getAuthState()).revoked) return error("Přihlášení vypršelo – přihlaste se znovu.", 401);
    const account = await getCurrentAccount();
    if (!account.can("submitChange") && !account.can("recordInspection")) return error(`Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS.submitChange} nebo ${PERMISSION_LABELS.recordInspection}.`, 403);
    const equipmentId = typeof form.get("equipmentId") === "string" && form.get("equipmentId") ? String(form.get("equipmentId")).slice(0, 64) : null;
    if (equipmentId) await assertTenantAccess({ equipmentId });
    const text = typeof form.get("text") === "string" ? String(form.get("text")).slice(0, 4000) : null;

    let photoUrl: string | null = null;
    let image: { bytes: Buffer; mimeType: string } | null = null;
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      const check = validateUpload("photo", file.name || "stitek.jpg", file.size);
      if (!check.ok) return error(check.error, check.error.startsWith("Soubor je příliš velký") ? 413 : 400);
      const who = await plantFileOwner();
      const bytes = Buffer.from(await file.arrayBuffer());
      const stored = await storeUpload({ dir: "photos", extension: check.extension, data: bytes, owner: who.owner, uploadedById: who.userId, originalName: file.name || "vyrobni-stitek.jpg" });
      photoUrl = stored.url;
      image = { bytes, mimeType: file.type || "image/jpeg" };
    } else {
      const url = form.get("photoUrl");
      if (typeof url !== "string" || !PHOTO_URL.test(url)) return error("Chybí fotka výrobního štítku.");
      await assertPlantFiles([url], { strict: true });
      photoUrl = url;
      image = await readStoredFile(url);
    }

    const result = await readNameplate({ image, text });
    if (equipmentId && photoUrl) await saveNameplatePhoto(prisma, equipmentId, { photoUrl, result });
    return Response.json({ photoUrl, mode: result.mode, reading: result.reading, rawText: result.rawText, warning: result.warning ?? null, saved: Boolean(equipmentId) });
  } catch (caught) {
    if (caught instanceof WorkflowError) return error(caught.message, caught.code === "NOT_FOUND" ? 404 : caught.code === "FORBIDDEN" ? 403 : 400);
    console.error(caught);
    return error("Výrobní štítek se nepodařilo zpracovat.", 500);
  }
}
