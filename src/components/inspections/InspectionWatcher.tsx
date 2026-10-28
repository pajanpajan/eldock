import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";

import { INSPECTION_WARNING_DAYS } from "@/lib/inspection";
import { equipmentHref } from "@/lib/routes";
import { INSPECTION_STATE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { InspectionWatch } from "@/server/queries/inspections";

import { InspectionStatusBadge } from "./InspectionStatusBadge";

/** Lišta „Hlídač elektrorevizí (Lhůtník)“: propadlé 🔴 a brzy končící 🟡 revize s proklikem na zařízení. */
export function InspectionWatcher({ watch, showPlant = false }: { watch: InspectionWatch; showPlant?: boolean }) {
  const tone = watch.expired ? INSPECTION_STATE.EXPIRED : watch.expiring ? INSPECTION_STATE.EXPIRING : INSPECTION_STATE.VALID;
  const Icon = tone.icon;

  return (
    <section aria-labelledby="inspection-watch" className={cn("rounded-xl border p-4", tone.soft)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="inspection-watch" className="flex items-center gap-2 font-semibold">
          <Icon className={cn("size-5", tone.text)} aria-hidden />
          Hlídač elektrorevizí (Lhůtník)
        </h2>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className={cn("rounded-full border px-2.5 py-1", INSPECTION_STATE.EXPIRED.badge)}>
            Propadlé <span className="font-mono font-semibold tabular-nums">{watch.expired}</span>
          </span>
          <span className={cn("rounded-full border px-2.5 py-1", INSPECTION_STATE.EXPIRING.badge)}>
            Končí do {INSPECTION_WARNING_DAYS} dnů <span className="font-mono font-semibold tabular-nums">{watch.expiring}</span>
          </span>
        </div>
        <p className="text-xs text-muted-foreground sm:ml-auto">ČSN 33 1500 · sledováno {watch.total} zařízení</p>
      </div>

      {watch.items.length ? (
        <ul className="mt-3 grid gap-2 lg:grid-cols-2">
          {watch.items.map((item) => (
            <li key={item.id}>
              <Link
                href={`${equipmentHref(item.id)}?tab=inspections`}
                className="group flex items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2.5 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className={cn("size-2.5 shrink-0 rounded-full", INSPECTION_STATE[item.summary.state].dot)} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono font-semibold">{item.tag}</span>
                    <InspectionStatusBadge summary={item.summary} />
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {showPlant ? `${item.plantName} › ` : ""}
                    {item.location}
                    {item.summary.state === "EXPIRED" && item.defectsSummary ? ` · závady: ${item.defectsSummary}` : ""}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-400" aria-hidden />
          Všechny revize jsou v platnosti, žádná nekončí do {INSPECTION_WARNING_DAYS} dnů.
        </p>
      )}
    </section>
  );
}
