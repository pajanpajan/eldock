"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export interface GalleryPhoto {
  id: string;
  url: string;
  caption: string | null;
}

/** Náhledy fotek z haly + lightbox se zoomem a listováním. */
export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const current = index === null ? null : photos[index];
  const step = (delta: number) => setIndex((i) => (i === null ? i : (i + delta + photos.length) % photos.length));

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="group block overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label={`Zobrazit fotku: ${photo.caption ?? `fotka ${i + 1}`}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- soubory z /api/files, SVG přes <img> (bezpečnost) */}
              <img
                src={photo.url}
                alt={photo.caption ?? `Fotka ${i + 1}`}
                className="h-24 w-32 object-cover transition-transform group-hover:scale-105 sm:h-28 sm:w-40"
                loading="lazy"
              />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={current !== null} onOpenChange={(open) => !open && setIndex(null)}>
        <DialogContent className="max-w-[calc(100%-1rem)] gap-3 p-3 sm:max-w-5xl">
          <DialogTitle className="pr-8">{current?.caption ?? "Fotka z haly"}</DialogTitle>
          <DialogDescription className="sr-only">Kolečkem nebo dvěma prsty přiblížíte, tažením posunete.</DialogDescription>
          {current ? (
            <div className="relative overflow-hidden rounded-lg bg-black">
              <TransformWrapper key={current.id} maxScale={6}>
                <TransformComponent wrapperClass="!w-full" contentClass="!w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element -- viz výše */}
                  <img src={current.url} alt={current.caption ?? "Fotka"} className="max-h-[75dvh] w-full object-contain" />
                </TransformComponent>
              </TransformWrapper>
              {photos.length > 1 ? (
                <>
                  <Button variant="secondary" size="icon" className="touch-target absolute top-1/2 left-2 -translate-y-1/2" onClick={() => step(-1)} aria-label="Předchozí fotka">
                    <ChevronLeft className="size-5" />
                  </Button>
                  <Button variant="secondary" size="icon" className="touch-target absolute top-1/2 right-2 -translate-y-1/2" onClick={() => step(1)} aria-label="Další fotka">
                    <ChevronRight className="size-5" />
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
          {photos.length > 1 && index !== null ? (
            <p className="text-center font-mono text-xs text-muted-foreground">
              {index + 1} / {photos.length}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
