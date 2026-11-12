"use client";

import { Bug } from "lucide-react";

import { openContactModal } from "@/components/contact/contact-events";
import { Button } from "@/components/ui/button";

/**
 * 🐛 Nahlásit chybu AI (fáze 50, od fáze 107 kontaktní modal): otevře formulář s kategorií „Hlášení chyby“ a ID projektu
 * (printscreen přes Ctrl + V, diagnostika s krokem průvodce). Hlášení jde do velínu „📬 Zprávy, Chyby & Schůzky“ a
 * s fotkou a rozpoznanými lištami projektu i do „Hlášení chyb AI a fotky“.
 */
export function ReportAiErrorButton({ projectId }: { projectId: string }) {
  return (
    <Button type="button" variant="outline" className="touch-target gap-1.5" data-testid="report-ai-error" onClick={() => openContactModal({ category: "BUG", context: { module: "panel-builder", projectId } })}>
      <Bug className="size-4" aria-hidden /> 🐛 Nahlásit chybu AI
    </Button>
  );
}
