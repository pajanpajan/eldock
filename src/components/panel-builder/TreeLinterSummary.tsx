import Link from "next/link";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import type { LintIssue } from "@/lib/panel-builder/linter";
import { cn } from "@/lib/utils";

/**
 * Fáze 98: Elektro-linter ve fázi 2 („Strom zapojení, Fáze & Linter“) – nálezy nad uloženým projektem (chrániče, póly,
 * soudobé zatížení chrániče, typ chrániče u výkonové elektroniky …) vedle stromu zapojení. Oprava jedním klikem mění
 * osazení přístrojů, proto vede do části 1a (osazení DIN lišt), kde je linter u lišt s tlačítky oprav.
 */
export function TreeLinterSummary({ issues, fixHref }: { issues: readonly LintIssue[]; fixHref: string }) {
  if (!issues.length) {
    return (
      <p className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-300" role="status" data-testid="tree-linter" data-issues={0}>
        <CheckCircle2 className="size-4 shrink-0" aria-hidden /> Elektro-linter bez nálezů – chrániče, póly, rezerva i hřebeny jsou v pořádku.
      </p>
    );
  }
  const errors = issues.filter((issue) => issue.severity === "error").length;
  return (
    <details className={cn("mb-4 rounded-xl border px-3 py-2 text-sm", errors ? "border-red-500/50 bg-red-500/5" : "border-amber-500/50 bg-amber-500/5")} data-testid="tree-linter" data-issues={issues.length}>
      <summary className={cn("flex cursor-pointer list-none items-center gap-2 font-semibold", errors ? "text-red-200" : "text-amber-200")}>
        {errors ? <XCircle className="size-4 shrink-0" aria-hidden /> : <AlertTriangle className="size-4 shrink-0" aria-hidden />}
        Elektro-linter: {issues.length} {issues.length === 1 ? "doporučení" : "doporučení"} ke kontrole zapojení
        <span className="ml-auto text-xs font-normal text-muted-foreground">rozbalit ▾</span>
      </summary>
      <ul className="mt-2 flex flex-col gap-1 text-xs">
        {issues.map((issue) => (
          <li key={issue.id} className={cn("rounded-md border px-2 py-1", issue.severity === "error" ? "border-red-500/40 text-red-100" : "border-amber-500/40 text-amber-100")} data-testid="tree-linter-issue" data-rule={issue.rule}>
            {issue.message}
          </li>
        ))}
      </ul>
      <Link href={fixHref} className="mt-2 inline-flex text-xs font-semibold text-primary underline-offset-2 hover:underline" data-testid="tree-linter-fix">
        Opravit jedním klikem v části 1a (osazení DIN lišt) →
      </Link>
    </details>
  );
}
