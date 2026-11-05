"use client";

import { useState, useTransition } from "react";
import { Bug, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { reportAiFeedbackAction } from "@/server/actions/credits";

/** 🐛 Nahlásit chybu AI (fáze 50): poznámka testera + fotka a snímek lišt projektu do velínu. */
export function ReportAiErrorButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function submit() {
    startTransition(async () => {
      const result = await reportAiFeedbackAction({ projectId, message });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Děkujeme! Hlášení jsme přijali – pomůžete nám AI dál zpřesnit.");
      setMessage("");
      setOpen(false);
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="touch-target gap-1.5" data-testid="report-ai-error">
          <Bug className="size-4" aria-hidden /> 🐛 Nahlásit chybu AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>🐛 Nahlásit chybu AI</DialogTitle>
          <DialogDescription>Našli jste chybu v rozpoznání přístrojů nebo ve schématu? Napište nám krátkou poznámku – pomůžete nám AI dál zpřesnit.</DialogDescription>
        </DialogHeader>
        <Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={5} placeholder="např. Špatně rozpoznaný stykač na 2. liště" aria-label="Popis chyby" />
        <p className="text-xs text-muted-foreground">Spolu s poznámkou odešleme fotku rozváděče a aktuální rozpoznané lišty a prvky projektu.</p>
        <Button type="button" className="touch-target gap-2" disabled={pending || message.trim().length < 3} onClick={submit}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Odeslat hlášení
        </Button>
      </DialogContent>
    </Dialog>
  );
}
