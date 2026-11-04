"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Wrench, XCircle } from "lucide-react";

import type { LintIssue } from "@/lib/panel-builder/linter";
import { cn } from "@/lib/utils";

/**
 * Elektro-linter (fáze 45): chyby červeně, varování oranžově, u každého nálezu „Opravit 1 klikem“.
 * Klik na nález vybere dotčený přístroj na plátně.
 */
export function LinterPanel({ issues, busy, onFix, onFocus }: { issues: LintIssue[]; busy: boolean; onFix: (issue: LintIssue) => void; onFocus: (itemId: string) => void }) {
  const [open, setOpen] = useState(true);
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.length - errors;
  if (!issues.length) {
    return (
      <p className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-2.5 py-1.5 text-xs text-emerald-300" data-testid="linter" role="status">
        <CheckCircle2 className="size-3.5" aria-hidden /> Elektro-linter: bez nálezů
      </p>
    );
  }
  return (
    <section aria-label="Elektro-linter" className="rounded-lg border border-border bg-card/60" data-testid="linter">
      <button type="button" className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold" onClick={() => setOpen(!open)} aria-expanded={open}>
        Elektro-linter
        {errors ? <span className="rounded-full bg-red-500/20 px-2 text-red-300">{errors} chyb{errors === 1 ? "a" : errors <= 4 ? "y" : ""}</span> : null}
        {warnings ? <span className="rounded-full bg-amber-500/20 px-2 text-amber-200">{warnings} varování</span> : null}
        <ChevronDown className={cn("ml-auto size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <ul className="flex flex-col gap-1 px-2 pb-2">
          {issues.map((issue) => (
            <li
              key={issue.id}
              data-rule={issue.rule}
              data-severity={issue.severity}
              className={cn("flex flex-wrap items-start gap-2 rounded-md border px-2 py-1.5 text-xs", issue.severity === "error" ? "border-red-500/50 bg-red-500/10 text-red-100" : "border-amber-500/50 bg-amber-500/10 text-amber-100")}
            >
              {issue.severity === "error" ? <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" aria-hidden /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-300" aria-hidden />}
              <button type="button" className="min-w-0 flex-1 text-left hover:underline" onClick={() => issue.itemIds[0] && onFocus(issue.itemIds[0])}>
                {issue.message}
              </button>
              {issue.fix ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onFix(issue)}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-current/40 bg-background/40 px-2 py-0.5 font-semibold hover:bg-background/70 disabled:opacity-50"
                  title={issue.fix.label}
                >
                  <Wrench className="size-3" aria-hidden /> [Opravit 1 klikem] {issue.fix.label}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
