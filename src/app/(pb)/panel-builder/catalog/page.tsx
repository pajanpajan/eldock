import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { CatalogSearch } from "@/components/panel-builder/CatalogSearch";
import { DatasheetImport } from "@/components/panel-builder/DatasheetImport";
import { ManufacturerLogo } from "@/components/panel-builder/ManufacturerLogo";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brandOf } from "@/lib/panel-builder/brands";
import { CATALOG_GROUPS, GROUP_FILTERS, catalogGroupOf, isCatalogGroup, type CatalogGroupId } from "@/lib/panel-builder/catalog-groups";
import { CATEGORY_LABELS, formatWatts } from "@/lib/panel-builder/catalog";
import { WIRING_CATEGORIES, frameLabel } from "@/lib/panel-builder/wiring-devices";
import { cn } from "@/lib/utils";
import { getBrandGroups, getCatalogBrands, getGroupItems, searchWholeCatalog, type CatalogItemFilter } from "@/server/queries/panel-builder";

export const metadata: Metadata = { title: "Katalog prvků – AI Panel Builder" };

const num = (value: number) => value.toLocaleString("cs-CZ", { maximumFractionDigits: 2 });
const one = (value: string | string[] | undefined) => (typeof value === "string" && value ? value : undefined);

function Datasheet({ url }: { url: string | null }) {
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline" data-testid="datasheet-link">
      Datasheet <ExternalLink className="size-3" aria-hidden />
    </a>
  ) : (
    <span className="text-muted-foreground">–</span>
  );
}

/** Odkaz s upraveným parametrem dotazu (dlaždicový filtr: klik na aktivní hodnotu filtr zruší). */
function href(params: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...patch })) if (value) next.set(key, value);
  return `/panel-builder/catalog?${next}`;
}

