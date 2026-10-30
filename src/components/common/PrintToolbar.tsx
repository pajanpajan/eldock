"use client";

import { useEffect } from "react";
import { Printer, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Lišta samostatné tiskové stránky (štítek, protokol): po načtení sama vyvolá tisk, v tisku se skryje. */
export function PrintToolbar({ hint, className }: { hint: React.ReactNode; className?: string }) {
  useEffect(() => {
    // Nechat dokreslit QR kód a písmo, pak otevřít dialog tisku.
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={cn("no-print flex w-full flex-wrap items-center gap-2", className)}>
      <p className="flex-1 text-sm text-muted-foreground">{hint}</p>
      <Button className="touch-target gap-2" onClick={() => window.print()}>
        <Printer className="size-4" />
        Vytisknout / uložit PDF
      </Button>
      <Button variant="outline" className="touch-target gap-2" onClick={() => window.close()}>
        <X className="size-4" />
        Zavřít
      </Button>
    </div>
  );
}
