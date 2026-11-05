"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/legal";
import { NEWSLETTER_AUDIENCES } from "@/lib/newsletter";
import { cn } from "@/lib/utils";
import { subscribeNewsletterAction } from "@/server/actions/newsletter";

/**
 * Fáze 56: přihlášení k měsíčnímu newsletteru. Souhlas je samostatné NEzaškrtnuté políčko (čl. 7 GDPR),
 * odběr se aktivuje až potvrzením odkazu v e-mailu. Skryté pole `website` je past na roboty.
 */
export function NewsletterSignup({ source = "web", defaultAudience = "", compact = false, className }: { source?: string; defaultAudience?: string; compact?: boolean; className?: string }) {
  const [email, setEmail] = useState("");
  const [audience, setAudience] = useState(defaultAudience);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await subscribeNewsletterAction({ email, audience: audience || null, consent, source, website });
      setMessage(result.ok ? { ok: true, text: result.data.message } : { ok: false, text: result.error });
      if (result.ok) {
        setEmail("");
        setConsent(false);
      }
    });
  }

  const id = `newsletter-${source}`;
  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-3", className)} data-testid="newsletter-form" aria-label="Přihlášení k odběru novinek">
      <div className={cn("flex flex-col gap-2", compact ? "" : "sm:flex-row")}>
        <label htmlFor={`${id}-email`} className="sr-only">
          E-mail
        </label>
        <Input id={`${id}-email`} type="email" required autoComplete="email" inputMode="email" placeholder="vas@email.cz" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 flex-1" />
        <label htmlFor={`${id}-audience`} className="sr-only">
          Jsem
        </label>
        <select id={`${id}-audience`} value={audience} onChange={(event) => setAudience(event.target.value)} className="h-11 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30" aria-label="Moje profese (nepovinné)">
          <option value="">Jsem… (nepovinné)</option>
          {NEWSLETTER_AUDIENCES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="submit" className="touch-target h-11" disabled={pending}>
          <Mail data-icon="inline-start" aria-hidden /> {pending ? "Odesílám…" : "Odebírat novinky"}
        </Button>
      </div>
      {/* Past na roboty – člověk pole nevidí */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Web
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} name="website" />
        </label>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" data-testid="newsletter-consent" />
        <span>
          {NEWSLETTER_CONSENT_TEXT}{" "}
          <Link href="/ochrana-osobnich-udaju#newsletter" className="text-primary hover:underline">
            Zásady zpracování osobních údajů
          </Link>
        </span>
      </label>
      {message ? (
        <p role="status" className={cn("flex items-start gap-2 text-sm", message.ok ? "text-primary" : "text-amber-400")} data-testid="newsletter-message">
          {message.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
