import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocumentationSheets, type DocumentationData } from "@/components/panel-builder/documentation/DocumentationSheets";
import { VersionSnapshotFrame } from "@/components/qr/VersionSnapshotFrame";
import { getPanelCompany } from "@/server/panel-session";
import { getVersionSnapshot } from "@/server/queries/switchboard-versions";

export const metadata: Metadata = { title: "Dokumentace rozváděče – vydaná verze", robots: { index: false, follow: false } };

/**
 * Fáze 103: „📄 Kompletní PDF dokumentace rozváděče + Kusová zkouška“ – neměnný snímek vydané verze (6 listů A4 s částí
 * revizního technika). Neaktuální verze má v hlavičce každého listu červený štítek a přes list vodoznak.
 */
export default async function VersionDocumentationPage({ params }: PageProps<"/q/[qrCode]/v/[version]">) {
  const { qrCode, version } = await params;
  const snapshot = await getVersionSnapshot(qrCode, version);
  if (!snapshot) notFound();
  const company = await getPanelCompany();
  const owner = company?.id === snapshot.card.project!.companyId;
  const current = snapshot.row.status === "LOCKED_PUBLISHED";
  const supersededBy = snapshot.row.supersededByVersion ?? snapshot.current;
  const data: DocumentationData = {
    ...snapshot.documentation,
    docVersion: { version: snapshot.row.version, current, supersededBy: current ? null : supersededBy },
    // Osobní údaje a soubory firmy (logo, razítko) jen pro přihlášenou firmu výrobce – čísla štítků jdou po sobě
    ...(owner ? {} : { customerName: null, installationSite: null, logoUrl: null, stampUrl: null }),
  };
  return (
    <VersionSnapshotFrame serial={snapshot.card.label.serialCode} version={snapshot.row.version} current={current} supersededBy={current ? null : supersededBy} latest={snapshot.current} owner={owner} title={`${data.code} – dokumentace rozváděče`}>
      <DocumentationSheets data={data} />
    </VersionSnapshotFrame>
  );
}
