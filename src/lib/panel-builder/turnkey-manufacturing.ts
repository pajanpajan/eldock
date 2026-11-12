// Fáze 106: výroba rozváděče na klíč u zasmluvněného výrobce ELDOCK – kraje, stavy zakázky, orientační kalkulace
// (materiál + montáž, drátování a kusová zkouška + doprava), číslo zakázky a výstupní kusová zkouška výrobce
// (ČSN EN IEC 61439-1 ed. 3) převedená na měření pro uzamčení Verze 1.0 pod QR štítkem.

import { z } from "zod";

import { ROUTINE_TEST_POINTS, type RoutinePointId, type RoutineTest } from "@/lib/legislation-2027";

import type { EntryDirection, MountingType } from "./cnc-manufacturing-engine";

export const REGIONS = [
  "Hlavní město Praha",
  "Středočeský kraj",
  "Jihočeský kraj",
  "Plzeňský kraj",
  "Karlovarský kraj",
  "Ústecký kraj",
  "Liberecký kraj",
  "Královéhradecký kraj",
  "Pardubický kraj",
  "Kraj Vysočina",
  "Jihomoravský kraj",
  "Olomoucký kraj",
  "Zlínský kraj",
  "Moravskoslezský kraj",
] as const;
export type Region = (typeof REGIONS)[number];
export const isRegion = (value: unknown): value is Region => REGIONS.includes(value as Region);

export const ORDER_STATUS = {
  SENT: "SENT",
  ACCEPTED: "ACCEPTED",
  TESTED: "TESTED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  SENT: "📨 Poptávka odeslána výrobci",
  ACCEPTED: "🏭 Přijato do výroby",
  TESTED: "🧪 Vyrobeno, kusová zkouška zapsána",
  COMPLETED: "✅ Vyrobeno, odzkoušeno, Verze 1.0 uzamčena – připraveno k převzetí",
  CANCELLED: "Zrušeno",
};

/** Doprava hotového rozváděče na stavbu – orientační paušál (upřesní výrobce při přijetí). */
export const TRANSPORT_CZK = 1490;

export interface TurnkeyEstimate {
  materialCzk: number;
  laborCzk: number;
  transportCzk: number;
  totalCzk: number;
  /** Přístroje bez ceníkové ceny (materiál je bez nich – upřesní výrobce). */
  missingPrices: number;
  laborHours: number;
}

export function turnkeyEstimate(input: { materialCzk: number; laborCzk: number; laborHours: number; missingPrices: number; transportCzk?: number }): TurnkeyEstimate {
  const transportCzk = input.transportCzk ?? TRANSPORT_CZK;
  const round = (value: number) => Math.round(value);
  return { materialCzk: round(input.materialCzk), laborCzk: round(input.laborCzk), transportCzk, totalCzk: round(input.materialCzk + input.laborCzk + transportCzk), missingPrices: input.missingPrices, laborHours: Math.round(input.laborHours * 10) / 10 };
}

export const czk = (value: number) => `${value.toLocaleString("cs-CZ")} Kč`;

/** Materiál v kalkulaci – bez ceníkových cen přístrojů se nepíše „0 Kč“ (cenu materiálu doplní výrobce při přijetí). */
export function materialText(estimate: Pick<TurnkeyEstimate, "materialCzk" | "missingPrices">): string {
  if (estimate.materialCzk <= 0) return estimate.missingPrices ? "doplní výrobce" : czk(0);
  return estimate.missingPrices ? `${czk(estimate.materialCzk)} + ${estimate.missingPrices} přístrojů bez ceny` : czk(estimate.materialCzk);
}

/** Číslo zakázky výroby „VYR-2026-0001“. */
export const orderNumber = (year: number, sequence: number) => `VYR-${year}-${String(sequence).padStart(4, "0")}`;

export interface TurnkeyConfig {
  entry: EntryDirection;
  mounting: MountingType;
  door: { centralStop: boolean; phaseLamps: boolean; meter: boolean; ventilation: boolean };
}

export const turnkeyConfigSchema = z.object({
  entry: z.enum(["top", "bottom", "both"]),
  mounting: z.enum(["flush", "surface"]),
  door: z.object({ centralStop: z.boolean(), phaseLamps: z.boolean(), meter: z.boolean(), ventilation: z.boolean() }),
});

export const DEFAULT_TURNKEY_CONFIG: TurnkeyConfig = { entry: "top", mounting: "flush", door: { centralStop: false, phaseLamps: false, meter: false, ventilation: false } };

export function parseTurnkeyConfig(json: string | null | undefined): TurnkeyConfig {
  try {
    const parsed = turnkeyConfigSchema.safeParse(JSON.parse(json ?? ""));
    return parsed.success ? parsed.data : DEFAULT_TURNKEY_CONFIG;
  } catch {
    return DEFAULT_TURNKEY_CONFIG;
  }
}

const decimal = (min: number, max: number) => z.coerce.number().min(min).max(max);

