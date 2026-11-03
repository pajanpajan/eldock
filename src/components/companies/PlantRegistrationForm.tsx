"use client";

import { useState, useTransition } from "react";
import { Factory, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLANT_TERMS_CONSENT } from "@/lib/registered-company";
import { registerPlantAction } from "@/server/actions/companies";

import { CompanyFields, EMPTY_COMPANY, TermsConsent, type CompanyForm } from "./CompanyFields";

/** Registrace výrobního závodu: firma z ARES, první závod, Technický ředitel, heslo a souhlas s VOP. */
export function PlantRegistrationForm() {
  const [company, setCompany] = useState<CompanyForm>(EMPTY_COMPANY);
  const [plantName, setPlantName] = useState("Hlavní výrobní závod");
  const [account, setAccount] = useState({ email: "", password: "" });
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (!terms) return setError({ text: "Bez souhlasu s obchodními podmínkami nelze registraci odeslat.", field: "termsAccepted" });
        startTransition(async () => {
          // Úspěch přesměruje rovnou do nového závodu (redirect v akci)
          const result = await registerPlantAction({ ...company, ...account, plantName, termsAccepted: terms });
          if (result && !result.ok) setError({ text: result.error, field: result.field });
        });
      }}
    >
      {error ? (
        <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert" data-testid="register-error">
          {error.text}
        </p>
      ) : null}
      <CompanyFields idPrefix="plant-reg" value={company} onChange={(patch) => setCompany((current) => ({ ...current, ...patch }))} invalidField={error?.field} showAuthorization={false} contactLabel="Kontaktní osoba (Technický ředitel)" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="plant-reg-plantName">Název prvního závodu</Label>
          <Input id="plant-reg-plantName" value={plantName} onChange={(event) => setPlantName(event.target.value)} maxLength={120} aria-invalid={error?.field === "plantName" || undefined} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plant-reg-email">E-mail (přihlášení)</Label>
          <Input id="plant-reg-email" type="email" autoComplete="email" value={account.email} onChange={(event) => setAccount({ ...account, email: event.target.value })} aria-invalid={error?.field === "email" || undefined} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plant-reg-password">Heslo (min. 8 znaků)</Label>
          <Input id="plant-reg-password" type="password" autoComplete="new-password" value={account.password} onChange={(event) => setAccount({ ...account, password: event.target.value })} aria-invalid={error?.field === "password" || undefined} className="h-11" />
        </div>
      </div>
      <TermsConsent text={PLANT_TERMS_CONSENT} checked={terms} onChange={setTerms} invalid={error?.field === "termsAccepted"} />
      <Button type="submit" className="touch-target gap-2" disabled={pending || !terms}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Factory className="size-4" aria-hidden />} Registrovat závod a přihlásit se
      </Button>
    </form>
  );
}
