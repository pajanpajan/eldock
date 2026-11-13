"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HLIDAC_MODES, HLIDAC_PALETTE, type HlidacMode } from "@/lib/hlidac";
import { cn } from "@/lib/utils";
import { addHlidacDeviceAction, createHlidacBuildingAction, setHlidacModeAction } from "@/server/actions/hlidac";
import type { HlidacDevice, HlidacOverview } from "@/server/services/hlidac";

import { useDeviceDetail } from "./DeviceDetailDialog";

const STATE_BADGE: Record<string, string> = {
  VALID: "border-emerald-500/50 text-emerald-300",
  DUE_SOON: "border-amber-500/60 text-amber-200",
  OVERDUE: "border-red-500/60 text-red-300",
  FAILED: "border-red-500/60 text-red-300",
  MISSING: "border-zinc-500/60 text-zinc-300",
};
const czDate = (iso: string) => new Date(iso).toLocaleDateString("cs-CZ");

/**
 * Fáze 111: pracovní plocha Hlídače revizí – režim objektu, budovy → patra → místnosti, rychlé nakreslení budovy
 * s patry a místnostmi, paleta spotřebičů na 1 klik do zvolené místnosti a seznam zařízení s lhůtou revize a detailem
 * (2 fotky, AI čtečka výrobního štítku, identifikační štítek).
 */
