"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Copy, KeyRound, Loader2, LogOut, MonitorSmartphone, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { PasswordRules } from "@/components/auth/PasswordForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { passwordIssues } from "@/lib/password-policy";
import { changePasswordAction, confirmTotpAction, disableTotpAction, revokeOtherSessionsAction, revokeSessionAction, startTotpAction } from "@/server/actions/account";

const CARD = "space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5";

/** Změna hesla (fáze 67) – ostatní zařízení se odhlásí. */
export function ChangePasswordCard({ email, name, forced }: { email: string; name: string; forced: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const valid = current.length > 0 && passwordIssues(next, { email, name }).length === 0 && next === confirm;

  function submit() {
    startTransition(async () => {
      const result = await changePasswordAction({ current, next, confirm });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Heslo je změněné.", { description: result.data.revoked ? `Ostatní zařízení (${result.data.revoked}) byla odhlášena.` : undefined });
      setCurrent("");
      setNext("");
      setConfirm("");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="change-password" className={CARD} data-testid="change-password">
      <h2 id="change-password" className="flex items-center gap-2 text-lg font-semibold">
        <KeyRound className="size-5 text-primary" aria-hidden />
        Heslo
      </h2>
      {forced ? (
        <p role="status" className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" data-testid="must-change-password">
          Účet dosud používal společné heslo firmy. Nastavte si prosím vlastní heslo, které nikdo jiný nezná.
        </p>
      ) : null}
      <input type="hidden" name="username" value={email} autoComplete="username" readOnly />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Současné heslo</Label>
          <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="next-password">Nové heslo</Label>
          <Input id="next-password" type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Nové heslo znovu</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-11" />
        </div>
      </div>
      <PasswordRules password={next} email={email} name={name} />
      <Button className="touch-target gap-2" onClick={submit} disabled={pending || !valid}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
        Změnit heslo
      </Button>
    </section>
  );
}

export interface SessionRow {
  id: string;
  device: string | null;
  createdAt: string;
  lastSeenAt: string;
}

/** Přihlášená zařízení – odhlášení jednotlivě i všude jinde. */
export function SessionsCard({ sessions, currentId }: { sessions: SessionRow[]; currentId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const others = sessions.filter((session) => session.id !== currentId);

  function act(action: () => Promise<{ ok: true; data: { count: number } } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.data.count ? `Odhlášeno zařízení: ${result.data.count}.` : "Žádné další zařízení není přihlášené.");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="sessions" className={CARD} data-testid="sessions">
      <h2 id="sessions" className="flex items-center gap-2 text-lg font-semibold">
        <MonitorSmartphone className="size-5 text-primary" aria-hidden />
        Přihlášená zařízení
      </h2>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {sessions.map((session) => (
          <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
            <span>
              <span className="font-medium">{session.device ?? "Neznámé zařízení"}</span>
              {session.id === currentId ? <span className="ml-2 rounded-full border border-primary/60 px-2 py-0.5 text-xs text-primary">toto zařízení</span> : null}
              <span className="block text-xs text-muted-foreground">
                přihlášeno {formatDateTime(session.createdAt)} · naposledy aktivní {formatDateTime(session.lastSeenAt)}
              </span>
            </span>
            {session.id !== currentId ? (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={pending} onClick={() => act(() => revokeSessionAction(session.id))}>
                <LogOut className="size-3.5" aria-hidden />
                Odhlásit
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {others.length ? (
        <Button type="button" variant="outline" className="gap-2" disabled={pending} onClick={() => act(() => revokeOtherSessionsAction())}>
          <LogOut className="size-4" aria-hidden />
          Odhlásit všechna ostatní zařízení
        </Button>
      ) : null}
    </section>
  );
}

/** Dvoufázové ověření: spárování aplikace Authenticator (QR), záložní kódy a vypnutí. */
export function TwoFactorCard({ enabledAt, codesLeft }: { enabledAt: string | null; codesLeft: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");

  const start = () =>
    startTransition(async () => {
      const result = await startTotpAction();
      if (!result.ok) return void toast.error(result.error);
      setSetup(result.data);
    });
  const confirm = () =>
    startTransition(async () => {
      const result = await confirmTotpAction(code);
      if (!result.ok) return void toast.error(result.error);
      setCodes(result.data.codes);
      setSetup(null);
      setCode("");
      toast.success("Dvoufázové ověření je zapnuté.");
      router.refresh();
    });
  const disable = () =>
    startTransition(async () => {
      const result = await disableTotpAction(password);
      if (!result.ok) return void toast.error(result.error);
      setPassword("");
      toast.success("Dvoufázové ověření je vypnuté.");
      router.refresh();
    });

  return (
    <section aria-labelledby="two-factor" className={CARD} data-testid="two-factor">
      <h2 id="two-factor" className="flex items-center gap-2 text-lg font-semibold">
        <ShieldCheck className="size-5 text-primary" aria-hidden />
        Dvoufázové ověření
      </h2>
      {codes ? (
        <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm" data-testid="recovery-codes">
          <p className="font-semibold">Záložní kódy – uložte si je teď, znovu se nezobrazí.</p>
          <p className="text-xs text-muted-foreground">Každý kód platí jednou, když nemáte po ruce telefon.</p>
          <ul className="grid grid-cols-2 gap-1 font-mono sm:grid-cols-4">
            {codes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => navigator.clipboard.writeText(codes.join("\n")).then(() => toast.success("Kódy zkopírovány."))}>
            <Copy className="size-3.5" aria-hidden />
            Kopírovat kódy
          </Button>
        </div>
      ) : null}
      {enabledAt ? (
        <div className="space-y-3">
          <p className="text-sm">
            Zapnuto {formatDateTime(enabledAt)} · zbývá záložních kódů: <span className="font-semibold">{codesLeft}</span>
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="totp-disable-password">Heslo pro vypnutí</Label>
              <Input id="totp-disable-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 w-56" />
            </div>
            <Button type="button" variant="outline" className="gap-1.5" disabled={pending || !password} onClick={disable}>
              <ShieldOff className="size-4" aria-hidden />
              Vypnout
            </Button>
          </div>
        </div>
      ) : setup ? (
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="rounded-lg bg-white p-3">
            <QRCodeSVG value={setup.uri} size={176} aria-label="QR kód pro aplikaci Authenticator" />
          </div>
          <div className="space-y-2 text-sm">
            <p>1. V aplikaci Authenticator (Google, Microsoft, 1Password …) naskenujte QR kód, nebo zadejte klíč:</p>
            <p className="font-mono text-xs break-all" data-testid="totp-secret">
              {setup.secret}
            </p>
            <p>2. Opište šestimístný kód, který aplikace ukáže:</p>
            <div className="flex flex-wrap items-end gap-2">
              <Input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={8} className="h-11 w-40 font-mono text-lg tracking-widest" aria-label="Kód z aplikace" />
              <Button type="button" className="gap-1.5" disabled={pending || code.replace(/\s/g, "").length !== 6} onClick={confirm}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
                Zapnout
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Při přihlášení bude kromě hesla potřeba kód z aplikace v telefonu. Doporučujeme zejména technickému řediteli a vedení údržby.</p>
          <Button type="button" className="gap-1.5" disabled={pending} onClick={start}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
            Zapnout dvoufázové ověření
          </Button>
        </div>
      )}
    </section>
  );
}
