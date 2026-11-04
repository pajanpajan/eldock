"use client";

import { Plus, Trash2 } from "lucide-react";

import { SCHEDULE_APPLIANCES, applianceLabel, type ScheduleRoom } from "@/engine/room-schedule";
import { cn } from "@/lib/utils";

// Soupis místností pro návrh rozváděče (fáze 48, most „půdorys → rozváděč“ z fáze 44).

const COUNTS: { key: "singleSockets" | "doubleSockets" | "lights" | "switchPlaces"; label: string; short: string; max: number }[] = [
  { key: "singleSockets", label: "Jednozásuvky", short: "1× zás.", max: 30 },
  { key: "doubleSockets", label: "Dvojzásuvky", short: "2× zás.", max: 30 },
  { key: "lights", label: "Světla", short: "Světla", max: 30 },
  { key: "switchPlaces", label: "Ovládací místa světel", short: "Ovl. míst", max: 6 },
];

const numberClass = "h-8 w-full rounded-md border border-input bg-transparent px-1.5 text-center text-sm tabular-nums dark:bg-input/30";

export function ScheduleEditor({ rooms, onChange }: { rooms: ScheduleRoom[]; onChange: (rooms: ScheduleRoom[]) => void }) {
  const update = (index: number, patch: Partial<ScheduleRoom>) => onChange(rooms.map((room, i) => (i === index ? { ...room, ...patch } : room)));
  return (
    <div className="flex flex-col gap-2" data-testid="schedule-editor">
      <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card text-muted-foreground">
            <tr>
              <th className="px-1.5 py-1 text-left font-medium">Místnost</th>
              <th className="px-1 py-1 font-medium" title="Vzdálenost od rozváděče po trase kabelu">m</th>
              {COUNTS.map((count) => (
                <th key={count.key} className="px-1 py-1 font-medium" title={count.label}>
                  {count.short}
                </th>
              ))}
              <th className="w-8" aria-label="Odebrat" />
            </tr>
          </thead>
          <tbody>
            {rooms.map((room, index) => (
              <tr key={index} className="border-t border-border align-top">
                <td className="px-1.5 py-1" colSpan={1}>
                  <input value={room.name} maxLength={40} onChange={(event) => update(index, { name: event.target.value })} className={cn(numberClass, "min-w-24 text-left")} aria-label={`Název místnosti ${index + 1}`} />
                  <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label={`Spotřebiče – ${room.name || `místnost ${index + 1}`}`}>
                    {SCHEDULE_APPLIANCES.map((tag) => {
                      const on = room.appliances.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          aria-pressed={on}
                          onClick={() => update(index, { appliances: on ? room.appliances.filter((value) => value !== tag) : [...room.appliances, tag] })}
                          className={cn("rounded border px-1 py-0.5 text-[10px] leading-tight", on ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                        >
                          {applianceLabel(tag)}
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td className="w-14 px-1 py-1">
                  <input type="number" min={1} max={100} step={0.5} value={room.distanceM} onChange={(event) => update(index, { distanceM: Number(event.target.value) })} className={numberClass} aria-label={`Vzdálenost od rozváděče [m] – ${room.name}`} />
                </td>
                {COUNTS.map((count) => (
                  <td key={count.key} className="w-14 px-1 py-1">
                    <input type="number" min={0} max={count.max} value={room[count.key]} onChange={(event) => update(index, { [count.key]: Number(event.target.value) })} className={numberClass} aria-label={`${count.label} – ${room.name}`} />
                  </td>
                ))}
                <td className="px-1 py-1">
                  <button type="button" onClick={() => onChange(rooms.filter((_, i) => i !== index))} className="rounded p-1.5 text-muted-foreground hover:bg-red-500/15 hover:text-red-300" aria-label={`Odebrat místnost ${room.name}`}>
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => onChange([...rooms, { name: `Místnost ${rooms.length + 1}`, distanceM: 6, singleSockets: 0, doubleSockets: 2, lights: 1, switchPlaces: 1, appliances: [] }])}
        className="flex w-fit items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
        disabled={rooms.length >= 30}
      >
        <Plus className="size-3.5" aria-hidden /> Přidat místnost
      </button>
    </div>
  );
}