export function HlidacWorkspace({ plant, plants, mode: initialMode, overview, canEdit, canStructure }: { plant: { id: string; name: string }; plants: { id: string; name: string }[]; mode: HlidacMode; overview: HlidacOverview; canEdit: boolean; canStructure: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<HlidacMode>(initialMode);
  const [pending, startTransition] = useTransition();
  const firstRoom = overview.flatMap((building) => building.floors.flatMap((floor) => floor.rooms.map((room) => ({ floorId: floor.id, room: room.key })))).at(0) ?? null;
  const [selected, setSelected] = useState<{ floorId: string; room: string } | null>(firstRoom);
  const [creating, setCreating] = useState(overview.length === 0);
  const [name, setName] = useState("");
  const [floors, setFloors] = useState(() => [{ usage: "", rooms: HLIDAC_MODES[initialMode].rooms.join(", ") }]);
  const detail = useDeviceDetail();

  const current = selected ? overview.flatMap((building) => building.floors.map((floor) => ({ building, floor }))).find((entry) => entry.floor.id === selected.floorId) ?? null : null;
  const room = current?.floor.rooms.find((candidate) => candidate.key === selected?.room) ?? null;

  function changeMode(next: HlidacMode) {
    setMode(next);
    startTransition(async () => {
      const result = await setHlidacModeAction(plant.id, next);
      if (!result.ok) toast.error(result.error);
    });
  }

  function createBuilding() {
    startTransition(async () => {
      const result = await createHlidacBuildingAction({ plantId: plant.id, mode, name, floors });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Budova ${result.data.code} „${name}“ založena (${result.data.floors} ${result.data.floors === 1 ? "patro" : result.data.floors < 5 ? "patra" : "pater"}) – vyberte místnost a osaďte spotřebiče.`);
      setCreating(false);
      setName("");
      setSelected(null);
      router.refresh();
    });
  }

  function addDevice(itemId: string) {
    if (!selected) return void toast.info("Vyberte nejdřív místnost vlevo.");
    startTransition(async () => {
      const result = await addHlidacDeviceAction({ floorId: selected.floorId, room: selected.room, itemId, mode });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${result.data.name} přidán · revize každých ${result.data.inspectionIntervalMonths} měsíců.`, { action: { label: "📷 Výrobní štítek", onClick: () => detail.open(result.data.id) } });
      router.refresh();
    });
  }

  const deviceRow = (device: HlidacDevice) => (
    <li key={device.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-sm" data-testid="hlidac-device">
      <span className="font-mono text-primary">{device.tag}</span>
      <span className="min-w-0 flex-1 truncate">{device.name.replace(`${device.tag} - `, "")}</span>
      <span className="text-xs text-muted-foreground">
        {device.protectionClass ? `tř. ${device.protectionClass}` : ""}
        {device.usageGroup ? ` · sk. ${device.usageGroup}` : ""} · {device.intervalMonths} měs.
      </span>
      {device.serialNumber ? <span className="font-mono text-xs text-muted-foreground">S/N {device.serialNumber}</span> : null}
      <span className={cn("rounded-full border px-2 py-0.5 text-xs", STATE_BADGE[device.state] ?? STATE_BADGE.MISSING)}>{device.validUntil ? `revize do ${czDate(device.validUntil)}` : "bez revize"}</span>
      <Button type="button" size="sm" variant={device.hasNameplate ? "outline" : "default"} className="gap-1.5" onClick={() => detail.open(device.id)} disabled={detail.loadingId === device.id} data-testid={`hlidac-device-detail-${device.tag}`}>
        {detail.loadingId === device.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Camera className="size-3.5" aria-hidden />} {device.hasNameplate ? "Detail & štítek" : "📷 Výrobní štítek"}
      </Button>
    </li>
  );

  return (
    <div className="flex flex-col gap-5" data-testid="hlidac-workspace">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Režim objektu">
        {(Object.keys(HLIDAC_MODES) as HlidacMode[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={mode === key}
            onClick={() => changeMode(key)}
            className={cn("rounded-xl border-2 px-4 py-2 text-left text-sm font-semibold", mode === key ? "border-primary bg-primary/15" : "border-border text-muted-foreground hover:text-foreground")}
            data-testid={`hlidac-mode-${key}`}
          >
            [ {HLIDAC_MODES[key].icon} {HLIDAC_MODES[key].title} ]
          </button>
        ))}
        {plants.length > 1 ? (
          <span className="ml-auto flex flex-wrap gap-1 text-xs">
            {plants.map((option) => (
              <Link key={option.id} href={`/hlidac-revizi?zavod=${option.id}`} className={cn("rounded-md border px-2 py-1", option.id === plant.id ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                {option.name}
              </Link>
            ))}
          </span>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3" aria-label="Budovy, patra a místnosti">
          {overview.map((building) => (
            <section key={building.id} className="rounded-xl border border-border bg-card p-3" data-testid="hlidac-building">
              <p className="font-semibold">
                <span className="font-mono text-primary">{building.code}</span> {building.name}
              </p>
              {building.floors.map((floor) => (
                <div key={floor.id} className="mt-2">
                  <p className="text-xs font-semibold text-muted-foreground">{floor.name}</p>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {floor.rooms.map((candidate) => {
                      const active = selected?.floorId === floor.id && selected.room === candidate.key;
                      return (
                        <li key={candidate.key}>
                          <button type="button" aria-pressed={active} onClick={() => setSelected({ floorId: floor.id, room: candidate.key })} className={cn("rounded-md border px-2 py-1 text-xs", active ? "border-primary bg-primary/15 font-semibold" : "border-border hover:border-primary/50")} data-testid={`hlidac-room-${candidate.name}`}>
                            {candidate.name} <span className="text-muted-foreground">({candidate.devices.length})</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          ))}
          {canStructure ? (
            creating ? (
              <section className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-primary/50 p-3" aria-label="Nová budova" data-testid="hlidac-new-building">
                <p className="font-semibold">➕ Nová budova, patra a místnosti</p>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={mode === "OFFICE" ? "např. Administrativní budova A" : "např. Výrobní hala 2"} maxLength={80} data-testid="hlidac-building-name" />
                {floors.map((floor, index) => (
                  <div key={index} className="flex flex-col gap-1 rounded-lg border border-border p-2">
                    <p className="text-xs font-semibold">{index + 1}. NP</p>
                    <Input value={floor.usage} onChange={(event) => setFloors((list) => list.map((row, position) => (position === index ? { ...row, usage: event.target.value } : row)))} placeholder="Využití patra (nepovinné)" maxLength={40} className="h-8 text-xs" />
                    <textarea
                      value={floor.rooms}
                      onChange={(event) => setFloors((list) => list.map((row, position) => (position === index ? { ...row, rooms: event.target.value } : row)))}
                      rows={2}
                      className="rounded-md border border-input bg-transparent p-2 text-xs"
                      aria-label={`Místnosti ${index + 1}. NP`}
                      data-testid={`hlidac-floor-rooms-${index}`}
                    />
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setFloors((list) => [...list, { usage: "", rooms: HLIDAC_MODES[mode].rooms.slice(0, 3).join(", ") }])} disabled={floors.length >= 10} data-testid="hlidac-add-floor">
                    <Plus className="size-3.5" aria-hidden /> Patro
                  </Button>
                  <Button type="button" size="sm" onClick={createBuilding} disabled={pending || name.trim().length < 3} data-testid="hlidac-building-create">
                    {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Založit budovu
                  </Button>
                  {overview.length ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
                      Zrušit
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">Místnosti oddělte čárkou nebo řádkem – každá dostane v půdorysu patra 6 × 5 m.</p>
              </section>
            ) : (
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => setCreating(true)} data-testid="hlidac-open-new-building">
                <Plus className="size-4" aria-hidden /> Nová budova / patra / místnosti
              </Button>
            )
          ) : null}
        </aside>

        <section className="flex min-w-0 flex-col gap-4" aria-label="Místnost a spotřebiče">
          {room && current ? (
            <>
              <h2 className="text-xl font-bold" data-testid="hlidac-room-title">
                {current.floor.name} – {room.name}
              </h2>
              {canEdit ? (
                <div className="grid gap-3 xl:grid-cols-3" data-testid="hlidac-palette">
                  {HLIDAC_PALETTE.map((group) => (
                    <div key={group.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3">
                      <p className="text-xs font-semibold text-muted-foreground">{group.title}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.items.map((item) => (
                          <button key={item.id} type="button" disabled={pending} onClick={() => addDevice(item.id)} className="rounded-lg border border-border px-2 py-1.5 text-left text-xs hover:border-primary hover:bg-primary/10 disabled:opacity-50" data-testid={`hlidac-palette-${item.id}`}>
                            {item.emoji} {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {room.devices.length ? (
                <ul className="flex flex-col gap-1.5" data-testid="hlidac-devices">
                  {room.devices.map(deviceRow)}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">V místnosti zatím nejsou žádné spotřebiče – přidejte je z palety na 1 klik.</p>
              )}
              {current.floor.unassigned.length ? (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Zařízení patra bez místnosti ({current.floor.unassigned.length})</summary>
                  <ul className="mt-2 flex flex-col gap-1.5">{current.floor.unassigned.map(deviceRow)}</ul>
                </details>
              ) : null}
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">{overview.length ? "Vyberte místnost vlevo." : "Začněte novou budovou – patra a místnosti nakliknete za pár vteřin."}</p>
          )}
        </section>
      </div>
      {detail.dialog}
    </div>
  );
}
