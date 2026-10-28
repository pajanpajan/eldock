import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, Inbox, MessageSquareWarning } from "lucide-react";

import { RevisionUploadForm } from "@/components/cae/RevisionUploadForm";
import { EmptyState } from "@/components/common/EmptyState";
import { LocationBreadcrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SwitchRoleButton } from "@/components/common/SwitchRoleButton";
import { Button } from "@/components/ui/button";
import { bomDraftFrom } from "@/lib/bom-edit";
import { caeTicketHref } from "@/lib/routes";
import { REVISION_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import { canPerform } from "@/lib/workflow/state-machine";
import { getRevisionFormData } from "@/server/queries/cae";
import { getCurrentRole } from "@/server/session";
type Props = PageProps<"/cae/tickets/[id]/revision">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getRevisionFormData(id);
  return { title: data ? `Nová revize – ${data.changeRequest.number}` : "Nová revize" };
}

// Nahrání nové revize k ticketu (CAE).
export default async function RevisionUploadPage({ params }: Props) {
  const { id } = await params;
  const [data, role] = await Promise.all([getRevisionFormData(id), getCurrentRole()]);
  if (!data) notFound();

  const { changeRequest, active, lastRejected, versions } = data;
  const { equipment } = changeRequest;

  const header = (
    <PageHeader
      breadcrumb={
        <LocationBreadcrumb
          items={[
            { label: "CAE Back-Office", href: "/cae" },
            { label: changeRequest.number, href: caeTicketHref(changeRequest.id) },
            { label: "Nová revize" },
          ]}
        />
      }
      title={`Nová revize – ${equipment.tag}`}
      description={`${equipment.name} · ${equipment.floor.building.plant.name}, ${equipment.floor.building.name}`}
      badges={<StatusBadge kind="changeRequest" status={changeRequest.status} />}
    />
  );

  if (role !== "CAE_ENGINEER") {
    return (
      <>
        {header}
        <EmptyState
          icon={Inbox}
          title="Revize nahrává CAE projektant"
          description="Po přepnutí pohledu zůstanete na této stránce."
          action={<SwitchRoleButton role="CAE_ENGINEER" />}
        />
      </>
    );
  }

  if (!canPerform("uploadRevision", role, changeRequest.status)) {
    return (
      <>
        {header}
        <EmptyState
          icon={CircleCheck}
          title="Revizi teď nelze nahrát"
          description="Ticket už má revizi čekající na schválení, nebo je uzavřený."
          action={
            <Button asChild className="touch-target">
              <Link href={caeTicketHref(changeRequest.id)}>Zpět na ticket</Link>
            </Button>
          }
        />
      </>
    );
  }

  const text = changeRequest.voiceTranscript ?? changeRequest.note;

  return (
    <>
      {header}
      <div className="mx-auto max-w-6xl space-y-4">
        {lastRejected?.rejectionComment ? (
          <p className={cn("flex items-start gap-2 rounded-xl border p-3 text-sm", REVISION_STATUS.REJECTED.soft)}>
            <MessageSquareWarning className={cn("mt-0.5 size-4 shrink-0", REVISION_STATUS.REJECTED.text)} aria-hidden />
            <span>
              <span className="font-medium">Údržba vrátila {lastRejected.version}: </span>
              {lastRejected.rejectionComment}
            </span>
          </p>
        ) : null}
        {text ? (
          <p className="rounded-xl border border-border bg-card p-3 text-sm">
            <span className="text-muted-foreground">Technik: </span>„{text}“
          </p>
        ) : null}
        <RevisionUploadForm
          changeRequest={{ id: changeRequest.id, number: changeRequest.number }}
          versions={versions}
          defaultTitle={active?.title ?? `Elektrické schéma ${equipment.tag}`}
          initialBom={bomDraftFrom(active?.bomItems ?? [])}
        />
      </div>
    </>
  );
}
