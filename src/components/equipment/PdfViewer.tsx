"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Odkaz ke stažení: soubory z `/api/files` posílají přílohu přes `?download=1`, statické dokumenty stačí s atributem `download`. */
export const downloadHref = (url: string) => (url.startsWith("/api/files/") ? `${url}?download=1` : url);

/**
 * Vestavěný náhled PDF (prohlížeč PDF v prohlížeči přes `<iframe>`) s lištou: celá obrazovka,
 * otevření v nové kartě a stažení originálu. Bez celé obrazovky (starší iPad) se PDF otevře v nové kartě.
 */
export function PdfViewer({ url, title, label, className, compact = false }: { url: string; title: string; label?: React.ReactNode; className?: string; compact?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    const element = container.current;
    if (element?.requestFullscreen) {
      try {
        await element.requestFullscreen();
        return;
      } catch {
        // Prohlížeč celou obrazovku odmítl → nová karta.
      }
    }
    window.open(url, "_blank", "noopener");
  }

  const fileName = url.split("/").pop() ?? "dokument.pdf";

  return (
    <div ref={container} className={cn("flex flex-col overflow-hidden rounded-xl border border-border bg-card", fullscreen && "h-dvh rounded-none border-0", className)} data-testid="pdf-viewer">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate px-1 text-sm text-muted-foreground">{label ?? <span className="font-mono">{decodeURIComponent(fileName)}</span>}</span>
        <Button variant="ghost" className="touch-target gap-2" onClick={toggleFullscreen} aria-label={fullscreen ? "Zavřít celou obrazovku" : "Celá obrazovka"}>
          {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          {compact ? null : <span className="hidden sm:inline">{fullscreen ? "Zavřít" : "Celá obrazovka"}</span>}
        </Button>
        <Button asChild variant="ghost" size="icon" className="touch-target" aria-label="Otevřít v nové kartě">
          <a href={url} target="_blank" rel="noopener">
            <ExternalLink className="size-4" />
          </a>
        </Button>
        <Button asChild variant="outline" className="touch-target gap-2">
          <a href={downloadHref(url)} download={fileName}>
            <Download className="size-4" />
            {compact ? <span className="sr-only">Stáhnout originál</span> : "Stáhnout originál"}
          </a>
        </Button>
      </div>
      <iframe
        src={`${url}#view=FitH`}
        title={title}
        className={cn("w-full flex-1 bg-white", fullscreen ? "h-full" : "aspect-[1.414] max-h-[calc(100dvh-10rem)] min-h-[24rem]")}
      />
    </div>
  );
}
