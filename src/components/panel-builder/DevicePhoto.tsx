import { FallbackImg } from "@/components/common/FallbackImg";
import { catalogSlug } from "@/lib/panel-builder/catalog-images";
import { DEVICE_PHOTO_SOURCES, DEVICE_PHOTOS } from "@/lib/panel-builder/device-photos.generated";
import { cn } from "@/lib/utils";

/** Fáze 97: fotka DIN přístroje podle objednacího čísla katalogu (null = bez fotky). Jen pro serverové stránky. */
export function devicePhoto(articleNumber: string | null | undefined): { src: string; source: string } | null {
  if (!articleNumber) return null;
  const entry = DEVICE_PHOTOS[catalogSlug(articleNumber)];
  return entry ? { src: entry[0], source: DEVICE_PHOTO_SOURCES[entry[1]] ?? "" } : null;
}

/**
 * Fáze 97: reálná fotka DIN přístroje (ABB ETIM 9.0, Hager ETIM 10, stránka výrobku OEZ) v katalogu přístrojů. Serverová
 * komponenta – manifest fotek přístrojů nepatří do klientského balíčku.
 */
export function DevicePhoto({ articleNumber, label, className }: { articleNumber: string | null | undefined; label?: string; className?: string }) {
  const photo = devicePhoto(articleNumber);
  if (!photo) return null;
  return (
    // Fáze 99: nenačtená fotka se jen vynechá (žádný rozbitý obrázek)
    <FallbackImg src={photo.src} alt={`Fotka ${label ?? articleNumber}`} title={photo.source} className={cn("size-10 shrink-0 rounded bg-white object-contain p-0.5", className)} loading="lazy" decoding="async" data-testid="device-photo" />
  );
}
