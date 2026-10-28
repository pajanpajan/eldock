"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleSlash, FileUp, Hand, Loader2 } from "lucide-react";
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
import type { ChangeRequestStatus } from "@/generated/prisma/enums";
import { caeRevisionHref } from "@/lib/routes";
import { canPerform } from "@/lib/workflow/state-machine";
import { assignChangeRequestAction, cancelChangeRequestAction } from "@/server/actions/workflow";

/** Akce projektanta nad ticketem: Převzít, Nahrát novou revizi, Stornovat (podle stavového automatu). */
export function TicketActions({
  changeRequest,
  assignedToMe,
}: {
  changeRequest: { id: string; number: string; status: ChangeRequestStatus };
  assignedToMe: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { id, number, status } = changeRequest;

  const canAssign = canPerform("assign", "CAE_ENGINEER", status);
  const canUpload = canPerform("uploadRevision", "CAE_ENGINEER", status);
  const canCancel = canPerform("cancel", "CAE_ENGINEER", status);

  function assign() {
    startTransition(async () => {
      const result = await assignChangeRequestAction({ changeRequestId: id });
      if (result.ok) {
        toast.success(`Ticket ${number} převzat.`);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelChangeRequestAction({ changeRequestId: id, comment: reason });
      if (result.ok) {
        toast.success(`Ticket ${number} stornován, zařízení je opět zelené.`);
        setCancelOpen(false);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  if (!canAssign && !canUpload && !canCancel) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canAssign ? (
        <Button size="lg" variant={canUpload ? "outline" : "default"} className="touch-target gap-2" onClick={assign} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Hand className="size-4" />}
          Převzít
        </Button>
      ) : null}
      {canUpload ? (
        <Button asChild size="lg" className="touch-target gap-2">
          <Link href={caeRevisionHref(id)}>
            <FileUp className="size-4" />
            Nahrát novou revizi
          </Link>
        </Button>
      ) : null}
      {canCancel ? (
        <Button variant="ghost" size="lg" className="touch-target gap-2 text-muted-foreground" onClick={() => setCancelOpen(true)} disabled={pending}>
          <CircleSlash className="size-4" />
          Stornovat
        </Button>
      ) : null}
      {!assignedToMe && status === "IN_PROGRESS" ? (
        <p className="basis-full text-xs text-muted-foreground">Ticket řeší jiný projektant – nahráním revize ho převezmete vy.</p>
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stornovat ticket {number}?</DialogTitle>
            <DialogDescription>
              Požadavek se uzavře bez nové revize a zařízení se vrátí do stavu „Dokumentace aktuální“. Použijte např. u duplicity
              nebo změny, která se nakonec neprovedla.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Důvod (nepovinné)</Label>
            <Textarea id="cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={4000} rows={3} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="touch-target">
                Zpět
              </Button>
            </DialogClose>
            <Button variant="destructive" className="touch-target gap-2" onClick={cancel} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <CircleSlash className="size-4" />}
              Stornovat ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
