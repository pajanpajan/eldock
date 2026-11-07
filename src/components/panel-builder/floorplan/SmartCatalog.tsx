"use client";

import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { InstallLevel } from "@/engine/floorplan-bridge";
import { familyLink } from "@/lib/panel-builder/series-links";
import type { CatalogProduct, ProductFamily } from "@/lib/panel-builder/smart-catalog";
import { smartSystemOf } from "@/lib/panel-builder/smart-home";
import { cn } from "@/lib/utils";

/**
 * Fáze 63: obsah produktové rodiny chytré domácnosti v liště výrobců – systém (nastaví výpočet akčních členů), výrobky
 * po podkategoriích k vložení do půdorysu (sběrnicová úroveň) a akční členy na DIN lištu jako informace o výpočtu
 * rozváděče. Bezdrátové prvky a samostatné systémy jsou označené (bez sběrnicového kabelu).
 */
export function SmartCatalog({
  family,
  installation,
  smartSystem,
  activeProduct,
  color,
  onSystem,
  onBusLevel,
  onPlace,
  onColor,
}: {
  family: ProductFamily;
  installation: InstallLevel;
  smartSystem: string;
  activeProduct: string | null;
  color: string;
  onSystem: (system: string) => void;
  onBusLevel: () => void;
  onPlace: (product: CatalogProduct) => void;
  onColor: (color: string) => void;
}) {
  const bus = installation === "bus_loxone";
  const system = family.system ? smartSystemOf(family.system) : null;
  const chosen = family.system !== null && smartSystem === family.system;
  const link = familyLink(family.id);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2 text-xs" data-testid="smart-catalog" data-family={family.id}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-muted-foreground">{family.description}</p>
        {system ? (
          <Button type="button" size="sm" variant={chosen ? "default" : "outline"} className="h-7 text-xs" onClick={() => onSystem(system.id)} data-testid="smart-catalog-system" aria-pressed={chosen}>
            {chosen ? "✓ " : ""}Systém: {system.label}
          </Button>
        ) : null}
        {link ? (
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 font-semibold hover:border-primary/60" data-testid="family-web" title={link.label}>
            🌐 Prohlédnout na webu výrobce <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
      </div>
      {family.colors ? (
        <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label={`Barva ${family.manufacturer}`}>
          {family.colors.map((option) => (
            <button key={option.id} type="button" role="radio" aria-checked={color === option.id} onClick={() => onColor(option.id)} className={cn("flex items-center gap-1.5 rounded-full border px-2 py-0.5", color === option.id ? "border-primary bg-primary/15" : "border-border text-muted-foreground")}>
              <span className="size-3.5 rounded-full border border-zinc-500" style={{ background: option.swatch }} aria-hidden />
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {!bus ? (
        <p className="flex flex-wrap items-center gap-2 rounded-md border border-amber-400/50 bg-amber-500/10 px-2 py-1 text-amber-100" data-testid="smart-catalog-level">
          Výrobky chytré domácnosti se vkládají na sběrnicové úrovni instalace.
          <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={onBusLevel}>
            Přepnout na sběrnicovou instalaci
          </Button>
        </p>
      ) : null}
      <div className="grid gap-2 lg:grid-cols-2">
        {family.groups.map((group) => (
          <section key={group.id} className="flex flex-col gap-1" aria-label={group.label}>
            <h4 className="font-bold">{group.din ? `⚙ ${group.label}` : group.label}</h4>
            {group.din ? (
              <ul className="flex flex-col gap-0.5 text-[11px] text-muted-foreground" data-testid="smart-catalog-din">
                {group.products.map((product) => (
                  <li key={product.id}>
                    {product.label}
                    {product.typeCode ? <span className="font-mono"> · {product.typeCode}</span> : null}
                    {product.articleNumber ? <span className="font-mono"> · {product.articleNumber}</span> : null}
                    {product.note ? ` · ${product.note}` : ""}
                  </li>
                ))}
                <li className="text-emerald-200">Počty a kanály dopočítá výpočet chytré domácnosti do rozváděče.</li>
              </ul>
            ) : (
              <div className="flex flex-wrap gap-1">
                {group.products.map((product) => {
                  const active = activeProduct === product.id;
                  return product.item ? (
                    <button
                      key={product.id}
                      type="button"
                      aria-pressed={active}
                      disabled={!bus}
                      onClick={() => onPlace(product)}
                      title={product.note ?? (product.noBus ? "bezdrátově – bez sběrnicového kabelu" : "na sběrnici 24 V DC")}
                      className={cn("rounded-md border px-1.5 py-1 text-left text-[11px] disabled:opacity-50", active ? "border-primary bg-primary/20" : "border-border hover:border-primary/60")}
                      data-product={product.id}
                    >
                      {product.label}
                      {product.noBus ? " 📶" : ""}
                    </button>
                  ) : (
                    <span key={product.id} className="rounded-md border border-dashed border-border px-1.5 py-1 text-[11px] text-muted-foreground" title={product.note}>
                      {product.label}
                      {product.articleNumber ? ` · ${product.articleNumber}` : ""}
                    </span>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
