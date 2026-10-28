"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Timer } from "lucide-react";
import { toast } from "sonner";

import { PhotoPicker } from "@/components/inspections/PhotoPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDateShort } from "@/lib/format";
import { TEMP_MOD_DAYS, tempModExpiry, type TempModDays } from "@/lib/temporary-mod";
import type { UploadedFile } from "@/lib/upload-client";
import { createTemporaryModAction } from "@/server/actions/temporary-mod";

const ROLES = ["Údržba", "Revizní technik"] as const;
const ITEM = "touch-target rounded-md border-0! px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

/** „⏱️ Zapsat dočasné provizorium (7–14 dní)“ – nemění dokumentaci ani nezakládá ticket pro CAE. */
export function TemporaryModDialog({ equipmentId, tag, version }: { equipmentId: string; tag: string; version: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState<TempModDays>(7);
  const [role, setRole] = useState<(typeof ROLES)[number]>("Údržba");
  const [photo, setPhoto] = useState<UploadedFile | null>(null);
  const valid = title.trim().length >= 3 && description.trim().length >= 3;

  function submit() {
    if (!valid) return;
    startTransition(async () => {
      const result = await createTemporaryModAction({ equipmentId, title, description, days, photoUrl: photo?.url ?? null, createdByRole: role });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Provizorium ${result.data.number} zapsáno k ${tag}.`, { description: `Odstranit nejpozději do ${formatDateShort(result.data.expiresAt)}.` });
      setOpen(false);
      setTitle("");
      setDescription("");
      setPhoto(null);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="lg" variant="outline" className="touch-target gap-2 border-violet-500/50 text-violet-200 hover:bg-violet-500/10" onClick={() => setOpen(true)}>
        ⏱️ Zapsat dočasné provizorium (7–14 dní)
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Dočasné provizorium – {tag}</DialogTitle>
            <DialogDescription>
              Oficiální dokumentace {version ?? ""} se nemění a CAE nedostane ticket. Obsluha uvidí výrazné varování, dokud provizorium neukončíte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mod-title">Co je provizorní</Label>
              <Input
                id="mod-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                placeholder="Např. Provizorní náhrada stykače K2 – čeká se na originální díl"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mod-description">Popis zapojení a bezpečnostní opatření</Label>
              <Textarea id="mod-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={4000} />
            </div>
            <div className="flex flex-wrap gap-6">
              <div className="space-y-2">
                <Label id="mod-days">Povinné odstranění do</Label>
                <ToggleGroup type="single" value={String(days)} onValueChange={(value) => value && setDays(Number(value) as TempModDays)} variant="outline" spacing={0} aria-labelledby="mod-days" className="border border-border bg-card/60 p-0.5">
                  {TEMP_MOD_DAYS.map((value) => (
                    <ToggleGroupItem key={value} value={String(value)} className={ITEM}>
                      {value} dní
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <p className="text-xs text-muted-foreground">Termín: {formatDateShort(tempModExpiry(new Date(), days))}</p>
              </div>
              <div className="space-y-2">
                <Label id="mod-role">Zapisuje</Label>
                <ToggleGroup type="single" value={role} onValueChange={(value) => value && setRole(value as (typeof ROLES)[number])} variant="outline" spacing={0} aria-labelledby="mod-role" className="border border-border bg-card/60 p-0.5">
                  {ROLES.map((value) => (
                    <ToggleGroupItem key={value} value={value} className={ITEM}>
                      {value}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>
            <PhotoPicker value={photo} onChange={setPhoto} label="Vyfotit provizorní zapojení (nepovinné)" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="touch-target">
                Zrušit
              </Button>
            </DialogClose>
            <Button className="touch-target gap-2 bg-violet-500 text-white hover:bg-violet-400" onClick={submit} disabled={pending || !valid}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Timer className="size-4" />}
              Zapsat provizorium
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
