"use client";

import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Úvodní stránka (fáze 48): náhled vzorového 6listového elaborátu rozváděče bez registrace. */
export function SampleElaborateDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="touch-target h-11 gap-2 px-5 text-sm" data-testid="sample-elaborate">
          <FileText className="size-4" aria-hidden /> 📄 Prohlédnout vzorový 6listový PDF elaborát rozváděče
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[92vh] flex-col gap-3 p-4 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Vzorový elaborát rozváděče PB-001</DialogTitle>
          <DialogDescription>
            Titulní list, 2D osazení, 1P schéma, kusovník, výpočet oteplení dle ČSN EN IEC 61439 a EU prohlášení o shodě s CE štítkem – přesně to, co AI Panel Builder vygeneruje pro váš rozváděč.
          </DialogDescription>
        </DialogHeader>
        <iframe src="/ukazka-elaboratu?embed=1" title="Vzorový 6listový elaborát rozváděče" className="min-h-0 w-full flex-1 rounded-lg border border-border bg-zinc-900" loading="lazy" />
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/ukazka-elaboratu" target="_blank">
              <ExternalLink className="size-4" aria-hidden /> Otevřít na celou stránku / tisk do PDF
            </Link>
          </Button>
          <Button asChild>
            <Link href="/panel-builder/auth">🚀 Vytvořit vlastní elaborát</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
