import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, FileText, HardHat, ListTree, Mic, PencilRuler } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { LocationBreadcrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SwitchRoleButton } from "@/components/common/SwitchRoleButton";
import { PageTransition } from "@/components/layout/PageTransition";
import { ApprovalActions } from "@/components/revisions/ApprovalActions";
import { BomDiffTable } from "@/components/revisions/BomDiffTable";
import { LazyRevisionCompare } from "@/components/lazy";
import { Button } from "@/components/ui/button";
import { diffBom } from "@/lib/bom-diff";
import { formatDateTime, formatRelative } from "@/lib/format";
import { parseMarkup } from "@/lib/markup";
import { buildingHref, equipmentHref, floorHref, plantHref } from "@/lib/routes";
import { getApprovalData } from "@/server/queries/equipment";
import { getModuleState } from "@/server/modules";
import { getCurrentAccount } from "@/server/session";

type Props = PageProps<"/equipment/[id]/approve">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getApprovalData(id);
  return { title: data?.pending ? `Schválení ${data.pending.version} – ${data.equipment.tag}` : "Schválení revize" };
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Mic; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        <Icon className="size-4" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

// Schválení nové revize údržbou: porovnání, shrnutí CAE, rozdíl kusovníku a rozhodnutí.
export default async function ApprovePage({ params }: Props) {
  const { id } = await params;
  const [data, account, modules] = await Promise.all([getApprovalData(id), getCurrentAccount(), getModuleState()]);
  if (!data) notFound();

  const { equipment, change, pending, active } = data;
  const { building } = equipment.floor;
  const plantId = building.plant.id;
  const basePath = equipmentHref(equipment.id);
  const now = new Date();

  const header = (
    <PageHeader
      breadcrumb={
        <LocationBreadcrumb
          items={[
            { label: building.plant.name, href: plantHref(plantId) },
            { label: building.name, href: building._count.floors > 1 ? buildingHref(plantId, building.id) : plantHref(plantId) },
            { label: equipment.floor.name, href: floorHref(plantId, building.id, equipment.floor.id) },
            { label: equipment.tag, href: basePath },
            { label: "Schválení revize" },
          ]}
        />
      }
      title={pending ? `Schválení revize ${pending.version} – ${equipment.tag}` : `Schválení revize – ${equipment.tag}`}
      description={equipment.name}
      badges={<StatusBadge kind="equipment" status={equipment.status} />}
    />
  );

  if (!change || change.status !== "WAITING_APPROVAL" || !pending) {
    return (
      <>
        {header}
        <EmptyState
          icon={CircleCheck}
          title="Žádná revize nečeká na schválení"
          description={change ? `Požadavek ${change.number} je ve stavu, kdy se nic neschvaluje.` : "Dokumentace zařízení je aktuální."}
          action={
            <Button asChild className="touch-target">
              <Link href={basePath}>Zpět na zařízení</Link>
            </Button>
          }
        />
      </>
    );
  }

  if (!account.can("approveRevision")) {
    return (
      <>
        {header}
        <EmptyState
          icon={HardHat}
          title="Revizi schvaluje vedoucí údržby"
          description="Potvrzení provádí vedoucí údržby (nebo technický ředitel), který zodpovídá za skutečné zapojení. Po přepnutí účtu zůstanete na této stránce."
          action={<SwitchRoleButton account="MAINTENANCE_LEAD" />}
        />
      </>
    );
  }

  const markup = parseMarkup(change.markupData);
  const bomDiff = diffBom(active?.bomItems ?? [], pending.bomItems);
  const technician = change.voiceTranscript ?? change.note;

  return (
    <PageTransition>
      <div className="space-y-6 pb-36 sm:pb-0">
        {header}

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title={`Shrnutí od CAE – ${pending.author.name}`} icon={PencilRuler}>
            <p className="text-base">{pending.summary}</p>
            <p className="text-xs text-muted-foreground">
              Nahráno {formatDateTime(pending.createdAt)} ({formatRelative(pending.createdAt, now)}) k požadavku{" "}
              <span className="font-mono">{change.number}</span>
            </p>
          </Section>
          <Section title={`Původní hlášení – ${change.reporter.name}`} icon={Mic}>
            {technician ? <blockquote className="rounded-lg border-l-4 border-orange-400 bg-muted/40 p-3">„{technician}“</blockquote> : null}
            <p className="text-xs text-muted-foreground">Nahlášeno {formatDateTime(change.submittedAt)}</p>
          </Section>
        </div>

        <Section title={`Porovnání schémat ${active?.version ?? ""} → ${pending.version}`} icon={FileText}>
          <LazyRevisionCompare
            before={active ? { version: active.version, url: active.schematicUrl, format: active.schematicFormat } : null}
            after={{ version: pending.version, url: pending.schematicUrl, format: pending.schematicFormat }}
            markup={markup}
            advanced={modules.CAE_ADVANCED}
          />
        </Section>

        <Section title="Změny v kusovníku" icon={ListTree}>
          <BomDiffTable rows={bomDiff} />
        </Section>

        <ApprovalActions changeRequestId={change.id} equipmentId={equipment.id} version={pending.version} activeVersion={active?.version ?? null} />
      </div>
    </PageTransition>
  );
}
