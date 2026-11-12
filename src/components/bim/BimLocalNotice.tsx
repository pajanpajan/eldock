"use client";

import { useRef, useState } from "react";
import { Building2, FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Fáze 101: záruka lokálního zpracování BIM v okně importu (`.ifc` závodu i 2D půdorysu). Pravdivě podle kódu: soubor se
 * čte v prohlížeči (`File.text()`) a převádí parserem `parseIfc` v klientském JS – na server ani do žádné AI se neposílá;
 * do ELDOCKu se ukládá až převedený výsledek (`result`), který uživatel potvrdí.
 */
export function BimLocalNotice({ result, className }: { result: string; className?: string }) {
  return (
    <div role="note" className={cn("rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2.5 text-sm", className)} data-testid="bim-local-notice">
      <p className="font-semibold text-emerald-700 dark:text-emerald-300">🔒 100% Lokální a bezpečné zpracování (Zero-Cloud & Offline-ready):</p>
      <p className="mt-1 leading-snug text-foreground/90">
        Váš soubor <code className="font-mono">.ifc</code> je zpracován výhradně lokálně v paměti vašeho prohlížeče – na server se neodesílá. Žádná citlivá výkresová ani technologická data závodu neodcházejí do žádné externí AI ani třetím stranám. Převod funguje i zcela offline bez připojení k internetu (stačí otevřená stránka ELDOCK); do ELDOCKu se uloží jen převedený výsledek ({result}), nikoli samotný soubor. Pro podniky s přísným režimem NIS2 lze celý ELDOCK provozovat On-Premise na interním serveru závodu.
      </p>
    </div>
  );
}

/** Fáze 101: 2D půdorys – „🏢 Importovat BIM model (.ifc)“ s oknem a zárukou lokálního zpracování před výběrem souboru. */
export function FloorplanBimImport({ disabled, onFile }: { disabled?: boolean; onFile: (file: File) => void }) {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={disabled} data-testid="floorplan-bim-open">
          <Building2 className="size-4" aria-hidden /> 🏢 Importovat BIM model (.ifc)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" data-testid="floorplan-bim-dialog">
        <DialogHeader>
          <DialogTitle>🏢 Importovat BIM model (.ifc)</DialogTitle>
          <DialogDescription>IFC2x3 / IFC4 (ISO 16739) – podlaží, místnosti, okna, dveře a elektro prvky se převedou do půdorysu v měřítku 1 : 1 bez kalibrace.</DialogDescription>
        </DialogHeader>
        <BimLocalNotice result="podlaží, místnosti a prvky půdorysu" />
        <input
          ref={input}
          type="file"
          accept=".ifc,application/x-step,model/ifc"
          className="sr-only"
          aria-label="BIM model budovy (.ifc)"
          data-testid="floorplan-bim-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setOpen(false);
            onFile(file);
          }}
        />
        <DialogFooter>
          <Button type="button" className="gap-1.5" onClick={() => input.current?.click()} data-testid="floorplan-bim-pick">
            <FileUp className="size-4" aria-hidden /> Vybrat soubor .ifc
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
