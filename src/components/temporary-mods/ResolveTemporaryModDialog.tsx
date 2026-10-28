"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, FilePen, Loader2, Wrench } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { UploadedFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { convertTemporaryModAction, resolveTemporaryModOneToOneAction } from "@/server/actions/temporary-mod";

type Path = "ONE_TO_ONE" | "CONVERT";

/** „Ukončit a řádně nahradit provizorium“: 1:1 dle schématu, nebo předat CAE k zakreslení. */
export function ResolveTemporaryModDialog({ id, number, version }: { id: string; number: string; version: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<Path | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<UploadedFile | null>(null);
  const [pending, startTransition] = useTransition();
  const valid = path === "ONE_TO_ONE" || (path === "CONVERT" && note.trim().length >= 3);

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setPath(null);
      setNote("");
      setPhoto(null);
    }
  }

  function submit() {
    if (!valid || !path) return;
    startTransition(async () => {
      if (path === "ONE_TO_ONE") {
        const result = await resolveTemporaryModOneToOneAction({ id, note: note.trim() || null });
        if (!result.ok) return void toast.error(result.error);
        toast.success(`Provizorium ${result.data.number} ukončeno – zapojení 1:1 dle schématu.`, { description: `Dokumentace ${version ?? ""} zůstává beze změny.` });
      } else {
        const result = await convertTemporaryModAction({ id, note, photoUrl: photo?.url ?? null });
        if (!result.ok) return void toast.error(result.error);
        toast.success(`Provizorium ${result.data.number} ukončeno a předáno CAE.`, {
          description: result.data.appended
            ? `Doplněno do otevřeného požadavku ${result.data.changeRequestNumber}.`
            : `Založen požadavek na změnu ${result.data.changeRequestNumber}.`,
        });
      }
      reset(false);
      router.refresh();
    });
  }

  const option = (value: Path, tone: string, title: string, text: string, Icon: typeof CircleCheck) => (
    <button
      type="button"
      role="radio"
      aria-checked={path === value}
      onClick={() => setPath(value)}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        path === value ? tone : "border-border bg-card hover:bg-muted/50",
      )}
    >
      <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">{text}</span>
      </span>
    </button>
  );

  return (
    <>
      <Button size="lg" className="touch-target gap-2 bg-violet-500 text-white hover:bg-violet-400" onClick={() => setOpen(true)}>
        <Wrench className="size-4" aria-hidden />
        Ukončit a řádně nahradit provizorium
      </Button>
      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ukončit provizorium {number}</DialogTitle>
            <DialogDescription>Jak bylo provizorium nahrazeno?</DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Způsob ukončení" className="space-y-2">
            {option(
              "ONE_TO_ONE",
              "border-emerald-500/60 bg-emerald-500/10",
              "🟢 Nahrazeno 1:1 dle schématu (Bez zásahu do výkresu)",
              `Osazen originální díl podle platné dokumentace ${version ?? ""}. Provizorium se uzavře do archivu.`,
              CircleCheck,
            )}
            {option(
              "CONVERT",
              "border-orange-500/60 bg-orange-500/10",
              "🟠 Finální úprava se liší od schématu (Předat CAE projektantovi k zakreslení)",
              "Provizorium se uzavře a rovnou vznikne požadavek na změnu dokumentace s vaším popisem a fotkou.",
              FilePen,
            )}
          </div>
          {path ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="mod-resolution">
                  {path === "CONVERT" ? (
                    <>
                      Popis finálního zapojení <span className="text-red-400">*</span>
                    </>
                  ) : (
                    "Poznámka (nepovinné)"
                  )}
                </Label>
                <Textarea
                  id="mod-resolution"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder={path === "CONVERT" ? "Např. Osazen stykač jiného typu, přepojena svorka A2." : "Např. Dodán originální stykač Siemens, provizorium odstraněno."}
                />
              </div>
              {path === "CONVERT" ? <PhotoPicker value={photo} onChange={setPhoto} label="Vyfotit finální stav (nepovinné)" /> : null}
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="touch-target">
                Zpět
              </Button>
            </DialogClose>
            <Button className="touch-target gap-2" onClick={submit} disabled={pending || !valid}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
              {path === "CONVERT" ? "Ukončit a předat CAE" : "Ukončit provizorium"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
