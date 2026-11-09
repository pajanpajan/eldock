// Fáze 71 a 73: aplikace Eldock (Windows, Android, iOS) – rozvržení, hlavička se stavem synchronizace, spodní lišta
// na telefonu (Přehled, Skenovat, Úpravy, Nastavení) a přepínání obrazovek. Systémové tlačítko Zpět (Android) zavře
// nejdřív dialog, pak obrazovku, na přehledu pošle aplikaci do pozadí.

import { AlertTriangle, CloudOff, Home, ListTodo, Loader2, QrCode, RefreshCw, Settings, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";

import { formatCount, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseScan } from "@/sync-client";

import { bridge, touchUi } from "./bridge";
import { useOutbox } from "./data";
import { PAIR_LINK_EVENT, ScannerProvider, useScanResolver, useScanner } from "./scan";
import { EquipmentScreen } from "./screens/EquipmentScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PairScreen } from "./screens/PairScreen";
import { QueueScreen } from "./screens/QueueScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SyncProvider, progressLabel, useSync } from "./sync";
import { Button, closeTopLayer } from "./ui";

export type Route = { name: "home"; query?: string } | { name: "equipment"; id: string; scannedToken?: string | null } | { name: "queue" } | { name: "settings" };

export interface Navigation {
  open: (route: Route) => void;
  back: () => void;
  /** Spodní lišta: přepnout na hlavní obrazovku bez hromadění historie (Zpět pak vede na přehled). */
  switchTo: (route: Route) => void;
}

export function App() {
  return (
    <SyncProvider>
      <ScannerProvider>
        <Shell />
      </ScannerProvider>
      <Toaster theme="dark" richColors position={touchUi ? "top-center" : "bottom-right"} closeButton offset={touchUi ? { top: "calc(var(--safe-top) + 0.75rem)" } : undefined} mobileOffset={{ top: "calc(var(--safe-top) + 0.5rem)", bottom: "calc(var(--safe-bottom) + 5rem)", left: "0.75rem", right: "0.75rem" }} />
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
  const depth = useRef(stack.length);
  useEffect(() => {
    depth.current = stack.length;
  }, [stack.length]);

  const navigation = useMemo<Navigation>(
    () => ({
      open: (next) => setStack((current) => [...current.slice(-30), next]),
      back: () => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current)),
      switchTo: (next) => setStack(next.name === "home" ? [next] : [{ name: "home" }, next]),
    }),
    [],
  );

  // Odkaz „otevřít a spárovat“ z webu (eldock://pair?server=…&code=…) nebo naskenovaný párovací QR
  const handleLink = useCallback((link: string) => {
    const scan = parseScan(link);
    if (scan.kind === "pairing") setPairLink({ server: scan.server, code: scan.code });
    else toast.error("Odkaz nepatří aplikaci Eldock.");
  }, []);
  useEffect(() => {
    void bridge.takeDeepLink().then((link) => link && handleLink(link));
    const onPairLink = (event: Event) => handleLink(String((event as CustomEvent<string>).detail ?? ""));
    window.addEventListener(PAIR_LINK_EVENT, onPairLink);
    const stop = bridge.onDeepLink(handleLink);
    return () => {
      stop();
      window.removeEventListener(PAIR_LINK_EVENT, onPairLink);
    };
  }, [handleLink]);
  // Nastavení → Spárovat znovu (stejný server, nový kód)
  const server = status?.server ?? null;
  useEffect(() => {
    const repair = () => setPairLink({ server: server ?? "eldock.cz", code: "" });
    window.addEventListener("eldock:repair", repair);
    return () => window.removeEventListener("eldock:repair", repair);
  }, [server]);

  // Zpět (Android): dialog nebo párování → předchozí obrazovka → aplikace do pozadí
  useEffect(() => {
    if (!bridge.onBack) return;
    return bridge.onBack(() => {
      if (closeTopLayer()) return;
      if (depth.current > 1) navigation.back();
      else void bridge.minimize?.();
    });
  }, [navigation]);

  const { scan } = useScanner();
  const resolveScan = useScanResolver(navigation);
  const startScan = useCallback(() => void scan(resolveScan), [scan, resolveScan]);

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
      <main className="app-main flex-1 overflow-y-auto">
        {route.name === "home" ? <HomeScreen key={route.query ?? ""} initialQuery={route.query ?? ""} navigation={navigation} /> : null}
        {route.name === "equipment" ? <EquipmentScreen key={route.id} id={route.id} scannedToken={route.scannedToken ?? null} navigation={navigation} /> : null}
        {route.name === "queue" ? <QueueScreen navigation={navigation} /> : null}
        {route.name === "settings" ? <SettingsScreen navigation={navigation} /> : null}
      </main>
      <MobileNav route={route} navigation={navigation} onScan={startScan} />
    </div>
  );
}

