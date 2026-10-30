import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileText, Inbox, Mic, MessageSquareWarning, StickyNote } from "lucide-react";

import { CommentForm } from "@/components/cae/CommentForm";
import { MarkupLayerViewer } from "@/components/cae/MarkupLayerViewer";
import { TicketActions } from "@/components/cae/TicketActions";
import { TicketTimeline } from "@/components/cae/TicketTimeline";
import { EmptyState } from "@/components/common/EmptyState";
import { LocationBreadcrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { RevisionCompare } from "@/components/revisions/RevisionCompare";
import { SwitchRoleButton } from "@/components/common/SwitchRoleButton";
import { PhotoGallery } from "@/components/equipment/PhotoGallery";
import { slaLevel } from "@/lib/cae-tickets";
import { formatDateTime, formatRelative } from "@/lib/format";
import { parseMarkup } from "@/lib/markup";
import { equipmentHref } from "@/lib/routes";
import { REVISION_STATUS, SLA_LEVEL } from "@/lib/status";
import { cn } from "@/lib/utils";
import { canPerform } from "@/lib/workflow/state-machine";
import { getTicketDetail } from "@/server/queries/cae";
import { getModuleState } from "@/server/modules";
import { getCurrentRole, getCurrentUser } from "@/server/session";

type Props = PageProps<"/cae/tickets/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ticket = await getTicketDetail(id);
  return { title: ticket ? `${ticket.number} – ${ticket.equipment.tag}` : "Ticket" };
}

