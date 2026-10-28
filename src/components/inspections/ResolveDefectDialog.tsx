"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { resolveDefectAction } from "@/server/actions/temporary-mod";

import { PhotoPicker } from "./PhotoPicker";

/** „✅ Potvrdit odstranění závady“ – popis opravy + volitelná fotka. */
export function ResolveDefectDialog({ defectId, description }: { defectId: string; description: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<UploadedFile | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await resolveDefectAction({ defectId, note, photoUrl: photo?.url ?? null });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Odstranění závady potvrzeno.");
      setOpen(false);
      setNote("");
      setPhoto(null);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" className="h-10 gap-1.5 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10" onClick={() => setOpen(true)}>
        ✅ Potvrdit odstranění závady
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Potvrdit odstranění závady</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`defect-note-${defectId}`}>
                Jak byla závada odstraněna <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id={`defect-note-${defectId}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="Např. Doplněn kryt IP2X, štítek jističe F3 vytištěn a nalepen."
              />
            </div>
            <PhotoPicker value={photo} onChange={setPhoto} label="Vyfotit opravu (nepovinné)" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="touch-target">
                Zpět
              </Button>
            </DialogClose>
            <Button className="touch-target gap-2 bg-emerald-500 text-emerald-950 hover:bg-emerald-400" onClick={submit} disabled={pending || note.trim().length < 3}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
              Potvrdit odstranění
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