function SyncPill() {
  const { status, syncing, progress, online } = useSync();
  if (!status) return null;
  const pending = status.pending ? ` · ${formatCount(status.pending, ["čeká úprava", "čekají úpravy", "čeká úprav"])}` : "";
  let tone = "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  let icon = <ShieldCheck className="size-4 shrink-0" aria-hidden />;
  const via = status.serverName && status.serverName !== "Eldock" ? " se serverem závodu" : "";
  let text = status.lastSyncAt ? `Synchronizováno${via} ${formatRelative(status.lastSyncAt)}${pending}` : `Zatím nesynchronizováno${pending}`;
  if (syncing) {
    tone = "border-sky-500/40 bg-sky-500/10 text-sky-300";
    icon = <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />;
    text = progressLabel(progress);
  } else if (!online || status.offline) {
    tone = "border-amber-500/40 bg-amber-500/10 text-amber-300";
    icon = <CloudOff className="size-4 shrink-0" aria-hidden />;
    text = `Offline${status.lastSyncAt ? ` – data z ${formatRelative(status.lastSyncAt)}` : ""}${pending}`;
  } else if (status.stale) {
    tone = "border-red-500/40 bg-red-500/10 text-red-300";
    icon = <AlertTriangle className="size-4 shrink-0" aria-hidden />;
    text = `Nesynchronizováno déle než 24 h${pending}`;
  }
  return (
    <span className={cn("inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border px-3 py-1 text-sm", tone)} data-testid="sync-status" title={status.lastError ?? undefined}>
      {icon}
      <span className="truncate">{text}</span>
    </span>
  );
}

function useWaiting() {
  const { status } = useSync();
  const outbox = useOutbox();
  const rejected = outbox?.filter((item) => item.status === "rejected").length ?? 0;
  return { waiting: (status?.pending ?? 0) + rejected, rejected };
}

function WaitingBadge({ waiting, rejected, className }: { waiting: number; rejected: number; className?: string }) {
  if (!waiting) return null;
  return <span className={cn("rounded-full px-1.5 text-xs font-semibold", rejected ? "bg-red-500 text-white" : "bg-primary text-primary-foreground", className)}>{waiting}</span>;
}

function Header({ navigation }: { navigation: Navigation }) {
  const { status, syncing, syncNow } = useSync();
  const { waiting, rejected } = useWaiting();
  const plantNames = status?.session?.plants.map((plant) => plant.name).join(", ");
  return (
    <header className="app-header flex items-center gap-2 border-b border-border bg-card/60 px-3 pb-2 sm:gap-3 sm:px-4">
      <button type="button" className="flex shrink-0 items-center gap-2 rounded-lg pr-1 text-left sm:pr-2" onClick={() => navigation.switchTo({ name: "home" })}>
        <Logo />
        <span className="leading-tight">
          <span className="block font-semibold">Eldock</span>
          <span className="hidden max-w-56 truncate text-xs text-muted-foreground sm:block">
            {status?.session?.company.name}
            {plantNames ? ` · ${plantNames}` : ""}
          </span>
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <SyncPill />
      </div>
      <span className="hidden text-sm text-muted-foreground lg:inline">{status?.user?.name}</span>
      <Button variant="outline" size="sm" className="shrink-0" onClick={() => void syncNow()} busy={syncing} aria-label="Synchronizovat" data-testid="sync-now">
        {syncing ? null : <RefreshCw className="size-4" aria-hidden />}
        <span className="hidden sm:inline">Synchronizovat</span>
      </Button>
      <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={() => navigation.open({ name: "queue" })} data-testid="open-queue">
        <ListTodo className="size-4" aria-hidden />
        Úpravy
        <WaitingBadge waiting={waiting} rejected={rejected} />
      </Button>
      <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => navigation.open({ name: "settings" })} aria-label="Nastavení" data-testid="open-settings">
        <Settings className="size-4" aria-hidden />
      </Button>
    </header>
  );
}

/** Spodní lišta telefonu (pod šířkou tabletu). */
function MobileNav({ route, navigation, onScan }: { route: Route; navigation: Navigation; onScan: () => void }) {
  const { waiting, rejected } = useWaiting();
  const item = (active: boolean) => cn("flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs font-medium", active ? "text-primary" : "text-muted-foreground");
  return (
    <nav className="app-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card/95 backdrop-blur md:hidden" aria-label="Hlavní menu" data-testid="mobile-nav">
      <button type="button" className={item(route.name === "home" || route.name === "equipment")} onClick={() => navigation.switchTo({ name: "home" })} data-testid="nav-home">
        <Home className="size-5" aria-hidden />
        Přehled
      </button>
      <button type="button" className={item(false)} onClick={onScan} data-testid="nav-scan">
        <span className="flex h-7 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <QrCode className="size-5" aria-hidden />
        </span>
        Skenovat
      </button>
      <button type="button" className={item(route.name === "queue")} onClick={() => navigation.switchTo({ name: "queue" })} data-testid="nav-queue">
        <span className="relative">
          <ListTodo className="size-5" aria-hidden />
          <WaitingBadge waiting={waiting} rejected={rejected} className="absolute -top-2 left-3" />
        </span>
        Úpravy
      </button>
      <button type="button" className={item(route.name === "settings")} onClick={() => navigation.switchTo({ name: "settings" })} data-testid="nav-settings">
        <Settings className="size-5" aria-hidden />
        Nastavení
      </button>
    </nav>
  );
}
