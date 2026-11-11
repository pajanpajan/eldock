import { isSuperadmin } from "@/server/superadmin-session";
import { uploadedSeriesPhotos } from "@/server/services/catalog-photo-store";

/**
 * Fáze 92: nahrané reálné fotky designových řad pro galerii „Designové řady a barvy“ (všem uživatelům) a zda smí
 * aktuální prohlížeč nahrávat (jen přihlášený velín).
 */
export async function GET() {
  const [photos, canUpload] = await Promise.all([uploadedSeriesPhotos(), isSuperadmin()]);
  return Response.json({ photos, canUpload }, { headers: { "Cache-Control": "no-store" } });
}
