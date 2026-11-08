"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, KeyRound, Loader2, Mail, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH, passwordIssues } from "@/lib/password-policy";
import { cn } from "@/lib/utils";
import { requestPasswordResetAction, setPasswordAction, type ResetRequestState, type SetPasswordState } from "@/server/actions/auth";

/** Živý přehled pravidel hesla (fáze 67). */
export function PasswordRules({ password, email, name }: { password: string; email?: string | null; name?: string | null }) {
  const issues = passwordIssues(password, { email, name });
  const rows = [
    { label: `Aspoň ${PASSWORD_MIN_LENGTH} znaků`, ok: password.length >= PASSWORD_MIN_LENGTH },
    { label: "Není běžné ani odvozené z e-mailu či jména", ok: password.length > 0 && issues.every((issue) => issue.includes("znaků")) },
  ];
  return (
    <ul className="grid gap-1 text-xs" aria-label="Pravidla hesla" data-testid="password-rules">
      {rows.map((row) => (
        <li key={row.label} className={cn("flex items-center gap-1.5", row.ok ? "text-emerald-300" : "text-muted-foreground")}>
          {row.ok ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
          {row.label}
        </li>
      ))}
      {password && issues.length ? <li className="text-amber-200">{issues[0]}</li> : null}
    </ul>
  );
}

/** „Zapomenuté heslo“ – odpověď je vždy stejná. */
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(requestPasswordResetAction, {});
  if (state.done) {
    return (
      <div role="status" className="grid gap-3 rounded-xl border border-border bg-card/70 p-4 text-sm sm:p-6" data-testid="reset-done">
        <p className="flex items-start gap-2">
          <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          Pokud účet s tímto e-mailem existuje, poslali jsme na něj odkaz na nastavení nového hesla. Platí 1 hodinu.
        </p>
        <p className="text-muted-foreground">E-mail nepřišel? Požádejte správce účtů své firmy (Správa podúčtů → „Odkaz na nové heslo“).</p>
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Zpět na přihlášení
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4 rounded-xl border border-border bg-card/70 p-4 sm:p-6">
      <div className="grid gap-1.5">
        <Label htmlFor="reset-email">E-mail, kterým se přihlašujete</Label>
        <Input id="reset-email" name="email" type="email" autoComplete="username" required maxLength={200} className="h-11" />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/login" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Zpět na přihlášení
        </Link>
        <Button type="submit" size="lg" disabled={pending} className="h-11">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Mail className="size-4" aria-hidden />}
          Poslat odkaz
        </Button>
      </div>
    </form>
  );
}

/** Nastavení hesla z pozvánky nebo z odkazu na obnovu. */
export function SetPasswordForm({ token, email, name }: { token: string; email: string; name: string }) {
  const [state, action, pending] = useActionState<SetPasswordState, FormData>(setPasswordAction, {});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const ok = passwordIssues(password, { email, name }).length === 0 && password === confirm;
  return (
    <form action={action} className="grid gap-4 rounded-xl border border-border bg-card/70 p-4 sm:p-6">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="username" value={email} autoComplete="username" readOnly />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="new-password">Nové heslo</Label>
          <Input id="new-password" name="password" type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-11" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-password-confirm">Nové heslo znovu</Label>
          <Input id="new-password-confirm" name="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-11" aria-invalid={(confirm.length > 0 && confirm !== password) || undefined} />
        </div>
      </div>
      <PasswordRules password={password} email={email} name={name} />
      {confirm && confirm !== password ? <p className="text-xs text-amber-200">Hesla se neshodují.</p> : null}
      {state.error ? (
        <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending || !ok} className="h-11">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
        Nastavit heslo a přihlásit
      </Button>
    </form>
  );
}
