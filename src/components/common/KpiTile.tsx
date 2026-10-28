import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  /** Třída barvy ikony a hodnoty, např. `text-orange-400` ze `status.ts`. */
  accent?: string;
  className?: string;
}

export function KpiTile({ label, value, hint, icon: Icon, accent, className }: Props) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{label}</span>
        {Icon ? <Icon className={cn("size-4", accent)} aria-hidden /> : null}
      </div>
      <div className={cn("mt-2 font-mono text-3xl font-semibold tabular-nums", accent)}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
