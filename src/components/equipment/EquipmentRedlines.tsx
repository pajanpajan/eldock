import Link from "next/link";
import { PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { REDLINE_STAGE_TONE, canRouteRedline, isOpenRedline, redlineStage } from "@/lib/equipment-redlines";
import { SAFETY_IMPACT } from "@/lib/legislation-2027";
import { cn } from "@/lib/utils";
import type { EquipmentRedline } from "@/server/queries/equipment";

import { RedlineRouteButton } from "./RedlineRouteButton";

const czDate = (value: Date) => value.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });

function stageOf(item: EquipmentRedline) {
  return redlineStage({
    status: item.status,
    assigneeName: item.assignee?.name ?? null,
    task: item.redlineTask ? { mode: item.redlineTask.mode, status: item.redlineTask.status, claimedBy: item.redlineTask.claimedBy?.name ?? null, internalName: item.redlineTask.internalName } : null,
    approvedVersion: item.resolvingRevisions.find((revision) => revision.status === "ACTIVE" || revision.status === "ARCHIVED")?.version ?? item.resolvingRevisions[0]?.version ?? null,
  });
}

/** Fáze 116: rychlý přehled Červenek nad schématem (počet otevřených, poslední zákres, odkaz do záložky). */
export function RedlinesSummary({ redlines, basePath }: { redlines: readonly EquipmentRedline[]; basePath: string }) {
  const open = redlines.filter((item) => isOpenRedline(item.status));
  const last = redlines[0];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm" data-testid="redlines-summary">
      <span className="font-semibold">✏️ Červenky:</span>
      <span>
        {open.length ? <b className="text-red-200">{open.length} otevřené</b> : "žádná otevřená"} · celkem {redlines.length}
      </span>
      {last ? (
        <span className="text-muted-foreground">
          poslední <span className="font-mono">{last.number}</span> ({stageOf(last).label}, {czDate(last.submittedAt)})
        </span>
      ) : null}
      <Link href={`${basePath}?tab=redlines`} className="ml-auto text-primary underline-offset-2 hover:underline">
        Zobrazit Červenky →
      </Link>
    </div>
  );
}

/**
 * Fáze 116: záložka „✏️ Červenky“ stroje / rozváděče – všechny polní zákresy a požadavky na změnu: náhled zákresu,
 * datum, autor z údržby, popis, dopad na bezpečnost dle Nařízení (EU) 2023/1230, stav a předání k překreslení.
 */
export function EquipmentRedlines({ redlines, changeHref, canSubmit, designer, ticketBase, approveHref }: { redlines: readonly EquipmentRedline[]; changeHref: string; canSubmit: boolean; designer: { name: string | null; email: string | null } | null; ticketBase: string | null; approveHref: string | null }) {
  return (
    <section className="flex flex-col gap-3" aria-label="Červenky a zákresy změn" data-testid="equipment-redlines">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">✏️ Červenky & Zákresy ({redlines.length})</h2>
        {canSubmit ? (
          <Button asChild className="gap-2" data-testid="redline-new">
            <Link href={changeHref}>
              <PencilLine className="size-4" aria-hidden /> ✏️ Zakreslit novou Červenku do schématu
            </Link>
          </Button>
        ) : null}
      </div>
      {redlines.length ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {redlines.map((item) => {
            const stage = stageOf(item);
            const impact = SAFETY_IMPACT[item.safetyImpact];
            const text = item.note || item.voiceTranscript || item.engineerSummary || "Bez popisu – viz zákres.";
            const routable = canRouteRedline({ status: item.status, task: item.redlineTask ? { mode: item.redlineTask.mode, status: item.redlineTask.status, claimedBy: item.redlineTask.claimedBy?.name ?? null, internalName: item.redlineTask.internalName } : null });
            return (
              <li key={item.id} className="flex gap-3 rounded-xl border border-border bg-card p-3" data-testid="redline-item" data-number={item.number} data-stage={stage.stage}>
                <div className="relative size-28 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                  {item.markupImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- soubory z /api/files
                    <img src={item.markupImageUrl} alt={`Zákres ${item.number}`} className="size-full object-contain" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-zinc-900 text-center text-xs text-muted-foreground">bez zákresu</div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{item.number}</span>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", REDLINE_STAGE_TONE[stage.stage])} data-testid="redline-stage">
                      {stage.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {czDate(item.submittedAt)} · {item.reporter.name}
                    {item.reporter.company ? ` (${item.reporter.company})` : ""} · nad revizí {item.baseRevision?.version ?? "–"}, list {item.markupSheet}
                  </p>
                  <p className="line-clamp-3">{text}</p>
                  <p className={cn("text-xs font-medium", impact.tone === "red" ? "text-red-300" : impact.tone === "yellow" ? "text-amber-200" : "text-emerald-300")} data-testid="redline-impact">
                    Dopad dle EU 2023/1230: {impact.short}
                    {item.requiresSoftwareUpdate ? " · vyžaduje úpravu SW / zálohu PLC" : ""}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {ticketBase ? (
                      <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                        <Link href={`${ticketBase}${item.id}`}>Otevřít ticket</Link>
                      </Button>
                    ) : null}
                    {approveHref && item.status === "WAITING_APPROVAL" ? (
                      <Button asChild size="sm" variant="outline" className="h-8 px-2">
                        <Link href={approveHref}>Zkontrolovat a schválit novou verzi</Link>
                      </Button>
                    ) : null}
                    {canSubmit && routable ? <RedlineRouteButton changeRequestId={item.id} number={item.number} designer={designer} /> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">U tohoto zařízení zatím nejsou žádné Červenky. Změnu zapojení zakreslete přímo do schématu – projektant ji překreslí do nové verze.</p>
      )}
    </section>
  );
}
