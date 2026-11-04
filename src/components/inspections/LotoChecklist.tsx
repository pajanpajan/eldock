"use client";

import { useState } from "react";

import { FIVE_SAFETY_RULES } from "@/lib/legislation-2027";
import { cn } from "@/lib/utils";

/** Checklist 5 bezpečnostních pravidel pro zajištění pracoviště (ČSN EN 50110-1 ed. 4) – jen na obrazovce. */
export function LotoChecklist() {
  const [done, setDone] = useState<boolean[]>(() => FIVE_SAFETY_RULES.map(() => false));
  const count = done.filter(Boolean).length;
  return (
    <div className="space-y-2" data-testid="loto-five-rules">
      <p className="flex items-center justify-between text-sm font-semibold">
        5 bezpečnostních pravidel pro zajištění pracoviště
        <span className={cn("rounded-full px-2 text-xs", count === FIVE_SAFETY_RULES.length ? "bg-emerald-500/20 text-emerald-300" : "bg-muted text-muted-foreground")}>
          {count}/{FIVE_SAFETY_RULES.length}
        </span>
      </p>
      <ol className="space-y-1">
        {FIVE_SAFETY_RULES.map((rule, index) => (
          <li key={rule}>
            <label className="flex min-h-9 items-center gap-2 rounded-lg border border-border px-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={done[index]} onChange={(event) => setDone(done.map((value, i) => (i === index ? event.target.checked : value)))} />
              <span className="font-mono text-muted-foreground">{index + 1}.</span> {rule}
            </label>
          </li>
        ))}
      </ol>
    </div>
  );
}
