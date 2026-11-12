import { hasCatalogSession } from "@/server/catalog-access";
import { ALL_SERIES_PHOTOS } from "@/server/catalog-data";
import { isSuperadmin } from "@/server/superadmin-session";
import { uploadedSeriesPhotos } from "@/server/services/catalog-photo-store";

/**
 * Fáze 92: nahrané reálné fotky designových řad pro galerii „Designové řady a barvy“ (všem uživatelům) a zda smí
 * aktuální prohlížeč nahrávat (jen přihlášený velín).
 */
// Fáze 104: `catalog` = fotky dílů řad z indexu katalogu (s objednacími čísly) jen přihlášeným – index do klientského
// bundlu nesmí; nahrané fotky (`photos`) vidí galerie všech uživatelů jako dřív.
export async function GET() {
  const [photos, canUpload, session] = await Promise.all([uploadedSeriesPhotos(), isSuperadmin(), hasCatalogSession()]);
  return Response.json({ photos, catalog: session ? ALL_SERIES_PHOTOS : [], canUpload }, { headers: { "Cache-Control": "no-store" } });
}
