"use client";

import { useEffect, useState } from "react";

import { renderPdfPage } from "./pdf-client";

/**
 * Obrázek výkresu pro `<img>` (zákres, náhled): SVG / obrázek se použije přímo, stránka PDF se
 * vykreslí přes pdf.js (PDF v `<img>` prohlížeč nezobrazí). `pdfPage = null` = nejde o PDF.
 */
export function useDrawingImage(url: string, pdfPage: number | null): { src: string | null; error: boolean } {
  const [rendered, setRendered] = useState<{ key: string; src: string | null; error: boolean } | null>(null);
  const key = `${url}#${pdfPage ?? "img"}`;

  useEffect(() => {
    if (pdfPage === null) return;
    let cancelled = false;
    renderPdfPage(url, pdfPage)
      .then((page) => !cancelled && setRendered({ key, src: page.src, error: false }))
      .catch(() => !cancelled && setRendered({ key, src: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [key, url, pdfPage]);

  if (pdfPage === null) return { src: url, error: false };
  return rendered?.key === key ? { src: rendered.src, error: rendered.error } : { src: null, error: false };
}
