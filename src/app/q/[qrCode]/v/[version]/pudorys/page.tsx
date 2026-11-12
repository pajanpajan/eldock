import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FloorplanVersionSheets, type DocumentationData } from "@/components/panel-builder/documentation/DocumentationSheets";
import { VersionSnapshotFrame } from "@/components/qr/VersionSnapshotFrame";
import { floorplanDocument } from "@/server/panel-documentation";
import { getPanelCompany } from "@/server/panel-session";
import { getVersionSnapshot } from "@/server/queries/switchboard-versions";

export const metadata: Metadata = { title: "Prováděcí 2D půdorys – vydaná verze", robots: { index: false, follow: false } };

/** Fáze 103: „📐 Prováděcí 2D půdorys a kabelové trasy“ vydané verze – snímek navázaného půdorysu s kusovníkem. */
export default async function VersionFloorplanPage({ params }: PageProps<"/q/[qrCode]/v/[version]/pudorys">) {
  const { qrCode, version } = await params;
  const snapshot = await getVersionSnapshot(qrCode, version);
  const plan = snapshot?.floorplanJson ? floorplanDocument(snapshot.floorplanJson) : null;
  if (!snapshot || !plan) notFound();
  const company = await getPanelCompany();
  const owner = company?.id === snapshot.card.project!.companyId;
  const current = snapshot.row.status === "LOCKED_PUBLISHED";
  const supersededBy = snapshot.row.supersededByVersion ?? snapshot.current;
  const data: DocumentationData = {
    ...snapshot.documentation,
    docVersion: { version: snapshot.row.version, current, supersededBy: current ? null : supersededBy },
    ...(owner ? {} : { customerName: null, installationSite: null, logoUrl: null, stampUrl: null }),
  };
  return (
    <VersionSnapshotFrame serial={snapshot.card.label.serialCode} version={snapshot.row.version} current={current} supersededBy={current ? null : supersededBy} latest={snapshot.current} owner={owner} title={`${data.code} – prováděcí 2D půdorys`}>
      <FloorplanVersionSheets data={data} plan={{ name: snapshot.floorplanName ?? data.name, ...plan }} />
    </VersionSnapshotFrame>
  );
}
