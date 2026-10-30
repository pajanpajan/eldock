"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Expand, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/common/StatusBadge";
import { InspectionStatusBadge } from "@/components/inspections/InspectionStatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EquipmentStatus, EquipmentType } from "@/generated/prisma/enums";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import type { InspectionSummary } from "@/lib/inspection";
import { resizeImage, uploadFile } from "@/lib/upload-client";
import { updateEquipmentPhotoAction } from "@/server/actions/equipment-card";

/**
 * Vizuální blok karty: velká fotografie (klik = detail), stav revize / dokumentace a nahrání
 * nebo výměna fotky z mobilu (zmenšení v prohlížeči → /api/uploads → Server Action).
 */
export function EquipmentPhotoCard({
  equipmentId,
  tag,
  name,
  type,
  photoUrl,
  inspection,
  documentStatus,
  canEdit,
}: {
  equipmentId: string;
  tag: string;
  name: string;
  type: EquipmentType;
  photoUrl: string | null;
  /** Stav revize (null = účet lhůtník nevidí). */
  inspection: InspectionSummary | null;
  /** Stav dokumentace (jen pevná zařízení; „V revizi“ dokumentace = oranžová / modrá). */
  documentStatus: EquipmentStatus | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = progress !== null || pending;
  const Icon = EQUIPMENT_TYPE_ICONS[type];

  async function onFile(file: File | undefined) {
    if (!file) return;
    setProgress(0);
    try {
      const resized = await resizeImage(file, 1600);
      const uploaded = await uploadFile("photo", resized, setProgress);
      startTransition(async () => {
        const result = await updateEquipmentPhotoAction({ equipmentId, photoUrl: uploaded.url });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(`Fotografie ${tag} uložena.`);
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fotku se nepodařilo nahrát.");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section aria-label="Fotografie zařízení" className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-[16/10] w-full bg-zinc-900">
        {photoUrl ? (
          <button type="button" onClick={() => setOpen(true)} className="group absolute inset-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Zobrazit fotografii ${tag} ve velkém`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- soubory z /api/files; SVG přes <img> nespouští skripty */}
            <img src={photoUrl} alt={`Fotografie ${name}`} className="size-full object-cover" data-testid="equipment-photo" />
            <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-md bg-zinc-950/80 px-2 py-1 text-xs text-zinc-100 opacity-80 transition-opacity group-hover:opacity-100">
              <Expand className="size-3.5" aria-hidden /> Detail
            </span>
          </button>
        ) : (
          <div className="bg-blueprint absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Icon className="size-14 opacity-60" aria-hidden />
            <span className="text-sm">Zařízení zatím nemá fotografii</span>
          </div>
        )}
        <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5">
          {inspection ? <InspectionStatusBadge summary={inspection} className="bg-zinc-950/85 backdrop-blur" /> : null}
          {documentStatus && documentStatus !== "ACTIVE" ? <StatusBadge kind="equipment" status={documentStatus} className="bg-zinc-950/85 backdrop-blur" /> : null}
        </div>
        {progress !== null ? (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-zinc-800" role="progressbar" aria-valuenow={progress} aria-label="Nahrávání fotografie">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <div className="flex items-center gap-2 border-t border-border p-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => onFile(event.target.files?.[0])} />
          <Button variant="outline" className="touch-target w-full gap-2" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            {photoUrl ? "Změnit fotografii" : "Nahrát fotografii"}
          </Button>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription>Fotografie zařízení {tag}</DialogDescription>
          </DialogHeader>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- soubory z /api/files
            <img src={photoUrl} alt={`Fotografie ${name}`} className="max-h-[75dvh] w-full rounded-lg object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
