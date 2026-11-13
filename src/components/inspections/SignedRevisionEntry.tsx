"use client";

import { useState } from "react";
import { FileSignature, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { RevisionTechnicianFormModal, type RevisionEquipment } from "./RevisionTechnicianFormModal";

/**
 * Fáze 108: vstup do formuláře revizního technika z karty rozváděče / stroje – po naskenování platného QR štítku
 * zvýrazněný („📱 QR štítek ověřen – zapište revizi“).
 */
export function SignedRevisionEntry({ equipment, today, scanned = false, className }: { equipment: RevisionEquipment; today: string; scanned?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3",
        scanned ? "border-primary/70 bg-primary/10 shadow-lg shadow-primary/10" : "border-border bg-card",
        className,
      )}
      data-testid="signed-revision-entry"
    >
      {scanned ? <ScanLine className="size-5 shrink-0 text-primary" aria-hidden /> : <FileSignature className="size-5 shrink-0 text-primary" aria-hidden />}
      <p className="min-w-0 flex-1 text-sm">
        <strong>{scanned ? "📱 QR štítek ověřen – zapište revizi na místě." : "Revizní technik:"}</strong>{" "}
        <span className="text-muted-foreground">Profil TIČR, měření na 1 klik, podpis s razítkem, PIN a pečeť SHA-256.</span>
      </p>
      <Button type="button" className="touch-target gap-2 font-semibold" onClick={() => setOpen(true)} data-testid="signed-revision-open">
        <FileSignature className="size-4" aria-hidden /> 🖊️ Doplnit data k revizi
      </Button>
      {open ? <RevisionTechnicianFormModal open={open} onOpenChange={setOpen} equipment={[equipment]} today={today} /> : null}
    </div>
  );
}
