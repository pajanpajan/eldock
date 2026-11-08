import { UPLOAD_RULES, contentTypeFor, validateUpload } from "@/lib/files";
import { storeUpload, uploadOwner } from "@/server/file-access";
import { getAuthState } from "@/server/session";

const error = (message: string, status = 400) => Response.json({ error: message }, { status });

/**
 * Nahrání souboru (multipart: `kind` = photo | revision | markup | voice | document | attachment | software, `file`,
 * volitelně `scope=panel`). Route Handler místo Server Action kvůli limitu těla akce (1 MB). Vrací URL pro `/api/files`.
 * Fáze 68: soubor se zapíše do registru s vlastníkem podle přihlášení (firma / demo, Panel Builder `scope=panel`).
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("Očekáván formulář multipart/form-data.");
  }

  const kind = form.get("kind");
  const file = form.get("file");
  const scope = form.get("scope");
  if (typeof kind !== "string" || !(file instanceof File)) return error("Chybí soubor nebo jeho druh.");
  // Fáze 67: zrušená relace uživatele firmy (odhlášení na jiném zařízení, blokace) už do závodu nenahrává
  if (scope !== "panel" && (await getAuthState()).revoked) return error("Přihlášení vypršelo – přihlaste se znovu.", 401);

  const check = validateUpload(kind, file.name, file.size);
  if (!check.ok) return error(check.error, check.error.startsWith("Soubor je příliš velký") ? 413 : 400);

  const who = await uploadOwner(typeof scope === "string" ? scope : null);
  if (!who) return error("Nepřihlášeno – přihlaste se znovu.", 401);

  const { url, storedName } = await storeUpload({
    dir: UPLOAD_RULES[check.kind].dir,
    extension: check.extension,
    data: Buffer.from(await file.arrayBuffer()),
    owner: who.owner,
    uploadedById: who.uploadedById,
    originalName: file.name,
  });

  return Response.json(
    {
      url,
      fileName: file.name,
      mimeType: contentTypeFor(storedName),
      sizeBytes: file.size,
    },
    { status: 201 },
  );
}
