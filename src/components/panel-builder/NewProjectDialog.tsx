"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImageIcon, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MANUFACTURER_OPTIONS, MIX } from "@/lib/panel-builder/catalog";
import { resizeImage, uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { createPanelProjectAction } from "@/server/actions/panel-builder";

const selectClass = "h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";
/** Ukázková fotka referenčního rozváděče (seed PB-001). */
export const SAMPLE_PHOTO = "/api/files/photos/seed/panel-pb-001.svg";

/** Nový projekt rozváděče z fotky – po založení se fotka hned analyzuje (Gemini / demo). */
export function NewProjectDialog() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function pickPhoto(file: File) {
    setUploading(true);
    try {
      const uploaded = await uploadFile("photo", await resizeImage(file, 2400));
      setPhoto({ url: uploaded.url, name: file.name });
    } catch {
      toast.error("Fotku se nepodařilo nahrát.");
    } finally {
      setUploading(false);
    }
  }

  function submit(form: FormData) {
    startTransition(async () => {
      const result = await createPanelProjectAction({
        name: String(form.get("name") ?? ""),
        customerName: String(form.get("customer") ?? "") || null,
        photoUrl: photo?.url ?? null,
        dominantManufacturer: String(form.get("manufacturer") ?? MIX),
        dinRailsCount: Number(form.get("rails")),
        modulesPerRail: Number(form.get("modules")),
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.data.mode === "GEMINI" ? "Fotka analyzována přes Gemini." : "Fotka analyzována (Demo AI režim).");
      if (result.data.warning) toast.warning(result.data.warning);
      setOpen(false);
      router.push(`/panel-builder/${result.data.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="touch-target gap-2">
          <Plus className="size-4" aria-hidden /> Nový projekt z fotky
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nový projekt rozváděče</DialogTitle>
          <DialogDescription>Vyfoťte otevřený rozváděč (dvířka pryč, celé DIN lišty v záběru). AI rozpozná přístroje zleva doprava.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pb-name">Název rozváděče</Label>
            <Input id="pb-name" name="name" required maxLength={120} placeholder="např. Podružný rozváděč RP2 – dílna" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pb-customer">Zákazník / objekt</Label>
            <Input id="pb-customer" name="customer" maxLength={120} placeholder="nepovinné" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pb-manufacturer">Převažující výrobce (nápověda pro AI)</Label>
            <select id="pb-manufacturer" name="manufacturer" className={selectClass} defaultValue={MIX} aria-describedby="pb-manufacturer-hint">
              {MANUFACTURER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p id="pb-manufacturer-hint" className="text-xs text-muted-foreground">
              Ponechte „Různí výrobci“, pokud jsou v rozváděči přístroje od více značek. Výběrem konkrétní značky pomůžete AI upřednostnit její katalog při horší čitelnosti.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pb-rails">DIN lišt</Label>
              <Input id="pb-rails" name="rails" type="number" min={1} max={12} defaultValue={3} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pb-modules">Modulů na lištu</Label>
              <Input id="pb-modules" name="modules" type="number" min={4} max={48} defaultValue={12} />
            </div>
          </div>

          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            aria-label="Fotka rozváděče"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void pickPhoto(file);
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className={cn("touch-target h-14 gap-2", photo && photo.url !== SAMPLE_PHOTO && "border-primary")} onClick={() => input.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />} Vyfotit / nahrát
            </Button>
            <Button type="button" variant="outline" className={cn("touch-target h-14 gap-2", photo?.url === SAMPLE_PHOTO && "border-primary")} onClick={() => setPhoto({ url: SAMPLE_PHOTO, name: "Ukázková fotka" })}>
              <ImageIcon className="size-4" aria-hidden /> Ukázková fotka
            </Button>
          </div>
          {photo ? <p className="text-xs text-muted-foreground">Fotka: {photo.name}</p> : null}

          <Button type="submit" className="touch-target gap-2" disabled={pending || uploading || !photo}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Založit a analyzovat fotku
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
