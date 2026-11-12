"use client";

import { useState } from "react";
import { ClipboardCopy, Download, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { WHOLESALERS, inquiryEmail, orderLines, quickOrderText, wholesalerFile, wholesalerOf, type OrderLine, type WholesalerId } from "@/lib/quoting/wholesaler-export";
import { cn } from "@/lib/utils";
import { saveQuoteSettingsAction } from "@/server/actions/quotes";

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Fáze 105: „🛒 Exportovat poptávku / košík do velkoobchodu“ – oblíbený velkoobchod (uloží se do profilu firmy) a tři
 * okamžité akce: soubor pro import košíku (CSV / XLSX / XML), rychlý seznam EAN + množství do schránky (pole „Rychlá
 * objednávka“ e-shopu) a průvodní e-mail s poptávkou obchodnímu zástupci.
 */
export function WholesalerExport({ lines, title, initial, company, className }: { lines: readonly OrderLine[]; title: string; initial?: WholesalerId | null; company?: { name?: string | null; contact?: string | null; phone?: string | null } | null; className?: string }) {
  const [shop, setShop] = useState<WholesalerId>(initial ?? "sonepar");
  const [email, setEmail] = useState<{ subject: string; body: string; mailto: string } | null>(null);
  const merged = orderLines(lines);
  const withCode = merged.filter((line) => line.ean || line.code).length;
  const choose = (id: WholesalerId) => {
    setShop(id);
    void saveQuoteSettingsAction({ wholesaler: id });
  };
  const meta = { title, createdAt: new Date().toISOString().slice(0, 10) };
  const wholesaler = wholesalerOf(shop);
  return (
    <section className={cn("flex flex-col gap-2 rounded-xl border border-border bg-card p-3", className)} aria-label="Export poptávky do velkoobchodu" data-testid="wholesaler-export">
      <h3 className="text-sm font-semibold">🛒 Exportovat poptávku / košík do velkoobchodu</h3>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Velkoobchod">
        {WHOLESALERS.map((entry) => (
          <button key={entry.id} type="button" role="radio" aria-checked={shop === entry.id} onClick={() => choose(entry.id)} className={cn("rounded-lg border px-2.5 py-1.5 text-left text-xs", shop === entry.id ? "border-primary bg-primary/15 font-semibold" : "border-border hover:bg-muted")} data-testid={`wholesaler-${entry.id}`}>
            {entry.label}
            {entry.site ? <span className="block text-[10px] text-muted-foreground">{entry.site}</span> : null}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {wholesaler.hint} · {merged.length} položek ({withCode} s EAN nebo objednacím číslem)
      </p>
      <div className="flex flex-wrap gap-1.5">
        {wholesaler.formats.map((format) => (
          <Button
            key={format}
            type="button"
            size="sm"
            variant={format === wholesaler.formats[0] ? "default" : "outline"}
            className="gap-1.5"
            disabled={!merged.length}
            onClick={() => {
              const file = wholesalerFile(shop, format, lines, meta);
              download(file.name, file.content as BlobPart, file.mime);
            }}
            data-testid={`wholesaler-download-${format}`}
          >
            <Download className="size-4" aria-hidden /> 📥 Stáhnout soubor pro import do košíku (.{format})
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!withCode}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(quickOrderText(lines));
              toast.success(`Zkopírováno ${withCode} řádků EAN + množství – vložte je přes Ctrl+V do rychlé objednávky e-shopu.`);
            } catch {
              toast.error("Schránku se nepodařilo použít – stáhněte soubor pro import.");
            }
          }}
          data-testid="wholesaler-clipboard"
        >
          <ClipboardCopy className="size-4" aria-hidden /> 📋 Zkopírovat rychlý B2B seznam (EAN + množství)
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={!merged.length} onClick={() => setEmail(inquiryEmail(shop, lines, { title, company: company?.name, contact: company?.contact, phone: company?.phone }))} data-testid="wholesaler-email">
          <Mail className="size-4" aria-hidden /> ✉️ Vygenerovat průvodní e-mail s poptávkou
        </Button>
      </div>
      {email ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-2 text-xs" data-testid="wholesaler-email-text">
          <b>{email.subject}</b>
          <textarea readOnly value={email.body} className="h-40 w-full rounded-md border border-input bg-background p-2 font-mono text-[11px]" />
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(`${email.subject}\n\n${email.body}`).then(() => toast.success("Text e-mailu je ve schránce."))}>
              Zkopírovat text e-mailu
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <a href={email.mailto}>Otevřít v e-mailovém klientovi</a>
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
