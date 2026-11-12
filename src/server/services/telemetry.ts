import type { PrismaClient } from "@/generated/prisma/client";
import { referrerHost, serializeProps, trafficSource, type TelemetryInput, type TelemetryType } from "@/lib/telemetry";

// Fáze 102: zápis události produktové telemetrie prvních stran. IP adresa se neukládá – slouží jen k omezení četnosti
// v paměti procesu (nejvýš 120 událostí za minutu z jedné adresy), po minutě se zapomene.

const WINDOW_MS = 60_000;
const LIMIT = 120;
const hits = new Map<string, { start: number; count: number }>();

/** Omezení četnosti podle klíče (IP / hash) – true = událost přijmout. */
export function allowTelemetry(key: string, now = Date.now()): boolean {
  const entry = hits.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    if (hits.size > 5000) hits.clear();
    hits.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= LIMIT;
}

export interface RecordedEvent extends Partial<Omit<TelemetryInput, "type">> {
  type: TelemetryType;
  companyId?: string | null;
}

/** Událost do databáze (zdroj návštěvy z UTM a domény odkazu; cesta bez dotazu). */
export async function recordTelemetry(prisma: PrismaClient, event: RecordedEvent) {
  const host = referrerHost(event.referrer ?? null);
  return prisma.telemetryEvent.create({
    data: {
      type: event.type,
      path: (event.path ?? "/").slice(0, 300),
      source: trafficSource({ referrerHost: host, utmSource: event.utm?.source ?? null }),
      referrerHost: host,
      utmSource: event.utm?.source?.slice(0, 80) || null,
      utmMedium: event.utm?.medium?.slice(0, 80) || null,
      utmCampaign: event.utm?.campaign?.slice(0, 120) || null,
      landing: Boolean(event.landing),
      visitorId: event.visitorId ?? null,
      companyId: event.companyId ?? null,
      props: serializeProps(event.props),
    },
    select: { id: true },
  });
}

/** Serverová událost (server action) – chyba zápisu nikdy nezastaví vlastní akci uživatele. */
export async function recordServerEvent(prisma: PrismaClient, event: RecordedEvent) {
  try {
    await recordTelemetry(prisma, event);
  } catch {
    // telemetrie je doplňková
  }
}

/** Typ prostoru nákresu → popisek trhu (RD / OC BD4 / Zdravotnictví). */
const OCCUPANCY_LABEL: Record<string, string> = { RESIDENTIAL: "RD", COMMERCIAL_BD4: "OC BD4", MEDICAL_G1: "Zdravotnictví", MEDICAL_G2: "Zdravotnictví" };

/**
 * Fáze 102: `switchboard_generated` z uloženého projektu – počet modulů a přístrojů, výrobci přístrojů (ABB / Eaton /
 * OEZ / Schneider …) podle katalogu a typ prostoru. Volá se po vzniku rozváděče (půdorys, soupis, fotka, trenažér).
 */
export async function recordSwitchboard(prisma: PrismaClient, input: { projectId: string; companyId: string | null; source: "floorplan" | "schedule" | "photo" | "scratch"; occupancy?: string | null }) {
  try {
    const items = await prisma.panelBoardItem.findMany({ where: { projectId: input.projectId }, select: { modulesWidth: true, catalogComponent: { select: { manufacturer: true } } } });
    const brands = new Map<string, number>();
    for (const item of items) {
      const brand = item.catalogComponent?.manufacturer;
      if (brand) brands.set(brand, (brands.get(brand) ?? 0) + 1);
    }
    const ranked = [...brands.entries()].sort((a, b) => b[1] - a[1]);
    await recordTelemetry(prisma, {
      type: "switchboard_generated",
      path: "/panel-builder",
      companyId: input.companyId,
      props: {
        source: input.source,
        devices: items.length,
        modules: Math.round(items.reduce((sum, item) => sum + item.modulesWidth, 0) * 10) / 10,
        brand: ranked[0]?.[0] ?? "",
        brands: ranked.map(([brand]) => brand).join(", ").slice(0, 120),
        occupancy: OCCUPANCY_LABEL[input.occupancy ?? ""] ?? "RD",
      },
    });
  } catch {
    // telemetrie je doplňková
  }
}
