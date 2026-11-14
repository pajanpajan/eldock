"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Printer, RefreshCw, TriangleAlert } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LABEL_SIZE_MM, formatQrToken } from "@/lib/qr-label";
import { regenerateQrLabelAction } from "@/server/actions/equipment-card";

import { QrLabelFace, type LabelData } from "./QrLabelFace";

/** Box „Přiřazený QR štítek“: náhled štítku, tisk na štítkovač a přegenerování kódu. */
export function QrLabelCard({ label, printHref, canEdit, compact = false }: { label: LabelData; printHref: string; canEdit: boolean; compact?: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState(false);
  const [pending, startTransition] = useTransition();

  function regenerate() {
    startTransition(async () => {
      const result = await regenerateQrLabelAction({ equipmentId: label.equipmentId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirm(false);
      toast.success(`Nový QR kód ${formatQrToken(result.data.qrToken)} přiřazen k ${label.tag}.`, { description: "Vytiskněte nový štítek a nahraďte jím původní." });
      router.refresh();
    });
  }

  const confirmDialog = (
    <Dialog open={confirm} onOpenChange={(open) => !pending && setConfirm(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-5 text-orange-400" aria-hidden />
            Přegenerovat QR kód?
          </DialogTitle>
          <DialogDescription>
            Opravdu chcete přegenerovat QR kód? Původní fyzický štítek na stroji {label.tag} přestane fungovat – po naskenování ohlásí neplatný štítek. Nový štítek je potřeba vytisknout a nalepit.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="touch-target" disabled={pending}>
              Zrušit
            </Button>
          </DialogClose>
          <Button className="touch-target gap-2" onClick={regenerate} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Přegenerovat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const print = () => window.open(printHref, "_blank", "noopener,width=720,height=560");

  if (compact) {
    return (
      <section id="qr-stitek" aria-labelledby="qr-stitek-title" className="flex max-h-[145px] min-h-[120px] scroll-mt-24 items-center gap-3 rounded-xl border border-border bg-card p-3" data-testid="identity-qr">
        <button type="button" onClick={() => setPreview(true)} className="shrink-0 rounded-lg bg-white p-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Náhled QR štítku ${label.tag}`}>
          <QRCodeSVG value={label.url} size={76} level="M" marginSize={0} />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p id="qr-stitek-title" className="text-xs font-semibold text-muted-foreground">
            Přiřazený QR štítek · {LABEL_SIZE_MM.width} × {LABEL_SIZE_MM.height} mm
          </p>
          <p className="truncate text-sm font-medium">
            {label.tag} {label.token ? <span className="font-mono text-xs text-muted-foreground">· {formatQrToken(label.token)}</span> : null}
          </p>
          <p className="truncate font-mono text-[11px] text-muted-foreground" data-testid="qr-label-url" title={label.url}>
            {label.url}
          </p>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={print}>
              <Printer className="size-3.5" /> 🖨️ Tisk QR
            </Button>
            {canEdit ? (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2 text-xs" onClick={() => setConfirm(true)}>
                <RefreshCw className="size-3.5" /> Přiřadit nový QR kód
              </Button>
            ) : null}
          </div>
        </div>
        <Dialog open={preview} onOpenChange={setPreview}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>QR štítek {label.tag}</DialogTitle>
              <DialogDescription>Náhled fyzického štítku {LABEL_SIZE_MM.width} × {LABEL_SIZE_MM.height} mm pro termotiskárnu.</DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-zinc-800/60 p-4">
              <QrLabelFace label={label} className="mx-auto w-full max-w-[26rem] shadow-lg shadow-black/40" />
            </div>
          </DialogContent>
        </Dialog>
        {confirmDialog}
      </section>
    );
  }

  return (
    <section id="qr-stitek" aria-labelledby="qr-stitek-title" className="flex scroll-mt-24 flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="qr-stitek-title" className="font-semibold">
          Přiřazený QR štítek
        </h2>
        <span className="text-xs text-muted-foreground">
          {LABEL_SIZE_MM.width} × {LABEL_SIZE_MM.height} mm
        </span>
      </div>

      <div className="rounded-lg bg-zinc-800/60 p-4">
        <QrLabelFace label={label} className="mx-auto w-full max-w-[26rem] shadow-lg shadow-black/40" />
      </div>
      <p className="font-mono text-xs break-all text-muted-foreground" data-testid="qr-label-url">
        {label.url}
      </p>

      <div className="mt-auto flex flex-wrap gap-2">
        <Button className="touch-target flex-1 gap-2" onClick={print}>
          <Printer className="size-4" />
          Vytisknout štítek
        </Button>
        {canEdit ? (
          <Button variant="outline" className="touch-target flex-1 gap-2" onClick={() => setConfirm(true)}>
            <RefreshCw className="size-4" />
            Přiřadit nový QR kód
          </Button>
        ) : null}
      </div>

      {confirmDialog}
    </section>
  );
}

