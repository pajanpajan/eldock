"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hand, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { claimPoolTaskAction, poolLoginAction } from "@/server/actions/pool-portal";

/** Fáze 103: přihlášení schváleného projektanta – e-mail a přístupový kód z velínu ELDOCK. */
export function PoolLoginForm() {
  const [state, action, pending] = useActionState(poolLoginAction, null);
  return (
    <form action={action} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" data-testid="pool-login">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        E-mail projektanta ze seznamu ELDOCK Poolu
        <Input name="email" type="email" autoComplete="email" required className="h-11" data-testid="pool-email" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Přístupový kód
        <Input name="code" autoComplete="one-time-code" placeholder="XXXX-XXXX-XXXX" required className="h-11 font-mono uppercase" data-testid="pool-code" />
      </label>
      <Button type="submit" className="touch-target" disabled={pending} data-testid="pool-login-submit">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}Přihlásit se do portálu
      </Button>
      {state?.error ? (
        <p role="alert" className="text-sm text-red-300 sm:col-span-3">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** ✋ Přijímám úkol k překreslení – atomicky na serveru (první vyhrává). */
export function ClaimTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      className="touch-target gap-2 bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
      disabled={pending}
      data-testid="pool-claim"
      onClick={() =>
        startTransition(async () => {
          const result = await claimPoolTaskAction(taskId);
          if (!result.ok) toast.error(result.error);
          else toast.success("✋ Úkol je váš – nikdo jiný ho už nepřevezme. Stáhněte balíček podkladů.");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Hand className="size-4" aria-hidden />}✋ Přijímám úkol k překreslení
    </Button>
  );
}

/** Odevzdání: nové čisté PDF schéma (+ zdrojový CAD) → nová revize schématu zařízení v závodě. */
export function PoolUploadForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <form
      className="grid gap-2 rounded-lg border border-border p-3"
      data-testid="pool-upload"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        form.set("taskId", taskId);
        setPending(true);
        try {
          const response = await fetch("/api/pool/upload", { method: "POST", body: form });
          const body = (await response.json().catch(() => null)) as { version?: string; error?: string } | null;
          if (!response.ok) return void toast.error(body?.error ?? "Odevzdání se nepodařilo.");
          toast.success(`Odevzdáno – nová revize ${body?.version ?? ""} čeká na schválení údržbou závodu.`);
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      <p className="text-sm font-medium">Odevzdat překreslené schéma</p>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Nové čisté PDF schéma (povinné, do 25 MB)
        <input name="pdf" type="file" accept="application/pdf,.pdf" required className="text-sm" data-testid="pool-upload-pdf" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Zdrojový CAD soubor (DWG / DXF nebo projekt PC|SCHEMATIC / EPLAN zabalený v ZIP, nepovinné)
        <input name="cad" type="file" accept=".dwg,.dxf,.zip,.7z,.rar" className="text-sm" data-testid="pool-upload-cad" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Shrnutí změn ve schématu
        <Textarea name="summary" rows={2} maxLength={2000} placeholder="Doplněn jistič -F7 B16 pro zásuvkový okruh dílny, přečíslování svorek X2" data-testid="pool-upload-summary" />
      </label>
      <Button type="submit" className="touch-target w-fit gap-2" disabled={pending} data-testid="pool-upload-submit">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}Nahrát a odevzdat novou verzi schématu
      </Button>
    </form>
  );
}
