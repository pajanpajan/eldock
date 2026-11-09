// Fáze 71: nastavení – účet a firma, server a zařízení, stav synchronizace, nové stažení dat a odpojení.

import { ArrowLeft, Download, KeyRound, LogOut, RefreshCw, Server, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { formatCount, formatDateTime } from "@/lib/format";

import type { Navigation } from "../App";
import { bridge, type AppInfo } from "../bridge";
import { db } from "../db";
import { useSync } from "../sync";
import { Button, Dialog, Fact, Section } from "../ui";

export function SettingsScreen({ navigation }: { navigation: Navigation }) {
  const { status, engine, syncNow, syncing } = useSync();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [counts, setCounts] = useState<{ records: number; files: number } | null>(null);
  const [confirm, setConfirm] = useState<"disconnect" | "reset" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void bridge.appInfo().then(setInfo);
    void Promise.all([db.records.count(), db.files.count()]).then(([records, files]) => setCounts({ records, files }));
  }, [status?.lastSyncAt]);

  const session = status?.session;
  const disconnect = async () => {
    setBusy(true);
    try {
      await engine.disconnect();
      toast.success("Zařízení je odpojené a místní data smazaná.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };
  const reset = async () => {
    setBusy(true);
    try {
      await engine.resetData();
      setConfirm(null);
      await syncNow();
      toast.success("Data závodu jsou stažená znovu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4" data-testid="settings-screen">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={navigation.back} aria-label="Zpět">
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <h1 className="text-xl font-semibold">Nastavení</h1>
      </div>

      <Section title="Účet" icon={<UserRound className="size-4 text-primary" aria-hidden />}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="Uživatel" value={status?.user ? `${status.user.name} (${status.user.email})` : null} />
          <Fact label="Typ účtu" value={status?.user?.accountLabel} />
          <Fact label="Firma" value={session ? `${session.company.name}, IČO ${session.company.ico}` : null} />
          <Fact label="Závody" value={session?.plants.map((plant) => plant.name).join(", ")} />
        </dl>
      </Section>

      <Section title="Server a zařízení" icon={<Server className="size-4 text-primary" aria-hidden />}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="Server" value={status?.server ? `${status.server}${status.serverName && status.serverName !== "Eldock" ? ` (${status.serverName})` : ""}` : null} />
          <Fact label="Zařízení" value={session?.device.name} />
          <Fact label="Spárováno" value={session?.device.pairedAt ? formatDateTime(session.device.pairedAt) : null} />
          <Fact label="Poslední úplná synchronizace" value={status?.lastSyncAt ? formatDateTime(status.lastSyncAt) : "zatím ne"} />
          <Fact label="Poslední chyba" value={status?.lastError} />
          <Fact label="Data v zařízení" value={counts ? `${formatCount(counts.records, ["záznam", "záznamy", "záznamů"])}, ${formatCount(counts.files, ["soubor", "soubory", "souborů"])}` : null} />
          <Fact label="Aplikace" value={info ? `Eldock pro Windows ${info.version}` : null} />
          <Fact label="Token zařízení" value={info ? (info.encrypted ? "zašifrovaný systémem Windows (DPAPI)" : "nešifrovaný (vývojový režim v prohlížeči)") : null} />
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void syncNow()} busy={syncing}>
            <RefreshCw className="size-4" aria-hidden />
            Synchronizovat
          </Button>
          <Button variant="outline" onClick={() => setConfirm("reset")}>
            <Download className="size-4" aria-hidden />
            Stáhnout data znovu
          </Button>
          <Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("eldock:repair"))}>
            <KeyRound className="size-4" aria-hidden />
            Spárovat znovu
          </Button>
          <Button variant="danger" onClick={() => setConfirm("disconnect")} data-testid="disconnect">
            <LogOut className="size-4" aria-hidden />
            Odpojit zařízení
          </Button>
        </div>
      </Section>

      <Dialog
        open={confirm === "disconnect"}
        title="Odpojit zařízení?"
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Zrušit
            </Button>
            <Button variant="danger" onClick={() => void disconnect()} busy={busy} data-testid="disconnect-confirm">
              Odpojit a smazat data
            </Button>
          </>
        }
      >
        <p className="text-sm">Token zařízení přestane platit a z počítače se smažou stažená data závodu.</p>
        {status?.pending ? <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">Pozor: {formatCount(status.pending, ["úprava ještě nebyla odeslána", "úpravy ještě nebyly odeslány", "úprav ještě nebylo odesláno"])} a smaže se. Nejdřív synchronizujte.</p> : null}
      </Dialog>
      <Dialog
        open={confirm === "reset"}
        title="Stáhnout data znovu?"
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Zrušit
            </Button>
            <Button onClick={() => void reset()} busy={busy}>
              Stáhnout znovu
            </Button>
          </>
        }
      >
        <p className="text-sm">Smaže stažená data závodu a stáhne je ze serveru znovu. Fronta úprav zůstane. Potřebuje připojení k síti.</p>
      </Dialog>
    </div>
  );
}
