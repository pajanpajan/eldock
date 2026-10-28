import { compareDefects, defectState } from "@/lib/defects";
import { formatDateShort, plural } from "@/lib/format";
import { DEFECT_SEVERITY, DEFECT_STATE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { EquipmentDefect } from "@/server/queries/equipment";

import { ResolveDefectDialog } from "./ResolveDefectDialog";

const DAYS = ["den", "dny", "dní"] as const;

/** Závady revizní zprávy: závažnost, odpočet lhůty, potvrzení odstranění. */
export function DefectList({ defects, now }: { defects: EquipmentDefect[]; now: Date }) {
  if (!defects.length) return null;
  return (
    <ul className="space-y-2" aria-label="Závady z revize">
      {[...defects].sort(compareDefects).map((defect) => {
        const { state, daysLeft } = defectState(defect, now);
        const severity = DEFECT_SEVERITY[defect.severity];
        const status = DEFECT_STATE[state];
        const StatusIcon = status.icon;
        return (
          <li key={defect.id} className={cn("space-y-2 rounded-lg border p-3", status.soft)}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", severity.badge)}>{severity.label}</span>
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", status.badge)}>
                <StatusIcon className="size-3.5" aria-hidden />
                {status.label}
              </span>
              <span className="text-sm font-medium">{defect.description}</span>
            </div>
            {state === "RESOLVED" ? (
              <p className="text-sm text-muted-foreground">
                Odstraněno {defect.resolvedAt ? formatDateShort(defect.resolvedAt) : ""} · {defect.resolvedBy ?? "–"}
                {defect.resolutionNote ? ` – ${defect.resolutionNote}` : ""}
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={cn("text-sm font-medium", status.text)}>
                  Lhůta {formatDateShort(defect.deadline)} ·{" "}
                  {daysLeft < 0 ? `${-daysLeft} ${plural(-daysLeft, DAYS)} po lhůtě` : daysLeft === 0 ? "odstranit dnes" : `zbývá ${daysLeft} ${plural(daysLeft, DAYS)}`}
                </p>
                <ResolveDefectDialog defectId={defect.id} description={defect.description} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
