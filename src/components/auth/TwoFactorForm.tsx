"use client";

import { useActionState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelTwoFactorLogin, verifyTwoFactorLogin, type LoginState } from "@/server/actions/auth";

/** Fáze 67: druhý krok přihlášení – kód z aplikace Authenticator nebo záložní kód. */
export function TwoFactorForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(verifyTwoFactorLogin, { needsTotp: true, next });
  return (
    <div className="grid gap-4 rounded-xl border border-border bg-card/70 p-4 sm:p-6" data-testid="two-factor-form">
      <form action={action} className="grid gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Účet má zapnuté dvoufázové ověření. Zadejte šestimístný kód z aplikace Authenticator, nebo jeden ze záložních kódů.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="login-code">Kód z aplikace</Label>
          <Input id="login-code" name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required maxLength={20} className="h-12 font-mono text-lg tracking-widest" aria-invalid={Boolean(state.error) || undefined} />
        </div>
        {state.error ? (
          <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending} className="h-11">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
          Ověřit a přihlásit
        </Button>
      </form>
      <form action={cancelTwoFactorLogin}>
        <Button type="submit" variant="ghost" size="sm">
          Zpět na přihlášení
        </Button>
      </form>
    </div>
  );
}
