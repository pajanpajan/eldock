"use client";

import Link from "next/link";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { BACKUP_FILTERS, effectiveTiers, matchesTenant, tierOf, type BackupFilter, type BackupNode, type BackupSummary } from "@/lib/power-backup";
import { equipmentHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * Fáze 93: filtr větví nad mapou areálu – všechny rozvody / jen běžná síť / zálohováno dieselagregátem (DA < 15 s) /
 * kritické okruhy UPS (< 0,5 s) / ZIS IT. Souhrn výkonu proti kapacitě zdroje zálohy, seznam rozváděčů větve a hledání
 * nájemní jednotky nebo zdravotnického oddělení.
 */
export function PowerBackupFilter({
  nodes,
  summary,
  filter,
  onFilter,
  query,
  onQuery,
}: {
  nodes: readonly BackupNode[];
  summary: BackupSummary;
  filter: BackupFilter;
  onFilter: (filter: BackupFilter) => void;
  query: string;
  onQuery: (query: string) => void;
}) {
  const tiers = effectiveTiers(nodes);
  const count = (id: BackupFilter) => (id === "ALL" ? nodes.length : nodes.filter((node) => tiers.get(node.id) === id).length);
  const listed = summary.members.filter((node) => matchesTenant(node, query));
  const active = filter === "ALL" ? null : tierOf(filter);
  const chip = (on: boolean) =>
    cn(
      "flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      on ? "border-primary/70 bg-primary/15 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
    );
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-3" aria-label="Zálohování napájení areálu" data-testid="power-backup-filter">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtr větví podle zálohování">
        {BACKUP_FILTERS.map((entry) => (
          <button key={entry.id} type="button" aria-pressed={filter === entry.id} className={chip(filter === entry.id)} onClick={() => onFilter(entry.id)} data-testid={`backup-filter-${entry.id}`}>
            {entry.id === "ALL" ? `[ ${entry.label} ]` : entry.label}
            <span className="font-mono">{count(entry.id)}</span>
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Nájemní jednotka / zdravotnické oddělení" aria-label="Hledat nájemní jednotku nebo oddělení" className="h-9 pl-9 text-sm" data-testid="tenant-search" />
        </div>
      </div>
      <p className={cn("rounded-lg border px-3 py-2 text-sm font-semibold", active ? "border-transparent text-white" : "border-border bg-muted/30")} style={active ? { background: `${active.color}cc` } : undefined} data-testid="backup-headline">
        {summary.headline}
        {summary.reservePct !== null && summary.reservePct < 10 ? <span className="ml-2 rounded bg-black/40 px-1.5 py-0.5 text-xs">⚠️ rezerva pod 10 % – zatížení zdroje zálohy prověřte</span> : null}
      </p>
      {filter !== "ALL" || query.trim() ? (
        listed.length ? (
          <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3" data-testid="backup-members">
            {listed.map((node) => {
              const tier = tierOf(node.effective);
              return (
                <li key={node.id}>
                  <Link href={equipmentHref(node.id)} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-xs hover:border-primary/60 hover:bg-muted/40">
                    <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-white" style={{ background: tier.color }}>
                      {tier.badge}
                    </span>
                    <span className="font-mono font-semibold">{node.tag}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{node.tenantUnit ?? node.name.replace(`${node.tag} - `, "")}</span>
                    <span className="font-mono tabular-nums">{node.loadKw.toLocaleString("cs-CZ")} kW</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Žádný rozváděč neodpovídá filtru{query.trim() ? ` „${query.trim()}“` : ""}.</p>
        )
      ) : null}
    </section>
  );
}
