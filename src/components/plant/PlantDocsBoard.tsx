import Link from "next/link";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDate } from "@/lib/format";
import { equipmentHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { PlantAgendaRow } from "@/server/queries/plant-agenda";

/**
 * Fáze 98: agenda „3. Schémata, Červenka & Zálohy PLC“ – u každého rozváděče a stroje platné schéma (otevře prohlížeč
 * výkresů), otevřené změny s červeným zákresem z haly (Červenka) a aktivní verzované zálohy řídicího SW.
 */
export function PlantDocsBoard({ rows }: { rows: readonly PlantAgendaRow[] }) {
  const shown = rows.filter((row) => row.group !== "devices" || row.drawing || row.changes.length || row.backups.length);
  if (!shown.length) {
    return <EmptyState icon={FileText} title="Zatím žádná schémata ani zálohy" description="Schéma nahraje CAE projektant ke kartě rozváděče, zálohy PLC údržba v záložce Software & Zálohy PLC." />;
  }
  const drawings = shown.filter((row) => row.drawing).length;
  const redlines = shown.reduce((sum, row) => sum + row.changes.filter((change) => change.redline).length, 0);
  const backups = shown.reduce((sum, row) => sum + row.backups.length, 0);
  return (
    <section aria-label="Schémata, Červenka a zálohy PLC" className="flex flex-col gap-3" data-testid="plant-docs">
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <p className="rounded-xl border border-border bg-card p-3" data-testid="plant-docs-drawings">
          📐 <b className="font-mono text-lg">{drawings}</b>
          <span className="block text-xs text-muted-foreground">platných schémat</span>
        </p>
        <p className={cn("rounded-xl border p-3", redlines ? "border-red-500/50 bg-red-500/5" : "border-border bg-card")} data-testid="plant-docs-redlines">
          🖍️ <b className="font-mono text-lg">{redlines}</b>
          <span className="block text-xs text-muted-foreground">červených zákresů k zapracování</span>
        </p>
        <p className="rounded-xl border border-border bg-card p-3" data-testid="plant-docs-backups">
          💾 <b className="font-mono text-lg">{backups}</b>
          <span className="block text-xs text-muted-foreground">aktivních záloh PLC / měničů</span>
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Zařízení</th>
              <th className="px-3 py-2 font-medium">📐 Platné schéma</th>
              <th className="px-3 py-2 font-medium">🖍️ Červenka – otevřené změny</th>
              <th className="px-3 py-2 font-medium">💾 Zálohy PLC</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id} className="border-t border-border align-top" data-testid="plant-docs-row" data-tag={row.tag}>
                <td className="px-3 py-2">
                  <Link href={equipmentHref(row.id)} className="font-semibold hover:text-primary">
                    <span className="font-mono">{row.tag}</span>
                  </Link>
                  <span className="block text-xs text-muted-foreground">{row.name}</span>
                </td>
                <td className="px-3 py-2">
                  {row.drawing ? (
                    <Link href={`${equipmentHref(row.id)}?tab=schema`} className="text-primary underline-offset-2 hover:underline" data-testid="plant-docs-schema">
                      {row.drawing.version} · {row.drawing.title} ({row.drawing.sheets} {row.drawing.sheets === 1 ? "list" : row.drawing.sheets < 5 ? "listy" : "listů"})
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">bez schématu</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.changes.length ? (
                    <ul className="flex flex-col gap-1">
                      {row.changes.map((change) => (
                        <li key={change.id} className="flex flex-wrap items-center gap-1.5 text-xs" data-testid="plant-docs-change" data-redline={change.redline ? "true" : "false"}>
                          <Link href={`${equipmentHref(row.id)}?tab=history`} className="font-mono font-semibold hover:text-primary">
                            {change.number}
                          </Link>
                          <StatusBadge kind="changeRequest" status={change.status} plain />
                          {change.redline ? <span className="rounded bg-red-500/15 px-1 text-red-200">červený zákres</span> : null}
                          {change.safetyImpact === "SUBSTANTIAL_SAFETY_MOD" ? <span className="rounded bg-amber-500/15 px-1 text-amber-200">⚖️ podstatná změna</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-emerald-300">✓ bez otevřených změn</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.backups.length ? (
                    <Link href={`${equipmentHref(row.id)}?tab=software`} className="flex flex-col gap-0.5 text-xs hover:text-primary" data-testid="plant-docs-backup">
                      {row.backups.slice(0, 2).map((backup) => (
                        <span key={backup.id}>
                          {backup.safety ? "🛡️ " : ""}
                          {backup.targetUnit} · {backup.platform} · <b className="font-mono">{backup.version}</b> · {formatDate(backup.createdAt)}
                        </span>
                      ))}
                      {row.backups.length > 2 ? <span className="text-muted-foreground">+ {row.backups.length - 2} další</span> : null}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">bez zálohy SW</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
