"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adjustCreditsAction, cancelCreditOrderAction, confirmCreditOrderAction, loginSuperadminAction, resolveAiFeedbackAction } from "@/server/actions/superadmin";

// Klientské ovládací prvky velínu /superadmin (fáze 50).

export function SuperadminLoginForm() {
  const [state, action, pending] = useActionState(loginSuperadminAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        Heslo velínu
        <Input type="password" name="password" required autoComplete="current-password" autoFocus aria-label="Heslo velínu" />
      </label>
      {state?.error ? (
        <p className="text-sm text-red-300" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="touch-target" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Vstoupit do velínu
      </Button>
    </form>
  );
}

/** [ +5 / +10 / +50 kreditů ] a ruční nastavení počtu kreditů firmy. */
export function CreditControls({ companyId, companyName, credits }: { companyId: string; companyName: string; credits: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(credits));
  const [pending, startTransition] = useTransition();
  const run = (change: { add: number } | { set: number }) =>
    startTransition(async () => {
      const result = await adjustCreditsAction(companyId, change);
      if (!result.ok) return void toast.error(result.error);
      setValue(String(result.data.creditsRemaining));
      toast.success(`${companyName}: ${result.data.creditsRemaining} kreditů.`);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="credit-controls">
      {[5, 10, 50].map((add) => (
        <Button key={add} type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending} onClick={() => run({ add })} aria-label={`Přidat ${add} kreditů firmě ${companyName}`}>
          +{add}
        </Button>
      ))}
      <Input value={value} onChange={(event) => setValue(event.target.value)} inputMode="numeric" className="h-7 w-16 px-1.5 text-right text-xs" aria-label={`Počet kreditů – ${companyName}`} />
      <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={pending || !/^\d+$/.test(value)} onClick={() => run({ set: Number(value) })}>
        Nastavit
      </Button>
    </div>
  );
}

/** [ ✅ Potvrdit úhradu a připsat kredity ] / Storno čekající objednávky. */
export function OrderActions({ orderId, variableSymbol }: { orderId: string; variableSymbol: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const confirm = () =>
    startTransition(async () => {
      const result = await confirmCreditOrderAction(orderId);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`VS ${variableSymbol} uhrazeno – ${result.data.companyName} má ${result.data.creditsRemaining} kreditů.`);
      router.refresh();
    });
  const cancel = () => {
    if (!window.confirm(`Stornovat objednávku VS ${variableSymbol}?`)) return;
    startTransition(async () => {
      const result = await cancelCreditOrderAction(orderId);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`VS ${variableSymbol} stornováno.`);
      router.refresh();
    });
  };
  return (
    <div className="flex flex-wrap gap-1">
      <Button type="button" size="sm" className="gap-1" disabled={pending} onClick={confirm} data-testid={`confirm-${variableSymbol}`}>
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <CheckCircle2 className="size-3.5" aria-hidden />} [ ✅ Potvrdit úhradu a připsat kredity ]
      </Button>
      <Button type="button" size="sm" variant="ghost" className="gap-1 text-muted-foreground" disabled={pending} onClick={cancel}>
        <XCircle className="size-3.5" aria-hidden /> Storno
      </Button>
    </div>
  );
}

/** [ ✓ Označit jako vyřešené ] s volitelnou poznámkou admina. */
export function ResolveFeedback({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1.5">
      <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={1000} placeholder="Poznámka admina (nepovinné)" aria-label="Poznámka admina" className="text-xs" />
      <Button
        type="button"
        size="sm"
        className="w-fit gap-1"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await resolveAiFeedbackAction(reportId, note || null);
            if (!result.ok) return void toast.error(result.error);
            toast.success("Hlášení označeno jako vyřešené.");
            router.refresh();
          })
        }
        data-testid="resolve-feedback"
      >
        [ ✓ Označit jako vyřešené ]
      </Button>
    </div>
  );
}
