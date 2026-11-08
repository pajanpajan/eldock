"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { DeviceSummary } from "@/components/sync/DevicesCard";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { SYNC_MUTATION_LABELS, type SyncMutationType } from "@/lib/sync";
import { revokeCompanyDeviceAction } from "@/server/actions/sync";
import type { DeviceRow } from "@/server/queries/sync";

interface RejectedRow {
  id: string;
  type: string;
  code: string | null;
  message: string | null;
  receivedAt: string;
  user: string;
  device: string | null;
}

/** Fáze 70: Administrace → Zařízení – aplikace všech zaměstnanců firmy, úpravy za 7 dní a odpojení. */
export function CompanyDevices({ devices, rejected }: { devices: DeviceRow[]; rejected: RejectedRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const active = devices.filter((device) => !device.revokedAt);
  const stale = active.filter((device) => device.state === "stale" || device.state === "never" || device.state === "expired");

  function revoke(device: DeviceRow) {
    if (!window.confirm(`Odpojit zařízení „${device.name}“ (${device.user?.name ?? "uživatel"})? Aplikace se bude muset spárovat znovu, neodeslané úpravy v ní zůstanou.`)) return;
    startTransition(async () => {
      const result = await revokeCompanyDeviceAction(device.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${device.name}: zařízení odpojeno.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="company-devices" className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5" data-testid="company-devices">
        <h2 id="company-devices" className="text-lg font-semibold">
          Spárované aplikace ({active.length})
        </h2>
        <p className="text-sm text-muted-foreground">
          Zaměstnanci párují aplikace sami v „Můj účet“ → „Aplikace a zařízení“. Ztracený telefon nebo odchod zaměstnance = odpojit (blokace účtu a změna hesla odpojí aplikace samy).
          {stale.length ? ` Bez synchronizace déle než 24 h: ${stale.length}.` : ""}
        </p>
        {devices.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {devices.map((device) => (
              <li key={device.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm" data-testid={`company-device-${device.id}`}>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-muted-foreground">{device.user?.name ?? "Uživatel"}</span>
                  <DeviceSummary device={device} />
                  <span className="block text-xs text-muted-foreground">
                    úpravy za 7 dní: {device.applied} provedeno{device.rejected ? `, ${device.rejected} odmítnuto` : ""}
                    {device.revokedAt ? ` · odpojeno ${formatDateTime(device.revokedAt)}${device.revokedReason ? ` (${device.revokedReason})` : ""}` : ""}
                  </span>
                </span>
                {device.revokedAt ? null : (
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={pending} onClick={() => revoke(device)}>
                    <LogOut className="size-3.5" aria-hidden />
                    Odpojit
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Žádný zaměstnanec zatím nespároval aplikaci.</p>
        )}
      </section>

      <section aria-labelledby="rejected-mutations" className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5" data-testid="rejected-mutations">
        <h2 id="rejected-mutations" className="text-lg font-semibold">
          Odmítnuté úpravy z aplikací (7 dní)
        </h2>
        {rejected.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {rejected.map((row) => (
              <li key={row.id} className="px-3 py-2">
                <span className="font-medium">{SYNC_MUTATION_LABELS[row.type as SyncMutationType] ?? row.type}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {formatDateTime(row.receivedAt)} · {row.user}
                  {row.device ? ` · ${row.device}` : ""}
                </span>
                <span className="block text-xs text-amber-300">{row.message ?? row.code}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Žádná odmítnutá úprava – vše z aplikací prošlo.</p>
        )}
      </section>
    </div>
  );
}
