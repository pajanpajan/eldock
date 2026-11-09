// Fáze 71: aplikace Eldock pro Windows – rozvržení, hlavička se stavem synchronizace a přepínání obrazovek.

import { AlertTriangle, CloudOff, ListTodo, Loader2, RefreshCw, Settings, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Toaster, toast } from "sonner";

import { formatCount, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseScan } from "@/sync-client";

import { bridge } from "./bridge";
import { useOutbox } from "./data";
import { EquipmentScreen } from "./screens/EquipmentScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PairScreen } from "./screens/PairScreen";
import { QueueScreen } from "./screens/QueueScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SyncProvider, progressLabel, useSync } from "./sync";
import { Button } from "./ui";

export type Route = { name: "home" } | { name: "equipment"; id: string; scannedToken?: string | null } | { name: "queue" } | { name: "settings" };

export interface Navigation {
  open: (route: Route) => void;
  back: () => void;
}

export function App() {
  return (
    <SyncProvider>
      <Shell />
      <Toaster theme="dark" richColors position="bottom-right" closeButton />
    </SyncProvider>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
      <rect x={1.5} y={1.5} width={29} height={29} rx={7} fill="#facc15" />
      <path d="M7 23V9.5h18V23" fill="none" stroke="#09090b" strokeWidth={2.6} strokeLinejoin="round" />
      <path d="M17.6 11.5 12.8 17.4h3.3l-1.4 4.2 4.9-6.1h-3.3z" fill="#09090b" />
      <rect x={4.5} y={23} width={23} height={4} rx={1} fill="#09090b" />
      <path d="M8 27l2.4-4M12.5 27l2.4-4M17 27l2.4-4M21.5 27l2.4-4" stroke="#facc15" strokeWidth={1.3} />
    </svg>
  );
}

function Shell() {
  const { status } = useSync();
  const [stack, setStack] = useState<Route[]>([{ name: "home" }]);
  const [pairLink, setPairLink] = useState<{ server: string; code: string } | null>(null);
  const route = stack[stack.length - 1] ?? { name: "home" };

  const navigation: Navigation = {
    open: (next) => setStack((current) => [...current.slice(-30), next]),
    back: () => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current)),
  };

  // Odkaz „otevřít a spárovat“ z webu (eldock://pair?server=…&code=…)
  const handleLink = useCallback((link: string) => {
    const scan = parseScan(link);
    if (scan.kind === "pairing") setPairLink({ server: scan.server, code: scan.code });
    else toast.error("Odkaz nepatří aplikaci Eldock.");
  }, []);
  useEffect(() => {
    void bridge.takeDeepLink().then((link) => link && handleLink(link));
    return bridge.onDeepLink(handleLink);
  }, [handleLink]);
  // Nastavení → Spárovat znovu (stejný server, nový kód)
  const server = status?.server ?? null;
  useEffect(() => {
    const repair = () => setPairLink({ server: server ?? "eldock.cz", code: "" });
    window.addEventListener("eldock:repair", repair);
    return () => window.removeEventListener("eldock:repair", repair);
  }, [server]);

  if (!status) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Načítám" />
      </div>
    );
  }

  if (!status.paired || pairLink) {
    return (
      <PairScreen
        key={pairLink ? `${pairLink.server}:${pairLink.code}` : "form"}
        prefill={pairLink}
        status={status}
        onDone={() => {
          setPairLink(null);
          setStack([{ name: "home" }]);
        }}
        onCancel={status.paired ? () => setPairLink(null) : undefined}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header navigation={navigation} />
      <main className="flex-1 overflow-y-auto">
        {route.name === "home" ? <HomeScreen navigation={navigation} /> : null}
        {route.name === "equipment" ? <EquipmentScreen key={route.id} id={route.id} scannedToken={route.scannedToken ?? null} navigation={navigation} /> : null}
        {route.name === "queue" ? <QueueScreen navigation={navigation} /> : null}
        {route.name === "settings" ? <SettingsScreen navigation={navigation} /> : null}
      </main>
    </div>
  );
}

function SyncPill() {
  const { status, syncing, progress, online } = useSync();
  if (!status) return null;
  const pending = status.pending ? ` · ${formatCount(status.pending, ["čeká úprava", "čekají úpravy", "čeká úprav"])}` : "";
  let tone = "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  let icon = <ShieldCheck className="size-4" aria-hidden />;
  const via = status.serverName && status.serverName !== "Eldock" ? " se serverem závodu" : "";
  let text = status.lastSyncAt ? `Synchronizováno${via} ${formatRelative(status.lastSyncAt)}${pending}` : `Zatím nesynchronizováno${pending}`;
  if (syncing) {
    tone = "border-sky-500/40 bg-sky-500/10 text-sky-300";
    icon = <Loader2 className="size-4 animate-spin" aria-hidden />;
    text = progressLabel(progress);
  } else if (!online || status.offline) {
    tone = "border-amber-500/40 bg-amber-500/10 text-amber-300";
    icon = <CloudOff className="size-4" aria-hidden />;
    text = `Offline${status.lastSyncAt ? ` – data z ${formatRelative(status.lastSyncAt)}` : ""}${pending}`;
  } else if (status.stale) {
    tone = "border-red-500/40 bg-red-500/10 text-red-300";
    icon = <AlertTriangle className="size-4" aria-hidden />;
    text = `Nesynchronizováno déle než 24 h${pending}`;
  }
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2 truncate rounded-full border px-3 py-1 text-sm", tone)} data-testid="sync-status" title={status.lastError ?? undefined}>
      {icon}
      <span className="truncate">{text}</span>
    </span>
  );
}

function Header({ navigation }: { navigation: Navigation }) {
  const { status, syncing, syncNow } = useSync();
  const outbox = useOutbox();
  const rejected = outbox?.filter((item) => item.status === "rejected").length ?? 0;
  const waiting = (status?.pending ?? 0) + rejected;
  const plantNames = status?.session?.plants.map((plant) => plant.name).join(", ");
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card/60 px-4 py-2">
      <button type="button" className="flex items-center gap-2 rounded-lg pr-2 text-left" onClick={() => navigation.open({ name: "home" })}>
        <Logo />
        <span className="leading-tight">
          <span className="block font-semibold">Eldock</span>
          <span className="block max-w-56 truncate text-xs text-muted-foreground">{status?.session?.company.name}{plantNames ? ` · ${plantNames}` : ""}</span>
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <SyncPill />
      </div>
      <span className="hidden text-sm text-muted-foreground lg:inline">{status?.user?.name}</span>
      <Button variant="outline" size="sm" onClick={() => void syncNow()} busy={syncing} data-testid="sync-now">
        {syncing ? null : <RefreshCw className="size-4" aria-hidden />}
        Synchronizovat
      </Button>
      <Button variant="outline" size="sm" onClick={() => navigation.open({ name: "queue" })} data-testid="open-queue">
        <ListTodo className="size-4" aria-hidden />
        Úpravy
        {waiting ? <span className={cn("rounded-full px-1.5 text-xs font-semibold", rejected ? "bg-red-500 text-white" : "bg-primary text-primary-foreground")}>{waiting}</span> : null}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => navigation.open({ name: "settings" })} aria-label="Nastavení" data-testid="open-settings">
        <Settings className="size-4" aria-hidden />
      </Button>
    </header>
  );
}
