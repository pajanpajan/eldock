import { UPLOAD_RULES, contentTypeFor, validateUpload } from "@/lib/files";
import { saveUpload } from "@/server/storage";

const error = (message: string, status = 400) => Response.json({ error: message }, { status });

/**
 * Nahrání souboru (multipart: `kind` = photo | revision | markup | voice | document, `file`).
 * Route Handler místo Server Action kvůli limitu těla akce (1 MB). Vrací URL pro `/api/files`.
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
  if (typeof kind !== "string" || !(file instanceof File)) return error("Chybí soubor nebo jeho druh.");

  const check = validateUpload(kind, file.name, file.size);
  if (!check.ok) return error(check.error, check.error.startsWith("Soubor je příliš velký") ? 413 : 400);

  const { url, storedName } = await saveUpload(UPLOAD_RULES[check.kind].dir, check.extension, Buffer.from(await file.arrayBuffer()));

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
