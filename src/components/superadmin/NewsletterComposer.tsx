"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Send, TestTube2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NEWSLETTER_AUDIENCES } from "@/lib/newsletter";
import { sendNewsletterAction, sendNewsletterTestAction } from "@/server/actions/newsletter";

/** Fáze 56: velín – napsání a rozeslání měsíčního vydání (nejdřív zkušební e-mail, pak potvrzené rozeslání). */
export function NewsletterComposer({ confirmed }: { confirmed: number }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("");
  const [testTo, setTestTo] = useState("");
  const [sure, setSure] = useState(false);
  const [pending, startTransition] = useTransition();

  const test = () =>
    startTransition(async () => {
      const result = await sendNewsletterTestAction({ to: testTo, subject, body, audience: audience || null });
      if (result.ok) toast.success(`Zkušební e-mail odeslán na ${testTo}.`);
      else toast.error(result.error);
    });

  const send = () =>
    startTransition(async () => {
      const result = await sendNewsletterAction({ subject, body, audience: audience || null });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Vydání rozesláno: ${result.data.sent} e-mailů${result.data.failed ? `, ${result.data.failed} se nepodařilo doručit` : ""}.`);
      setSure(false);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4" data-testid="newsletter-composer">
      <h2 className="font-semibold">Nové vydání</h2>
      <Input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={150} placeholder="Předmět, např. Novinky Eldock – listopad 2026" aria-label="Předmět vydání" />
      <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={12} maxLength={20_000} placeholder={"Text vydání. Odstavce oddělte prázdným řádkem, odkazy https://… budou klikací.\nOdkaz pro odhlášení se přidá automaticky."} aria-label="Text vydání" />
      <div className="flex flex-wrap items-center gap-2">
        <select value={audience} onChange={(event) => setAudience(event.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30" aria-label="Komu poslat">
          <option value="">Všem potvrzeným ({confirmed})</option>
          {NEWSLETTER_AUDIENCES.map((option) => (
            <option key={option.id} value={option.id}>
              Jen: {option.label}
            </option>
          ))}
        </select>
        <Input value={testTo} onChange={(event) => setTestTo(event.target.value)} type="email" placeholder="zkušební adresa" className="h-9 w-56" aria-label="Adresa pro zkušební e-mail" />
        <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={pending || !testTo} onClick={test}>
          <TestTube2 className="size-4" aria-hidden /> Poslat zkušební
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={sure} onChange={(event) => setSure(event.target.checked)} className="size-4 accent-primary" />
        Zkušební e-mail jsem zkontroloval(a) a chci vydání rozeslat.
      </label>
      <Button type="button" className="w-fit gap-1.5" disabled={pending || !sure || !subject || !body} onClick={send} data-testid="newsletter-send">
        <Send className="size-4" aria-hidden /> Rozeslat vydání
      </Button>
    </div>
  );
}
