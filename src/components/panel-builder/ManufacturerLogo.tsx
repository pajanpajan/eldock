import { brandOf } from "@/lib/panel-builder/brands";
import { brandSlug } from "@/lib/panel-builder/brand-logos";
import { cn } from "@/lib/utils";

/**
 * Logo výrobce (fáze 51): soubor z `public/brands/<slug>` přes `/api/brand-logo/<slug>` – oficiální
 * vektorové logo, vlastní PNG / WebP / SVG nahrané do složky, jinak generovaný wordmark. Logo leží na
 * světlé podložce (tmavé UI), `<img>` = SVG se nikdy nespouští jako dokument.
 */
export function ManufacturerLogo({ manufacturer, className, bare = false }: { manufacturer: string; className?: string; /** Fáze 100: bez vlastní bílé podložky – logo leží na kartě výrobce (`brandCardClass`). */ bare?: boolean }) {
  const brand = brandOf(manufacturer);
  const key = brand?.value ?? manufacturer;
  const label = brand?.label ?? manufacturer;
  const slug = brandSlug(manufacturer);
  return (
    <span className={cn("inline-flex h-8 max-w-full min-w-0 shrink-0 items-center justify-center overflow-hidden", bare ? "px-0.5" : "rounded-md bg-white px-1.5 py-1", className)} data-logo={key}>
      {/* eslint-disable-next-line @next/next/no-img-element -- logo může být SVG / PNG / WebP z public/brands */}
      <img src={`/api/brand-logo/${slug}${brand ? "" : `?name=${encodeURIComponent(manufacturer)}`}`} alt={`Logo ${label}`} className="h-full w-auto max-w-[min(7rem,100%)] min-w-0 object-contain" loading="lazy" decoding="async" />
    </span>
  );
}

/**
 * Fáze 100: sjednocená karta výrobce (ABB, Schneider, Legrand, Hager, Loxone, TapHome) – jemné světlé studio se zaoblením
 * `rounded-lg` a jemným rámečkem místo ostrého bílého obdélníku v tmavé liště; aktivní výrobce se žlutým akcentem.
 */
export function brandCardClass(active: boolean) {
  return cn(
    "flex h-10 w-24 items-center justify-center overflow-hidden rounded-lg border bg-gradient-to-b from-slate-50 to-slate-200/90 px-1.5 py-1 shadow-sm transition",
    active ? "border-amber-300 ring-2 ring-amber-400 shadow-lg shadow-amber-500/10" : "border-white/10 opacity-80 ring-1 ring-black/5 hover:opacity-100 hover:ring-amber-300/50",
  );
}
