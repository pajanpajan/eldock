import Link from "next/link";

import { cn } from "@/lib/utils";

export type PanelStep = "recognition" | "tree" | "thermal";

const STEPS: { key: PanelStep; label: string; href: (id: string) => string }[] = [
  { key: "recognition", label: "1. Analýza fotky", href: (id) => `/panel-builder/${id}` },
  { key: "tree", label: "2. Hierarchický strom a zapojení", href: (id) => `/panel-builder/${id}/tree` },
  { key: "thermal", label: "3. Výpočet oteplení a bilance", href: (id) => `/panel-builder/${id}/thermal` },
];

/** Kroky pracovní plochy projektu rozváděče. */
export function PanelSteps({ projectId, current }: { projectId: string; current: PanelStep }) {
  return (
    <nav aria-label="Kroky projektu" className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
      {STEPS.map((step) => (
        <Link
          key={step.key}
          href={step.href(projectId)}
          aria-current={step.key === current ? "page" : undefined}
          className={cn(
            "touch-target flex items-center rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            step.key === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {step.label}
        </Link>
      ))}
    </nav>
  );
}
