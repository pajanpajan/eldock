"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TERMS_CONSENT, TESTER_COMPANY } from "@/lib/registered-company";
import { cn } from "@/lib/utils";
import { loginPanelCompanyAction, registerPanelCompanyAction } from "@/server/actions/companies";

import { CompanyFields, EMPTY_COMPANY, TermsConsent, type CompanyForm } from "./CompanyFields";

type Tab = "login" | "register";

/** /panel-builder/auth: „Přihlášení“ (+ předvyplněný Tester účet) a „Registrace firmy (Tester)“. */
export function PanelAuthForms({ next, initialTab = "login" }: { next?: string; initialTab?: Tab }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pending, startTransition] = useTransition();
  const [login, setLogin] = useState({ email: "", password: "" });
  const [company, setCompany] = useState<CompanyForm>(EMPTY_COMPANY);
  const [account, setAccount] = useState({ email: "", password: "" });
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);

  function submitLogin(credentials = login) {
    setError(null);
    startTransition(async () => {
      const result = await loginPanelCompanyAction(credentials, next);
      if (!result.ok) return setError({ text: result.error });
      router.replace(result.data.href);
      router.refresh();
    });
  }

  function submitRegistration() {
    setError(null);
    if (!terms) return setError({ text: "Bez souhlasu s podmínkami a přenesením odpovědnosti nelze registraci odeslat.", field: "termsAccepted" });
    startTransition(async () => {
      const result = await registerPanelCompanyAction({ ...company, ...account, termsAccepted: terms }, next);
      if (!result.ok) return setError({ text: result.error, field: result.field });
      toast.success(`Firma ${company.companyName} zaregistrována – máte 5 testovacích kreditů.`);
      router.replace(result.data.href);
      router.refresh();
    });
  }

  const tabButton = (key: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => {
        setTab(key);
        setError(null);
      }}
      className={cn("h-11 flex-1 rounded-md text-sm font-semibold", tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex gap-1 rounded-lg border border-border bg-background p-1" role="tablist" aria-label="Přihlášení nebo registrace">
        {tabButton("login", "Přihlášení")}
        {tabButton("register", "Registrace firmy (Tester)")}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert" data-testid="auth-error">
          {error.text}
        </p>
      ) : null}

      {tab === "login" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            submitLogin();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pb-login-email">E-mail</Label>
            <Input id="pb-login-email" type="email" autoComplete="email" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pb-login-password">Heslo</Label>
            <Input id="pb-login-password" type="password" autoComplete="current-password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} className="h-11" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="touch-target gap-2" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogIn className="size-4" aria-hidden />} Přihlásit se
            </Button>
            <Button
              type="button"
              variant="outline"
              className="touch-target gap-2"
              disabled={pending}
              onClick={() => {
                const tester = { email: TESTER_COMPANY.email, password: TESTER_COMPANY.password };
                setLogin(tester);
                submitLogin(tester);
              }}
            >
              <FlaskConical className="size-4" aria-hidden /> Vyzkoušet předvyplněný Tester účet
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tester účet: <span className="font-mono">{TESTER_COMPANY.email}</span> / <span className="font-mono">{TESTER_COMPANY.password}</span> – vzorová firma s rozváděčem PB-001.
          </p>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitRegistration();
          }}
        >
          <CompanyFields idPrefix="pb-reg" value={company} onChange={(patch) => setCompany((current) => ({ ...current, ...patch }))} invalidField={error?.field} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pb-reg-email">E-mail (přihlášení)</Label>
              <Input id="pb-reg-email" type="email" autoComplete="email" value={account.email} onChange={(event) => setAccount({ ...account, email: event.target.value })} aria-invalid={error?.field === "email" || undefined} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pb-reg-password">Heslo (min. 8 znaků)</Label>
              <Input id="pb-reg-password" type="password" autoComplete="new-password" value={account.password} onChange={(event) => setAccount({ ...account, password: event.target.value })} aria-invalid={error?.field === "password" || undefined} className="h-11" />
            </div>
          </div>
          <TermsConsent text={TERMS_CONSENT} checked={terms} onChange={setTerms} invalid={error?.field === "termsAccepted"} />
          <Button type="submit" className="touch-target w-full gap-2 sm:w-auto" disabled={pending || !terms}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />} Zaregistrovat firmu a spustit Panel Builder
          </Button>
        </form>
      )}
    </div>
  );
}