function Section({ title, icon: Icon, children, className }: { title: string; icon?: typeof Mic; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3 rounded-xl border border-border bg-card p-4", className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {Icon ? <Icon className="size-4" aria-hidden /> : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

// Detail ticketu pro CAE projektanta: podklady od technika vlevo, akce a timeline vpravo.
export default async function TicketDetailPage({ params }: Props) {
  const { id } = await params;
  const [ticket, role, user, modules] = await Promise.all([getTicketDetail(id), getCurrentRole(), getCurrentUser(), getModuleState()]);
  if (!ticket) notFound();

  const now = new Date();
  const { equipment } = ticket;
  const { building } = equipment.floor;
  const markup = parseMarkup(ticket.markupData);
  const photos = ticket.attachments.filter((attachment) => attachment.type === "PHOTO");
  const sla = slaLevel(ticket, now);
  const slaStyle = sla ? SLA_LEVEL[sla] : null;

  const header = (
    <PageHeader
      breadcrumb={<LocationBreadcrumb items={[{ label: "CAE Back-Office", href: "/cae" }, { label: ticket.number }]} />}
      title={
        <>
          <span className="font-mono">{ticket.number}</span> · {equipment.tag}
        </>
      }
      description={equipment.name}
      badges={
        <>
          <StatusBadge kind="changeRequest" status={ticket.status} />
          <StatusBadge kind="priority" status={ticket.priority} />
        </>
      }
    />
  );

  if (role !== "CAE_ENGINEER") {
    return (
      <>
        {header}
        <EmptyState
          icon={Inbox}
          title="Ticket zpracovává CAE projektant"
          description="Detail ticketu je součástí back-office. Po přepnutí pohledu zůstanete na této stránce."
          action={<SwitchRoleButton role="CAE_ENGINEER" />}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <div className="space-y-6">
          <Section title="Zákres technika" icon={FileText}>
            {ticket.baseRevision ? (
              <MarkupLayerViewer src={ticket.baseRevision.schematicUrl} markup={markup} version={ticket.baseRevision.version} pdf={ticket.baseRevision.schematicFormat === "PDF"} />
            ) : (
              <p className="text-sm text-muted-foreground">Zařízení nemělo platnou revizi, technik nekreslil.</p>
            )}
          </Section>

          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Popis od technika" icon={Mic}>
              {ticket.voiceTranscript ? (
                <figure className="space-y-1">
                  <figcaption className="text-xs text-muted-foreground">Přepis hlasové poznámky</figcaption>
                  <blockquote className="rounded-lg border-l-4 border-primary bg-muted/40 p-3 text-base">„{ticket.voiceTranscript}“</blockquote>
                </figure>
              ) : null}
              {ticket.note ? (
                <figure className="space-y-1">
                  <figcaption className="flex items-center gap-1 text-xs text-muted-foreground">
                    <StickyNote className="size-3.5" aria-hidden /> Poznámka
                  </figcaption>
                  <p className="rounded-lg bg-muted/40 p-3 whitespace-pre-line">{ticket.note}</p>
                </figure>
              ) : null}
              {!ticket.voiceTranscript && !ticket.note ? <p className="text-sm text-muted-foreground">Technik nepřidal text.</p> : null}
            </Section>

            <Section title={`Fotky z haly (${photos.length})`}>
              {photos.length ? (
                <PhotoGallery photos={photos.map(({ id: photoId, url, caption }) => ({ id: photoId, url, caption }))} />
              ) : (
                <p className="text-sm text-muted-foreground">Bez fotek.</p>
              )}
            </Section>
          </div>

          {ticket.baseRevision && ticket.resolvingRevisions[0] && modules.CAE_ADVANCED ? (
            <Section title="Porovnat revize (Visual Diff)">
              <RevisionCompare
                before={{ version: ticket.baseRevision.version, url: ticket.baseRevision.schematicUrl, format: ticket.baseRevision.schematicFormat }}
                after={{ version: ticket.resolvingRevisions[0].version, url: ticket.resolvingRevisions[0].schematicUrl, format: ticket.resolvingRevisions[0].schematicFormat }}
                markup={markup}
                labels={["Základ", "Nahraná"]}
              />
            </Section>
          ) : null}

          {ticket.resolvingRevisions.length ? (
            <Section title="Revize k tomuto ticketu">
              <ul className="space-y-3">
                {ticket.resolvingRevisions.map((revision) => (
                  <li key={revision.id} className="space-y-2 rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-lg font-bold">{revision.version}</span>
                      <StatusBadge kind="revision" status={revision.status} />
                      <span className="text-sm text-muted-foreground">
                        {revision.author.name} · {formatDateTime(revision.createdAt)}
                      </span>
                      <a href={revision.schematicUrl} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-sm text-primary hover:underline">
                        Schéma <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                    {revision.summary ? <p className="text-sm">{revision.summary}</p> : null}
                    {revision.rejectionComment ? (
                      <p className={cn("flex items-start gap-2 rounded-lg border p-2.5 text-sm", REVISION_STATUS.REJECTED.soft)}>
                        <MessageSquareWarning className={cn("mt-0.5 size-4 shrink-0", REVISION_STATUS.REJECTED.text)} aria-hidden />
                        <span>
                          <span className="font-medium">Vráceno údržbou: </span>
                          {revision.rejectionComment}
                        </span>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20">
          <Section title="Ticket">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Zařízení</dt>
              <dd>
                <Link href={equipmentHref(equipment.id)} className="font-mono font-medium text-primary hover:underline">
                  {equipment.tag}
                </Link>{" "}
                <StatusBadge kind="equipment" status={equipment.status} plain className="ml-1 align-middle" />
              </dd>
              <dt className="text-muted-foreground">Lokace</dt>
              <dd>
                {building.plant.name} · {building.name} · {equipment.floor.name}
              </dd>
              <dt className="text-muted-foreground">Nahlásil(a)</dt>
              <dd>
                {ticket.reporter.name}
                {ticket.reporter.company ? <div className="text-xs text-muted-foreground">{ticket.reporter.company}</div> : null}
              </dd>
              <dt className="text-muted-foreground">Kdy</dt>
              <dd>
                {formatDateTime(ticket.submittedAt)}
                <div className={cn("text-xs", slaStyle?.text ?? "text-muted-foreground")}>
                  {formatRelative(ticket.submittedAt, now)}
                  {slaStyle ? ` · ${slaStyle.label}` : ""}
                </div>
              </dd>
              <dt className="text-muted-foreground">Řeší</dt>
              <dd>{ticket.assignee ? ticket.assignee.name : <span className="text-muted-foreground">Nepřiřazeno</span>}</dd>
              <dt className="text-muted-foreground">Výchozí revize</dt>
              <dd className="font-mono">{ticket.baseRevision?.version ?? "–"}</dd>
            </dl>
            <TicketActions
              changeRequest={{ id: ticket.id, number: ticket.number, status: ticket.status }}
              assignedToMe={ticket.assigneeId === user.id}
            />
          </Section>

          <Section title="Timeline">
            <TicketTimeline events={ticket.events} now={now} />
            {canPerform("comment", role, ticket.status) ? <CommentForm changeRequestId={ticket.id} /> : null}
          </Section>
        </aside>
      </div>
    </>
  );
}
