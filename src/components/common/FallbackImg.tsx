"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";

/**
 * Fáze 99: obrázek s náhradou – když se fotka nenačte (404, poškozený soubor), místo ikony rozbitého obrázku se hned
 * vykreslí `fallback` (vektorový studiový náhled, kresba čela, nebo nic). Pozná i obrázek, který selhal ještě před
 * hydratací stránky (vykreslený na serveru).
 */
export function FallbackImg({ fallback = null, src, alt, onError, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string; fallback?: ReactNode }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = ref.current;
    if (image && image.complete && image.naturalWidth === 0 && image.currentSrc) setFailedSrc(src);
  }, [src]);
  if (failedSrc === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- statické fotky z public/catalog-images a z úložiště katalogu
    <img
      ref={ref}
      src={src}
      alt={alt ?? ""}
      {...props}
      onError={(event) => {
        setFailedSrc(src);
        onError?.(event);
      }}
    />
  );
}
