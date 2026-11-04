"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Tisk / uložení do PDF přes dialog prohlížeče (vzorový elaborát). */
export function PrintButton() {
  return (
    <Button type="button" variant="outline" className="touch-target gap-1.5" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden /> Tisk / uložit jako PDF
    </Button>
  );
}
