import { brandOf } from "@/lib/panel-builder/brands";
import { brandSlug } from "@/lib/panel-builder/brand-logos";
import { cn } from "@/lib/utils";

/**
 * Logo výrobce (fáze 51): soubor z `public/brands/<slug>` přes `/api/brand-logo/<slug>` – oficiální
 * vektorové logo, vlastní PNG / WebP / SVG nahrané do složky, jinak generovaný wordmark. Logo leží na
 * světlé podložce (tmavé UI), `<img>` = SVG se nikdy nespouští jako dokument.
 */
export function ManufacturerLogo({ manufacturer, className }: { manufacturer: string; className?: string }) {
  const brand = brandOf(manufacturer);
  const key = brand?.value ?? manufacturer;
  const label = brand?.label ?? manufacturer;
  const slug = brandSlug(manufacturer);
  return (
    <span className={cn("inline-flex h-8 max-w-full min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white px-1.5 py-1", className)} data-logo={key}>
      {/* eslint-disable-next-line @next/next/no-img-element -- logo může být SVG / PNG / WebP z public/brands */}
      <img src={`/api/brand-logo/${slug}${brand ? "" : `?name=${encodeURIComponent(manufacturer)}`}`} alt={`Logo ${label}`} className="h-full w-auto max-w-[min(7rem,100%)] min-w-0 object-contain" loading="lazy" decoding="async" />
    </span>
  );
}
