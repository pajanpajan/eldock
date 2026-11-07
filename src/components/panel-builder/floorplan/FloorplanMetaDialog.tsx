"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { FloorplanMetaState } from "./useFloorplanSync";

/** Fáze 64: název půdorysu, zákazník a místo stavby (seznam půdorysů i lišta editoru). */
export function FloorplanMetaDialog({
  open,
  onOpenChange,
  meta,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meta: FloorplanMetaState;
  /** Vrací chybovou hlášku, nebo null. */
  onSave: (meta: FloorplanMetaState) => Promise<string | null>;
}) {
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    const next: FloorplanMetaState = {
      name: String(form.get("name") ?? "").trim(),
      customerName: String(form.get("customer") ?? "").trim() || null,
      installationSite: String(form.get("site") ?? "").trim() || null,
    };
    if (!next.name) return void toast.error("Zadejte název půdorysu.");
    setPending(true);
    const error = await onSave(next);
    setPending(false);
    if (error) return void toast.error(error);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="floorplan-meta-dialog">
        <DialogHeader>
          <DialogTitle>Údaje půdorysu</DialogTitle>
          <DialogDescription>Název, zákazník a místo stavby – zákazník a místo se předvyplní i při generování rozváděče.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="fpm-name">Název půdorysu</Label>
            <Input id="fpm-name" name="name" required maxLength={120} defaultValue={meta.name} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="fpm-customer">Zákazník</Label>
              <Input id="fpm-customer" name="customer" maxLength={120} defaultValue={meta.customerName ?? ""} placeholder="nepovinné" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="fpm-site">Místo stavby</Label>
              <Input id="fpm-site" name="site" maxLength={120} defaultValue={meta.installationSite ?? ""} placeholder="nepovinné" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Zrušit
            </Button>
            <Button type="submit" disabled={pending} className="gap-1.5">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Uložit údaje
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
