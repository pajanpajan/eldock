"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2, Undo2 } from "lucide-react";
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
import { equipmentHref } from "@/lib/routes";
import { approveRevisionAction, rejectRevisionAction } from "@/server/actions/workflow";

const QUICK_REASONS = ["Schéma neodpovídá skutečnému zapojení.", "Chybí přečíslování svorek.", "Kusovník neobsahuje nový přístroj."];

/** Rozhodnutí údržby: „Potvrdit a propsat do systému“ nebo „Vrátit k přepracování“ (povinný komentář). */
export function ApprovalActions({
  changeRequestId,
  equipmentId,
  version,
  activeVersion,
}: {
  changeRequestId: string;
  equipmentId: string;
  version: string;
  activeVersion: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");
  const commentOk = comment.trim().length >= 3;

  function approve() {
    startTransition(async () => {
      const result = await approveRevisionAction({ changeRequestId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Revize ${result.data.version} je platná a propsaná do systému.`, {
        description: activeVersion ? `Revize ${activeVersion} přesunuta do archivu.` : undefined,
      });
      router.push(`${equipmentHref(equipmentId)}?tab=history`);
    });
  }

  function reject() {
    if (!commentOk) return;
    startTransition(async () => {
      const result = await rejectRevisionAction({ changeRequestId, comment });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Revize ${result.data.version} vrácena k přepracování.`, { description: "CAE projektant uvidí váš komentář v ticketu." });
      router.push(equipmentHref(equipmentId));
    });
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 pb-safe backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="lg" variant="outline" className="h-12 gap-2 border-red-500/50 text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => setDialog("reject")} disabled={pending}>
            <Undo2 className="size-5" />
            Vrátit k přepracování
          </Button>
          <Button size="lg" className="h-12 gap-2 bg-emerald-500 px-5 text-base font-semibold text-emerald-950 hover:bg-emerald-400" onClick={() => setDialog("approve")} disabled={pending}>
            <CircleCheck className="size-5" />
            Potvrdit a propsat do systému
          </Button>
        </div>
      </div>

      <Dialog open={dialog === "approve"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Potvrdit revizi {version}?</DialogTitle>
            <DialogDescription>
              Potvrzujete, že revize {version} odpovídá skutečnému zapojení v hale. Stane se platnou dokumentací
              {activeVersion ? `, revize ${activeVersion} se přesune do archivu` : ""} a zařízení zezelená.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="touch-target">
                Zpět
              </Button>
            </DialogClose>
            <Button className="touch-target gap-2 bg-emerald-500 text-emerald-950 hover:bg-emerald-400" onClick={approve} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
              Potvrdit a propsat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "reject"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vrátit revizi {version} k přepracování</DialogTitle>
            <DialogDescription>Napište projektantovi, co nesedí. Zařízení zůstane oranžové, dokud nepřijde opravená revize.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-comment">
              Důvod vrácení <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="reject-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="Např. Chybí přečíslování svorek X2 po výměně stykače."
              aria-invalid={comment.length > 0 && !commentOk ? true : undefined}
            />
            <div className="flex flex-wrap gap-2">
              {QUICK_REASONS.map((reason) => (
                <Button key={reason} type="button" variant="outline" size="sm" className="h-9" onClick={() => setComment((value) => (value.trim() ? `${value.trim()} ${reason}` : reason))}>
                  + {reason}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="touch-target">
                Zpět
              </Button>
            </DialogClose>
            <Button variant="destructive" className="touch-target gap-2" onClick={reject} disabled={pending || !commentOk}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
              Vrátit k přepracování
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
