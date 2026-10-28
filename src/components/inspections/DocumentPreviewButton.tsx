"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Náhled dokumentu v dialogu (obrázky a SVG přes `<img>`, PDF v `<iframe>`) + stažení. */
export function DocumentPreviewButton({ url, title, subtitle }: { url: string; title: string; subtitle?: string }) {
  const [open, setOpen] = useState(false);
  const isPdf = url.toLowerCase().endsWith(".pdf");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="h-10 gap-2" onClick={() => setOpen(true)}>
          <Eye className="size-4" aria-hidden />
          Náhled
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-10 gap-2">
          <a href={`${url}?download=1`} download>
            <Download className="size-4" aria-hidden />
            Stáhnout
          </a>
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(96vw,64rem)] gap-3 sm:max-w-[min(96vw,64rem)]">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle ?? "Náhled dokumentu"}</DialogDescription>
          <div className="h-[75vh] overflow-hidden rounded-lg border border-border bg-zinc-200">
            {isPdf ? (
              <iframe src={url} title={title} className="size-full" />
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
