"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS, COMPONENT_CATEGORIES, CURVES, POLES, RATED_CURRENTS } from "@/lib/panel-builder/catalog";
import { cn } from "@/lib/utils";

const selectClass = "h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";

/** Filtry katalogu v URL (?q=&category=…) – hledání se odesílá průběžně při psaní. */
export function CatalogFilters({ manufacturers }: { manufacturers: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Poslední požadovaný stav filtrů – zpožděné hledání nesmí přepsat filtr zvolený mezitím.
  const latest = useRef(params.toString());

  useEffect(() => {
    latest.current = params.toString();
  }, [params]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(latest.current);
    if (value) next.set(key, value);
    else next.delete(key);
    latest.current = next.toString();
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function onQuery(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update("q", value.trim()), 150);
  }

  const active = ["q", "category", "manufacturer", "poles", "current", "curve"].some((key) => params.get(key));
  const select = (key: string, label: string, options: readonly (string | number)[], format: (value: string) => string = (value) => value) => (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select aria-label={label} className={cn(selectClass, "min-w-28 text-foreground")} value={params.get(key) ?? ""} onChange={(event) => update(key, event.target.value)}>
        <option value="">Vše</option>
        {options.map((option) => (
          <option key={option} value={String(option)}>
            {format(String(option))}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs text-muted-foreground">
        Hledat (typ, objednací číslo, popis – bez diakritiky)
        <span className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="např. S201 B16, 2CDS251001, chránič 30 mA" className="h-10 pl-9" aria-label="Hledat v katalogu" />
        </span>
      </label>
      {select("category", "Kategorie", COMPONENT_CATEGORIES, (value) => CATEGORY_LABELS[value as keyof typeof CATEGORY_LABELS])}
      {select("manufacturer", "Výrobce", manufacturers)}
      {select("poles", "Póly", POLES)}
      {select("current", "Proud In", RATED_CURRENTS, (value) => `${value} A`)}
      {select("curve", "Charakteristika", CURVES)}
      {pending ? <Loader2 className="mb-3 size-4 animate-spin text-muted-foreground" aria-label="Načítání" /> : null}
      {active ? (
        <Button
          variant="ghost"
          className="touch-target gap-1"
          onClick={() => {
            setQuery("");
            clearTimeout(timer.current);
            latest.current = "";
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
        >
          <X className="size-4" aria-hidden /> Zrušit filtry
        </Button>
      ) : null}
    </div>
  );
}
