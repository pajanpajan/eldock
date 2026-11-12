import Link from "next/link";
import { Scale } from "lucide-react";

import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCount } from "@/lib/format";
import { MACHINERY_REGULATION_FROM, daysUntil } from "@/lib/plant-phases";
import { equipmentHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { PlantAgendaRow } from "@/server/queries/plant-agenda";

/**
 * Fáze 98: legislativní karta agendy „4. Kniha revizí, Legislativa & Simulátor“ – Nařízení (EU) 2023/1230 o strojních
 * zařízeních (použije se od 20. 1. 2027): stroje závodu, otevřené podstatné změny bezpečnostních obvodů (čl. 18 – kdo
 * stroj podstatně změní, přebírá povinnosti výrobce: posouzení shody, CE, technická dokumentace) a zálohy Safety PLC.
 */
export function PlantMachineryRegulation({ rows, now }: { rows: readonly PlantAgendaRow[]; now: Date }) {
  const machines = rows.filter((row) => row.group === "machines").length;
  const substantial = rows.flatMap((row) => row.changes.filter((change) => change.safetyImpact === "SUBSTANTIAL_SAFETY_MOD").map((change) => ({ ...change, equipmentId: row.id, tag: row.tag, name: row.name })));
  const safetyBackups = rows.reduce((sum, row) => sum + row.backups.filter((backup) => backup.safety).length, 0);
  const days = daysUntil(MACHINERY_REGULATION_FROM, now);
  return (
    <section aria-labelledby="machinery-regulation" className={cn("rounded-xl border p-4", substantial.length ? "border-amber-500/50 bg-amber-500/5" : "border-border bg-card")} data-testid="plant-legislation" data-substantial={substantial.length}>
      <h2 id="machinery-regulation" className="flex flex-wrap items-center gap-2 font-semibold">
        <Scale className="size-5 text-primary" aria-hidden /> Legislativa: Nařízení (EU) 2023/1230 o strojních zařízeních
      </h2>
      <p className="mt-1 text-sm text-muted-foreground" data-testid="plant-legislation-deadline">
        {days > 0 ? `Použije se od 20. 1. 2027 – za ${formatCount(days, ["den", "dny", "dní"])}` : "Použije se od 20. 1. 2027 – platí"} (nahrazuje směrnici 2006/42/ES). V závodě {formatCount(machines, ["stroj", "stroje", "strojů"])} a{" "}
        {formatCount(safetyBackups, ["záloha", "zálohy", "záloh"])} bezpečnostní logiky (Safety PLC s kontrolním součtem).
      </p>
      {substantial.length ? (
        <ul className="mt-3 flex flex-col gap-1.5 text-sm">
          {substantial.map((change) => (
            <li key={change.id} className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 px-2 py-1.5" data-testid="plant-legislation-change">
              <span className="rounded bg-amber-500/15 px-1.5 text-xs font-semibold text-amber-200">⚖️ Podstatná změna (čl. 18)</span>
              <Link href={`${equipmentHref(change.equipmentId)}?tab=history`} className="font-mono font-semibold hover:text-primary">
                {change.tag} · {change.number}
              </Link>
              <StatusBadge kind="changeRequest" status={change.status} plain />
              <span className="text-xs text-muted-foreground">nové posouzení shody, CE a technická dokumentace před uvedením do provozu</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-emerald-300">✓ Žádná otevřená podstatná změna bezpečnostních obvodů strojů.</p>
      )}
    </section>
  );
}
