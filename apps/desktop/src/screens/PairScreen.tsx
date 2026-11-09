// Fáze 71: spárování aplikace kódem z webu (Můj účet → Aplikace a zařízení) nebo odkazem „otevřít a spárovat“.

import { KeyRound, Link2, Lock, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { formatCount } from "@/lib/format";
import { formatPairingCode } from "@/lib/sync";
import { normalizeServerUrl, parseScan, type EngineStatus } from "@/sync-client";

import { bridge } from "../bridge";
import { progressLabel, useSync } from "../sync";
import { Button, Field, inputClass } from "../ui";

const isPlainHttp = (server: string) => {
  const url = normalizeServerUrl(server);
  return url.startsWith("http://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url);
};

export function PairScreen({ prefill, status, onDone, onCancel }: { prefill: { server: string; code: string } | null; status: EngineStatus; onDone: () => void; onCancel?: () => void }) {
  const { engine, syncNow, syncing, progress } = useSync();
  const [server, setServer] = useState(prefill?.server ?? status.server ?? "eldock.cz");
  const [code, setCode] = useState(prefill?.code ? formatPairingCode(prefill.code) : "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiting = status.pending + status.foreign;

  useEffect(() => {
    void bridge.appInfo().then((info) => setName((current) => current || `Windows – ${info.hostname}`));
  }, []);

  const fillFromLink = (text: string) => {
    const scan = parseScan(text);
    if (scan.kind !== "pairing") return false;
    setServer(scan.server);
    setCode(formatPairingCode(scan.code));
    return true;
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await engine.pair({ server, code, name });
      toast.success(`Spárováno: ${session.user.name}, ${session.company.name}. Stahuji data závodu…`);
      const report = await syncNow();
      if (report && !report.ok && report.error) toast.warning(report.error);
      onDone();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Spárování se nepodařilo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form
        className="w-full max-w-xl space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        data-testid="pair-form"
      >
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <KeyRound className="size-5 text-primary" aria-hidden />
            {status.paired ? "Spárovat znovu" : "Spárování aplikace"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Kód vytvoříte na webu Eldock: <strong>Můj účet → Aplikace a zařízení → Spárovat nové zařízení</strong>. Platí 10 minut a jen jednou. Na stejném počítači stačí na webu kliknout na „otevřít a spárovat jedním klikem“.
          </p>
        </div>

        {status.unpairedReason && !status.paired ? (
          <p className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200" data-testid="unpaired-reason">
            <ShieldAlert className="size-4 shrink-0" aria-hidden />
            <span>
              {status.unpairedReason}
              {waiting ? ` Ve frontě ${formatCount(waiting, ["zůstala úprava", "zůstaly úpravy", "zůstalo úprav"])} – odešlou se po spárování stejným účtem.` : ""}
            </span>
          </p>
        ) : null}
        {status.paired ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">Zařízení je spárované ({status.user?.name}). Nové spárování jiným účtem stáhne jeho data; úpravy ve frontě zůstanou původnímu uživateli.</p>
        ) : null}

        <Field label="Adresa serveru" hint="eldock.cz, nebo adresa serveru závodu v interní síti">
          <input className={inputClass} value={server} onChange={(event) => setServer(event.target.value)} autoComplete="off" spellCheck={false} data-testid="pair-server-input" />
        </Field>
        {isPlainHttp(server) ? (
          <p className="flex gap-2 text-xs text-amber-300">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            Spojení přes http není šifrované – používejte ho jen v interní síti závodu.
          </p>
        ) : null}
        <Field label="Kód párování" hint="8 znaků, např. K7QX-3MZP (velikost písmen ani pomlčka nevadí)">
          <input
            className={`${inputClass} font-mono text-lg tracking-widest uppercase`}
            value={code}
            onChange={(event) => {
              if (!fillFromLink(event.target.value)) setCode(event.target.value.toUpperCase().slice(0, 12));
            }}
            onPaste={(event) => {
              if (fillFromLink(event.clipboardData.getData("text"))) event.preventDefault();
            }}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            data-testid="pair-code-input"
          />
        </Field>
        <Field label="Název zařízení" hint="Uvidíte ho v Můj účet a správce firmy v Administraci → Zařízení">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} data-testid="pair-name-input" />
        </Field>

        {error ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200" role="alert" data-testid="pair-error">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Link2 className="size-3.5" aria-hidden />
            Odkaz eldock://pair… můžete vložit i do pole kódu.
          </span>
          <div className="flex gap-2">
            {onCancel ? (
              <Button variant="ghost" onClick={onCancel}>
                Zrušit
              </Button>
            ) : null}
            <Button type="submit" size="lg" busy={busy} data-testid="pair-submit">
              {busy && syncing ? progressLabel(progress) : "Spárovat"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
