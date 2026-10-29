"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Check, KeyRound, Loader2, LogIn } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountType } from "@/generated/prisma/enums";
import { ACCOUNT_TYPES } from "@/lib/accounts";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { login, type LoginState } from "@/server/actions/auth";

interface LoginAccount {
  id: string;
  name: string;
  email: string;
  title: string | null;
  accountType: AccountType;
}

/** Výběr účtu (dlaždice, velké pro dotyk) nebo e-mail + přístupové heslo / PIN. */
export function LoginForm({ accounts, next }: { accounts: LoginAccount[]; next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [accountId, setAccountId] = useState(state.accountId ?? accounts[0]?.id ?? "");
  const [email, setEmail] = useState(state.email ?? "");

  // Odeslání přes transition: automatický reset formuláře po akci by vrátil výběr účtu na první dlaždici.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form action={action} onSubmit={onSubmit} className="grid gap-5 rounded-xl border border-border bg-card/70 p-4 sm:p-6">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <fieldset className="grid gap-2" disabled={Boolean(email)}>
        <legend className="mb-2 text-sm font-medium">Účet</legend>
        <div role="radiogroup" aria-label="Účet" className="grid gap-2 sm:grid-cols-2">
          {accounts.map((account) => {
            const definition = ACCOUNT_TYPES[account.accountType];
            const active = !email && account.id === accountId;
            return (
              <label
                key={account.id}
                className={cn(
                  "touch-target flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  active ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                  email && "opacity-50",
                )}
              >
                <input
                  type="radio"
                  name="accountId"
                  value={account.id}
                  checked={account.id === accountId}
                  onChange={() => setAccountId(account.id)}
                  className="sr-only"
                  aria-label={`${account.name} – ${definition.label}`}
                />
                <Avatar className="size-9">
                  <AvatarFallback className="bg-secondary text-xs font-semibold">{initials(account.name)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-medium">{account.name}</span>
                  <span className={cn("mt-1 inline-block rounded-full border px-1.5 text-[11px] font-medium", definition.badge)}>{definition.label}</span>
                </span>
                {active ? <Check className="size-4 text-primary" aria-hidden /> : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="login-email">nebo e-mail</Label>
          <Input id="login-email" name="email" type="email" autoComplete="username" placeholder="jmeno@firma.cz" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="login-password">Heslo / PIN</Label>
          <Input id="login-password" name="password" type="password" autoComplete="current-password" required className="h-11" aria-invalid={Boolean(state.error) || undefined} />
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <KeyRound className="size-4" aria-hidden />
          Přístupové heslo nastavuje správce (proměnná <code className="font-mono">DIGITRY_ACCESS_PASSWORD</code>).
        </p>
        <Button type="submit" size="lg" disabled={pending} className="h-11 min-w-40">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogIn className="size-4" aria-hidden />}
          Přihlásit se
        </Button>
      </div>
    </form>
  );
}
