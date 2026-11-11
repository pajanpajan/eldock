import { isPhotoPart } from "@/lib/panel-builder/catalog-photos";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { isSuperadmin } from "@/server/superadmin-session";
import { CATALOG_PHOTO_MAX_UPLOAD, storeCatalogPhoto, uploadedPhotoSrc } from "@/server/services/catalog-photo-store";

const error = (message: string, status = 400) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Fáze 92: reálná fotka vypínače / zásuvky / víceramečku do galerie řad (Ctrl+V, přetažení nebo soubor). Fotka se ukáže
 * všem uživatelům, proto nahrává jen velín (/superadmin). Multipart: `file`, `series` („ABB|Tango“), `part`
 * (switch / socket / set), volitelně `color` (id barvy řady), `source` a `license`.
 */
export async function POST(request: Request) {
  if (!(await isSuperadmin())) return error("Fotky do katalogu řad nahrává jen velín – přihlaste se na /superadmin.", 403);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("Očekáván formulář multipart/form-data.");
  }
  const file = form.get("file");
  const series = form.get("series");
  const part = form.get("part");
  const color = form.get("color");
  if (!(file instanceof File) || typeof series !== "string" || !isPhotoPart(part)) return error("Chybí obrázek, řada nebo díl (spínač / zásuvka / víceramček).");
  if (file.size > CATALOG_PHOTO_MAX_UPLOAD) return error(`Obrázek je větší než ${CATALOG_PHOTO_MAX_UPLOAD / 1024 / 1024} MB.`, 413);
  try {
    const photo = await storeCatalogPhoto({
      data: Buffer.from(await file.arrayBuffer()),
      series,
      color: typeof color === "string" && color ? color : null,
      part,
      source: typeof form.get("source") === "string" ? String(form.get("source")) : "",
      license: typeof form.get("license") === "string" ? String(form.get("license")) : "",
    });
    return Response.json({ photo: { series: photo.series, ...(photo.color ? { color: photo.color } : {}), part: photo.part, src: uploadedPhotoSrc(photo), source: photo.source, license: photo.license, photo: true } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    if (caught instanceof WorkflowError) return error(caught.message);
    console.error(caught);
    return error("Fotku se nepodařilo uložit.", 500);
  }
}
