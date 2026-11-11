"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CheckCircle2, Circle, Minus, PartyPopper, X } from "lucide-react";

import { PANEL_CHECKLIST_OFF_KEY, panelChecklist, panelChecklistKey, type PanelChecklistKey, type PanelChecklistState, type PanelChecklistVisits } from "@/lib/panel-builder/panel-live-checklist";
import { cn } from "@/lib/utils";

type Mode = "open" | "pill" | "off";

const STEP_HREF: Record<PanelChecklistKey, string> = { recognition: "", tree: "/tree", enclosure: "/enclosure", thermal: "/thermal", documentation: "/documentation" };

const STORE_EVENT = "eldock:panel-checklist";

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // soukromý režim – stav platí jen do zavření stránky
  }
  window.dispatchEvent(new Event(STORE_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORE_EVENT, callback);
  };
}

/** Hodnota z localStorage bez rozdílu mezi serverem a hydratací (server = výchozí hodnota). */
function useStored<T>(key: string, fallback: T): T {
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => null);
  return useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- výchozí hodnota je konstanta volajícího
  }, [raw]);
}

/**
 * Fáze 92: živý tahák rozváděče na všech krocích projektu – pět bodů podle kroků projektu se odškrtává samo (nálezy
 * Elektro-linteru, strom zapojení, skříň, oteplení, tisk elaborátu) jako pruh nad projektem (nic nepřekrývá). U tréninkové
 * zakázky nese úkoly zakázky. Sbalí se do pilulky „🧭 Tahák (3/5 hotovo)“ nebo se trvale vypne; v tisku se neukazuje.
 */
