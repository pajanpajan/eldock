"use client";

import { useEffect } from "react";
import { Printer, X } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Lišta tiskové stránky štítku: po načtení sama vyvolá tisk (v tisku se skryje). */
export function LabelPrintToolbar({ tag, width, height }: { tag: string; width: number; height: number }) {
  useEffect(() => {
    // Nechat dokreslit QR kód a písmo, pak otevřít dialog tisku.
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="no-print flex w-full max-w-[34rem] flex-wrap items-center gap-2">
      <p className="flex-1 text-sm text-muted-foreground">
        Štítek <span className="font-mono text-foreground">{tag}</span> · {width} × {height} mm. V dialogu tisku zvolte štítkovač, měřítko 100 % a vypněte záhlaví a zápatí.
      </p>
      <Button className="touch-target gap-2" onClick={() => window.print()}>
        <Printer className="size-4" />
        Vytisknout
      </Button>
      <Button variant="outline" className="touch-target gap-2" onClick={() => window.close()}>
        <X className="size-4" />
        Zavřít
      </Button>
    </div>
  );
}
