"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Move, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteEquipmentAction, equipmentImpactAction } from "@/server/actions/buildings";
import type { EquipmentImpact } from "@/server/services/buildings";

// Fáze 108: vybrané zařízení v hale – přesun (Studio nad tímto patrem, zařízení jde přetáhnout do jiné místnosti)
// a smazání s potvrzením (se záznamy revizí jen po opsání označení).

export function EquipmentManageActions({ equipment, studioHref, onDone }: { equipment: { id: string; tag: string; name: string }; studioHref: string; onDone: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<EquipmentImpact | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void equipmentImpactAction(equipment.id).then((result) => {
      if (!alive) return;
      if (result.ok) setImpact(result.data);
      else setError(result.error);
    });
    return () => {
      alive = false;
    };
  }, [open, equipment.id]);

  const typedNeeded = Boolean(impact && (impact.inspections || impact.documents));
  const typedOk = !typedNeeded || typed.trim().toUpperCase() === equipment.tag.toUpperCase();

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteEquipmentAction({ equipmentId: equipment.id, confirmTag: typed || null });
      if (!result.ok) return setError(result.error);
      toast.success(`Zařízení ${equipment.tag} bylo smazáno.`);
      setOpen(false);
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-2 gap-2" data-testid="equipment-manage">
      <Button asChild variant="outline" className="touch-target gap-1.5">
        <Link href={studioHref} data-testid="equipment-move">
          <Move className="size-4" aria-hidden /> Přesunout
        </Link>
      </Button>
      <Button type="button" variant="outline" className="touch-target gap-1.5 border-red-500/50 text-red-300 hover:text-red-200" onClick={() => setOpen(true)} data-testid="equipment-delete">
        <Trash2 className="size-4" aria-hidden /> Smazat
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" data-testid="equipment-delete-dialog">
          <DialogHeader>
            <DialogTitle>🗑️ Smazat {equipment.tag}?</DialogTitle>
            <DialogDescription>{equipment.name} zmizí z podlaží i se svou historií (revize, dokumenty, výkresy). Smazání nejde vrátit.</DialogDescription>
          </DialogHeader>
          {impact ? (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              Smaže se: {impact.inspections} záznamů revizí, {impact.documents} dokumentů a výkresů.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Zjišťuji historii zařízení…
            </p>
          )}
          {typedNeeded ? (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Pro potvrzení opište označení „{equipment.tag}“
              <Input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" data-testid="equipment-delete-confirm" />
            </label>
          ) : null}
          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Zrušit
            </Button>
            <Button type="button" variant="destructive" disabled={pending || !impact || !typedOk} onClick={remove} className="gap-1.5" data-testid="equipment-delete-submit">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} Smazat zařízení
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
