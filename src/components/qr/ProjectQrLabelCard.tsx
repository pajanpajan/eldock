"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { qrUrl } from "@/lib/qr-label-registry";
import { pairLabelAction } from "@/server/actions/switchboard-versions";

import { EldockLabelFace } from "./EldockQrLabel";

/**
 * Fáze 103: QR štítek ELDOCK rozváděče v kroku 4 (Štítky) – náhled 50 × 25 mm, tisk 1:1 na kotouč Zebra ZD421t nebo
 * arch A4; bez štítku spárování předtištěného štítku firmy (série z velínu), jinak se přidělí při prvním uzamčení verze.
 */
export function ProjectQrLabelCard({ projectId, serial, companyName }: { projectId: string; serial: string | null; companyName: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <section className="no-print flex flex-col gap-3 rounded-xl border border-border bg-card p-4" data-testid="project-qr-label" data-serial={serial ?? undefined}>
      <h2 className="font-semibold">🏷️ QR štítek ELDOCK rozváděče (50 × 25 mm – ČSN EN IEC 61439)</h2>
      {serial ? (
        <div className="flex flex-wrap items-center gap-4">
          <div className="rounded bg-white p-1">
            <EldockLabelFace code={serial} purpose="SWITCHBOARD" companyName={companyName} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
            <p>
              Po naskenování otevře kartu{" "}
              <Link href={`/q/${serial}`} className="font-mono underline" data-testid="project-qr-card-link">
                {qrUrl(serial)}
              </Link>{" "}
              s platnou uzamčenou verzí dokumentace a historií verzí.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href={`/panel-builder/${projectId}/labels/qr?format=roll`} target="_blank" rel="noreferrer" className="rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground" data-testid="project-qr-print-roll">
                🖨️ Tisk na kotouč Zebra ZD421t (PDF 1:1)
              </a>
              <a href={`/panel-builder/${projectId}/labels/qr?format=a4`} target="_blank" rel="noreferrer" className="rounded-md border border-border px-3 py-2">
                📄 Tisk na arch A4
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>Rozváděč zatím nemá QR štítek – globálně unikátní štítek EL-xxxxxx se přidělí automaticky při prvním uzamčení verze (krok 4 Dokumentace → Část pro revizního technika). Máte předtištěné štítky ze série ELDOCK? Spárujte jeden s tímto rozváděčem:</p>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await pairLabelAction(code, projectId);
                if (!result.ok) return void toast.error(result.error);
                toast.success(`Štítek ${result.data.serial} je spárovaný s rozváděčem.`);
                router.refresh();
              });
            }}
          >
            <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="EL-000123" className="h-10 w-40 font-mono" aria-label="Sériové číslo předtištěného štítku" data-testid="project-qr-code" />
            <Button type="submit" variant="outline" className="h-10 gap-2" disabled={pending || !/^EL-\d{6,9}$/.test(code.trim())} data-testid="project-qr-pair">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
              Spárovat štítek
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}
