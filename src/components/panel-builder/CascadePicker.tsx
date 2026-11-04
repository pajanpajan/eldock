"use client";

import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { DEVICE_BRANDS, brandOf, filterBrands, type Brand } from "@/lib/panel-builder/brands";
import { CONFIG_CATEGORIES, CONFIG_FIELDS, isOptionActive, type ConfigCategory, type ConfigField, type ItemConfig } from "@/lib/panel-builder/configurator";
import { cn } from "@/lib/utils";

import { ManufacturerLogo } from "./ManufacturerLogo";

/** Barevný odznak značky (logo kreslené kódem). */
export function BrandBadge({ brand, size = "md" }: { brand: Pick<Brand, "color" | "mark">; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded font-black tracking-tight text-white shadow-inner", size === "sm" ? "h-5 min-w-5 px-1 text-[9px]" : "h-8 min-w-8 px-1.5 text-[11px]")}
      style={{ background: brand.color }}
    >
      {brand.mark}
    </span>
  );
}

export function Tile({ active, onClick, children, label, disabled }: { active: boolean; onClick: () => void; children: ReactNode; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "touch-target min-h-11 rounded-lg border-2 px-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Kaskádové pravé menu (fáze 43): KROK A výrobce (karty s hledáním; po výběru zůstane jen kompaktní
 * lišta značky + „🔄 Vybrat jiného výrobce“) → KROK B kategorie → KROK C parametry podle kategorie.
 * Sdílí ho úprava vybraného přístroje i vkládání nových součástek.
 */
export function CascadePicker({
  manufacturer,
  chosen,
  config,
  brandCounts,
  onManufacturer,
  onCategory,
  onOption,
  fieldExtra,
  advanced,
}: {
  /** Vybraný výrobce (null + chosen = obecný přístroj bez výrobce). */
  manufacturer: string | null;
  chosen: boolean;
  config: ItemConfig | null;
  /** Počet kusů v databázi podle výrobce (karty ukážou „1 428 prvků“). */
  brandCounts: Readonly<Record<string, number>>;
  onManufacturer: (value: string | null) => void;
  onCategory: (category: ConfigCategory) => void;
  onOption: (patch: Partial<ItemConfig>) => void;
  /** Doplněk pod řádkem dlaždic (např. „Sloučit se sousedními moduly“ u pólů). */
  fieldExtra?: (field: ConfigField) => ReactNode;
  /** Obsah akordeonu „Pokročilé / Ruční korekce a AI dohledání“ (pod ruční šířkou v modulech). */
  advanced?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(!chosen);
  const [query, setQuery] = useState("");
  const brand = brandOf(manufacturer);
  const brands = filterBrands(DEVICE_BRANDS, query);
  const allFields = config ? CONFIG_FIELDS[config.category] : [];
  // Ruční šířka patří do akordeonu Pokročilé – hlavní kaskáda je o třetinu kratší
  const fields = allFields.filter((field) => field.key !== "width");
  const widthField = chosen && !expanded ? allFields.find((field) => field.key === "width") : undefined;
  const countOf = (value: string) => brandCounts[brandOf(value)?.value ?? value] ?? 0;

  function pick(value: string | null) {
    onManufacturer(value);
    setExpanded(false);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-4" data-testid="cascade-picker">
      <section aria-label="Krok A – výrobce přístroje" className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">A. Výrobce přístroje</h3>
        {expanded ? (
          <>
            <label className="relative">
              <span className="sr-only">Hledat výrobce podle názvu</span>
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="🔍 Hledat výrobce podle názvu..." className="h-10 pl-8" aria-label="Hledat výrobce podle názvu" />
            </label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="group" aria-label="Výrobci z databáze" data-testid="brand-grid">
              {brands.map((option) => {
                const count = countOf(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={brand?.value === option.value}
                    aria-label={option.label}
                    onClick={() => pick(option.value)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-lg border px-2 py-1 text-left text-xs transition-colors",
                      brand?.value === option.value ? "border-primary bg-primary/15" : "border-border bg-card hover:border-primary/60",
                    )}
                  >
                    <ManufacturerLogo manufacturer={option.value} className="h-7" />
                    <span className="min-w-0 text-[10px] leading-tight text-muted-foreground">{count ? `${count.toLocaleString("cs-CZ")} prvků` : "odhad IEC"}</span>
                  </button>
                );
              })}
              {!query ? (
                <button type="button" onClick={() => pick(null)} className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-border px-2 text-left text-xs text-muted-foreground hover:border-primary/60">
                  ⚡ Obecný přístroj (bez výrobce)
                </button>
              ) : null}
              {!brands.length ? <p className="col-span-full text-xs text-muted-foreground">Výrobce „{query}“ v databázi není.</p> : null}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2" data-testid="brand-chosen">
            <button
              type="button"
              aria-pressed
              aria-label={brand?.label ?? manufacturer ?? "Obecný přístroj"}
              onClick={() => setExpanded(true)}
              className="flex min-h-10 items-center gap-2 rounded-lg border-2 border-primary bg-primary/15 px-2.5 text-sm font-bold"
            >
              {brand ? <ManufacturerLogo manufacturer={brand.value} className="h-6" /> : null}
              {brand?.label ?? manufacturer ?? "⚡ Obecný přístroj"}
            </button>
            <button type="button" onClick={() => setExpanded(true)} className="flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              🔄 Vybrat jiného výrobce
            </button>
          </div>
        )}
      </section>

      {chosen && !expanded ? (
        <>
          <section aria-label="Krok B – kategorie" className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">B. Kategorie</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CONFIG_CATEGORIES.map((category) => (
                <Tile key={category.value} active={config?.category === category.value} onClick={() => onCategory(category.value)}>
                  {category.label}
                </Tile>
              ))}
            </div>
          </section>

          {fields.map((field, index) => (
            <section key={field.key} aria-label={field.label} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">
                C{index + 1}. {field.label}
              </h3>
              <div className="flex flex-wrap gap-2">
                {field.options.map((option) => (
                  <Tile key={option.value} active={!!config && isOptionActive(config, option)} onClick={() => onOption(option.patch)}>
                    {option.label}
                  </Tile>
                ))}
              </div>
              {fieldExtra?.(field)}
            </section>
          ))}
        </>
      ) : null}

      {widthField || advanced ? (
        <details className="group rounded-lg border border-border bg-muted/20 p-3" data-testid="advanced">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground uppercase select-none group-open:mb-3">Pokročilé / Ruční korekce a AI dohledání</summary>
          <div className="flex flex-col gap-3">
            {widthField ? (
              <section aria-label={widthField.label} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase">{widthField.label}</h3>
                <div className="flex flex-wrap gap-2">
                  {widthField.options.map((option) => (
                    <Tile key={option.value} active={!!config && isOptionActive(config, option)} onClick={() => onOption(option.patch)}>
                      {option.label}
                    </Tile>
                  ))}
                </div>
              </section>
            ) : null}
            {advanced}
          </div>
        </details>
      ) : null}
    </div>
  );
}
