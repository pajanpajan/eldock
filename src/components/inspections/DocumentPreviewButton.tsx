"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Náhled dokumentu v dialogu (obrázky a SVG přes `<img>`, PDF a protokoly vygenerované v ELDOCKu v `<iframe>`) + stažení.
 * Fáze 116: vygenerovaný protokol (`page`) se stahuje jako PDF z tiskové podoby.
 */
export function DocumentPreviewButton({ url, title, subtitle, page = false, labels }: { url: string; title: string; subtitle?: string; page?: boolean; labels?: { preview: string; download: string } }) {
  const [open, setOpen] = useState(false);
  const isPdf = page || url.toLowerCase().split("?")[0].endsWith(".pdf");
  const downloadHref = page ? `${url}?tisk=1` : `${url}?download=1`;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="h-10 gap-2" onClick={() => setOpen(true)} data-testid="doc-preview">
          <Eye className="size-4" aria-hidden />
          {labels?.preview ?? "Náhled"}
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-10 gap-2">
          <a href={downloadHref} {...(page ? { target: "_blank", rel: "noopener" } : { download: true })} data-testid="doc-download">
            <Download className="size-4" aria-hidden />
            {labels?.download ?? "Stáhnout"}
          </a>
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(96vw,64rem)] gap-3 sm:max-w-[min(96vw,64rem)]">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle ?? "Náhled dokumentu"}</DialogDescription>
          <div className="h-[75vh] overflow-hidden rounded-lg border border-border bg-zinc-200">
            {isPdf ? (
              <iframe src={page ? `${url}?nahled=1` : url} title={title} className="size-full bg-white" />
            ) : (
              <TransformWrapper minScale={0.5} maxScale={6} centerOnInit>
                <TransformComponent wrapperClass="size-full!" contentClass="size-full!">
                  {/* eslint-disable-next-line @next/next/no-img-element -- soubory z /api/files, SVG přes <img> (bezpečnost) */}
                  <img src={url} alt={title} className="size-full object-contain" />
                </TransformComponent>
              </TransformWrapper>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