// Katalog prvků (fáze 47): rozcestník výrobců → kategorie výrobce → prvky s dlaždicovými filtry; globální hledání.
export default async function CatalogPage({ searchParams }: PageProps<"/panel-builder/catalog">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const params = await searchParams;
  const q = one(params.q) ?? "";
  const brand = one(params.brand);
  const group = isCatalogGroup(params.group) ? (params.group as CatalogGroupId) : undefined;
  const filter: CatalogItemFilter = {
    poles: one(params.poles),
    current: one(params.current) ? Number(params.current) : undefined,
    curve: one(params.curve),
    sensitivity: one(params.sensitivity) ? Number(params.sensitivity) : undefined,
    series: one(params.series),
  };
  const current: Record<string, string | undefined> = { brand, group, poles: filter.poles, current: filter.current ? String(filter.current) : undefined, curve: filter.curve, sensitivity: filter.sensitivity ? String(filter.sensitivity) : undefined, series: filter.series };

  const header = (
    <PageHeader
      title="Katalog prvků"
      description="Databáze přístrojů po výrobcích a kategoriích – každý jistič, chránič, skříň či domovní přístroj jako samostatný záznam se ztrátovým výkonem a odkazem na datasheet."
      breadcrumb={
        <Link href="/panel-builder" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> AI Panel Builder
        </Link>
      }
      actions={<DatasheetImport />}
    />
  );

  // KROK 3: prvky výrobce v kategorii
  if (brand && group) {
    const result = await getGroupItems(brand, group, filter);
    const filters = GROUP_FILTERS[group] ?? [];
    const tileRow = (key: "poles" | "current" | "curve" | "sensitivity" | "series", label: string, values: (string | number)[], format: (value: string | number) => string) =>
      values.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
          <span className="w-28 text-xs text-muted-foreground">{label}</span>
          {values.map((value) => {
            const active = current[key] === String(value);
            return (
              <Link key={String(value)} href={href(current, { [key]: active ? undefined : String(value) })} aria-pressed={active} className={cn("min-h-8 rounded-md border px-2.5 py-1 text-xs font-semibold", active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}>
                {format(value)}
              </Link>
            );
          })}
        </div>
      ) : null;
    const options = result.options as Partial<Record<"poles" | "current" | "curve" | "sensitivity" | "series", (string | number)[]>>;
    return (
      <PageTransition>
        {header}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link href={href({}, { brand })} className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:border-primary">
              <ArrowLeft className="size-4" aria-hidden /> Zpět na kategorie
            </Link>
            <ManufacturerLogo manufacturer={brand} className="h-9" />
            <h2 className="text-lg font-semibold">
              {catalogGroupOf(group).icon} {catalogGroupOf(group).label}
            </h2>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3" data-testid="catalog-tiles">
            {filters.includes("poles") ? tileRow("poles", "Póly", options.poles ?? [], String) : null}
            {filters.includes("curve") ? tileRow("curve", "Charakteristika", options.curve ?? [], String) : null}
            {filters.includes("current") ? tileRow("current", "Jmenovitý proud", options.current ?? [], (value) => `${value} A`) : null}
            {filters.includes("sensitivity") ? tileRow("sensitivity", "Citlivost", options.sensitivity ?? [], (value) => `${value} mA`) : null}
            {filters.includes("series") ? tileRow("series", "Řada", options.series ?? [], String) : null}
          </div>
          <p className="text-sm text-muted-foreground" data-testid="catalog-count">
            {result.matching} prvků{result.matching > result.rows.length ? ` (zobrazeno prvních ${result.rows.length})` : ""}
          </p>
          <div className="overflow-x-auto rounded-xl border border-border" data-testid="catalog-items">
            {result.kind === "component" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Řada</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Objednací číslo</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Póly</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead>Char. / IΔn</TableHead>
                    <TableHead className="text-right">Moduly</TableHead>
                    <TableHead className="text-right">Pv</TableHead>
                    <TableHead>Datasheet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs text-muted-foreground">{row.series}</TableCell>
                      <TableCell className="font-medium">{row.typeCode}</TableCell>
                      <TableCell className="font-mono text-xs">{row.articleNumber}</TableCell>
                      <TableCell className="text-xs">{CATEGORY_LABELS[row.category]}</TableCell>
                      <TableCell>{row.poles}</TableCell>
                      <TableCell className="text-right font-mono">{row.ratedCurrentA ? `${num(row.ratedCurrentA)} A` : "–"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.rcdSensitivityMa ? `${row.rcdType ?? ""} ${row.rcdSensitivityMa} mA` : (row.trippingCurve ?? row.spdType ?? "–")}</TableCell>
                      <TableCell className="text-right font-mono">{num(row.modulesCount)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatWatts(row.powerLossWatts)}
                        {row.dataSource === "IEC_ESTIMATE" ? (
                          <Badge variant="outline" className="ml-1">
                            odhad
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Datasheet url={row.datasheetUrl} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : result.kind === "enclosure" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Objednací číslo</TableHead>
                    <TableHead className="text-right">Řady × M</TableHead>
                    <TableHead className="text-right">V × Š × H [mm]</TableHead>
                    <TableHead>Krytí</TableHead>
                    <TableHead className="text-right">P_max</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.model}</TableCell>
                      <TableCell className="font-mono text-xs">{row.articleNumber}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.rows} × {row.modulesPerRow} = {row.totalModules}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.heightMm} × {row.widthMm} × {row.depthMm}
                      </TableCell>
                      <TableCell>{row.ipRating}</TableCell>
                      <TableCell className="text-right font-mono">{row.pMaxW ? `${num(row.pMaxW)} W` : "–"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : result.kind === "wiring" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Řada</TableHead>
                    <TableHead>Přístroj</TableHead>
                    <TableHead>Druh</TableHead>
                    <TableHead>Objednací číslo</TableHead>
                    <TableHead>Barva</TableHead>
                    <TableHead>Rámeček</TableHead>
                    <TableHead>Krytí</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs text-muted-foreground">{row.series}</TableCell>
                      <TableCell className="font-medium">
                        {row.productUrl ? (
                          <a href={row.productUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                            {row.title}
                          </a>
                        ) : (
                          row.title
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{WIRING_CATEGORIES[row.category] ?? row.category}</TableCell>
                      <TableCell className="font-mono text-xs">{row.articleNumber.split(":").pop()}</TableCell>
                      <TableCell className="text-xs">{row.color ?? "–"}</TableCell>
                      <TableCell>{frameLabel(row.frameUnits) ?? "–"}</TableCell>
                      <TableCell>{row.ipRating ?? "–"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Typ</TableHead>
                    <TableHead>Objednací číslo</TableHead>
                    <TableHead className="text-right">Průtok volně / s filtrem</TableHead>
                    <TableHead className="text-right">Příkon</TableHead>
                    <TableHead>Krytí</TableHead>
                    <TableHead>Výřez [mm]</TableHead>
                    <TableHead className="text-right">Hluk</TableHead>
                    <TableHead>Datasheet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.typeCode}
                        <span className="block text-xs text-muted-foreground">{row.series}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.articleNumber}</TableCell>
                      <TableCell className="text-right font-mono">
                        {num(row.airflowFreeM3h)} / {row.airflowFilterM3h ? num(row.airflowFilterM3h) : "–"} m³/h
                      </TableCell>
                      <TableCell className="text-right font-mono">{row.powerW ? `${num(row.powerW)} W` : "–"}</TableCell>
                      <TableCell className="text-xs">{row.ipRating}</TableCell>
                      <TableCell className="text-xs">{row.cutoutMm ?? "–"}</TableCell>
                      <TableCell className="text-right font-mono">{row.noiseDbA ? `${num(row.noiseDbA)} dB(A)` : "–"}</TableCell>
                      <TableCell className="text-xs">
                        <Datasheet url={row.datasheetUrl} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </PageTransition>
    );
  }

  // KROK 2: kategorie výrobce
  if (brand) {
    const { counts } = await getBrandGroups(brand);
    return (
      <PageTransition>
        {header}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/panel-builder/catalog" className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:border-primary">
              <ArrowLeft className="size-4" aria-hidden /> Zpět na všechny výrobce
            </Link>
            <ManufacturerLogo manufacturer={brand} className="h-10" />
            <h2 className="text-lg font-semibold">{brandOf(brand)?.label ?? brand}</h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="catalog-groups">
            {CATALOG_GROUPS.map((entry) => {
              const count = counts.get(entry.id) ?? 0;
              return (
                <li key={entry.id}>
                  {count ? (
                    <Link href={href({}, { brand, group: entry.id })} className="flex h-full items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary" aria-label={`${entry.label} (${count})`}>
                      <span className="text-3xl" aria-hidden>
                        {entry.icon}
                      </span>
                      <span className="flex flex-col">
                        <b>{entry.label}</b>
                        <span className="text-sm text-muted-foreground">{count.toLocaleString("cs-CZ")} prvků</span>
                      </span>
                    </Link>
                  ) : (
                    <div className="flex h-full items-center gap-3 rounded-xl border border-dashed border-border p-4 text-muted-foreground opacity-60">
                      <span className="text-3xl grayscale" aria-hidden>
                        {entry.icon}
                      </span>
                      <span className="flex flex-col">
                        <b>{entry.label}</b>
                        <span className="text-sm">zatím bez prvků</span>
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </PageTransition>
    );
  }

  // KROK 1: rozcestník výrobců + globální hledání
  const [brands, search] = await Promise.all([getCatalogBrands(), q ? searchWholeCatalog(q) : Promise.resolve(null)]);
  return (
    <PageTransition>
      {header}
      <div className="flex flex-col gap-5">
        <CatalogSearch initial={q} />
        {search ? (
          <>
            <p className="text-sm text-muted-foreground" data-testid="catalog-count">
              {search.componentCount} přístrojů a {search.wiringCount} domovních přístrojů pro „{q}“
            </p>
            <div className="overflow-x-auto rounded-xl border border-border" data-testid="catalog-items">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Výrobce · řada</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Objednací číslo</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead className="text-right">Pv</TableHead>
                    <TableHead>Datasheet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {search.components.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs">
                        {row.manufacturer} · {row.series}
                      </TableCell>
                      <TableCell className="font-medium">{row.typeCode}</TableCell>
                      <TableCell className="font-mono text-xs">{row.articleNumber}</TableCell>
                      <TableCell className="text-xs">{CATEGORY_LABELS[row.category]}</TableCell>
                      <TableCell className="text-right font-mono">{formatWatts(row.powerLossWatts)}</TableCell>
                      <TableCell className="text-xs">
                        <Datasheet url={row.datasheetUrl} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {search.wiring.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs">
                        {row.manufacturer} · {row.series}
                      </TableCell>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell className="font-mono text-xs">{row.articleNumber.split(":").pop()}</TableCell>
                      <TableCell className="text-xs">{WIRING_CATEGORIES[row.category] ?? row.category}</TableCell>
                      <TableCell className="text-right">–</TableCell>
                      <TableCell className="text-xs">–</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" data-testid="catalog-brands">
            {brands.map((entry) => (
              <li key={entry.brand}>
                <Link
                  href={href({}, { brand: entry.brand })}
                  className="flex h-full flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-primary"
                  aria-label={`${brandOf(entry.brand)?.label ?? entry.brand} (${entry.count})`}
                >
                  <ManufacturerLogo manufacturer={entry.brand} className="h-10" />
                  <span className="text-xs text-muted-foreground">{entry.count.toLocaleString("cs-CZ")} prvků</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageTransition>
  );
}
