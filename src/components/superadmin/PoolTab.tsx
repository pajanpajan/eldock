import Link from "next/link";

import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cadFormatLabel, redlineStatusLabel } from "@/lib/redline-marketplace";

import { PoolDesignerForm, PoolDesignerToggle } from "./PoolDesignerControls";

const th = "px-2 py-1.5 text-left font-medium";
const td = "px-2 py-1.5 align-top";

/**
 * Fáze 103: velín „🌐 ELDOCK Pool projektantů“ – schválení externích projektantů (přístupový kód do portálu),
 * přehled úkolů z Červenek (cesta A firemní projektant i cesta B pool) a odkaz na /portal-projektantu.
 */
export async function PoolTab() {
  const [designers, tasks] = await Promise.all([
    prisma.poolDesigner.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, name: true, email: true, active: true, createdAt: true, _count: { select: { tasks: true } } } }),
    prisma.redlineTask.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { claimedBy: { select: { name: true } }, changeRequest: { select: { number: true, equipment: { select: { tag: true, floor: { select: { building: { select: { plant: { select: { name: true } } } } } } } } } } } }),
  ]);
  return (
    <section className="flex flex-col gap-4" data-testid="pool-tab">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">🌐 ELDOCK Pool projektantů</h2>
        <Link href="/portal-projektantu" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted" data-testid="pool-portal-link">
          Otevřít portál projektantů →
        </Link>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 font-semibold">Schválení projektanti</h3>
        <PoolDesignerForm />
        <table className="mt-3 w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className={th}>Projektant</th>
              <th className={th}>Úkolů</th>
              <th className={th}>Schválen</th>
              <th className={th}>Stav</th>
            </tr>
          </thead>
          <tbody>
            {designers.map((designer) => (
              <tr key={designer.id} className="border-t border-border" data-testid="pool-designer-row">
                <td className={td}>
                  <div className="font-medium">{designer.name}</div>
                  <div className="text-xs text-muted-foreground">{designer.email}</div>
                </td>
                <td className={`${td} font-mono`}>{designer._count.tasks}</td>
                <td className={td}>{formatDate(designer.createdAt)}</td>
                <td className={td}>
                  <span className="mr-2 text-xs">{designer.active ? "✓ aktivní" : "vyřazen"}</span>
                  <PoolDesignerToggle id={designer.id} active={designer.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm" data-testid="pool-tasks">
          <caption className="px-2 py-2 text-left font-semibold">Předané Červenky (posledních 100)</caption>
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className={th}>Změna</th>
              <th className={th}>Závod</th>
              <th className={th}>Cesta</th>
              <th className={th}>Formát / odměna</th>
              <th className={th}>Stav</th>
              <th className={th}>Předáno</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-t border-border">
                <td className={`${td} font-mono`}>
                  {task.changeRequest.number} · {task.changeRequest.equipment.tag}
                </td>
                <td className={td}>{task.changeRequest.equipment.floor.building.plant.name}</td>
                <td className={td}>{task.mode === "POOL" ? "🌐 ELDOCK Pool" : `🏢 ${task.internalName ?? "CAE závodu"}`}</td>
                <td className={td}>
                  {cadFormatLabel(task.format)}
                  {task.rewardCzk ? ` · ${task.rewardCzk.toLocaleString("cs-CZ")} Kč` : ""}
                </td>
                <td className={td}>{redlineStatusLabel(task.mode, task.status, task.claimedBy?.name)}</td>
                <td className={td}>{formatDate(task.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
