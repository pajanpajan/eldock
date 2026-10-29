"use client";

import { StatusBadge } from "@/components/common/StatusBadge";
import { InspectionStatusBadge } from "@/components/inspections/InspectionStatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/format";
import { isLightCard } from "@/lib/inspection-rules";
import { cn } from "@/lib/utils";
import type { FloorEquipment } from "@/server/queries/floor";

/** Tabulka zařízení patra (respektuje vrstvy a filtry); klik na řádek otevře rychlý náhled, checkboxy vybírají pro hromadnou revizi. */
export function FloorEquipmentTable({
  equipment,
  selectedId,
  onSelect,
  checked,
  onCheckedChange,
  selectable = true,
  showInspections = true,
}: {
  equipment: FloorEquipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  checked: ReadonlySet<string>;
  onCheckedChange: (next: ReadonlySet<string>) => void;
  /** Checkboxy hromadné revize. */
  selectable?: boolean;
  showInspections?: boolean;
}) {
  const allChecked = equipment.length > 0 && equipment.every((item) => checked.has(item.id));
  const toggleOne = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onCheckedChange(next);
  };
  const toggleAll = () => {
    const next = new Set(checked);
    for (const item of equipment) {
      if (allChecked) next.delete(item.id);
      else next.add(item.id);
    }
    onCheckedChange(next);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable ? (
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  className="size-5 accent-primary align-middle"
                  checked={allChecked}
                  onChange={toggleAll}
                  aria-label="Vybrat vše pro hromadnou revizi"
                />
              </TableHead>
            ) : null}
            <TableHead>Tag</TableHead>
            <TableHead>Název</TableHead>
            <TableHead className="hidden md:table-cell">Typ</TableHead>
            <TableHead>Stav</TableHead>
            <TableHead className="hidden lg:table-cell">Dokumentace</TableHead>
            {showInspections ? <TableHead>Elektrorevize</TableHead> : null}
            <TableHead className="hidden sm:table-cell">Otevřená změna</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipment.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                Filtru neodpovídá žádné zařízení.
              </TableCell>
            </TableRow>
          ) : (
            equipment.map((item) => {
              const Icon = EQUIPMENT_TYPE_ICONS[item.type];
              return (
                <TableRow
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={cn("h-12 cursor-pointer", item.id === selectedId && "bg-primary/10", checked.has(item.id) && "bg-primary/5")}
                >
                  {selectable ? (
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="size-5 accent-primary align-middle"
                        checked={checked.has(item.id)}
                        onChange={() => toggleOne(item.id)}
                        aria-label={`Vybrat ${item.tag} pro hromadnou revizi`}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <button
                      type="button"
                      className="rounded font-mono font-semibold text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(item.id);
                      }}
                    >
                      {item.tag}
                    </button>
                  </TableCell>
                  <TableCell className="max-w-64 truncate">{item.name.replace(`${item.tag} - `, "")}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    <span className="flex items-center gap-1.5">
                      <Icon className="size-4" aria-hidden />
                      {EQUIPMENT_TYPE_LABELS[item.type]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {isLightCard(item.type) ? (
                      <span className="text-xs text-muted-foreground">bez výkresu</span>
                    ) : (
                      <StatusBadge kind="equipment" status={item.status} />
                    )}
                  </TableCell>
                  <TableCell className="hidden font-mono lg:table-cell">{item.activeRevision?.version ?? "—"}</TableCell>
                  {showInspections ? (
                    <TableCell>
                      <InspectionStatusBadge summary={item.inspection} />
                    </TableCell>
                  ) : null}
                  <TableCell className="hidden font-mono sm:table-cell">{item.openChange?.number ?? "—"}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
