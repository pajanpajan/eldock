"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BatteryCharging, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { POWER_BACKUP_TIERS, tierOf, type PowerBackupTier } from "@/lib/power-backup";
import { cn } from "@/lib/utils";
import { updatePowerBackupAction } from "@/server/actions/power-backup";

/**
 * Fáze 93: karta rozváděče – úroveň zálohování napájení rozváděče a jeho přívodní trasy (běžná síť / dieselagregát
 * s ATS do 15 s / UPS < 0,5 s · ZIS IT), kapacita zdroje zálohy u kořene větve a nájemní jednotka / zdravotnické oddělení
 * pro hledání a filtr v areálu.
 */
export function PowerBackupCard({
  equipmentId,
  tag,
  tier: initialTier,
  capacityKva,
  tenantUnit,
  tiered,
  canEdit,
}: {
  equipmentId: string;
  tag: string;
  tier: PowerBackupTier;
  capacityKva: number | null;
  tenantUnit: string | null;
  /** Rozváděč / zdroj – úroveň zálohy jde nastavit; ostatní zařízení jen nájemní jednotku. */
  tiered: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [tier, setTier] = useState<PowerBackupTier>(initialTier);
  const [capacity, setCapacity] = useState(capacityKva ? String(capacityKva).replace(".", ",") : "");
  const [tenant, setTenant] = useState(tenantUnit ?? "");
  const [pending, startTransition] = useTransition();
  const info = tierOf(tier);
  const dirty = tier !== initialTier || tenant.trim() !== (tenantUnit ?? "") || (capacity.trim() ? Number(capacity.replace(",", ".")) : null) !== capacityKva;

  function save() {
    const kva = capacity.trim() ? Number(capacity.replace(",", ".")) : null;
    if (kva !== null && (!Number.isFinite(kva) || kva <= 0)) return void toast.error("Kapacitu zdroje zadejte v kVA (např. 250).");
    startTransition(async () => {
      const result = await updatePowerBackupAction({ equipmentId, tier, capacityKva: tier === "GRID_STANDARD" ? null : kva, tenantUnit: tenant.trim() || null });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${tag}: ${tierOf(result.data.tier).label}${result.data.tenantUnit ? ` · ${result.data.tenantUnit}` : ""}`);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 lg:col-span-2" aria-label="Zálohování napájení" data-testid="power-backup-card">
      <div className="flex flex-wrap items-center gap-2">
        <BatteryCharging className="size-5 text-primary" aria-hidden />
        <h2 className="font-semibold">Zálohování napájení a nájemní jednotka</h2>
        {tiered ? (
          <span className="rounded px-2 py-0.5 font-mono text-xs font-bold text-white" style={{ background: info.color }} data-testid="power-backup-badge">
            {info.badge}
          </span>
        ) : null}
      </div>
      {tiered ? (
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Úroveň zálohování napájení">
          {POWER_BACKUP_TIERS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={tier === option.id}
              disabled={!canEdit}
              onClick={() => setTier(option.id)}
              className={cn("rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default", tier === option.id ? "border-transparent text-white" : "border-border bg-background hover:bg-muted/50")}
              style={tier === option.id ? { background: option.color } : undefined}
              data-testid={`power-tier-${option.id}`}
            >
              <span className="block font-semibold">{option.badge}</span>
              <span className={cn("block text-xs", tier === option.id ? "text-white/90" : "text-muted-foreground")}>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      {tiered ? <p className="text-xs text-muted-foreground">{info.hint} Úroveň platí i pro přívodní trasu rozváděče; podřízené rozváděče ji dědí, pokud nemají vlastní.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {tiered && tier !== "GRID_STANDARD" ? (
          <div className="space-y-1">
            <Label htmlFor="backup-capacity">Kapacita zdroje zálohy {info.source} [kVA] (u kořene větve)</Label>
            <Input id="backup-capacity" inputMode="decimal" value={capacity} onChange={(event) => setCapacity(event.target.value)} disabled={!canEdit} placeholder="např. 250" className="h-10" data-testid="backup-capacity" />
          </div>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="tenant-unit">Nájemní jednotka / Zdravotnické oddělení</Label>
          <Input id="tenant-unit" value={tenant} onChange={(event) => setTenant(event.target.value)} disabled={!canEdit} maxLength={120} placeholder="např. Jednotka A12 – Lékárna / Interní oddělení 2. NP" className="h-10" data-testid="tenant-unit" />
        </div>
      </div>
      {canEdit ? (
        <Button type="button" onClick={save} disabled={pending || !dirty} className="gap-1.5" data-testid="power-backup-save">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Uložit zálohování a jednotku
        </Button>
      ) : null}
    </section>
  );
}
