"use client";

import { useState } from "react";
import Link from "next/link";
import { DatabaseZap, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidIco, normalizeIco, type AresCompany } from "@/lib/ares";
import { TERMS_SECTIONS, TERMS_VERSION } from "@/lib/registered-company";
import { cn } from "@/lib/utils";

/** Údaje firmy ve formuláři (registrace i „Firemní údaje do razítka“). */
export interface CompanyForm {
  ico: string;
  dic: string;
  companyName: string;
  street: string;
  city: string;
  zip: string;
  contactName: string;
  phone: string;
  authorizationNumber: string;
}

export const EMPTY_COMPANY: CompanyForm = { ico: "", dic: "", companyName: "", street: "", city: "", zip: "", contactName: "", phone: "", authorizationNumber: "" };

function Field({ id, label, value, onChange, invalid, className, ...rest }: { id: string; label: string; value: string; onChange: (value: string) => void; invalid?: boolean; className?: string } & Omit<React.ComponentProps<typeof Input>, "onChange" | "value" | "id">) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={invalid || undefined} className="h-11" {...rest} />
    </div>
  );
}

/**
 * IČO s doplněním z ARES (automaticky po 8 číslicích nebo tlačítkem), sídlo a odpovědná osoba.
 * Při výpadku ARES zůstanou pole volná k ručnímu vyplnění.
 */
export function CompanyFields({
  value,
  onChange,
  invalidField,
  idPrefix,
  showAuthorization = true,
  contactLabel = "Jméno a příjmení odpovědné osoby / projektanta",
}: {
  value: CompanyForm;
  onChange: (patch: Partial<CompanyForm>) => void;
  invalidField?: string;
  idPrefix: string;
  showAuthorization?: boolean;
  contactLabel?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function loadFromAres(raw = value.ico) {
    const ico = normalizeIco(raw);
    if (!isValidIco(ico)) return setStatus({ ok: false, text: "Zadejte platné 8místné IČO." });
    setLoading(true);
    try {
      const response = await fetch(`/api/ares?ico=${ico}`);
      const body = (await response.json()) as Partial<AresCompany> & { error?: string };
      if (!response.ok || !body.companyName) {
        setStatus({ ok: false, text: body.error ?? "Registr ARES je nedostupný – vyplňte údaje ručně." });
        return;
      }
      onChange({ ico, companyName: body.companyName, dic: body.dic ?? "", street: body.street ?? "", city: body.city ?? "", zip: body.zip ?? "" });
      setStatus({ ok: true, text: `Údaje načteny z ARES: ${body.companyName}` });
      toast.success("Údaje firmy doplněny z registru ARES.");
    } catch {
      setStatus({ ok: false, text: "Registr ARES je nedostupný – vyplňte údaje ručně." });
    } finally {
      setLoading(false);
    }
  }

  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="grid gap-3 sm:grid-cols-6" data-testid="company-fields">
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor={id("ico")}>IČO</Label>
        <div className="flex gap-2">
          <Input
            id={id("ico")}
            value={value.ico}
            inputMode="numeric"
            maxLength={8}
            placeholder="12345678"
            aria-invalid={invalidField === "ico" || undefined}
            onChange={(event) => {
              const ico = event.target.value.replace(/\D/g, "").slice(0, 8);
              onChange({ ico });
              setStatus(null);
              if (ico.length === 8 && isValidIco(ico)) void loadFromAres(ico);
            }}
            className="h-11 font-mono"
          />
          <Button type="button" variant="outline" className="h-11 shrink-0 gap-1.5" onClick={() => void loadFromAres()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <DatabaseZap className="size-4" aria-hidden />}
            Doplnit z ARES
          </Button>
        </div>
        {status ? (
          <p className={cn("text-xs", status.ok ? "text-emerald-300" : "text-amber-300")} role="status" data-testid="ares-status">
            {status.text}
          </p>
        ) : null}
      </div>
      <Field id={id("dic")} label="DIČ (nepovinné)" value={value.dic} onChange={(dic) => onChange({ dic })} placeholder="CZ12345678" className="sm:col-span-3" invalid={invalidField === "dic"} />
      <Field id={id("companyName")} label="Obchodní název firmy" value={value.companyName} onChange={(companyName) => onChange({ companyName })} className="sm:col-span-6" invalid={invalidField === "companyName"} maxLength={160} />
      <Field id={id("street")} label="Ulice a č. p." value={value.street} onChange={(street) => onChange({ street })} className="sm:col-span-3" invalid={invalidField === "street"} maxLength={160} />
      <Field id={id("city")} label="Město" value={value.city} onChange={(city) => onChange({ city })} className="sm:col-span-2" invalid={invalidField === "city"} maxLength={100} />
      <Field id={id("zip")} label="PSČ" value={value.zip} onChange={(zip) => onChange({ zip })} className="sm:col-span-1" invalid={invalidField === "zip"} inputMode="numeric" maxLength={6} />
      <Field id={id("contactName")} label={contactLabel} value={value.contactName} onChange={(contactName) => onChange({ contactName })} className="sm:col-span-3" invalid={invalidField === "contactName"} maxLength={120} />
      <Field id={id("phone")} label="Telefon" value={value.phone} onChange={(phone) => onChange({ phone })} className="sm:col-span-3" invalid={invalidField === "phone"} type="tel" maxLength={40} />
      {showAuthorization ? (
        <Field
          id={id("authorizationNumber")}
          label="Ev. č. oprávnění TIČR (nepovinné)"
          value={value.authorizationNumber}
          onChange={(authorizationNumber) => onChange({ authorizationNumber })}
          className="sm:col-span-6"
          placeholder="např. E-0815/2021 (NV 190/2022 Sb.)"
          maxLength={80}
        />
      ) : null}
    </div>
  );
}

/** Povinný souhlas s podmínkami + celé znění v modalu „Obchodní podmínky a vyloučení odpovědnosti“. */
export function TermsConsent({ text, checked, onChange, invalid }: { text: string; checked: boolean; onChange: (value: boolean) => void; invalid?: boolean }) {
  return (
    <div className={cn("space-y-2 rounded-lg border p-3 text-sm", invalid ? "border-red-500/60 bg-red-500/10" : "border-primary/40 bg-primary/5")} data-testid="terms-consent">
      <label className="flex items-start gap-2.5">
        <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label="Souhlas s obchodními podmínkami a přenesením odpovědnosti" />
        <span>{text}</span>
      </label>
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="text-xs font-semibold text-primary underline underline-offset-2">
            Obchodní podmínky a vyloučení odpovědnosti (celé znění)
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Obchodní podmínky a vyloučení odpovědnosti</DialogTitle>
            <DialogDescription>Verze {TERMS_VERSION} · platforma ELDOCK</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm" data-testid="terms-text">
            {TERMS_SECTIONS.map((section) => (
              <section key={section.title}>
                <h3 className="font-semibold">{section.title}</h3>
                <p className="text-muted-foreground">{section.text}</p>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {/* Fáze 54: informace o zpracování osobních údajů (čl. 13 GDPR) přímo u registrace */}
      <Link href="/ochrana-osobnich-udaju" target="_blank" className="ml-3 text-xs font-semibold text-primary underline underline-offset-2">
        Zásady zpracování osobních údajů
      </Link>
    </div>
  );
}
