"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSearch, Loader2, Sparkles, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CATEGORY_LABELS, formatWatts } from "@/lib/panel-builder/catalog";
import { extractPdfText } from "@/lib/pdf-client";
import { uploadFile } from "@/lib/upload-client";
import { importDatasheetAction } from "@/server/actions/panel-builder";
import type { ImportedComponent } from "@/server/services/panel-builder";

const DEMO_PDFS = [
  { file: "domovni-rozvadec-rh1.pdf", label: "Domovní rozváděč RH1 – kusovník a seznam komponent (ABB)" },
  { file: "pohon-vrat-motor.pdf", label: "Pohon vrat – kusovník stykačů, jističů a svorek" },
  { file: "plc-rozvadec-linka.pdf", label: "PLC rozváděč linky – seznam karet a kompaktních PLC" },
];

type Phase = { step: "idle" } | { step: "working"; message: string } | { step: "done"; fileName: string; mode: "GEMINI" | "DEMO"; components: ImportedComponent[] } | { step: "error"; message: string };

/** „Atomizovat PDF datasheet (AI Import)“ – PDF se rozpadne na jednotlivé přístroje v katalogu. */
export function DatasheetImport() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });

  async function run(fileName: string, getUrl: () => Promise<string>) {
    try {
      setPhase({ step: "working", message: "Načítám PDF…" });
      const url = await getUrl();
      setPhase({ step: "working", message: "Čtu text stránek…" });
      const pages = await extractPdfText(url);
      setPhase({ step: "working", message: "Rozpadám PDF na jednotlivé přístroje…" });
      const result = await importDatasheetAction({ fileName, pages });
      if (!result.ok) return setPhase({ step: "error", message: result.error });
      setPhase({ step: "done", fileName, ...result.data });
      router.refresh();
    } catch {
      setPhase({ step: "error", message: "PDF se nepodařilo načíst. Je soubor platné PDF?" });
    }
  }

  const created = phase.step === "done" ? phase.components.filter((c) => c.status === "created").length : 0;

  return (
    <Dialog onOpenChange={(open) => !open && setPhase({ step: "idle" })}>
      <DialogTrigger asChild>
        <Button className="touch-target gap-2">
          <Sparkles className="size-4" aria-hidden /> Atomizovat PDF datasheet (AI Import)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Atomizace PDF datasheetu</DialogTitle>
          <DialogDescription>Katalogový list, kusovník nebo seznam komponent se rozpadne na jednotlivé přístroje – každý jako samostatný řádek katalogu s parametry pro výpočet oteplení.</DialogDescription>
        </DialogHeader>

        {phase.step === "working" ? (
          <p className="flex items-center gap-2 py-6 text-sm" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {phase.message}
          </p>
        ) : phase.step === "done" ? (
          <div className="flex flex-col gap-3" data-testid="datasheet-result">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-400" aria-hidden />
              {phase.fileName}: {phase.components.length} přístrojů, z toho {created} nových v katalogu.
              {phase.mode === "DEMO" ? <Badge variant="outline">Demo AI režim</Badge> : <Badge variant="outline">Gemini</Badge>}
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {phase.components.map((component) => (
                <li key={component.articleNumber} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <span className="font-mono text-xs text-muted-foreground">{component.articleNumber}</span>
                  <span className="font-medium">{component.typeCode}</span>
                  <span className="text-muted-foreground">{CATEGORY_LABELS[component.category]}</span>
                  <span className="ml-auto font-mono text-xs">{formatWatts(component.powerLossWatts)}</span>
                  <Badge variant={component.status === "created" ? "default" : "secondary"}>{component.status === "created" ? "Nový" : "Už v katalogu"}</Badge>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="touch-target self-start" onClick={() => setPhase({ step: "idle" })}>
              Importovat další PDF
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {phase.step === "error" ? (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {phase.message}
              </p>
            ) : null}
            <input
              ref={input}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              aria-label="PDF datasheet"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void run(file.name, async () => (await uploadFile("document", file)).url);
              }}
            />
            <Button variant="outline" className="touch-target h-14 gap-2 border-dashed" onClick={() => input.current?.click()}>
              <Upload className="size-4" aria-hidden /> Nahrát vlastní PDF (datasheet, kusovník)
            </Button>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">Nebo vyzkoušejte vzorové PDF z demo dokumentace:</p>
              {DEMO_PDFS.map((demo) => (
                <Button key={demo.file} variant="secondary" className="touch-target h-auto justify-start gap-2 py-2 text-left whitespace-normal" onClick={() => void run(demo.file, async () => `/demo-docs/${demo.file}`)}>
                  <FileSearch className="size-4 shrink-0" aria-hidden /> {demo.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
