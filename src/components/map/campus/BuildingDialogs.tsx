"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deletionSummary, mapRectToMeters, needsTypedConfirmation } from "@/lib/building-edit";
import { polygonBounds, type CampusSize } from "@/lib/campus-layout";
import { cn } from "@/lib/utils";
import { buildingImpactAction, deleteBuildingAction, updateBuildingAction, updateFloorAction } from "@/server/actions/buildings";
import type { BuildingImpact } from "@/server/services/buildings";

// Fáze 108: úprava a smazání budovy (seznam budov, mapa areálu, hlavička budovy / podlaží) a úprava podlaží.

export interface EditableBuilding {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  mapPolygon: string;
}

/** Klíče prohlížeče, které se smazanou budovou souvisí (budovy jsou v databázi; jen pojistka pro rozpracované koncepty). */
function forgetBuildingLocally(buildingId: string) {
  try {
    const stale: string[] = [];
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index);
      if (key && (key.includes(buildingId) || (window.localStorage.getItem(key) ?? "").includes(buildingId))) stale.push(key);
    }
    for (const key of stale) window.localStorage.removeItem(key);
  } catch {
    // úložiště nedostupné – nic k úklidu
  }
}

const num = (value: string) => Number(value.replace(",", "."));

export function BuildingEditDialog({ open, onOpenChange, building, campus }: { open: boolean; onOpenChange: (open: boolean) => void; building: EditableBuilding; campus: CampusSize }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const meters = mapRectToMeters(polygonBounds(building.mapPolygon), campus);
  const [form, setForm] = useState({ name: building.name, code: building.code, shortName: building.shortName ?? "", x: String(meters.x), y: String(meters.y), w: String(meters.w), h: String(meters.h) });
  const [error, setError] = useState<string | null>(null);
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value })) });

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const map = { x: num(form.x), y: num(form.y), w: num(form.w), h: num(form.h) };
    if (Object.values(map).some((value) => !Number.isFinite(value))) return setError("Poloha a rozměr musí být čísla v metrech.");
    startTransition(async () => {
      const result = await updateBuildingAction({ buildingId: building.id, name: form.name, code: form.code, shortName: form.shortName || null, map });
      if (!result.ok) return setError(result.error);
      toast.success(`Budova ${result.data.code} – ${result.data.name} upravena.`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="building-edit-dialog">
        <DialogHeader>
          <DialogTitle>✏️ Upravit budovu</DialogTitle>
          <DialogDescription>
            Název, kód a poloha na mapě areálu v metrech pozemku ({campus.width} × {campus.height} m). Budova nesmí přesahovat areál ani se překrývat s jinou halou.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-6">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-4">
            Název budovy
            <Input {...field("name")} maxLength={80} data-testid="building-edit-name" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
            Kód
            <Input {...field("code")} maxLength={4} className="font-mono uppercase" data-testid="building-edit-code" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-6">
            Zkrácený název na mapě (nepovinné)
            <Input {...field("shortName")} maxLength={40} data-testid="building-edit-short" />
          </label>
          {(
            [
              ["x", "X – levý okraj [m]"],
              ["y", "Y – horní okraj [m]"],
              ["w", "Šířka (osa X) [m]"],
              ["h", "Hloubka (osa Y) [m]"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-3">
              {label}
              <Input {...field(key)} inputMode="decimal" data-testid={`building-edit-${key}`} />
            </label>
          ))}
          {error ? (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200 sm:col-span-6" role="alert" data-testid="building-edit-error">
              {error}
            </p>
          ) : null}
          <DialogFooter className="sm:col-span-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Zrušit
            </Button>
            <Button type="submit" disabled={pending} className="gap-1.5" data-testid="building-edit-save">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Uložit budovu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BuildingDeleteDialog({ open, onOpenChange, building, plantId }: { open: boolean; onOpenChange: (open: boolean) => void; building: Pick<EditableBuilding, "id" | "code" | "name">; plantId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [impact, setImpact] = useState<BuildingImpact | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void buildingImpactAction(building.id).then((result) => {
      if (!alive) return;
      if (result.ok) setImpact(result.data);
      else setError(result.error);
    });
    return () => {
      alive = false;
    };
  }, [open, building.id]);

  const typedNeeded = impact ? needsTypedConfirmation(impact) : true;
  const typedOk = !typedNeeded || typed.trim().toLocaleLowerCase("cs") === building.name.trim().toLocaleLowerCase("cs");

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteBuildingAction({ buildingId: building.id, confirmName: typed || null });
      if (!result.ok) return setError(result.error);
      forgetBuildingLocally(building.id);
      toast.success(`Budova ${building.code} – ${building.name} byla smazána.`);
      onOpenChange(false);
      router.push(`/plant/${plantId}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="building-delete-dialog">
        <DialogHeader>
          <DialogTitle>🗑️ Odstranit budovu {building.code} – {building.name}?</DialogTitle>
          <DialogDescription>Smazání nejde vrátit. S budovou zmizí její podlaží, zařízení a všechny jejich záznamy (revize, dokumenty, výkresy, požadavky na změnu).</DialogDescription>
        </DialogHeader>
        {impact ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100" data-testid="building-delete-impact">
            Smaže se: {deletionSummary(impact)}.
            {impact.inspections || impact.documents ? " Doklady o revizích musí provozovatel archivovat – před smazáním si stáhněte export dat firmy (Účty → Data firmy)." : ""}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Zjišťuji, co budova obsahuje…
          </p>
        )}
        {impact && typedNeeded ? (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Pro potvrzení opište název budovy „{building.name}“
            <Input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" data-testid="building-delete-confirm" />
          </label>
        ) : null}
        {error ? (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert" data-testid="building-delete-error">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
          <Button type="button" variant="destructive" disabled={pending || !impact || !typedOk} onClick={remove} className="gap-1.5" data-testid="building-delete-submit">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} Odstranit budovu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FloorEditDialog({ open, onOpenChange, floor }: { open: boolean; onOpenChange: (open: boolean) => void; floor: { id: string; name: string; description: string | null } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(floor.name);
  const [description, setDescription] = useState(floor.description ?? "");
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateFloorAction({ floorId: floor.id, name, description: description || null });
      if (!result.ok) return setError(result.error);
      toast.success(`Podlaží „${name}“ uloženo.`);
      onOpenChange(false);
      router.refresh();
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="floor-edit-dialog">
        <DialogHeader>
          <DialogTitle>✏️ Upravit podlaží</DialogTitle>
          <DialogDescription>Název podlaží („1. NP - Výroba“) a krátký popis.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Název podlaží
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} data-testid="floor-edit-name" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Popis (nepovinné)
            <Input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} />
          </label>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending} data-testid="floor-edit-save">
              Uložit podlaží
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Ikony ✏️ / 🗑️ u karty budovy v seznamu (a jejich dialogy). */
export function BuildingCardActions({ building, campus, plantId, className }: { building: EditableBuilding; campus: CampusSize; plantId: string; className?: string }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  return (
    <span className={cn("flex shrink-0 items-center gap-1", className)}>
      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Upravit budovu ${building.name}`} title="✏️ Upravit (název, kód, rozměr a poloha)" onClick={() => setDialog("edit")} data-testid="building-edit">
        <Pencil className="size-4" aria-hidden />
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" className="text-red-300 hover:text-red-200" aria-label={`Odstranit budovu ${building.name}`} title="🗑️ Odstranit budovu" onClick={() => setDialog("delete")} data-testid="building-delete">
        <Trash2 className="size-4" aria-hidden />
      </Button>
      {dialog === "edit" ? <BuildingEditDialog open onOpenChange={(open) => !open && setDialog(null)} building={building} campus={campus} /> : null}
      {dialog === "delete" ? <BuildingDeleteDialog open onOpenChange={(open) => !open && setDialog(null)} building={building} plantId={plantId} /> : null}
    </span>
  );
}

/**
 * Fáze 108: hlavička budovy / podlaží – ← Zpět na mapu závodu, ✏️ Upravit budovu / podlaží (nabídka) a červené
 * 🗑️ Odstranit tuto budovu (po potvrzení zpět na mapu závodu). Úpravy jen s právem Studia (`canEdit`).
 */
export function BuildingHeaderActions({
  plantId,
  building,
  campus,
  floor = null,
  canEdit,
}: {
  plantId: string;
  building: EditableBuilding;
  campus: CampusSize;
  floor?: { id: string; name: string; description: string | null } | null;
  canEdit: boolean;
}) {
  const [dialog, setDialog] = useState<"building" | "floor" | "delete" | null>(null);
  const [menu, setMenu] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="building-header-actions">
      <Button asChild variant="outline" className="touch-target gap-1.5">
        <Link href={`/plant/${plantId}`} data-testid="back-to-plant">
          ← Zpět na mapu závodu
        </Link>
      </Button>
      {canEdit ? (
        <>
          <span className="relative">
            <Button type="button" variant="outline" className="touch-target gap-1.5" aria-haspopup="menu" aria-expanded={menu} onClick={() => (floor ? setMenu((open) => !open) : setDialog("building"))} data-testid="building-header-edit">
              <Pencil className="size-4" aria-hidden /> {floor ? "Upravit budovu / podlaží" : "Upravit budovu"}
            </Button>
            {menu && floor ? (
              <span role="menu" className="absolute top-full right-0 z-30 mt-1 flex w-64 flex-col gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-xl">
                <button type="button" role="menuitem" className="rounded-md px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => (setMenu(false), setDialog("building"))} data-testid="building-header-edit-building">
                  🏢 Budovu – název, kód, rozměr a poloha
                </button>
                <button type="button" role="menuitem" className="rounded-md px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => (setMenu(false), setDialog("floor"))} data-testid="building-header-edit-floor">
                  🧱 Podlaží – název a popis
                </button>
              </span>
            ) : null}
          </span>
          <Button type="button" variant="destructive" className="touch-target gap-1.5" onClick={() => setDialog("delete")} data-testid="building-header-delete">
            <Trash2 className="size-4" aria-hidden /> Odstranit tuto budovu
          </Button>
        </>
      ) : null}
      {dialog === "building" ? <BuildingEditDialog open onOpenChange={(open) => !open && setDialog(null)} building={building} campus={campus} /> : null}
      {dialog === "floor" && floor ? <FloorEditDialog open onOpenChange={(open) => !open && setDialog(null)} floor={floor} /> : null}
      {dialog === "delete" ? <BuildingDeleteDialog open onOpenChange={(open) => !open && setDialog(null)} building={building} plantId={plantId} /> : null}
    </div>
  );
}
