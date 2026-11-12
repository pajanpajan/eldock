"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Fáze 106: tisk stránky portálu výrobců (elaborát, štítky) – PDF přes „Uložit jako PDF“ v prohlížeči. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" className="gap-1.5" onClick={() => window.print()} data-testid="print-button">
      <Printer className="size-4" aria-hidden /> {label}
    </Button>
  );
}