export function PanelLiveChecklist({ projectId, state, job }: { projectId: string; state: PanelChecklistState; job: { icon: string; title: string; defect: string | null; steps: readonly { key: PanelChecklistKey; text: string }[] } | null }) {
  const pathname = usePathname();
  const key = panelChecklistKey(projectId);
  const visits = useStored<PanelChecklistVisits>(key, NO_VISITS);
  const storedMode = useStored<Mode | null>(PANEL_CHECKLIST_OFF_KEY, null);
  const mode: Mode = storedMode === "pill" || storedMode === "off" ? storedMode : "open";
  const base = `/panel-builder/${projectId}`;

  // Krok 4 otevřený = oteplení zkontrolované; tisk elaborátu z kroku 5 (Tisk / PDF i Ctrl+P)
  useEffect(() => {
    const remember = (patch: PanelChecklistVisits) => {
      let current: PanelChecklistVisits = {};
      try {
        current = JSON.parse(readRaw(key) ?? "{}") as PanelChecklistVisits;
      } catch {
        current = {};
      }
      writeJson(key, { ...current, ...patch });
    };
    if (pathname === `${base}/thermal` && !visits.thermal) remember({ thermal: true });
    if (pathname !== `${base}/documentation`) return;
    const onPrint = () => remember({ printed: true });
    window.addEventListener("beforeprint", onPrint);
    return () => window.removeEventListener("beforeprint", onPrint);
  }, [pathname, base, key, visits.thermal]);

  const changeMode = (next: Mode) => writeJson(PANEL_CHECKLIST_OFF_KEY, next);

  const rows = panelChecklist(state, visits, job);
  const done = rows.filter((row) => row.ok).length;
  const current = rows.find((row) => !row.ok)?.key ?? null;
  if (mode === "off") return null;
  if (mode === "pill") {
    return (
      <button type="button" onClick={() => changeMode("open")} className="mb-3 flex w-fit items-center gap-1.5 rounded-full border border-primary/60 bg-card px-3 py-1 text-xs font-semibold hover:border-primary print:hidden" data-testid="panel-checklist-pill">
        {job ? "🎯" : "🧭"} Tahák ({done}/{rows.length} hotovo)
      </button>
    );
  }
  const active = rows.find((row) => row.key === current) ?? null;
  const activeHref = active ? `${base}${STEP_HREF[active.key]}` : null;
  return (
    <section className="mb-4 flex flex-col gap-2 rounded-xl border border-primary/40 bg-card px-3 py-2 text-xs print:hidden" aria-label="Tahák rozváděče" data-testid="panel-checklist" data-done={done} data-current={current ?? "done"} data-trainer={job ? "true" : undefined}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <b className="text-sm leading-tight">{job ? `${job.icon} Tréninková zakázka – tahák` : "🧭 Tahák rozváděče (Co teď udělat)"}</b>
        {job ? <span className="text-muted-foreground">{job.title}</span> : null}
        <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[11px] tabular-nums">
          {done}/{rows.length}
        </span>
        <button type="button" onClick={() => changeMode("pill")} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Minimalizovat tahák do pilulky" title="Minimalizovat" data-testid="panel-checklist-minimize">
          <Minus className="size-4" aria-hidden />
        </button>
        <button type="button" onClick={() => window.confirm("Tahák rozváděče trvale vypnout? Vrátí ho smazání dat webu v prohlížeči.") && changeMode("off")} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Trvale vypnout tahák" title="Trvale vypnout" data-testid="panel-checklist-off">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {job?.defect ? (
        <p className="text-[11px] leading-snug text-amber-200" data-testid="panel-checklist-defect">
          ⚠️ Záměrná chyba: {job.defect}
        </p>
      ) : null}
      <ol className="flex flex-wrap gap-1.5">
        {rows.map((row) => (
          <li key={row.key} className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5", current === row.key ? "border-primary bg-primary/10 font-semibold" : row.ok ? "border-emerald-500/40 text-emerald-200" : "border-border text-muted-foreground")} title={row.detail} data-testid={`panel-checklist-${row.key}`} data-ok={row.ok ? "true" : "false"}>
            {row.ok ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" aria-label="hotovo" /> : <Circle className="size-3.5 shrink-0" aria-label="zbývá" />}
            {row.label}
          </li>
        ))}
      </ol>
      {active ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          {active.task ? (
            <span className="text-yellow-100" data-testid={`panel-checklist-${active.key}-task`}>
              🎯 {active.task}
            </span>
          ) : null}
          <span className="text-muted-foreground">{active.detail}</span>
          {activeHref && pathname !== activeHref ? (
            <Link href={activeHref} className="inline-flex h-6 items-center rounded-md border border-primary/60 px-2 font-semibold hover:bg-primary/10" data-testid={`panel-checklist-${active.key}-open`}>
              Otevřít krok {STEP_NUMBER[active.key]} →
            </Link>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] text-emerald-200">✅ Všech 5 kroků je hotových – elaborát je vytištěný.</p>
      )}
    </section>
  );
}

const STEP_NUMBER: Record<PanelChecklistKey, number> = { recognition: 1, tree: 2, enclosure: 3, thermal: 4, documentation: 5 };
const NO_VISITS: PanelChecklistVisits = {};

/** Fáze 92: gratulace po rozváděči z trenažéru 2D půdorysu (`?trenazer=hotovo`). */
export function TrainerCongrats() {
  const params = useSearchParams();
  const [open, setOpen] = useState(true);
  if (!open || params.get("trenazer") !== "hotovo") return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border-2 border-yellow-400/70 bg-yellow-400/10 p-3 text-sm print:hidden" role="status" data-testid="trainer-congrats">
      <PartyPopper className="mt-0.5 size-5 shrink-0 text-yellow-300" aria-hidden />
      <div className="min-w-0 flex-1">
        <b className="text-yellow-100">🎉 Gratulujeme! Zakázku z trenažéru jste dokončili za 3 kliky.</b>
        <p className="text-muted-foreground">Tohle je kompletní rozváděč vygenerovaný z cvičného bungalovu – jističe, chrániče, akční členy ABB-free@home, skříň i kabeláž. Kredit se neodečetl. Projděte kroky 1–5 podle taháku nad projektem a vytiskněte elaborát.</p>
      </div>
      <button type="button" onClick={() => setOpen(false)} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Zavřít gratulaci">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
