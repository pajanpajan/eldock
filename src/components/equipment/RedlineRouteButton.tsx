"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { RedlineRoutingChoice, initialRouting, routingInput, type RoutingState } from "@/components/change-request/RedlineRoutingChoice";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { routeRedlineAction } from "@/server/actions/redlines";

/** Fáze 116: „🌐 Odeslat k překreslení projektantovi / do Poolu“ u už odeslané Červenky (záložka ✏️ Červenky stroje). */
export function RedlineRouteButton({ changeRequestId, number, designer }: { changeRequestId: string; number: string; designer: { name: string | null; email: string | null } | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [routing, setRouting] = useState<RoutingState>(initialRouting);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await routeRedlineAction({ changeRequestId, ...routingInput(routing) });
      if (!result.ok) return setError(result.error);
      toast.success(result.data.mode === "POOL" ? `${number} je v ELDOCK Poolu – čeká na přijetí projektantem.` : `${number} předáno firemnímu projektantovi.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" size="sm" className="h-8 gap-1.5 px-2" onClick={() => setOpen(true)} data-testid="redline-route">
        🌐 Odeslat k překreslení projektantovi / do Poolu
      </Button>
      <Dialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl" data-testid="redline-route-dialog">
          <DialogHeader>
            <DialogTitle>🌐 Překreslení Červenky {number}</DialogTitle>
            <DialogDescription>Firemní projektant závodu dostane podklady e-mailem, v ELDOCK Poolu úkol převezme první schválený projektant.</DialogDescription>
          </DialogHeader>
          <RedlineRoutingChoice value={routing} onChange={setRouting} designer={designer} canConfigure={false} />
          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" className="gap-2" onClick={submit} disabled={pending} data-testid="redline-route-submit">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {routing.mode === "POOL" ? "🚀 Odeslat do ELDOCK Poolu" : "Předat firemnímu projektantovi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
