"use client";

import { useState, useTransition } from "react";
import { ExternalLink, FileText, Loader2, Search, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { isLocalPdf } from "@/lib/panel-builder/datasheets";
import { SYMBOLS, symbolPreviewSvg } from "@/lib/panel-builder/iec-symbols";
import { cn } from "@/lib/utils";
import { componentDatasheetAction, type ComponentDatasheet } from "@/server/actions/panel-builder";

const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/**
 * Fáze 58: náhled datasheetu přístroje – značka dle ČSN EN 60617, parametry z katalogu, původ dat a odkazy na podklady
 * výrobce. PDF uložené v Eldocku se zobrazí přímo v dialogu; weby výrobců se otevírají v nové záložce (vkládání
 * cizích stránek jejich servery blokují).
 */
export function DatasheetDialog({ componentId, label = "Datasheet", className, size = "sm" }: { componentId: string; label?: string; className?: string; size?: "sm" | "xs" }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ComponentDatasheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load(next: boolean) {
    setOpen(next);
    if (!next || data) return;
    startTransition(async () => {
      const result = await componentDatasheetAction(componentId);
      if (result.ok) setData(result.data);
      else setError(result.error);
    });
  }

  const pdf = data?.links.find((link) => link.kind === "datasheet" && isLocalPdf(link.url)) ?? null;
  return (
    <Dialog open={open} onOpenChange={load}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size={size} className={cn("gap-1.5", size === "xs" && "h-7 px-2 text-xs", className)} data-testid="datasheet-open">
          <FileText className="size-3.5" aria-hidden /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto", pdf ? "sm:max-w-4xl" : "sm:max-w-xl")} data-testid="datasheet-dialog">
        <DialogHeader>
          <DialogTitle>{data ? `${data.manufacturer} ${data.typeCode}` : "Náhled datasheetu"}</DialogTitle>
          <DialogDescription>{data ? `${data.series} · obj. č. ${data.articleNumber}` : "Načítám údaje z katalogu…"}</DialogDescription>
        </DialogHeader>
        {pending && !data ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Načítám…
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {data ? (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex gap-4">
              <figure className="flex shrink-0 flex-col items-center gap-1 rounded-lg border border-border bg-white p-2" data-testid="datasheet-symbol">
                {/* eslint-disable-next-line @next/next/no-img-element -- vlastní vektorová značka */}
                <img src={svgUri(symbolPreviewSvg(data.symbol, 96))} alt={`Značka: ${SYMBOLS[data.symbol].label}`} className="h-20 w-24" />
                <figcaption className="max-w-28 text-center text-[10px] leading-tight text-zinc-600">{SYMBOLS[data.symbol].label}</figcaption>
              </figure>
              <div className="flex min-w-0 flex-col gap-1">
                <p>{data.description}</p>
                <p className="text-xs text-muted-foreground">
                  Značka: {SYMBOLS[data.symbol].description} ({SYMBOLS[data.symbol].norm})
                </p>
                <p className="text-xs text-muted-foreground">Zdroj dat: {data.source}</p>
              </div>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-border p-3 text-xs" data-testid="datasheet-params">
              {data.params.map(([name, value]) => (
                <div key={name} className="contents">
                  <dt className="text-muted-foreground">{name}</dt>
                  <dd className="font-mono">{value}</dd>
                </div>
              ))}
            </dl>
            {pdf ? <iframe src={pdf.url} title={`Datasheet ${data.typeCode}`} className="h-[60vh] w-full rounded-lg border border-border bg-white" /> : null}
            <ul className="flex flex-col gap-1.5" data-testid="datasheet-links">
              {data.links.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noreferrer noopener" className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted", link.verified ? "border-emerald-500/50 text-emerald-200" : "border-border text-muted-foreground")} data-kind={link.kind}>
                    {link.kind === "search" ? <Search className="size-3.5" aria-hidden /> : link.verified ? <ShieldCheck className="size-3.5" aria-hidden /> : <ExternalLink className="size-3.5" aria-hidden />}
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            {!data.links.some((link) => link.verified) ? (
              <p className="text-[11px] text-amber-200">Datasheet zatím není u prvku v katalogu uložený – odkaz na web výrobce je sestavený z objednacího čísla. Ověřte parametry v originálním podkladu výrobce.</p>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
