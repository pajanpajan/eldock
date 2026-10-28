import Link from "next/link";

import { formatDateShort } from "@/lib/format";
import { caeTicketHref } from "@/lib/routes";
import { TEMP_MOD_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { EquipmentTemporaryMod } from "@/server/queries/equipment";

/** Archiv ukončených provizorií zařízení (záložka Historie změn). */
export function TemporaryModArchive({ mods, canOpenTicket }: { mods: EquipmentTemporaryMod[]; canOpenTicket: boolean }) {
  const closed = mods.filter((mod) => mod.status !== "ACTIVE");
  if (!closed.length) return null;
  return (
    <section aria-labelledby="temp-archive" className="space-y-3">
      <h2 id="temp-archive" className="text-lg font-semibold">
        Archiv provizorií
      </h2>
      <ul className="space-y-2">
        {closed.map((mod) => {
          const style = TEMP_MOD_STATUS[mod.status];
          const Icon = style.icon;
          return (
            <li key={mod.id} className="space-y-1.5 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{mod.number}</span>
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", style.badge)}>
                  <Icon className="size-3.5" aria-hidden />
                  {style.label}
                </span>
                {mod.spawnedChangeRequest ? (
                  canOpenTicket ? (
                    <Link href={caeTicketHref(mod.spawnedChangeRequest.id)} className="font-mono text-xs text-primary underline-offset-4 hover:underline">
                      → {mod.spawnedChangeRequest.number}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">→ {mod.spawnedChangeRequest.number}</span>
                  )
                ) : null}
                <span className="ml-auto text-sm text-muted-foreground">
                  {formatDateShort(mod.createdAt)} – {mod.resolvedAt ? formatDateShort(mod.resolvedAt) : "?"}
                </span>
              </div>
              <p className="font-medium">{mod.title}</p>
              <p className="text-sm text-muted-foreground">
                Zapsal(a) {mod.createdByName} ({mod.createdByRole}) · ukončil(a) {mod.resolvedByName ?? "–"}
              </p>
              {mod.resolutionNote ? <p className="text-sm">{mod.resolutionNote}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