/** Výstupní kusová zkouška výrobce (ČSN EN IEC 61439-1 ed. 3, čl. 11). */
export const factoryTestSchema = z.object({
  testerName: z.string().trim().min(3, "Zadejte jméno zkoušejícího.").max(80),
  enclosureSerial: z.string().trim().min(2, "Zadejte výrobní číslo skříně.").max(40),
  measuredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Zadejte datum zkoušky."),
  insulationMOhm: decimal(0, 100_000),
  peContinuityOhm: decimal(0, 100),
  rcdTripCurrentMa: decimal(0, 1000).optional(),
  rcdTripTimeMs: decimal(0, 1000).optional(),
  torqueOk: z.boolean(),
  wiringOk: z.boolean(),
  /** Vizuální a funkční body kusové zkoušky (IP, vzdušné cesty, přístroje, obvody, svorky) – „vyhovuje“. */
  checks: z.object({ ip: z.boolean(), clearances: z.boolean(), devices: z.boolean(), circuits: z.boolean(), terminals: z.boolean() }),
  note: z.string().trim().max(500).optional(),
});
export type FactoryTestInput = z.input<typeof factoryTestSchema>;
export type FactoryTest = z.output<typeof factoryTestSchema>;

/** Nevyhovující body výstupní zkoušky výrobce (izolační odpor ≥ 1 MΩ, PE ≤ 0,1 Ω, RCD ≤ 300 ms, momenty a zapojení). */
export function factoryTestIssues(test: FactoryTest): string[] {
  const issues: string[] = [];
  if (test.insulationMOhm < 1) issues.push(`Izolační odpor ${test.insulationMOhm} MΩ < 1 MΩ.`);
  if (test.peContinuityOhm > 0.1) issues.push(`Spojitost PE ${test.peContinuityOhm} Ω > 0,1 Ω.`);
  if (test.rcdTripTimeMs !== undefined && test.rcdTripTimeMs > 300) issues.push(`Vybavovací čas RCD ${test.rcdTripTimeMs} ms > 300 ms.`);
  if (!test.torqueOk) issues.push("Utahovací momenty svorek nebyly zkontrolovány.");
  if (!test.wiringOk) issues.push("Kontrola zapojení podle drátovacího listu neproběhla.");
  for (const point of ROUTINE_TEST_POINTS) if (point.id in test.checks && !test.checks[point.id as keyof FactoryTest["checks"]]) issues.push(`${point.label} (čl. ${point.clause}) nevyhověl.`);
  return issues;
}

/** Měření pro uzamčení verze (fáze 103 `Inspection`) z výstupní zkoušky výrobce. */
export function inspectionFromFactoryTest(test: FactoryTest, manufacturer: { name: string; ico: string | null }) {
  return {
    inspectorName: test.testerName,
    inspectorCert: `Výrobce rozváděčů ${manufacturer.name}${manufacturer.ico ? `, IČO ${manufacturer.ico}` : ""} – výrobní č. ${test.enclosureSerial}`.slice(0, 60),
    measuredAt: test.measuredAt,
    insulationMOhm: test.insulationMOhm,
    insulationTestVoltage: 500,
    peContinuityOhm: test.peContinuityOhm,
    ...(test.rcdTripCurrentMa !== undefined ? { rcdTripCurrentMa: test.rcdTripCurrentMa } : {}),
    ...(test.rcdTripTimeMs !== undefined ? { rcdTripTimeMs: test.rcdTripTimeMs } : {}),
    mechanicalOk: test.torqueOk && test.wiringOk,
    verdict: factoryTestIssues(test).length ? ("UNSAFE" as const) : ("SAFE" as const),
    note: [`Výstupní kusová zkouška výrobce rozváděče na klíč (výrobní č. skříně ${test.enclosureSerial}).`, test.note].filter(Boolean).join(" ").slice(0, 500),
  };
}

/** Protokol o kusové zkoušce (8 bodů ČSN EN IEC 61439-1 ed. 3, čl. 11) z výstupní zkoušky výrobce. */
export function routineTestFromFactory(test: FactoryTest, manufacturer: { name: string }): RoutineTest {
  const result = (ok: boolean): "PASS" | "FAIL" => (ok ? "PASS" : "FAIL");
  const points: Record<RoutinePointId, "PASS" | "FAIL"> = {
    ip: result(test.checks.ip),
    clearances: result(test.checks.clearances),
    protection: result(test.peContinuityOhm <= 0.1),
    devices: result(test.checks.devices),
    circuits: result(test.checks.circuits && test.wiringOk),
    terminals: result(test.checks.terminals && test.torqueOk),
    mechanical: result(test.torqueOk),
    dielectric: result(test.insulationMOhm >= 1),
  };
  return { points, insulationMOhm: test.insulationMOhm, testedBy: `${test.testerName}, ${manufacturer.name}`.slice(0, 120), testedAt: test.measuredAt, note: `Výstupní kusová zkouška výrobce, výrobní č. skříně ${test.enclosureSerial}.${test.note ? ` ${test.note}` : ""}`.slice(0, 500) };
}
