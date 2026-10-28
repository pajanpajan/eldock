import { cn } from "@/lib/utils";
import {
  CHANGE_REQUEST_PRIORITY,
  CHANGE_REQUEST_STATUS,
  EQUIPMENT_STATUS,
  REVISION_STATUS,
  type StatusStyle,
} from "@/lib/status";
import type {
  ChangeRequestPriority,
  ChangeRequestStatus,
  EquipmentStatus,
  RevisionStatus,
} from "@/generated/prisma/enums";

export type StatusRef =
  | { kind: "equipment"; status: EquipmentStatus }
  | { kind: "changeRequest"; status: ChangeRequestStatus }
  | { kind: "revision"; status: RevisionStatus }
  | { kind: "priority"; status: ChangeRequestPriority };

export function getStatusStyle(ref: StatusRef): StatusStyle {
  switch (ref.kind) {
    case "equipment":
      return EQUIPMENT_STATUS[ref.status];
    case "changeRequest":
      return CHANGE_REQUEST_STATUS[ref.status];
    case "revision":
      return REVISION_STATUS[ref.status];
    case "priority":
      return CHANGE_REQUEST_PRIORITY[ref.status];
  }
}

type Props = StatusRef & {
  className?: string;
  /** Bez ikony (jen text). */
  plain?: boolean;
};

/** Štítek stavu – barva i popisek vždy ze `src/lib/status.ts`. */
export function StatusBadge({ className, plain, ...ref }: Props) {
  const style = getStatusStyle(ref as StatusRef);
  const Icon = style.icon;
  return (
    <span
      title={style.description}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        style.badge,
        className,
      )}
    >
      {plain ? null : <Icon className="size-3.5" aria-hidden />}
      {style.label}
    </span>
  );
}
