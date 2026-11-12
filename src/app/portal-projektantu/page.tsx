import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";

import { Logo } from "@/components/layout/Logo";
import { ClaimTaskButton, PoolLoginForm, PoolUploadForm } from "@/components/pool/PoolPortalControls";
import { prisma } from "@/lib/prisma";
import { anonymizedTitle, cadFormatLabel, redlineStatusLabel } from "@/lib/redline-marketplace";
import { cn } from "@/lib/utils";
import { poolLogoutAction } from "@/server/actions/pool-portal";
import { getPoolDesigner } from "@/server/pool-session";
import { markupChanges, poolTasks, type PoolTask } from "@/server/services/redlines";

export const metadata: Metadata = {
  title: "Portál projektantů ELDOCK Pool",
  description: "Živá fronta Červenek z výrobních závodů k čistému překreslení do CADu – princip „kdo první přijme úkol“.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const czDay = (date: Date | null) => (date ? date.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" }) : "bez termínu");

/**
 * Fáze 103: portál externích projektantů ELDOCK Poolu – živá fronta Červenek k překreslení. Nepřihlášený vidí jen
 * anonymizované úkoly; schválený projektant (e-mail + přístupový kód z velínu) vidí firmu a náhled zákresu, jedním
 * klikem úkol atomicky přijme, stáhne balíček podkladů a nahraje nové čisté PDF (+ CAD) jako novou verzi schématu.
 */
export default async function PoolPortalPage() {
  const [designer, tasks] = await Promise.all([getPoolDesigner(), poolTasks(prisma)]);
  const open = tasks.filter((task) => task.status === "OPEN").length;
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
          <Link href="/" aria-label="Eldock – úvodní stránka" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Logo />
          </Link>
          <span className="text-sm font-semibold">🌐 Portál projektantů ELDOCK Pool</span>
          {designer ? (
            <form action={poolLogoutAction} className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-muted-foreground" data-testid="pool-designer">
                👷 {designer.name}
              </span>
              <button type="submit" className="touch-target flex items-center gap-1 rounded-lg border border-border px-3 text-muted-foreground hover:text-foreground">
                <LogOut className="size-4" aria-hidden /> Odhlásit
              </button>
            </form>
          ) : null}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6" data-testid="pool-portal">
        <div>
          <h1 className="text-2xl font-semibold">Živá fronta Červenek k překreslení</h1>
          <p className="text-sm text-muted-foreground">
            Údržbáři z výrobních závodů, nemocnic a obchodních center sem posílají polní úpravy zakreslené v nástroji ✏️ Červenka. Úkol převezme vždy jen jeden projektant – kdo první klikne na „✋ Přijímám úkol“. Volných úkolů:{" "}
            <strong data-testid="pool-open-count">{open}</strong>.
          </p>
        </div>
        {designer ? null : <PoolLoginForm />}
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} designerId={designer?.id ?? null} />
          ))}
          {tasks.length ? null : <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Fronta je prázdná – nové Červenky se tu objeví hned po odeslání z údržby.</li>}
        </ul>
      </main>
    </div>
  );
}

function TaskCard({ task, designerId }: { task: PoolTask; designerId: string | null }) {
  const request = task.changeRequest;
  const mine = Boolean(designerId && task.claimedById === designerId);
  const lockedForMe = task.status !== "OPEN" && !mine;
  const revealed = Boolean(designerId) && !lockedForMe;
  const plant = request.equipment.floor.building.plant;
  const title = anonymizedTitle({ equipmentType: request.equipment.type, equipmentName: request.equipment.name, tag: request.equipment.tag, company: revealed ? `${plant.customerName} (${plant.name})` : null }, revealed);
  return (
    <li className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", lockedForMe ? "border-border opacity-60" : task.status === "OPEN" ? "border-emerald-500/50" : "border-sky-500/50")} data-testid="pool-task" data-task-id={task.id} data-status={task.status}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", task.status === "OPEN" ? "bg-emerald-500/20 text-emerald-200" : lockedForMe ? "bg-zinc-700 text-zinc-200" : "bg-sky-500/20 text-sky-200")} data-testid="pool-task-status">
          {redlineStatusLabel("POOL", task.status, task.claimedBy?.name)}
        </span>
        <h2 className="font-semibold">{title}</h2>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{request.number}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
        {revealed && request.markupData ? (
          // eslint-disable-next-line @next/next/no-img-element -- náhled vrstvy Červenky (SVG z API portálu)
          <img src={`/api/pool/preview/${task.id}`} alt={`Náhled zákresu Červenky ${request.number}`} className="aspect-[1.414] w-full rounded-md bg-white object-contain" data-testid="pool-task-preview" />
        ) : (
          <div className="flex aspect-[1.414] w-full items-center justify-center rounded-md border border-dashed border-border p-2 text-center text-xs text-muted-foreground">{designerId ? "🔒 Náhled jen pro projektanta, který úkol přijal" : "Náhled zákresu po přihlášení projektanta"}</div>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Počet změn (tahů Červenky)</dt>
            <dd className="font-semibold">{markupChanges(task)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Požadovaný CAD formát</dt>
            <dd className="font-semibold">{cadFormatLabel(task.format)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Listů schématu</dt>
            <dd className="font-semibold">{task.sheets}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Termín dodání</dt>
            <dd className="font-semibold">{czDay(task.dueAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Odměna</dt>
            <dd className="font-semibold text-emerald-300" data-testid="pool-task-reward">
              {task.rewardCzk ? `${task.rewardCzk.toLocaleString("cs-CZ")} Kč bez DPH` : "dle dohody"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fotky z místa</dt>
            <dd className="font-semibold">{request._count.attachments}</dd>
          </div>
          {revealed && task.description ? (
            <div className="col-span-full">
              <dt className="text-xs text-muted-foreground">Komentář údržbáře</dt>
              <dd>{task.description}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      {task.status === "OPEN" ? (
        designerId ? (
          <ClaimTaskButton taskId={task.id} />
        ) : (
          <p className="text-sm text-muted-foreground">Přihlaste se e-mailem a přístupovým kódem schváleného projektanta a úkol přijměte.</p>
        )
      ) : null}
      {mine && task.status === "CLAIMED" ? (
        <div className="flex flex-col gap-3">
          <a href={`/api/pool/package/${task.id}`} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted" data-testid="pool-package">
            ⬇️ Stáhnout balíček podkladů (původní výkres + Červenka + komentář údržbáře)
          </a>
          <PoolUploadForm taskId={task.id} />
        </div>
      ) : null}
      {mine && task.status === "SUBMITTED" ? <p className="text-sm text-sky-200">Odevzdáno {task.submittedAt ? czDay(task.submittedAt) : ""} – nová verze schématu čeká na schválení údržbou závodu.</p> : null}
    </li>
  );
}
