import type { InspectionSummary } from "@/lib/inspection";
import { INSPECTION_STATE, inspectionBadgeLabel } from "@/lib/status";
import { cn } from "@/lib/utils";

/** Odznak stavu elektrorevize: 🟢 platná do … / 🟡 končí za X dní / 🔴 REVIZE PROPADLÁ před X dny. */
export function InspectionStatusBadge({ summary, className }: { summary: InspectionSummary; className?: string }) {
  const style = INSPECTION_STATE[summary.state];
  const Icon = style.icon;
  return (
    <span
      title={style.description}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        style.badge,
        summary.state === "EXPIRED" && "font-bold",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {inspectionBadgeLabel(summary.state, summary.validUntil, summary.daysLeft)}
    </span>
  );
}
