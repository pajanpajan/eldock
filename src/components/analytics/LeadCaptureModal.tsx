"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidIco, normalizeIco } from "@/lib/ares";
import { LEAD_BONUS_CREDITS, LEAD_MARKETING_TEXT, LEAD_PROCESSING_TEXT, LEAD_ROLES, LEAD_TRIGGER_LABEL, type LeadContext, type LeadRole } from "@/lib/leads";
import { track } from "@/lib/telemetry-client";
import { cn } from "@/lib/utils";
import { captureLeadAction } from "@/server/actions/leads";

// Fáze 102: zachycení kontaktu u návštěvníka bez vlastního účtu (ukázková firma – trenažér, demo scénáře) při exportu
// kusovníku XLSX / CSV, tisku 6listového PDF elaborátu nebo uložení projektu. Registrovaná firma okno nevidí.

export type LeadRequest = LeadContext;
type Gate = (request: LeadRequest, run: () => void) => void;

const LeadGateContext = createContext<Gate | null>(null);
/** Funkční cookie (30 dní): kontakt už je zadaný – okno se znovu neptá (vyžádaná služba, bez souhlasu). */
export const LEAD_COOKIE = "eldock_lead";

const wasCaptured = () => document.cookie.split(";").some((part) => part.trim() === `${LEAD_COOKIE}=1`);

/** Export / tisk / uložení přes okno kontaktu (bez poskytovatele – registrovaná firma nebo jiná část webu – rovnou). */
export function useLeadGate(): Gate {
  const gate = useContext(LeadGateContext);
  return (
    gate ??
    ((request, run) => {
      track("export_clicked", { kind: request.trigger, context: request.kind });
      run();
    })
  );
}

/** Zdroj návštěvy pro kontakt (doména odkazu, UTM vstupní stránky). */
function sourceOf() {
  try {
    const params = new URLSearchParams(location.search);
    const referrer = document.referrer && new URL(document.referrer).origin !== location.origin ? new URL(document.referrer).origin : undefined;
    return { referrer, utmSource: params.get("utm_source") ?? undefined, utmMedium: params.get("utm_medium") ?? undefined, utmCampaign: params.get("utm_campaign") ?? undefined, landing: location.pathname };
  } catch {
    return undefined;
  }
}

export function LeadGateProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [pending, setPending] = useState<{ request: LeadRequest; run: () => void } | null>(null);
  const gate: Gate = (request, run) => {
    track("export_clicked", { kind: request.trigger, context: request.kind, demo: enabled });
    if (!enabled || wasCaptured()) return run();
    setPending({ request, run });
  };
  return (
    <LeadGateContext.Provider value={gate}>
      {children}
      {pending ? <LeadCaptureModal request={pending.request} onClose={() => setPending(null)} onDone={() => {
        const run = pending.run;
        setPending(null);
        // Tisk až po zavření okna (jinak by se vytisklo okno)
        window.setTimeout(run, 200);
      }} /> : null}
    </LeadGateContext.Provider>
  );
}

function LeadCaptureModal({ request, onClose, onDone }: { request: LeadRequest; onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [ico, setIco] = useState("");
  const [role, setRole] = useState<LeadRole>("installer");
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firm, setFirm] = useState<{ ico: string; text: string } | null>(null);

  // Náhled firmy z ARES po zadání platného IČO (veřejný registr, nic se neukládá)
  const lookup = async (value: string) => {
    const normalized = normalizeIco(value);
    if (!isValidIco(normalized)) return setFirm(null);
    try {
      const response = await fetch(`/api/ares?ico=${normalized}`);
      const data = (await response.json()) as { companyName?: string; city?: string; segmentLabel?: string; error?: string };
      setFirm({ ico: normalized, text: response.ok && data.companyName ? `${data.companyName}${data.city ? `, ${data.city}` : ""} · ${data.segmentLabel ?? ""}` : (data.error ?? "ARES je nedostupný") });
    } catch {
      setFirm({ ico: normalized, text: "ARES je nedostupný – údaje doplníte při registraci." });
    }
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    const result = await captureLeadAction({ email, ico: ico.trim() || undefined, role, marketing, context: request, source: sourceOf() });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    document.cookie = `${LEAD_COOKIE}=1; Max-Age=${30 * 86_400}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    toast.success(`Hotovo – ${LEAD_TRIGGER_LABEL[request.trigger].toLowerCase()} se připravuje.${result.data.newsletter === "pending" ? " Odběr novinek potvrďte odkazem v e-mailu." : ""}`, {
      duration: 15_000,
      action: { label: `Dokončit registraci (${LEAD_BONUS_CREDITS} kreditů)`, onClick: () => router.push(`/panel-builder/auth?tab=register&lead=${result.data.token}`) },
    });
    onDone();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg" data-testid="lead-capture">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" aria-hidden /> 📩 Kam vám máme poslat hotový kusovník a PDF dokumentaci?
          </DialogTitle>
          <DialogDescription>
            {LEAD_TRIGGER_LABEL[request.trigger]} · {request.summary}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="lead-email">Váš e-mail</Label>
            <Input id="lead-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="jmeno@firma.cz" data-testid="lead-email" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="lead-ico">IČO firmy (automaticky doplníme vaše razítko z ARESu)</Label>
            <Input id="lead-ico" inputMode="numeric" value={ico} onChange={(event) => setIco(event.target.value)} onBlur={() => void lookup(ico)} placeholder="nepovinné – 8 číslic" data-testid="lead-ico" />
            {firm ? (
              <p className="text-xs text-muted-foreground" data-testid="lead-ares">
                ARES: {firm.text}
              </p>
            ) : null}
          </div>
          <fieldset className="flex flex-col gap-1.5" role="radiogroup" aria-label="Zaměření">
            {LEAD_ROLES.map((option) => (
              <button key={option.id} type="button" role="radio" aria-checked={role === option.id} onClick={() => setRole(option.id)} className={cn("rounded-lg border px-3 py-2 text-left text-sm", role === option.id ? "border-primary bg-primary/15 font-semibold" : "border-border text-muted-foreground hover:text-foreground")} data-testid={`lead-role-${option.id}`}>
                [{option.label}]
              </button>
            ))}
          </fieldset>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} data-testid="lead-marketing" />
            {LEAD_MARKETING_TEXT}
          </label>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {LEAD_PROCESSING_TEXT.replace(" Podrobnosti v zásadách ochrany osobních údajů.", "")}{" "}
            <Link href="/ochrana-osobnich-udaju#kontakty" target="_blank" className="text-primary underline-offset-2 hover:underline">
              Zásady ochrany osobních údajů
            </Link>
          </p>
          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="h-auto min-h-11 gap-2 py-2 font-bold whitespace-normal" disabled={busy} data-testid="lead-submit">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Stáhnout dokumentaci & získat {LEAD_BONUS_CREDITS} kreditů zdarma →
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
