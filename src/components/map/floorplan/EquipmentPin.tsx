"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { EQUIPMENT_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { FloorEquipment } from "@/server/queries/floor";

/** Výška hlavičky pinu + nožky v px – špička nožky leží přesně na souřadnici zařízení. */
const PIN_HEIGHT = 46;

export const pinElementId = (equipmentId: string) => `pin-${equipmentId}`;

interface Props {
  equipment: FloorEquipment;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Pin zařízení. Kotva je v procentech půdorysu; vnitřek se protiškáluje proměnnou
 * `--inv-scale` (nastavuje FloorplanViewer), takže pin má na obrazovce stálou velikost;
 * `--pin-scale` ho zmenší na úzkých displejích.
 */
export function EquipmentPin({ equipment, selected, onSelect }: Props) {
  const style = EQUIPMENT_STATUS[equipment.status];
  const Icon = EQUIPMENT_TYPE_ICONS[equipment.type];
  const pulse = equipment.status === "PENDING_UPDATE";

  return (
    <div className="absolute size-0" style={{ left: `${equipment.pinX}%`, top: `${equipment.pinY}%` }}>
      <div className="origin-top-left" style={{ transform: "scale(calc(var(--inv-scale, 1) * var(--pin-scale, 1)))" }}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              id={pinElementId(equipment.id)}
              type="button"
              onClick={() => onSelect(equipment.id)}
              aria-label={`${equipment.name} – ${style.label}`}
              className="pin-button group absolute top-0 left-0 flex flex-col items-center outline-none"
              style={{ transform: `translate(-50%, -${PIN_HEIGHT}px)` }}
            >
              <span
                className={cn(
                  "relative flex size-9 items-center justify-center rounded-full border-2 text-white shadow-lg shadow-black/60 transition-transform group-hover:scale-110 group-focus-visible:scale-110",
                  style.dot,
                  selected ? "border-primary ring-4 ring-primary/50" : "border-zinc-950",
                )}
              >
                {pulse ? <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", style.dot)} /> : null}
                <Icon className="relative size-[18px]" strokeWidth={2.4} aria-hidden />
              </span>
              <span className={cn("h-2.5 w-0.5", style.dot)} />
              <span
                className={cn(
                  "mt-0.5 rounded px-1.5 py-px font-mono text-[11px] font-semibold whitespace-nowrap shadow",
                  selected ? "bg-primary text-primary-foreground" : "bg-zinc-950/90 text-zinc-100",
                )}
              >
                {equipment.tag}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            <div className="font-medium">{equipment.name}</div>
            <div className="opacity-80">{style.label}</div>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
