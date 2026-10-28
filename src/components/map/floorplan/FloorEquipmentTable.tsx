"use client";

import { StatusBadge } from "@/components/common/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FloorEquipment } from "@/server/queries/floor";

/** Tabulka zařízení patra (respektuje filtry); klik na řádek otevře rychlý náhled. */
export function FloorEquipmentTable({
  equipment,
  selectedId,
  onSelect,
}: {
  equipment: FloorEquipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tag</TableHead>
            <TableHead>Název</TableHead>
            <TableHead className="hidden md:table-cell">Typ</TableHead>
            <TableHead>Stav</TableHead>
            <TableHead className="hidden lg:table-cell">Revize</TableHead>
            <TableHead className="hidden sm:table-cell">Otevřená změna</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipment.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
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
                  className={cn("h-12 cursor-pointer", item.id === selectedId && "bg-primary/10")}
                >
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
                    <StatusBadge kind="equipment" status={item.status} />
                  </TableCell>
                  <TableCell className="hidden font-mono lg:table-cell">{item.activeRevision?.version ?? "—"}</TableCell>
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
