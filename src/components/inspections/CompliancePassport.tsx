import Link from "next/link";
import { Cable, FileWarning, FileCheck2, PlugZap, ShieldCheck } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COMPLIANCE_CATEGORY_LABELS, COMPLIANCE_CATEGORY_ORDER, EQUIPMENT_TYPE_LABELS, formatDateShort } from "@/lib/format";
import { equipmentHref } from "@/lib/routes";
import { buildInterfaceRows } from "@/lib/switchboard-interface";
import { cn } from "@/lib/utils";
import type { EquipmentDetail } from "@/server/queries/equipment";

import { DocumentPreviewButton } from "./DocumentPreviewButton";

/** Záložka „Pasport & Shoda (61439)“: výrobní dokumentace rozváděče, rozhraní a napájené vývody. */
export function CompliancePassport({ equipment }: { equipment: EquipmentDetail }) {
  const documents = equipment.complianceDocuments;
  const isSwitchboard = equipment.type === "SWITCHBOARD";

  if (!isSwitchboard && documents.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Pasport dle ČSN EN 61439 se vede pro rozváděče"
        description={
          equipment.fedFrom ? (
            <>
              {EQUIPMENT_TYPE_LABELS[equipment.type]} je napájen z rozváděče{" "}
              <Link href={`${equipmentHref(equipment.fedFrom.id)}?tab=passport`} className="font-mono text-primary underline-offset-4 hover:underline">
                {equipment.fedFrom.tag}
              </Link>
              {equipment.fedFromCircuit ? ` (${equipment.fedFromCircuit})` : ""} – výrobní dokumentaci najdete u něj.
            </>
          ) : (
            "U tohoto zařízení se výrobní dokumentace rozváděče neeviduje."
          )
        }
      />
    );
  }

  const present = new Set(documents.map((doc) => doc.category));
  const missing = COMPLIANCE_CATEGORY_ORDER.filter((category) => !present.has(category));
  const sorted = [...documents].sort(
    (a, b) => COMPLIANCE_CATEGORY_ORDER.indexOf(a.category) - COMPLIANCE_CATEGORY_ORDER.indexOf(b.category),
  );
  const rows = buildInterfaceRows(equipment);

  return (
    <div className="space-y-8">
      <section aria-labelledby="passport-docs" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="passport-docs" className="text-lg font-semibold">
            Výrobní dokumentace rozváděče
          </h2>
          <p className={cn("text-sm", missing.length ? "text-amber-400" : "text-emerald-400")}>
            {missing.length ? `Pasport neúplný – chybí ${missing.length} z ${COMPLIANCE_CATEGORY_ORDER.length} dokumentů` : "Pasport kompletní dle ČSN EN 61439-2"}
          </p>
        </div>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((doc) => {
            const meta = COMPLIANCE_CATEGORY_LABELS[doc.category];
            return (
              <li key={doc.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <FileCheck2 className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{meta.label}</p>
                    <h3 className="font-semibold">{doc.title}</h3>
                    <p className="text-xs text-muted-foreground">{meta.hint}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Číslo</dt>
                  <dd className="font-mono">{doc.documentNumber}</dd>
                  <dt className="text-muted-foreground">Vydáno</dt>
                  <dd>{formatDateShort(doc.issuedAt)}</dd>
                  <dt className="text-muted-foreground">Vystavil</dt>
                  <dd>{doc.issuer}</dd>
                </dl>
                {doc.notes ? <p className="text-sm text-muted-foreground">{doc.notes}</p> : null}
                <div className="mt-auto">
                  <DocumentPreviewButton url={doc.fileUrl} title={doc.title} subtitle={`${meta.label} · ${doc.documentNumber}`} />
                </div>
              </li>
            );
          })}
          {missing.map((category) => {
            const meta = COMPLIANCE_CATEGORY_LABELS[category];
            return (
              <li key={category} className="flex items-start gap-3 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                  <FileWarning className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-medium tracking-wide text-amber-400 uppercase">Chybí v pasportu</p>
                  <h3 className="font-semibold">{meta.label}</h3>
                  <p className="text-xs text-muted-foreground">{meta.hint}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="passport-interface" className="space-y-3">
          <h2 id="passport-interface" className="flex items-center gap-2 text-lg font-semibold">
            <PlugZap className="size-5 text-primary" aria-hidden />
            Rozhraní rozváděče
            <span className="text-sm font-normal text-muted-foreground">ČSN EN 61439-1, příloha C</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Charakteristika</TableHead>
                  <TableHead>Hodnota</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Článek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="text-muted-foreground">{row.label}</TableCell>
                    <TableCell className="font-medium whitespace-normal">
                      {row.label === "Napájeno z" && equipment.fedFrom ? (
                        <Link href={equipmentHref(equipment.fedFrom.id)} className="text-primary underline-offset-4 hover:underline">
                          {row.value}
                        </Link>
                      ) : (
                        row.value
                      )}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-xs text-muted-foreground sm:table-cell">{row.clause ?? "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section aria-labelledby="passport-feeds" className="space-y-3">
          <h2 id="passport-feeds" className="flex items-center gap-2 text-lg font-semibold">
            <Cable className="size-5 text-primary" aria-hidden />
            Napájené vývody
          </h2>
          {equipment.feeds.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {equipment.feeds.map((feed) => (
                <li key={feed.id}>
                  <Link href={equipmentHref(feed.id)} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{feed.name}</span>
                      <span className="text-xs text-muted-foreground">{EQUIPMENT_TYPE_LABELS[feed.type]}</span>
                    </span>
                    <span className="shrink-0 rounded-md border border-border px-2 py-1 font-mono text-xs">{feed.fedFromCircuit ?? "–"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Z tohoto zařízení nejsou v systému napájena žádná další zařízení.</p>
          )}
        </section>
      </div>
    </div>
  );
}
