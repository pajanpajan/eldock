import Link from "next/link";
import { ChevronRight, Lock, PowerOff, TriangleAlert } from "lucide-react";

import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { EQUIPMENT_TYPE_LABELS, formatCount } from "@/lib/format";
import { downstreamTree, upstreamChain, type PowerNode } from "@/lib/power-tree";
import { equipmentHref } from "@/lib/routes";

/** „⚡ LOTO – Bezpečné odpojení a hierarchie napájení“: kde vypnout a co zůstane bez proudu. */
export function LotoCard({ equipment, nodes }: { equipment: { id: string; tag: string }; nodes: PowerNode[] }) {
  const chain = upstreamChain(equipment.id, nodes);
  const lockout = chain.at(-1) ?? null;
  const impact = downstreamTree(equipment.id, nodes);

  return (
    <section aria-labelledby="loto" className="space-y-4 rounded-2xl border border-yellow-500/40 bg-yellow-500/5 p-4 sm:p-5">
      <h2 id="loto" className="flex items-center gap-2 text-lg font-semibold">
        ⚡ LOTO – Bezpečné odpojení a hierarchie napájení
      </h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <Lock className="size-4 text-yellow-400" aria-hidden />
            Kde bezpečně vypnout (upstream)
          </h3>
          {lockout ? (
            <>
              <p className="text-sm">
                Vypněte, zajistěte zámkem a označte visačkou:{" "}
                <Link href={equipmentHref(lockout.node.id)} className="font-mono font-semibold text-primary underline-offset-4 hover:underline" data-testid="loto-lockout">
                  {lockout.node.tag} › {lockout.circuit ?? "vývod neuveden"}
                </Link>
              </p>
              <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="Řetězec napájení">
                {chain.map((step) => (
                  <li key={step.node.id} className="flex items-center gap-1">
                    <Link href={equipmentHref(step.node.id)} className="font-mono text-foreground underline-offset-4 hover:underline">
                      {step.node.tag}
                    </Link>
                    <span>({step.circuit ?? "–"})</span>
                    <ChevronRight className="size-3.5" aria-hidden />
                  </li>
                ))}
                <li className="font-mono font-semibold text-foreground">{equipment.tag}</li>
              </ol>
              <p className="text-xs text-muted-foreground">Před zahájením prací ověřte beznapěťový stav zkoušečkou na všech fázích (ČSN EN 50110-1).</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nadřazený rozváděč není v systému evidovaný – vypínací místo určete podle projektové dokumentace.</p>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <PowerOff className="size-4 text-orange-400" aria-hidden />
            Dopad vypnutí (downstream)
          </h3>
          {impact.length ? (
            <>
              <p className="flex items-start gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 p-2.5 text-sm text-orange-200" data-testid="loto-impact">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-orange-400" aria-hidden />
                Po vypnutí {equipment.tag} zůstane bez proudu {formatCount(impact.length, ["zařízení", "zařízení", "zařízení"])}. Domluvte odstávku s výrobou.
              </p>
              <ul className="space-y-1 text-sm">
                {impact.map(({ node, depth }) => {
                  const Icon = EQUIPMENT_TYPE_ICONS[node.type];
                  return (
                    <li key={node.id} className="flex items-center gap-2" style={{ paddingLeft: `${(depth - 1) * 1.25}rem` }}>
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <Link href={equipmentHref(node.id)} className="font-mono font-semibold text-primary underline-offset-4 hover:underline">
                        {node.tag}
                      </Link>
                      <span className="truncate text-muted-foreground">
                        {EQUIPMENT_TYPE_LABELS[node.type]} · {node.fedFromCircuit ?? "–"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Z tohoto zařízení nejsou napájena žádná další zařízení – vypnutí neovlivní jiné stroje.</p>
          )}
        </div>
      </div>
    </section>
  );
}
