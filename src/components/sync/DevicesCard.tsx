"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { CircleCheck, Loader2, LogOut, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { DEVICE_SYNC_STATE } from "@/lib/status";
import { SYNC_PLATFORM_LABELS } from "@/lib/sync";
import { cn } from "@/lib/utils";
import type { SyncPlatform } from "@/generated/prisma/enums";
import { createPairingCodeAction, revokeMyDeviceAction } from "@/server/actions/sync";
import type { DeviceRow } from "@/server/queries/sync";

const CARD = "space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5";

interface Pairing {
  code: string;
  expiresAt: string;
  server: string;
  uri: string;
  /** Počet zařízení při vytvoření kódu – nové zařízení v seznamu = spárováno. */
  known: number;
}

/** Řádek zařízení: platforma, verze, stav synchronizace. */
export function DeviceSummary({ device }: { device: DeviceRow }) {
  const style = DEVICE_SYNC_STATE[device.state];
  const Icon = style.icon;
  return (
    <span className="min-w-0">
      <span className="font-medium">{device.name}</span>
      <span className="ml-2 text-xs text-muted-foreground">
        {SYNC_PLATFORM_LABELS[device.platform as SyncPlatform] ?? device.platform}
        {device.appVersion ? ` · aplikace ${device.appVersion}` : ""}
      </span>
      <span className={cn("mt-1 flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs", style.badge)} title={style.description} data-testid="device-state">
        <Icon className="size-3" aria-hidden />
        {style.label}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">
        spárováno {formatDateTime(device.createdAt)}
        {device.lastPullAt ? ` · naposledy synchronizováno ${formatDateTime(device.lastPullAt)}` : ""}
        {device.lastPushAt ? ` · úpravy odeslány ${formatDateTime(device.lastPushAt)}` : ""}
      </span>
    </span>
  );
}

/** Fáze 70: „Aplikace a zařízení“ v „Můj účet“ – spárování aplikace kódem / QR a odpojení vlastních zařízení. */
export function DevicesCard({ devices }: { devices: DeviceRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const paired = pairing !== null && devices.length > pairing.known;
  const secondsLeft = pairing ? Math.max(0, Math.round((new Date(pairing.expiresAt).getTime() - now) / 1000)) : 0;

  // Odpočet platnosti kódu a obnova seznamu – zařízení spárované v aplikaci se tu samo objeví
  useEffect(() => {
    if (!pairing || paired) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => router.refresh(), 4000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [pairing, paired, router]);

  function start() {
    startTransition(async () => {
      const result = await createPairingCodeAction();
      if (!result.ok) return void toast.error(result.error);
      setNow(Date.now());
      setPairing({ ...result.data, known: devices.length });
    });
  }

  function revoke(device: DeviceRow) {
    startTransition(async () => {
      const result = await revokeMyDeviceAction(device.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${device.name}: zařízení odpojeno.`);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="devices" className={CARD} data-testid="devices-card">
      <h2 id="devices" className="flex items-center gap-2 text-lg font-semibold">
        <Smartphone className="size-5 text-primary" aria-hidden />
        Aplikace a zařízení
      </h2>
      <p className="text-sm text-muted-foreground">
        Aplikace Eldock pro Windows, iPhone a Android pracují s daty závodu i bez signálu v hale – úpravy (změny, provizoria, odstranění závad, fotky) odešlou po připojení. Offline zařízení synchronizujte aspoň jednou denně.
        Aplikace pro Windows a Android jsou ve zkušebním provozu (instalace mimo obchody), aplikace pro iPhone vyjde s účtem v App Store.
      </p>

      {pairing ? (
        paired ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm" role="status" data-testid="pair-done">
            <span className="flex items-center gap-2">
              <CircleCheck className="size-4 text-emerald-400" aria-hidden />
              Zařízení je spárované – aplikace teď stahuje data závodu.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => setPairing(null)}>
              Hotovo
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 rounded-lg border border-primary/40 bg-primary/5 p-3 sm:grid-cols-[auto_1fr]" data-testid="pairing">
            <div className="w-fit rounded-lg bg-white p-3" data-testid="pair-qr" data-uri={pairing.uri}>
              <QRCodeSVG value={pairing.uri} size={176} aria-label="QR kód pro spárování aplikace Eldock" />
            </div>
            <div className="space-y-2 text-sm">
              <p>1. V aplikaci Eldock zvolte „Spárovat zařízení“ a naskenujte QR kód.</p>
              <p>2. Bez fotoaparátu opište adresu serveru a kód:</p>
              <p className="font-mono text-xs break-all text-muted-foreground" data-testid="pair-server">
                {pairing.server}
              </p>
              <p className="font-mono text-2xl font-semibold tracking-widest" data-testid="pair-code">
                {pairing.code}
              </p>
              <p className="text-xs text-muted-foreground">
                Aplikace Eldock na tomto počítači nebo telefonu:{" "}
                <a href={pairing.uri} className="font-medium text-primary underline-offset-2 hover:underline" data-testid="pair-open-app">
                  otevřít a spárovat jedním klikem
                </a>
              </p>
              <p className={cn("text-xs", secondsLeft ? "text-muted-foreground" : "text-red-400")}>
                {secondsLeft
                  ? `Kód platí ještě ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")} a jde použít jen jednou.`
                  : "Kód vypršel – vytvořte nový."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={start}>
                  Nový kód
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPairing(null)}>
                  Zavřít
                </Button>
              </div>
            </div>
          </div>
        )
      ) : (
        <Button type="button" className="gap-2" disabled={pending} onClick={start} data-testid="pair-start">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Smartphone className="size-4" aria-hidden />}
          Spárovat nové zařízení
        </Button>
      )}

      {devices.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border" data-testid="my-devices">
          {devices.map((device) => (
            <li key={device.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm" data-testid={`device-row-${device.id}`}>
              <DeviceSummary device={device} />
              <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={pending} onClick={() => revoke(device)}>
                <LogOut className="size-3.5" aria-hidden />
                Odpojit
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Zatím žádné spárované zařízení.</p>
      )}
    </section>
  );
}
