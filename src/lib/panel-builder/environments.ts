// Prostředí instalace rozváděče a vnější vlivy dle ČSN 33 2000-5-51 ed. 3 (fáze 45): minimální krytí
// a odolnost skříně, teplota okolí pro výpočet oteplení a doporučení (UV, žhavá smyčka, AFDD).

import { ipNumber } from "./enclosures";

export type EnvironmentId = "INDOOR_DRY" | "GARAGE" | "OUTDOOR" | "TIMBER" | "HOT";

export interface InstallEnvironment {
  id: EnvironmentId;
  label: string;
  codes: string;
  /** Minimální krytí (číslo IP: 20, 44, 54 …) a doporučené vyšší krytí. */
  minIp: number;
  recommendedIp: number;
  minIk: number | null;
  /** Teplota okolí pro výpočet oteplení [°C]. */
  ambientTempC: number;
  notes: string[];
}

export const ENVIRONMENTS: readonly InstallEnvironment[] = [
  { id: "INDOOR_DRY", label: "Interiér – Byt / Technická místnost", codes: "Suché – AA5/AD1", minIp: 20, recommendedIp: 30, minIk: null, ambientTempC: 25, notes: [] },
  { id: "GARAGE", label: "Garáž / Dílna / Sklep", codes: "Vlhkost a prach – AD2/AE4/AG2", minIp: 44, recommendedIp: 54, minIk: 7, ambientTempC: 25, notes: ["Skříň s odolností min. IK 07."] },
  {
    id: "OUTDOOR",
    label: "Venkovní prostředí / Fasáda / FVE",
    codes: "Déšť a UV – AA4/AD4/AN2",
    minIp: 54,
    recommendedIp: 65,
    minIk: 7,
    ambientTempC: 40,
    notes: ["UV stabilní skříň (polykarbonát / ocel s nátěrem).", "Teplota okolí −25 až +40 °C – oteplení se počítá pro +40 °C."],
  },
  { id: "TIMBER", label: "Dřevostavba / Pasivní dům / Hořlavý podklad", codes: "CA2/CB1", minIp: 30, recommendedIp: 41, minIk: null, ambientTempC: 25, notes: ["Skříň se zkouškou žhavou smyčkou 850 °C (ČSN EN 60695-2-11).", "Doporučení: ochrana před obloukovou poruchou AFDD (ČSN 33 2000-4-42)."] },
  { id: "HOT", label: "Kotelna / Střídačovna FVE / Průmysl", codes: "Zvýšená teplota – AA6", minIp: 30, recommendedIp: 41, minIk: null, ambientTempC: 35, notes: ["Teplota okolí 35 °C – výpočet oteplení započítá derating jističů."] },
];

export const DEFAULT_ENVIRONMENT: EnvironmentId = "INDOOR_DRY";
export const environmentOf = (id: string | null | undefined): InstallEnvironment => ENVIRONMENTS.find((env) => env.id === id) ?? ENVIRONMENTS[0];
export const isEnvironmentId = (value: unknown): value is EnvironmentId => ENVIRONMENTS.some((env) => env.id === value);

/** Vyhovuje krytí skříně prostředí? (krytí „IP 41“ / „IP41“ / „IP4X“) */
export function enclosureFitsEnvironment(ipRating: string, environment: InstallEnvironment): boolean {
  return ipNumber(ipRating.replace(/\s+/g, "")) >= environment.minIp;
}

/** „IP 54“ – text pro tlačítko výběru vhodné skříně. */
export const ipLabel = (value: number) => `IP ${String(value).padStart(2, "0")}`;


/**
 * Stavební detaily instalace (fáze 52): dřevostavba / pasivní dům a venkovní prostupy – vzduchotěsné
 * krabice, manžety a obvodový zemnič V4A (ČSN 33 2000-5-54 ed. 3). Položky kusovníku a technické zprávy.
 */
export function constructionDetails(environment: string | null | undefined): string[] {
  const timber = [
    "Vzduchotěsná membránová přístrojová krabice (parotěsná vrstva dřevostavby)",
    "EPDM manžeta pro vzduchotěsný prostup kabelu (např. ProClima ROFLEX)",
  ];
  const outdoor = ["Krabice do zateplení fasády (např. Kopos KEZ_KB)", "EPDM manžeta pro vzduchotěsný prostup kabelu (např. ProClima ROFLEX)"];
  const earthing = "Obvodový zemnič z nerezové oceli V4A (AISI 316Ti) pod hydroizolací základové desky (ČSN 33 2000-5-54 ed. 3)";
  if (environment === "TIMBER") return [...timber, outdoor[0], earthing];
  if (environment === "OUTDOOR") return [...outdoor, earthing];
  return [];
}
