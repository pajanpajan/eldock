import type { Metadata } from "next";
import { CircleCheck, Hourglass, Inbox, Timer, Wrench } from "lucide-react";

import { TicketDashboard } from "@/components/cae/TicketDashboard";
import { EmptyState } from "@/components/common/EmptyState";
import { KpiTile } from "@/components/common/KpiTile";
import { PageHeader } from "@/components/common/PageHeader";
import { SwitchRoleButton } from "@/components/common/SwitchRoleButton";
import { InspectionWatcher } from "@/components/inspections/InspectionWatcher";
import { computeKpis, formatDuration, parseTicketFilter } from "@/lib/cae-tickets";
import { formatCount } from "@/lib/format";
import { CHANGE_REQUEST_PRIORITY, CHANGE_REQUEST_STATUS } from "@/lib/status";
import { getCaeTickets } from "@/server/queries/cae";
import { getInspectionWatch } from "@/server/queries/inspections";
import { getPlants } from "@/server/queries/plant";
import { getCurrentRole, getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "CAE Back-Office" };

// Pracoviště CAE projektanta: KPI a tickety napříč závody.
export default async function CaeDashboardPage({ searchParams }: PageProps<"/cae">) {
  const [role, user, tickets, plants, params, watch] = await Promise.all([
    getCurrentRole(),
    getCurrentUser(),
    getCaeTickets(),
    getPlants(),
    searchParams,
    getInspectionWatch(),
  ]);

  if (role !== "CAE_ENGINEER") {
    return (
      <>
        <PageHeader title="CAE Back-Office" description="Požadavky na změnu ze všech závodů." />
        <EmptyState
          icon={Inbox}
          title="Back-office je určený pro CAE projektanty"
          description="Po přepnutí pohledu zůstanete na této stránce."
          action={<SwitchRoleButton role="CAE_ENGINEER" />}
        />
      </>
    );
  }

  const now = new Date();
  const kpis = computeKpis(tickets, now);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") query.set(key, value);
  const filter = parseTicketFilter(query, Object.keys(CHANGE_REQUEST_PRIORITY));

  return (
    <>
      <PageHeader
        title="CAE Back-Office"
        description={`Požadavky na změnu dokumentace ze všech závodů. Přihlášen: ${user.name}.`}
      />
      <div className="space-y-8">
        <section aria-label="Souhrn" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <KpiTile label="Nové" value={kpis.submitted} icon={Inbox} accent={CHANGE_REQUEST_STATUS.SUBMITTED.text} hint="Čekají na převzetí" />
          <KpiTile label="V řešení" value={kpis.inProgress} icon={Wrench} accent={CHANGE_REQUEST_STATUS.IN_PROGRESS.text} hint="Projektant zpracovává revizi" />
          <KpiTile
            label="Čeká na schválení"
            value={kpis.waitingApproval}
            icon={Hourglass}
            accent={CHANGE_REQUEST_STATUS.WAITING_APPROVAL.text}
            hint="Revize u údržby"
          />
          <KpiTile label="Uzavřeno za 30 dní" value={kpis.closedLast30Days} icon={CircleCheck} accent={CHANGE_REQUEST_STATUS.APPROVED.text} hint="Schválené i stornované" />
          <KpiTile
            label="Průměrná doba vyřízení"
            value={kpis.averageResolutionHours === null ? "–" : formatDuration(kpis.averageResolutionHours)}
            icon={Timer}
            hint={kpis.resolvedCount ? `Od nahlášení po schválení, ${formatCount(kpis.resolvedCount, ["ticket", "tickety", "ticketů"])}` : "Zatím nic schváleno"}
            className="col-span-2 md:col-span-1"
          />
        </section>
        <InspectionWatcher watch={watch} showPlant />
        <TicketDashboard tickets={tickets} plants={plants} userId={user.id} initialFilter={filter} now={now} />
      </div>
    </>
  );
}
