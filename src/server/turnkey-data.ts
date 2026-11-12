import "server-only";

import { parseCableReport } from "@/lib/panel-builder/floorplan-editor";
import type { CncDevice, CncInput } from "@/lib/panel-builder/cnc-manufacturing-engine";
import { turnkeyEstimate, type TurnkeyConfig } from "@/lib/panel-builder/turnkey-manufacturing";
import { buildQuote } from "@/lib/quoting/quote-engine";
import { prisma } from "@/lib/prisma";
import { inspectionBlock, nextVersion, snapshotStringify } from "@/lib/switchboard-versions";
import { ENVIRONMENT_BLOCKER } from "@/lib/panel-builder/environments";
import { smtpTransportFromEnv } from "@/server/mailer";
import { buildDocumentationData } from "@/server/panel-documentation";
import { getPanelProject, getPanelProjectById, type PanelProjectDetail } from "@/server/queries/panel-builder";
import { projectQuoteSource } from "@/server/quote-sources";
import { requestOrigin } from "@/server/request-url";
import { completeManufacturingOrder } from "@/server/services/manufacturing";
import { parseInspection } from "@/server/services/switchboard-versions";
import { factoryTestSchema, inspectionFromFactoryTest, routineTestFromFactory } from "@/lib/panel-builder/turnkey-manufacturing";

// Fáze 106: data výroby na klíč na serveru – vstup CNC generátoru z projektu rozváděče, orientační kalkulace výroby,
// oznámení výrobcům / zákazníkovi a dokončení zakázky (snímek elaborátu s kusovou zkouškou výrobce → Verze 1.0).

/** Vývodový kabel okruhu podle jističe (1f B10 → 3×1,5, B16 → 3×2,5, 3f podle proudu). */
export function outgoingCable(poles: string, ratedA: number): string {
  const three = /3P|4P/.test(poles);
  if (three) return ratedA <= 16 ? "CYKY-J 5×2,5" : ratedA <= 25 ? "CYKY-J 5×4" : ratedA <= 32 ? "CYKY-J 5×6" : "CYKY-J 5×10";
  return ratedA <= 10 ? "CYKY-J 3×1,5" : ratedA <= 16 ? "CYKY-J 3×2,5" : ratedA <= 25 ? "CYKY-J 3×4" : "CYKY-J 3×6";
}

/** Přívodní kabel rozváděče podle hlavního vypínače (do 40 A 5×10, do 63 A 5×16, nad 4×25). */
export const supplyCable = (ratedA: number) => (ratedA <= 40 ? "CYKY-J 5×10" : ratedA <= 63 ? "CYKY-J 5×16" : "CYKY-J 4×25");

/** Vstup CNC generátoru z projektu: přístroje na lištách (pozice v modulech), skříň a strom zapojení. */
export function cncBaseOf(project: PanelProjectDetail): Omit<CncInput, "entry" | "mounting" | "door"> {
  const offsets = new Map<number, number>();
  const devices: CncDevice[] = [...project.items]
    .sort((a, b) => a.dinRailIndex - b.dinRailIndex || a.positionOnRail - b.positionOnRail)
    .map((item) => {
      const position = offsets.get(item.dinRailIndex) ?? 0;
      offsets.set(item.dinRailIndex, position + (item.modulesWidth || 1));
      const component = item.catalogComponent;
      const category = component?.category ?? "OTHER";
      const poles = component?.poles ?? (item.phaseAssignment?.includes("L2") ? "3P" : "1P");
      const ratedA = component?.ratedCurrentA ?? 16;
      const outgoing = (category === "MCB" || category === "RCBO") && !project.items.some((child) => child.parentItemId === item.id);
      return { id: item.id, designation: item.designation, category, poles, modules: item.modulesWidth || component?.modulesCount || 1, ratedCurrentA: ratedA, rail: item.dinRailIndex, position, parentId: item.parentItemId, label: item.circuitLabel || null, cable: outgoing ? outgoingCable(poles, ratedA) : null };
    });
  const enclosure = project.enclosure;
  const rails = Math.max(1, ...devices.map((device) => device.rail));
  const widest = Math.max(12, ...[...offsets.values()].map((value) => Math.ceil(value)));
  const main = devices.find((device) => device.category === "MAIN_SWITCH") ?? devices[0];
  const busCables = devices.filter((device) => device.category === "PLC").length;
  return {
    name: `${project.code}${project.name ? ` ${project.name}` : ""}`,
    enclosure: enclosure
      ? { manufacturer: enclosure.manufacturer, model: enclosure.model, rows: enclosure.rows, modulesPerRow: enclosure.modulesPerRow, widthMm: enclosure.widthMm, heightMm: enclosure.heightMm, depthMm: enclosure.depthMm, installation: enclosure.installation, material: enclosure.material }
      : { manufacturer: "Skříň", model: project.enclosureModel ?? `${rails} × ${widest} M`, rows: rails, modulesPerRow: widest, widthMm: Math.round(widest * 17.5 + 120), heightMm: rails * 150 + 120, depthMm: 120, installation: "SURFACE", material: "PAINTED_STEEL" },
    devices,
    supplyCable: supplyCable(main?.ratedCurrentA ?? 40),
    busCables,
  };
}

