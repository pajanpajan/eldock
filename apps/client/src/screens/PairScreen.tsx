// Fáze 71 a 73: spárování aplikace kódem z webu (Můj účet → Aplikace a zařízení) – naskenováním QR kódu z webu
// (telefon fotoaparátem, počítač webkamerou), odkazem „otevřít a spárovat“, nebo opsáním adresy serveru a kódu.

import { KeyRound, Link2, Lock, QrCode, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { formatCount } from "@/lib/format";
import { formatPairingCode } from "@/lib/sync";
import { normalizeServerUrl, parseScan, type EngineStatus } from "@/sync-client";

import { bridge, touchUi } from "../bridge";
import { useScanner } from "../scan";
import { progressLabel, useSync } from "../sync";
import { Button, Field, inputClass, useBackHandler } from "../ui";

const isPlainHttp = (server: string) => {
  const url = normalizeServerUrl(server);
  return url.startsWith("http://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url);
};

export function PairScreen({ prefill, status, onDone, onCancel }: { prefill: { server: string; code: string } | null; status: EngineStatus; onDone: () => void; onCancel?: () => void }) {
  const { engine, syncNow, syncing, progress } = useSync();
  const { scan } = useScanner();
  const [server, setServer] = useState(prefill?.server ?? status.server ?? "eldock.cz");
  const [code, setCode] = useState(prefill?.code ? formatPairingCode(prefill.code) : "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiting = status.pending + status.foreign;
  useBackHandler(Boolean(onCancel), () => onCancel?.());

  useEffect(() => {
    void bridge.appInfo().then((info) => setName((current) => current || info.deviceName));
  }, []);

  const fillFromLink = (text: string) => {
    const scan = parseScan(text);
    if (scan.kind !== "pairing") return null;
    setServer(scan.server);
    setCode(formatPairingCode(scan.code));
    return scan;
  };

  const submit = async (values: { server: string; code: string } = { server, code }) => {
    setBusy(true);
    setError(null);
    try {
      const deviceName = name.trim() || (await bridge.appInfo()).deviceName;
      const session = await engine.pair({ server: values.server, code: values.code, name: deviceName });
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

  // QR z webu (Můj účet → Aplikace a zařízení) nese adresu serveru i kód – spáruje se rovnou
  const scanPairing = () =>
    void scan((text) => {
      const pairing = fillFromLink(text);
      if (!pairing) {
        toast.error("To není QR kód pro spárování – na webu otevřete Můj účet → Aplikace a zařízení → Spárovat nové zařízení.");
        return false;
      }
      void submit({ server: pairing.server, code: pairing.code });
      return true;
    });

  return (
    <div className="app-safe flex min-h-full items-center justify-center p-3 sm:p-6">
      <form
        className="w-full max-w-xl space-y-5 rounded-2xl border border-border bg-card p-4 shadow-xl sm:p-6"
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
            Kód vytvoříte na webu Eldock: <strong>Můj účet → Aplikace a zařízení → Spárovat nové zařízení</strong>. Platí 10 minut a jen jednou.{" "}
            {bridge.mobile ? "Naskenujte QR kód z obrazovky počítače, nebo na webu v telefonu klepněte na „otevřít a spárovat jedním klikem“." : "Na stejném počítači stačí na webu kliknout na „otevřít a spárovat jedním klikem“."}
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
        {!status.unpairedReason && !status.paired && waiting ? (
          <p className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200" data-testid="waiting-before-pair">
            <ShieldAlert className="size-4 shrink-0" aria-hidden />V zařízení {formatCount(waiting, ["čeká úprava", "čekají úpravy", "čeká úprav"])} – odešlou se po spárování stejným účtem.
          </p>
        ) : null}
        {status.paired ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">Zařízení je spárované ({status.user?.name}). Nové spárování jiným účtem stáhne jeho data; úpravy ve frontě zůstanou původnímu uživateli.</p>
        ) : null}

        <Button size="lg" variant={bridge.mobile ? "primary" : "outline"} className="w-full" onClick={scanPairing} disabled={busy} data-testid="pair-scan">
          <QrCode className="size-5" aria-hidden />
          Naskenovat QR kód z webu
        </Button>

        <Field label="Adresa serveru" hint="eldock.cz, nebo adresa serveru závodu v interní síti">
          <input className={inputClass} value={server} onChange={(event) => setServer(event.target.value)} inputMode="url" autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} data-testid="pair-server-input" />
        </Field>
        {isPlainHttp(server) ? (
          <p className="flex gap-2 text-xs text-amber-300">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            Spojení přes http není šifrované – používejte ho jen v interní síti závodu.
          </p>
        ) : null}
        <Field label="Kód párování" hint="8 znaků, např. K7QX-3MZP (velikost písmen ani pomlčka nevadí)">
          <input
            className={`${inputClass} font-mono text-lg tracking-widest uppercase sm:text-lg`}
            value={code}
            onChange={(event) => {
              if (!fillFromLink(event.target.value)) setCode(event.target.value.toUpperCase().slice(0, 12));
            }}
            onPaste={(event) => {
              if (fillFromLink(event.clipboardData.getData("text"))) event.preventDefault();
            }}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            autoFocus={!touchUi}
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
          <div className="flex w-full gap-2 sm:w-auto">
            {onCancel ? (
              <Button variant="ghost" onClick={onCancel}>
                Zrušit
              </Button>
            ) : null}
            <Button type="submit" size="lg" className="flex-1 sm:flex-none" busy={busy} data-testid="pair-submit">
              {busy && syncing ? progressLabel(progress) : "Spárovat"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
