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
import { DEFAULT_RAIL_MODULES } from "@/lib/panel-builder/rails";
import { resizeImage, uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { createPanelProjectAction } from "@/server/actions/panel-builder";

const selectClass = "h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";
/** Ukázková fotka referenčního rozváděče (seed PB-001). */
export const SAMPLE_PHOTO = "/api/files/photos/seed/panel-pb-001.svg";

type Mode = "DESIGN" | "PHOTO";

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "DESIGN", label: "📐 Navrhnout nový rozváděč od nuly (bez fotky)", hint: "Čisté 2D vektorové plátno s 1 DIN lištou 12M – přístroje vkládáte z databáze prvků." },
  { value: "PHOTO", label: "📷 Pasportizovat rozváděč z fotky (AI Vision)", hint: "Vyfoťte otevřený rozváděč (dvířka pryč, celé DIN lišty v záběru). AI rozpozná přístroje zleva doprava." },
];

/** Nový projekt rozváděče: návrh od nuly (výchozí pro projekci) nebo pasportizace z fotky s okamžitou analýzou. */
export function NewProjectDialog({ credits = null }: { credits?: number | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("DESIGN");
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const design = mode === "DESIGN";

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
        photoUrl: design ? null : (photo?.url ?? null),
        dominantManufacturer: design ? MIX : String(form.get("manufacturer") ?? MIX),
        dinRailsCount: design ? 1 : Number(form.get("rails")),
        modulesPerRail: design ? DEFAULT_RAIL_MODULES : Number(form.get("modules")),
        designMode: mode,
      });
      if (!result.ok) return void toast.error(result.error);
      if (result.data.design) toast.success("Návrh založen – 1 DIN lišta 12M, vkládejte přístroje z pravého menu.");
      else toast.success(result.data.mode === "GEMINI" ? "Fotka analyzována přes Gemini." : "Fotka analyzována (Demo AI režim).");
      if (result.data.warning) toast.warning(result.data.warning);
      setOpen(false);
      router.push(`/panel-builder/${result.data.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="touch-target gap-2" disabled={credits !== null && credits <= 0} title={credits !== null && credits <= 0 ? "Došly testovací kredity" : credits !== null ? `Spotřebuje 1 kredit (zbývá ${credits})` : undefined}>
          <Plus className="size-4" aria-hidden /> Nový projekt rozváděče
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nový projekt rozváděče</DialogTitle>
          <DialogDescription>{MODES.find((option) => option.value === mode)?.hint}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2" role="group" aria-label="Režim projektu">
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={mode === option.value}
              onClick={() => setMode(option.value)}
              className={cn(
                "touch-target min-h-12 rounded-lg border-2 px-3 text-left text-sm font-bold transition-colors",
                mode === option.value ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
              )}
            >
              [ {option.label} ]
            </button>
          ))}
        </div>
        <form action={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pb-name">Název rozváděče</Label>
            <Input id="pb-name" name="name" required maxLength={120} placeholder={design ? "např. Rozvodnice RD1 – rodinný dům" : "např. Podružný rozváděč RP2 – dílna"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pb-customer">Zákazník / objekt</Label>
            <Input id="pb-customer" name="customer" maxLength={120} placeholder="nepovinné" />
          </div>
          {design ? (
            <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              Začínáte s <b className="text-foreground">1 DIN lištou na 12 modulů</b>. Šířku řady (8–36M) i další lišty nastavíte přímo na plátně, skříň vyberete podle velikosti návrhu.
            </p>
          ) : (
            <>
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
            </>
          )}

          <Button type="submit" className="touch-target gap-2" disabled={pending || uploading || (!design && !photo)}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {design ? "📐 Založit návrh rozváděče" : "Založit a analyzovat fotku"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
