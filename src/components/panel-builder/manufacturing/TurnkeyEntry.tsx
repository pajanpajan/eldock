import { DEFAULT_TURNKEY_CONFIG, parseTurnkeyConfig } from "@/lib/panel-builder/turnkey-manufacturing";
import { prisma } from "@/lib/prisma";
import type { QuoteSource } from "@/components/quoting/QuoteWizardModal";
import type { PanelProjectDetail } from "@/server/queries/panel-builder";
import { projectQuoteSource } from "@/server/quote-sources";
import { projectOrders } from "@/server/services/manufacturing";
import { documentationState } from "@/server/services/panel-builder";
import { cncBaseOf, documentationBlockers, estimateFromSource } from "@/server/turnkey-data";

import { ManufacturingSection } from "./ManufacturingSection";

/**
 * Fáze 106: výroba rozváděče na klíč u projektu – v kroku 1b tlačítko poptávky se stavem zakázky, v kroku 4 navíc
 * „🛠️ CNC & Výroba na klíč“ (náhled CNC plánu, drátovací list, stažení podkladů). Data připraví server (kalkulace
 * z ceníků, blokace dokumentace, aktivní výrobci, poslední mechanické provedení).
 */
export async function TurnkeyEntry({ project, variant, source, blockers }: { project: PanelProjectDetail; variant: "button" | "full"; source?: QuoteSource; blockers?: readonly string[] }) {
  const [quoteSource, docBlockers, manufacturers, orders] = await Promise.all([
    source ?? projectQuoteSource(project),
    blockers ?? documentationBlockers(project),
    prisma.panelManufacturer.findMany({ where: { active: true }, orderBy: [{ region: "asc" }, { name: "asc" }], select: { id: true, name: true, region: true, leadDays: true } }),
    project.companyId ? projectOrders(prisma, project.id, project.companyId) : Promise.resolve([]),
  ]);
  const last = orders[0];
  // Bez předchozí zakázky: montáž podle skříně (zapuštěná rozvodnice = membránová příruba, jinak vývodky) a ventilátor
  // s filtrem ve dveřích, když výpočet oteplení v kroku 3 nevyhoví
  const { thermal } = documentationState(project);
  const initial = last ? parseTurnkeyConfig(last.configJson) : { ...DEFAULT_TURNKEY_CONFIG, mounting: project.enclosure?.installation === "FLUSH" ? ("flush" as const) : ("surface" as const), door: { ...DEFAULT_TURNKEY_CONFIG.door, ventilation: !thermal.ok } };
  return (
    <ManufacturingSection
      variant={variant}
      projectId={project.id}
      projectLabel={`Rozváděč ${project.code}${project.name ? ` „${project.name}“` : ""} · ${project.items.length} přístrojů`}
      base={cncBaseOf(project)}
      initial={initial}
      estimate={estimateFromSource(quoteSource)}
      manufacturers={manufacturers}
      contact={{ name: project.company?.contactName ?? "", email: project.company?.email ?? "", phone: project.company?.phone ?? "" }}
      blockers={[...docBlockers]}
      orders={orders.map((order) => ({ id: order.id, number: order.number, status: order.status, qrSerial: order.qrSerial, version: order.version, manufacturer: order.manufacturer?.name ?? null, region: order.region, acceptedPriceCzk: order.acceptedPriceCzk, acceptedDays: order.acceptedDays }))}
    />
  );
}
