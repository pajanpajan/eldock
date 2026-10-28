import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Inbox } from "lucide-react";

import { LocationBreadcrumb } from "@/components/common/LocationBreadcrumb";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { BomTable } from "@/components/equipment/BomTable";
import { Cabinet3D } from "@/components/equipment/Cabinet3D";
import { ChangeRequestCta } from "@/components/equipment/ChangeRequestCta";
import { DocumentationTabs } from "@/components/equipment/DocumentationTabs";
import { QrDialog } from "@/components/equipment/QrDialog";
import { RevisionTimeline } from "@/components/equipment/RevisionTimeline";
import { SafetyBanner } from "@/components/equipment/SafetyBanner";
import { SchematicViewer } from "@/components/equipment/SchematicViewer";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/button";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/format";
import { buildingHref, caeTicketHref, equipmentHref, floorHref, plantHref } from "@/lib/routes";
import { getEquipmentDetail } from "@/server/queries/equipment";
import { getCurrentRole } from "@/server/session";

type Props = PageProps<"/equipment/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const equipment = await getEquipmentDetail(id);
  return { title: equipment?.name ?? "Zařízení" };
}

/** Absolutní URL pro QR kód podle hlaviček požadavku (funguje i přes IP v síti haly). */
async function absoluteUrl(pathname: string) {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${pathname}`;
}

// Detail zařízení – Documentation Hub (dostupný i přes QR kód).
export default async function EquipmentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { rev } = await searchParams;
  const [equipment, role] = await Promise.all([getEquipmentDetail(id), getCurrentRole()]);
  if (!equipment) notFound();

  const { floor } = equipment;
  const { building } = floor;
  const plantId = building.plant.id;
  const basePath = equipmentHref(equipment.id);
  const openChange = equipment.changeRequests[0] ?? null;
  const active = equipment.revisions.find((revision) => revision.status === "ACTIVE") ?? equipment.revisions[0] ?? null;
  const pending = equipment.revisions.find((revision) => revision.status === "PENDING_APPROVAL") ?? null;
  const selected = equipment.revisions.find((revision) => revision.id === rev) ?? active;
  const location = `${building.plant.name} › ${building.name} › ${floor.name}`;
  const qrUrl = await absoluteUrl(basePath);
  // Pevné „teď“ pro relativní časy (server i klient vykreslí totéž).
  const now = new Date();

  return (
    <PageTransition>
      <div className="space-y-6 pb-20 sm:pb-0">
        <PageHeader
          className="pb-0"
          breadcrumb={
            <LocationBreadcrumb
              items={[
                { label: building.plant.name, href: plantHref(plantId) },
                {
                  label: building.name,
                  href: building._count.floors > 1 ? buildingHref(plantId, building.id) : plantHref(plantId),
                },
                { label: floor.name, href: floorHref(plantId, building.id, floor.id) },
                { label: equipment.tag },
              ]}
            />
          }
          title={equipment.name}
          badges={<StatusBadge kind="equipment" status={equipment.status} className="text-sm" />}
          description={
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <span>{EQUIPMENT_TYPE_LABELS[equipment.type]}</span>
              <span>
                Tag <span className="font-mono text-foreground">{equipment.tag}</span>
              </span>
              <span>
                ID <span className="font-mono">{equipment.id}</span>
              </span>
              {equipment.manufacturer ? (
                <span>
                  {equipment.manufacturer} {equipment.model}
                </span>
              ) : null}
              {equipment.ratedVoltage ? <span>{equipment.ratedVoltage}</span> : null}
              {equipment.ratedCurrent ? <span>{equipment.ratedCurrent}</span> : null}
              {equipment.ipRating ? <span>{equipment.ipRating}</span> : null}
              {active ? (
                <span>
                  Platná revize <span className="font-mono text-foreground">{active.version}</span>
                </span>
              ) : null}
            </span>
          }
          actions={
            <>
              <QrDialog url={qrUrl} tag={equipment.tag} name={equipment.name} location={location} />
              {role === "MAINTENANCE" ? (
                <ChangeRequestCta href={`${basePath}/change-request`} openNumber={openChange?.number ?? null} />
              ) : openChange ? (
                <Button asChild size="lg" className="touch-target gap-2">
                  <Link href={caeTicketHref(openChange.id)}>
                    <Inbox className="size-4" />
                    Otevřít ticket {openChange.number}
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />

        {openChange ? (
          <SafetyBanner
            change={openChange}
            pendingRevision={pending}
            reviewHref={`${basePath}/approve`}
            canReview={role === "MAINTENANCE"}
            now={now}
          />
        ) : null}

        <DocumentationTabs
          panels={{
            schema: (
              <SchematicViewer
                basePath={basePath}
                selectedId={selected?.id ?? ""}
                revisions={equipment.revisions.map(({ id: revisionId, version, status, title, schematicUrl, schematicFormat, sheetCount, createdAt }) => ({
                  id: revisionId,
                  version,
                  status,
                  title,
                  schematicUrl,
                  schematicFormat,
                  sheetCount,
                  createdAt,
                }))}
              />
            ),
            bom: selected ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Kusovník revize <span className="font-mono text-foreground">{selected.version}</span>
                </p>
                <BomTable rows={selected.bomItems} fileName={`kusovnik-${equipment.tag}-${selected.version}.csv`} />
              </div>
            ) : null,
            "3d": selected ? <Cabinet3D bom={selected.bomItems} tag={equipment.tag} /> : null,
            history: <RevisionTimeline revisions={equipment.revisions} basePath={basePath} selectedId={selected?.id ?? null} />,
          }}
        />
      </div>
    </PageTransition>
  );
}
