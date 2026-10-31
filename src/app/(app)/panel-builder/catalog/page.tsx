import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { CatalogFilters } from "@/components/panel-builder/CatalogFilters";
import { DatasheetImport } from "@/components/panel-builder/DatasheetImport";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CATEGORY_LABELS, DATA_SOURCE_LABELS, formatWatts, parseCatalogFilter } from "@/lib/panel-builder/catalog";
import { getCatalog } from "@/server/queries/panel-builder";

export const metadata: Metadata = { title: "Katalog prvků – AI Panel Builder" };

const num = (value: number) => value.toLocaleString("cs-CZ", { maximumFractionDigits: 2 });

// Atomická databáze prvků: filtry, okamžité hledání a těžba PDF datasheetů.
export default async function CatalogPage({ searchParams }: PageProps<"/panel-builder/catalog">) {
  const guard = await panelBuilderGuard("Katalog prvků");
  if (guard) return guard;
  const filter = parseCatalogFilter(await searchParams);
  const catalog = await getCatalog(filter);

  return (
    <PageTransition>
      <PageHeader
        title="Katalog prvků"
        description="Atomická databáze přístrojů – každý jistič, chránič či vypínač jako samostatný záznam se ztrátovým výkonem pro výpočet oteplení."
        breadcrumb={
          <Link href="/panel-builder" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> AI Panel Builder
          </Link>
        }
        actions={<DatasheetImport />}
      />
      <div className="flex flex-col gap-4">
        <CatalogFilters manufacturers={catalog.manufacturers} />
        <p className="text-sm text-muted-foreground" data-testid="catalog-count">
          {catalog.matching} z {catalog.total} prvků
          {catalog.matching > catalog.limit ? ` (zobrazeno prvních ${catalog.limit})` : ""}
        </p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Výrobce · řada</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Objednací číslo</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Póly</TableHead>
                <TableHead className="text-right">In</TableHead>
                <TableHead>Char.</TableHead>
                <TableHead className="text-right">Icn / IΔn</TableHead>
                <TableHead className="text-right">Moduly</TableHead>
                <TableHead className="text-right">Pv</TableHead>
                <TableHead>Zdroj</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalog.items.map((component) => (
                <TableRow key={component.id}>
                  <TableCell>
                    <div className="font-medium">{component.manufacturer}</div>
                    <div className="text-xs text-muted-foreground">{component.series}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{component.typeCode}</div>
                    <div className="max-w-72 truncate text-xs text-muted-foreground" title={component.description}>
                      {component.description}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{component.articleNumber}</TableCell>
                  <TableCell>{CATEGORY_LABELS[component.category]}</TableCell>
                  <TableCell>{component.poles}</TableCell>
                  <TableCell className="text-right font-mono">{component.ratedCurrentA ? `${num(component.ratedCurrentA)} A` : "–"}</TableCell>
                  <TableCell>{component.trippingCurve ?? "–"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {[
                      component.breakingCapacityKa ? `${num(component.breakingCapacityKa)} kA` : null,
                      component.rcdSensitivityMa ? `${component.rcdSensitivityMa} mA${component.rcdType ? ` ${component.rcdType}` : ""}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "–"}
                  </TableCell>
                  <TableCell className="text-right font-mono">{num(component.modulesCount)}</TableCell>
                  <TableCell className="text-right font-mono">{formatWatts(component.powerLossWatts)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" title={component.sourcePdfName ? `${component.sourcePdfName}${component.sourcePage ? `, str. ${component.sourcePage}` : ""}` : undefined}>
                      {DATA_SOURCE_LABELS[component.dataSource]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!catalog.items.length ? <p className="p-6 text-center text-sm text-muted-foreground">Filtru neodpovídá žádný prvek.</p> : null}
        </div>
      </div>
    </PageTransition>
  );
}