/** Orientační kalkulace výroby rozváděče na klíč z podkladů nabídky (materiál z ceníků, práce rozváděče z normohodin). */
export function estimateFromSource(source: Awaited<ReturnType<typeof projectQuoteSource>>) {
  const quote = buildQuote(source.materials, source.work, { scope: "switchboard", hourlyRate: 650, construction: "aac", discountPct: 0, vatRate: 21, layout: "chapters", number: "VYR", issuedAt: new Date().toISOString(), validityDays: 14, customer: { name: "" }, supplier: { name: "" }, title: source.title });
  const labor = quote.customer.chapters.filter((chapter) => chapter.id !== "material").reduce((sum, chapter) => sum + chapter.totalCzk, 0);
  return turnkeyEstimate({ materialCzk: quote.internal.materialCustomerCzk, laborCzk: labor, laborHours: quote.internal.laborHours, missingPrices: quote.internal.missingPrices.length });
}

/** Blokace dokumentace před výrobou (prostředí, oteplení, kusovník …) – nevyhovující návrh se do výroby neposílá. */
export async function documentationBlockers(project: PanelProjectDetail) {
  const built = await buildDocumentationData(project, await requestOrigin());
  return project.environmentConfirmedAt ? built.blockers : [ENVIRONMENT_BLOCKER, ...built.blockers];
}

/** Orientační kalkulace výroby na klíč a blokace dokumentace (poptávka z akce – vše znovu na serveru). */
export async function turnkeyEstimateOf(projectId: string) {
  const project = await getPanelProject(projectId);
  if (!project) throw new Error("Rozváděč nebyl nalezen.");
  const estimate = estimateFromSource(await projectQuoteSource(project));
  return { estimate, blockers: await documentationBlockers(project), project };
}

const html = (text: string) => `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`;

/** Oznámení nové poptávky výrobci (nebo všem aktivním výrobcům kraje) – jen s nastaveným SMTP. */
export async function notifyManufacturers(orderId: string) {
  const send = smtpTransportFromEnv();
  if (!send) return 0;
  const order = await prisma.manufacturingOrder.findUniqueOrThrow({ where: { id: orderId }, include: { project: { select: { code: true, name: true } } } });
  const recipients = order.manufacturerId ? await prisma.panelManufacturer.findMany({ where: { id: order.manufacturerId, active: true }, select: { email: true } }) : await prisma.panelManufacturer.findMany({ where: { region: order.region, active: true }, select: { email: true } });
  if (!recipients.length) return 0;
  const text = `Nová poptávka výroby rozváděče na klíč ${order.number} (${order.project.code}${order.project.name ? ` ${order.project.name}` : ""}, ${order.region}).\nPodklady, cenu a termín najdete v portálu https://eldock.cz/vyroba-rozvadecu.`;
  await send({ to: recipients.map((entry) => entry.email), subject: `ELDOCK – poptávka výroby rozváděče ${order.number}`, text, html: html(text) });
  return recipients.length;
}

/** Dokončení zakázky výrobcem: snímek 6listového elaborátu s kusovou zkouškou výrobce → Verze 1.0 pod QR štítkem. */
export async function completeOrder(orderId: string, manufacturerId: string) {
  const order = await prisma.manufacturingOrder.findFirst({ where: { id: orderId, manufacturerId }, include: { manufacturer: { select: { name: true, ico: true } } } });
  if (!order?.routineTestJson || !order.manufacturer) throw new Error("Nejdřív zapište výstupní kusovou zkoušku.");
  const project = await getPanelProjectById(order.projectId);
  if (!project) throw new Error("Rozváděč nebyl nalezen.");
  const origin = await requestOrigin();
  const built = await buildDocumentationData(project, origin);
  const test = factoryTestSchema.parse(JSON.parse(order.routineTestJson));
  const inspection = parseInspection(inspectionFromFactoryTest(test, order.manufacturer));
  const versions = await prisma.switchboardVersion.findMany({ where: { projectId: project.id }, select: { major: true, minor: true } });
  const version = nextVersion(versions).version;
  const now = new Date();
  const data = { ...built.data, routineTest: routineTestFromFactory(test, order.manufacturer), inspection: inspectionBlock(inspection, version, now), qrUrl: `${origin}/q/${order.qrSerial}` };
  const floorplan = project.floorplanJson ? { name: project.name || project.code, json: project.floorplanJson } : null;
  const result = await completeManufacturingOrder(prisma, { orderId, manufacturerId, documentationJson: snapshotStringify(data), floorplan, now });
  const send = smtpTransportFromEnv();
  if (send) {
    const text = `Dobrý den,\nrozváděč ${project.code}${project.name ? ` „${project.name}“` : ""} (zakázka ${result.number}) je vyrobený, odzkoušený a připravený k převzetí / odeslání na stavbu.\nDokumentace je uzamčená jako Verze ${result.version} pod QR štítkem ${result.serial}: ${origin}/q/${result.serial}\n\nVýrobce: ${order.manufacturer.name}`;
    await send({ to: [result.contactEmail], subject: `ELDOCK – rozváděč ${project.code} je vyrobený (${result.number})`, text, html: html(text) }).catch((error) => console.error("[eldock] Oznámení zákazníkovi se nepodařilo odeslat:", error));
  }
  return result;
}

export type { TurnkeyConfig };
export { parseCableReport };
