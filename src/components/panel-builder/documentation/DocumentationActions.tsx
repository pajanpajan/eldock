"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Printer, Rocket } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { releaseDocumentationAction } from "@/server/actions/panel-builder";

/** QR kód na výrobním štítku (vede na kartu rozváděče v Eldocku). */
export function CeLabelQr({ value }: { value: string }) {
  return <QRCodeSVG value={value} level="M" marginSize={0} className="size-full" title="QR kód – karta rozváděče v Eldocku" />;
}

const selectClass = "h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";

export interface ReleaseTarget {
  id: string;
  tag: string;
  label: string;
}

/** Lišta kroku 4: tisk / export PDF a propuštění pasportu ke kartě rozváděče. */
export function DocumentationActions({
  projectId,
  released,
  blockers,
  targets,
}: {
  projectId: string;
  released: { equipmentId: string; tag: string; name: string } | null;
  blockers: string[];
  targets: ReleaseTarget[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [equipmentId, setEquipmentId] = useState(released?.equipmentId ?? targets[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  function release() {
    startTransition(async () => {
      const result = await releaseDocumentationAction(projectId, equipmentId);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Dokumentace propuštěna do provozu – přiřazena k rozváděči ${result.data.tag}.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="no-print flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button className="touch-target gap-2" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> Vytisknout / Exportovat kompletní PDF elaborát
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="touch-target gap-2">
              <Rocket className="size-4" aria-hidden /> Propustit dokumentaci do provozu (Přiřadit k zařízení v Eldocku)
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Propustit dokumentaci do provozu</DialogTitle>
              <DialogDescription>Pasport rozváděče se přiřadí ke kartě zařízení – údržba ho najde i přes QR kód na dvířkách.</DialogDescription>
            </DialogHeader>
            {blockers.length ? (
              <ul className="flex flex-col gap-1 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-100" data-testid="release-blockers">
                {blockers.map((blocker) => (
                  <li key={blocker} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {blocker}
                  </li>
                ))}
              </ul>
            ) : null}
            <label className="flex flex-col gap-1.5 text-sm">
              Rozváděč v Eldocku
              <select aria-label="Rozváděč v Eldocku" className={selectClass} value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)}>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>
            <Button className="touch-target gap-2" onClick={release} disabled={pending || !equipmentId || blockers.length > 0}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />} Propustit do provozu
            </Button>
          </DialogContent>
        </Dialog>
      </div>
      {released ? (
        <p className="flex items-center gap-2 text-sm text-emerald-300" data-testid="released">
          <CheckCircle2 className="size-4" aria-hidden /> Propuštěno do provozu – karta zařízení:{" "}
          <Link href={`/equipment/${released.equipmentId}`} className="underline underline-offset-2">
            {released.name}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
