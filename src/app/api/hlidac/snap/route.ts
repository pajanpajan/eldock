import { PERMISSION_LABELS } from "@/lib/accounts";
import { validateUpload } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { plantFileOwner, storePlantFile, storeUpload } from "@/server/file-access";
import { DeviceLimitError, getHlidacMode } from "@/server/services/hlidac";
import { processSnap } from "@/server/services/snap";
import { getAuthState, getCurrentAccount, getCurrentUser } from "@/server/session";
import { assertTenantAccess } from "@/server/tenant";

const error = (message: string, status = 400) => Response.json({ error: message }, { status });
const text = (form: FormData, name: string, max = 200) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
};
const number = (form: FormData, name: string) => {
  const value = text(form, name, 20).replace(",", ".");
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed < 1e7 ? parsed : null;
};

/**
 * Fáze 112: jeden cyklus sekvenčního sběru (Scan & Snap) – multipart `id` (id klienta z offline fronty), `floorId`,
 * `room`, `labelCode` (naskenovaný EL-xxxxxx, prázdný = další v pořadí), `passed` (1 / 0), `rpe`, `riso`, `inspectorName`,
 * `inspectorLicense`, `text` (text štítku) a `file` (fotka výrobního štítku). Opakované odeslání stejného id vrátí
 * uložený výsledek (`duplicate: true`).
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
    if (!account.can("recordInspection") && !account.can("rapid")) return error(`Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS.recordInspection}.`, 403);
    const id = text(form, "id", 64);
    if (!/^[\w-]{8,64}$/.test(id)) return error("Neplatné id záznamu.");
    const done = await prisma.offlineSubmission.findUnique({ where: { id }, select: { resultJson: true } });
    if (done?.resultJson) return Response.json({ result: JSON.parse(done.resultJson), duplicate: true });

    const floorId = text(form, "floorId", 64);
    const room = text(form, "room", 120);
    if (!floorId || !room) return error("Vyberte patro a místnost.");
    await assertTenantAccess({ floorId });
    const floor = await prisma.floor.findUnique({ where: { id: floorId }, select: { building: { select: { plantId: true } } } });
    if (!floor) return error("Patro nebylo nalezeno.", 404);

    let photo: { url: string; bytes: Buffer; mimeType: string } | null = null;
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      const check = validateUpload("photo", file.name || "stitek.jpg", file.size);
      if (!check.ok) return error(check.error, check.error.startsWith("Soubor je příliš velký") ? 413 : 400);
      const who = await plantFileOwner();
      const bytes = Buffer.from(await file.arrayBuffer());
      const stored = await storeUpload({ dir: "photos", extension: check.extension, data: bytes, owner: who.owner, uploadedById: who.userId, originalName: file.name || "vyrobni-stitek.jpg" });
      photo = { url: stored.url, bytes, mimeType: file.type || "image/jpeg" };
    }
    const user = await getCurrentUser();
    const { result, duplicate } = await processSnap(
      prisma,
      {
        id,
        accountId: user?.id ?? null,
        floorId,
        room,
        mode: await getHlidacMode(prisma, floor.building.plantId),
        labelCode: text(form, "labelCode", 40) || null,
        passed: text(form, "passed", 4) !== "0",
        rpeOhm: number(form, "rpe"),
        risoMOhm: number(form, "riso"),
        inspectorName: text(form, "inspectorName", 120) || user?.name || "Revizní technik",
        inspectorLicense: text(form, "inspectorLicense", 120) || "neuvedeno",
        text: text(form, "text", 4000) || null,
        photo,
      },
      { saveReport: async (svg) => (await storePlantFile("documents", ".svg", svg)).url },
    );
    return Response.json({ result, duplicate });
  } catch (caught) {
    // Fáze 113: limit zařízení tarifu = 402 – záznam zůstane v offline frontě a odešle se po aktivaci tarifu
    if (caught instanceof DeviceLimitError) return error(caught.message, 402);
    if (caught instanceof WorkflowError) return error(caught.message, caught.code === "NOT_FOUND" ? 404 : caught.code === "FORBIDDEN" ? 403 : 400);
    console.error(caught);
    return error("Záznam se nepodařilo uložit.", 500);
  }
}
