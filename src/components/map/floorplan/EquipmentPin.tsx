"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { needsAttention } from "@/lib/inspection";
import { isLightCard } from "@/lib/inspection-rules";
import { EQUIPMENT_STATUS, INSPECTION_STATE, inspectionBadgeLabel } from "@/lib/status";
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
  // Spotřebiče a nářadí nemají výkresovou dokumentaci – barva pinu = stav revize.
  const light = isLightCard(equipment.type);
  const style = light ? INSPECTION_STATE[equipment.inspection.state] : EQUIPMENT_STATUS[equipment.status];
  const Icon = EQUIPMENT_TYPE_ICONS[equipment.type];
  const pulse = !light && equipment.status === "PENDING_UPDATE";
  const { inspection } = equipment;
  const expired = inspection.state === "EXPIRED" || inspection.state === "FAILED";
  const inspectionText = inspectionBadgeLabel(inspection.state, inspection.validUntil, inspection.daysLeft);

  return (
    <div className="absolute size-0" style={{ left: `${equipment.pinX}%`, top: `${equipment.pinY}%` }}>
      <div className="origin-top-left" style={{ transform: "scale(calc(var(--inv-scale, 1) * var(--pin-scale, 1)))" }}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              id={pinElementId(equipment.id)}
              type="button"
              onClick={() => onSelect(equipment.id)}
              aria-label={`${equipment.name} – ${style.label}${expired ? ` – ${inspectionText}` : ""}`}
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
                {expired ? (
                  <span
                    data-testid="pin-inspection-warning"
                    className={cn(
                      "absolute -top-1.5 -right-2 flex size-[18px] items-center justify-center rounded-full border-2 border-zinc-950 text-[11px] leading-none font-black text-white",
                      INSPECTION_STATE.EXPIRED.dot,
                    )}
                    aria-hidden
                  >
                    !
                  </span>
                ) : null}
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
            {needsAttention(inspection.state) ? (
              <div className={cn("font-medium", INSPECTION_STATE[inspection.state].text)}>{inspectionText}</div>
            ) : null}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
