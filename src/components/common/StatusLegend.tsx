import type { ReactNode } from "react";

import type { EquipmentStatus } from "@/generated/prisma/enums";
import { EQUIPMENT_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";

import { StatusDot } from "./StatusDot";

const ORDER: EquipmentStatus[] = ["ACTIVE", "PENDING_UPDATE", "WAITING_APPROVAL"];

/** Legenda stavových barev zařízení (+ volitelné doplňující položky). */
export function StatusLegend({ extra, className }: { extra?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground", className)}>
      {ORDER.map((status) => (
        <span key={status} className="flex items-center gap-2" title={EQUIPMENT_STATUS[status].description}>
          <StatusDot kind="equipment" status={status} />
          {EQUIPMENT_STATUS[status].label}
        </span>
      ))}
      {extra}
    </div>
  );
}
