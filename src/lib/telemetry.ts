import { z } from "zod";

// Fáze 102: produktová telemetrie prvních stran (`POST /api/telemetry`). Bez IP adresy, bez celého user-agentu a bez
// identifikátoru u návštěvníka, který nedal souhlas s analytikou (pak se nic nezapisuje do prohlížeče a událost je jen
// souhrnný počet). Odkud návštěva přišla se ukládá jen jako doména odkazu a UTM parametry. Čisté funkce.

export const TELEMETRY_EVENTS = ["page_view", "sandbox_started", "series_selected", "switchboard_generated", "export_clicked", "lead_captured"] as const;
export type TelemetryType = (typeof TELEMETRY_EVENTS)[number];

export const TELEMETRY_LABEL: Record<TelemetryType, string> = {
  page_view: "Zobrazení stránky",
  sandbox_started: "Spuštěný trenažér / demo",
  series_selected: "Zvolená designová řada",
  switchboard_generated: "Vygenerovaný rozváděč",
  export_clicked: "Pokus o export",
  lead_captured: "Zachycený kontakt",
};

/** Trenažéry a demo scénáře (zadání fáze 102). */
export const SANDBOXES = ["2D Půdorys 4+kk", "AI Panel Builder", "Průmyslový BIM závod", "Zdravotnictví", "Obchodní centrum"] as const;
export type Sandbox = (typeof SANDBOXES)[number];

/** Zdroj návštěvy pro trychtýř (Google / Seznam / Facebook / LinkedIn / přímý vstup / jiný web / interní). */
export const TRAFFIC_SOURCES = ["google", "seznam", "facebook", "linkedin", "direct", "other", "internal"] as const;
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];
export const SOURCE_LABEL: Record<TrafficSource, string> = { google: "Google", seznam: "Seznam", facebook: "Facebook", linkedin: "LinkedIn", direct: "Přímé", other: "Jiné weby", internal: "Interní" };

const short = (max: number) => z.string().trim().max(max);
const propValue = z.union([short(120), z.number().finite(), z.boolean()]);

export const telemetrySchema = z.object({
  type: z.enum(TELEMETRY_EVENTS),
  /** Jen cesta stránky bez dotazu (v dotazu mohou být tokeny). */
  path: z.string().max(300).regex(/^\/[^?#\s]*$/),
  /** Doména odkazující stránky (`https://www.google.com`) – cestu klient neposílá. */
  referrer: short(200).optional(),
  utm: z.object({ source: short(80).optional(), medium: short(80).optional(), campaign: short(120).optional() }).optional(),
  landing: z.boolean().optional(),
  props: z
    .record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/), propValue)
    .refine((value) => Object.keys(value).length <= 20, "Nejvýš 20 vlastností události.")
    .optional(),
  /** Pseudonymní id prohlížeče – jen se souhlasem s analytikou. */
  visitorId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
});
export type TelemetryInput = z.infer<typeof telemetrySchema>;

/** Doména z odkazu (`https://www.seznam.cz/hledani?q=…` → `www.seznam.cz`); neplatný nebo prázdný odkaz → null. */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer?.trim()) return null;
  try {
    const url = new URL(referrer.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.hostname.toLowerCase().slice(0, 120) : null;
  } catch {
    return null;
  }
}

/** Zdroj návštěvy podle UTM (přednost) a domény odkazu; vlastní doména = interní přechod. */
export function trafficSource(input: { referrerHost?: string | null; utmSource?: string | null }, ownHosts: readonly string[] = ["eldock.cz", "www.eldock.cz", "localhost"]): TrafficSource {
  const utm = input.utmSource?.trim().toLowerCase() ?? "";
  const host = input.referrerHost?.trim().toLowerCase() ?? "";
  const match = (value: string): TrafficSource | null => {
    if (!value) return null;
    if (/(^|\.)google\.|^google$|googleads|gclid|adwords/.test(value)) return "google";
    if (/(^|\.)seznam\.cz|^seznam$|^sklik$|(^|\.)firmy\.cz|(^|\.)zbozi\.cz/.test(value)) return "seznam";
    if (/(^|\.)facebook\.com|(^|\.)fb\.com|^facebook$|^fb$|(^|\.)instagram\.com|^instagram$|^meta$/.test(value)) return "facebook";
    if (/(^|\.)linkedin\.com|(^|\.)lnkd\.in|^linkedin$/.test(value)) return "linkedin";
    return null;
  };
  const fromUtm = match(utm);
  if (fromUtm) return fromUtm;
  if (utm) return "other";
  if (!host) return "direct";
  if (ownHosts.some((own) => host === own || host.endsWith(`.${own}`))) return "internal";
  return match(host) ?? "other";
}

/** Krátký JSON vlastností události (do 2 kB). */
export function serializeProps(props: TelemetryInput["props"]): string {
  const json = JSON.stringify(props ?? {});
  return json.length <= 2000 ? json : "{}";
}

export function parseProps(json: string | null | undefined): Record<string, string | number | boolean> {
  try {
    const value: unknown = JSON.parse(json ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string | number | boolean>) : {};
  } catch {
    return {};
  }
}

/** Roboti a náhledy odkazů se nepočítají (user-agent se neukládá, jen se podle něj událost zahodí). */
export const isBotAgent = (userAgent: string | null | undefined) => /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|embedly|preview|monitor|pingdom|lighthouse|curl\/|wget\/|python-requests|httpclient/i.test(userAgent ?? "");
