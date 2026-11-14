import Link from "next/link";

import { InspectionOverviewTable } from "@/components/inspections/InspectionOverviewTable";
import { InspectionWatcher } from "@/components/inspections/InspectionWatcher";
import { RevisionWalkRoute } from "@/components/inspections/RevisionWalkRoute";
import { SmartRevisionTripOptimizer } from "@/components/inspections/SmartRevisionTripOptimizer";
import { WALK_SORTS, withWalkSort, type WalkSort } from "@/lib/revision-walk";
import { pragueToday } from "@/lib/inspection";
import { PORTABLE_TYPES } from "@/lib/inspection-rules";
import { REVISION_TABS, buildingSemaphore, revisionHref, type RevisionTab } from "@/lib/revision-hub";
import { auditReportHref, inspectionAlertsHref, inspectionImportHref, plannerHref, rapidInspectionHref, ticrReportHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { getInspectionOverview, getInspectionWatch } from "@/server/queries/inspections";
import { getTripItems, getWalkItems } from "@/server/queries/revision-trip";

const STATUS_CLASS = {
  red: "border-red-500/60 bg-red-500/10",
  amber: "border-amber-400/60 bg-amber-400/10",
  green: "border-emerald-500/50 bg-emerald-500/10",
  none: "border-border bg-card",
} as const;

export interface RevisionHubAccess {
  canRecord: boolean;
  canAudit: boolean;
  canPlanner: boolean;
  canRapid: boolean;
  canImport: boolean;
  showReports: boolean;
  alerts: boolean;
  types: Parameters<typeof getTripItems>[2];
}

/**
 * Fáze 115: „📋 Revize & Plánovač“ – přehled budov se semaforem revizí (klik = filtr budovy) a záložky revizní agendy.
 * Sdílí ji `/revize` a 4. agenda závodu (`?faze=4`); data se načítají jen pro otevřenou záložku.
 */
export async function RevisionHub({ plant, base: rawBase, tab, buildingId, access, sort = "urgence", now = new Date() }: { plant: { id: string; name: string; buildings: readonly { id: string; name: string }[] }; base: string; tab: RevisionTab; buildingId: string | null; access: RevisionHubAccess; sort?: WalkSort; now?: Date }) {
  const today = pragueToday(now);
  const focus = buildingId && plant.buildings.some((building) => building.id === buildingId) ? buildingId : null;
  // Fáze 116: 🚶 pochůzkový režim (Budova ➔ Patro ➔ Místnost) v Chytré revizi i Lhůtníku – volba v adrese
  const walkTab = tab === "chytra" || tab === "lhutnik";
  const walking = walkTab && sort === "trasa";
  const base = withWalkSort(rawBase, sort);
  const [tripItems, overview, watch, walkItems] = await Promise.all([
    getTripItems(plant.id, now, access.types),
    tab === "lhutnik" ? getInspectionOverview(plant.id, now, access.types) : Promise.resolve([]),
    tab === "lhutnik" ? getInspectionWatch(plant.id, now, access.types) : Promise.resolve(null),
    walking ? getWalkItems(plant.id, now, access.types) : Promise.resolve([]),
  ]);
  const sortSwitch = walkTab ? (
    <nav aria-label="Řazení výjezdu" className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/5 p-2 text-sm" data-testid="walk-sort">
      <span className="font-semibold">Řazení výjezdu:</span>
      {WALK_SORTS.map((option) => (
        <Link
          key={option.id}
          href={revisionHref(withWalkSort(rawBase, option.id), tab, focus)}
          aria-current={sort === option.id ? "true" : undefined}
          className={cn("rounded-lg border px-3 py-1.5 font-semibold", sort === option.id ? "border-sky-400 bg-sky-500 text-white" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")}
          data-testid={`walk-sort-${option.id}`}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  ) : null;
  const semaphore = buildingSemaphore(tripItems, plant.buildings);
  const focusName = focus ? plant.buildings.find((building) => building.id === focus)?.name : null;
  const portable = tripItems.filter((item) => PORTABLE_TYPES.includes(item.type) && (!focus || item.buildingId === focus));
  const portableDue = portable.filter((item) => item.state !== "VALID").length;
  return (
    <div className="flex flex-col gap-4" data-testid="revision-hub" data-tab={tab}>
      {/* Přehled areálu a budov se semaforem revizí */}
      <section aria-label="Přehled budov se semaforem revizí" className="flex flex-col gap-2" data-testid="revision-buildings">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">🏭 {plant.name} – revize po budovách</h2>
          <p className="text-xs text-muted-foreground">🟢 platné · 🟡 končí do 30 dnů · 🔴 propadlé / neschopné provozu – klikněte na budovu pro filtr</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {semaphore.map((building) => {
            const active = focus === building.id;
            return (
              <Link
                key={building.id}
                href={revisionHref(base, tab, active ? null : building.id)}
                aria-current={active ? "true" : undefined}
                className={cn("flex flex-col gap-1 rounded-xl border p-3 text-sm transition-colors hover:bg-muted/50", STATUS_CLASS[building.status], active && "ring-2 ring-sky-400")}
                data-testid="revision-building"
                data-building={building.id}
                data-status={building.status}
              >
                <span className="font-semibold">{building.name}</span>
                <span className="flex flex-wrap gap-2 font-mono text-xs">
                  <span title="Platné revize" data-testid="revision-building-valid">🟢 {building.valid}</span>
                  <span title="Končí do 30 dnů" data-testid="revision-building-expiring">🟡 {building.expiring}</span>
                  <span title="Propadlé nebo neschopné provozu" data-testid="revision-building-expired">🔴 {building.expired}</span>
                  {building.missing ? <span title="Bez revize">⚪ {building.missing}</span> : null}
                </span>
              </Link>
            );
          })}
        </div>
        {focusName ? (
          <p className="text-sm" data-testid="revision-building-filter">
            Filtr: <b>{focusName}</b> ·{" "}
            <Link href={revisionHref(base, tab, null)} className="text-primary underline-offset-2 hover:underline">
              zobrazit celý areál
            </Link>
          </p>
        ) : null}
      </section>

      {/* Záložky revizní agendy */}
      <nav aria-label="Revizní agenda" className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-card p-1.5" data-testid="revision-tabs">
        {REVISION_TABS.map((item) => (
          <Link
            key={item.id}
            href={revisionHref(base, item.id, focus)}
            aria-current={item.id === tab ? "page" : undefined}
            title={item.hint}
            className={cn("rounded-lg px-3 py-2 text-sm font-semibold", item.id === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            data-testid={`revision-tab-${item.id}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "chytra" ? (
        <div className="flex flex-col gap-3" data-testid="revision-tab-panel-chytra">
          {sortSwitch}
          {walking ? <RevisionWalkRoute items={walkItems} plantId={plant.id} canRecord={access.canRecord} focusBuildingId={focus} /> : <SmartRevisionTripOptimizer items={tripItems} today={today} focusBuildingId={focus} canRecord={access.canRecord} />}
          <div className="flex flex-wrap gap-2 text-sm">
            {access.canPlanner ? (
              <Link href={plannerHref} className="rounded-lg border border-border px-3 py-2 hover:bg-muted" data-testid="revision-planner-link">
                📅 Kalendářní plánovač a hromadný zápis revize →
              </Link>
            ) : null}
            {access.canRapid ? (
              <Link href={rapidInspectionHref} className="rounded-lg border border-border px-3 py-2 hover:bg-muted" data-testid="revision-rapid-link">
                ⚡ Rychlá revize na místě →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "lhutnik" && watch ? (
        <div className="flex flex-col gap-3" data-testid="revision-tab-panel-lhutnik">
          {sortSwitch}
          <InspectionWatcher watch={focus ? { ...watch, items: watch.items.filter((item) => item.location.startsWith(`${focusName} ›`)) } : watch} />
          {walking ? <RevisionWalkRoute items={walkItems} plantId={plant.id} canRecord={access.canRecord} focusBuildingId={focus} title="🚶‍♂️ Lhůtník – pochůzková trasa technika" /> : null}
          {access.canImport ? (
            <p className="text-sm">
              <Link href={inspectionImportHref} className="text-primary underline-offset-2 hover:underline">
                📥 Import revizních dat z měřáků a CSV →
              </Link>
            </p>
          ) : null}
          {walking ? null : <InspectionOverviewTable items={focus ? overview.filter((item) => item.buildingId === focus) : overview} today={today} showPlant={false} canBatchInspect={access.canRecord} showReports={access.showReports} showAudit={access.canAudit} />}
        </div>
      ) : null}

      {tab === "spotrebice" ? (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-sm" data-testid="revision-tab-panel-spotrebice">
          <h3 className="text-base font-bold">🔌 Hlídač revizí spotřebičů & Kanceláří (ČSN 33 1600)</h3>
          <p className="text-muted-foreground">
            Monitory, prodlužovačky, nářadí a svářečky {focusName ? `v budově ${focusName}` : "v areálu"}: <b data-testid="revision-portable-count">{portable.length}</b> kusů, z toho <b>{portableDue}</b> s propadlou, končící nebo chybějící revizí.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/hlidac-revizi" className="rounded-lg border border-border px-3 py-2 hover:bg-muted" data-testid="revision-hlidac-link">
              🛡️ Hlídač revizí – správa spotřebičů a AI čtečka výrobních štítků →
            </Link>
            {access.canRapid ? (
              <Link href={rapidInspectionHref} className="rounded-lg border border-border px-3 py-2 hover:bg-muted">
                📱 Mobilní Scan & Snap a rychlá revize →
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "ticr" ? (
        <section className="grid gap-3 md:grid-cols-2" data-testid="revision-tab-panel-ticr">
          {access.canRecord ? (
            <Link href={ticrReportHref} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 hover:bg-muted/50" data-testid="revision-ticr-link">
              <span className="font-bold">🛡️ Měsíční TIČR report</span>
              <span className="text-sm text-muted-foreground">Kontrolní výpis všech revizí pod číslem TIČR revizního technika – ochrana osvědčení.</span>
            </Link>
          ) : null}
          {access.canAudit ? (
            <Link href={auditReportHref} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 hover:bg-muted/50" data-testid="revision-audit-link">
              <span className="font-bold">📖 Auditní zpráva – Kniha revizí</span>
              <span className="text-sm text-muted-foreground">Přehled revizí a podstatných změn pro TIČR / SÚIP a auditora.</span>
            </Link>
          ) : null}
          {access.alerts ? (
            <Link href={inspectionAlertsHref} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 hover:bg-muted/50">
              <span className="font-bold">🔔 Hlídač lhůt</span>
              <span className="text-sm text-muted-foreground">Upozornění na končící a propadlé revize e-mailem.</span>
            </Link>
          ) : null}
          {!access.canRecord && !access.canAudit && !access.alerts ? <p className="text-sm text-muted-foreground">TIČR report a auditní zpráva nejsou pro tento účet dostupné.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
