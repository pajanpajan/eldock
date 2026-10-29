import { Construction, OctagonAlert } from "lucide-react";

import { PhotoGallery } from "@/components/equipment/PhotoGallery";
import { formatDateShort, formatDateTime, plural } from "@/lib/format";
import { TEMP_MOD_OVERDUE, TEMP_MOD_STATUS } from "@/lib/status";
import { tempModCountdown } from "@/lib/temporary-mod";
import { cn } from "@/lib/utils";
import type { EquipmentTemporaryMod } from "@/server/queries/equipment";

import { ResolveTemporaryModDialog } from "./ResolveTemporaryModDialog";

const DAYS = ["den", "dny", "dní"] as const;

/** Výrazné varování o aktivním provizoriu (fialové; po termínu červené). */
export function TemporaryModBanner({ mod, version, now, canResolve = true }: { mod: EquipmentTemporaryMod; version: string | null; now: Date; canResolve?: boolean }) {
  const { daysLeft, overdue } = tempModCountdown(mod.expiresAt, now);
  const style = overdue ? TEMP_MOD_OVERDUE : TEMP_MOD_STATUS.ACTIVE;
  const Icon = overdue ? OctagonAlert : Construction;

  return (
    <section role="alert" aria-label={`Aktivní provizorium ${mod.number}`} className={cn("space-y-4 rounded-2xl border-2 p-4 sm:p-5", style.soft)}>
      <div className="flex flex-wrap items-start gap-3">
        <Icon className={cn("mt-0.5 size-7 shrink-0", style.text)} aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn("text-sm font-bold tracking-wide uppercase", style.text)}>
            {overdue ? "PROVIZORIUM PO TERMÍNU!" : "Aktivní dočasné provizorium"} · <span className="font-mono">{mod.number}</span>
          </p>
          <h2 className="text-lg font-semibold">{mod.title}</h2>
          <p className="text-sm text-muted-foreground">
            Zapsal(a) {mod.createdByName} ({mod.createdByRole}), {formatDateTime(mod.createdAt)}
          </p>
        </div>
        <div className="text-right">
          <p className={cn("font-mono text-3xl font-bold tabular-nums", style.text)}>{Math.abs(daysLeft)}</p>
          <p className="text-xs text-muted-foreground">
            {overdue ? `${plural(-daysLeft, DAYS)} po termínu` : `${plural(daysLeft, DAYS)} do odstranění`}
            <br />
            termín {formatDateShort(mod.expiresAt)}
          </p>
        </div>
      </div>

      <p className="rounded-lg border border-border bg-background/60 p-3 text-sm font-medium">
        Oficiální technická dokumentace {version ?? ""} zůstává v platnosti – v zařízení je dočasné provizorní zapojení.
      </p>
      <p className="text-sm whitespace-pre-line">{mod.description}</p>
      {mod.photoUrl ? <PhotoGallery photos={[{ id: mod.id, url: mod.photoUrl, caption: `Provizorium ${mod.number}` }]} /> : null}
      {canResolve ? <ResolveTemporaryModDialog id={mod.id} number={mod.number} version={version} /> : null}
    </section>
  );
}
