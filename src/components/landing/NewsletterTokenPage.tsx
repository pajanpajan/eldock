import Link from "next/link";
import { CheckCircle2, MailCheck, MailX, TriangleAlert } from "lucide-react";

import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";

/**
 * Fáze 56: společná stránka pro potvrzení / odhlášení newsletteru. Akce se provede až tlačítkem (POST),
 * ne samotným otevřením odkazu – bezpečnostní skenery pošty odkazy předem otevírají.
 */
export function NewsletterTokenPage({
  title,
  text,
  button,
  kind,
  action,
  result,
}: {
  title: string;
  text: string;
  button: string;
  kind: "confirm" | "unsubscribe";
  action: (() => Promise<void>) | null;
  result: { ok: boolean; message: string } | null;
}) {
  return (
    <div className="landing bg-blueprint flex flex-1 flex-col">
      <header className="border-b border-border bg-background/90">
        <div className="mx-auto flex min-h-16 w-full max-w-xl items-center px-4 sm:px-6">
          <Link href="/" aria-label="Eldock – úvodní stránka">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-14 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {result ? (
          <p role="status" className={`flex items-start gap-3 rounded-xl border p-4 ${result.ok ? "border-primary/40 bg-primary/10" : "border-amber-500/40 bg-amber-500/10"}`} data-testid="newsletter-result">
            {result.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden /> : <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-400" aria-hidden />}
            {result.message}
          </p>
        ) : action ? (
          <form action={action} className="flex flex-col gap-4">
            <p className="text-muted-foreground">{text}</p>
            <Button type="submit" className="touch-target w-fit">
              {kind === "confirm" ? <MailCheck data-icon="inline-start" aria-hidden /> : <MailX data-icon="inline-start" aria-hidden />} {button}
            </Button>
          </form>
        ) : (
          <p role="status" className="text-muted-foreground">Odkaz je neúplný. Otevřete ho prosím znovu z e-mailu.</p>
        )}
        <Link href="/" className="text-sm text-primary hover:underline">
          Zpět na eldock.cz
        </Link>
      </main>
    </div>
  );
}
