"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, EyeOff, Wrench, XCircle } from "lucide-react";

import type { LintIssue } from "@/lib/panel-builder/linter";
import { cn } from "@/lib/utils";

/**
 * Elektro-linter (fáze 45, kompaktní od fáze 47): v liště nad plátnem jen malý odznak
 * „⚠️ X doporučení ▾“; detaily v plovoucím popoveru s opravou 1 klikem a možností nálezy skrýt.
 */
export function LinterPanel({ issues, busy, onFix, onFocus }: { issues: LintIssue[]; busy: boolean; onFix: (issue: LintIssue) => void; onFocus: (itemId: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  // Popover se zavře klikem mimo nebo klávesou Esc
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  // Skryté nálezy (podle id) – nový nález se znovu ukáže
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const visible = issues.filter((issue) => !hidden.has(issue.id));
  const errors = visible.filter((issue) => issue.severity === "error").length;

  if (!visible.length) {
    return (
      <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-300" data-testid="linter" role="status">
        <CheckCircle2 className="size-3.5" aria-hidden /> Linter bez nálezů
      </span>
    );
  }
  return (
    <div ref={root} className="relative" data-testid="linter">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", errors ? "border-red-500/60 bg-red-500/10 text-red-200" : "border-amber-500/60 bg-amber-500/10 text-amber-200")}
        data-testid="linter-badge"
      >
        {errors ? <XCircle className="size-3.5" aria-hidden /> : <AlertTriangle className="size-3.5" aria-hidden />}
        {visible.length} doporučení
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="absolute top-full left-0 z-40 mt-1.5 w-[min(34rem,90vw)] rounded-xl border border-border bg-popover p-2 shadow-2xl shadow-black/50" role="dialog" aria-label="Elektro-linter">
          <div className="mb-1.5 flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>Elektro-linter – kontrola norem a zapojení</span>
            <button type="button" className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted" onClick={() => setHidden(new Set(issues.map((issue) => issue.id)))}>
              <EyeOff className="size-3" aria-hidden /> Skrýt vše
            </button>
          </div>
          <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
            {visible.map((issue) => (
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
                <button type="button" className="shrink-0 rounded p-0.5 text-current/70 hover:bg-background/40" onClick={() => setHidden(new Set([...hidden, issue.id]))} aria-label={`Skrýt doporučení: ${issue.message}`}>
                  <EyeOff className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
