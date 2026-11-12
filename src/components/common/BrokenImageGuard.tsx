"use client";

import { useEffect } from "react";

const mark = (image: HTMLImageElement) => {
  if (image.dataset.broken === "true") return;
  image.dataset.broken = "true";
  image.alt = "";
};

/**
 * Fáze 99: globální pojistka – žádná stránka nesmí ukázat ikonu rozbitého obrázku. Obrázek, který se nenačte (i ten,
 * který selhal ještě před hydratací), dostane `data-broken` a globální styl ho schová (`globals.css`); komponenty
 * s fotkami katalogu navíc kreslí vlastní vektorový náhled (`FallbackImg`).
 */
export function BrokenImageGuard() {
  useEffect(() => {
    for (const image of Array.from(document.images)) if (image.complete && image.naturalWidth === 0 && image.currentSrc) mark(image);
    const onError = (event: Event) => {
      if (event.target instanceof HTMLImageElement) mark(event.target);
    };
    const onLoad = (event: Event) => {
      if (event.target instanceof HTMLImageElement && event.target.dataset.broken === "true" && event.target.naturalWidth > 0) delete event.target.dataset.broken;
    };
    document.addEventListener("error", onError, true);
    document.addEventListener("load", onLoad, true);
    return () => {
      document.removeEventListener("error", onError, true);
      document.removeEventListener("load", onLoad, true);
    };
  }, []);
  return null;
}
