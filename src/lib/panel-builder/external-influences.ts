// Fáze 52: legislativní rámec projektové dokumentace a protokol o určení vnějších vlivů
// (TNI 33 2000-5-51:2022, ČSN 33 2000-5-51 ed. 3+Z1+Z2) generovaný z prostředí instalace rozváděče.
// Čisté funkce – sdílí je krok 4 dokumentace i veřejná ukázka elaborátu.

import {
  constructionDetails,
  environmentOf,
  ipLabel,
  type EnvironmentId,
} from "./environments";

/** Právní předpisy a normy technické zprávy (vyhláška č. 131/2024 Sb., příloha 9, D.2.5 TPS – Silnoproud). */
export const LEGAL_FRAMEWORK: readonly string[] = [
  "Zákon č. 283/2021 Sb., stavební zákon",
  "Vyhláška č. 131/2024 Sb., o dokumentaci staveb – příloha 9, část D.2.5 Technika prostředí staveb (TPS) – Silnoproud",
  "Zákon č. 250/2021 Sb., o bezpečnosti práce v souvislosti s provozem vyhrazených technických zařízení",
  "Nařízení vlády č. 190/2022 Sb., o vyhrazených technických elektrických zařízeních",
  "ČSN 33 2130 ed. 4 – Elektrické instalace nízkého napětí – Vnitřní elektrické rozvody (platná od 1. 1. 2025)",
  "ČSN 33 2000-5-51 ed. 3+Z1+Z2 a TNI 33 2000-5-51:2022 – Určení vnějších vlivů",
  "ČSN 33 2000-5-52 ed. 2 – Výběr a stavba elektrických zařízení – Elektrická vedení",
  "ČSN 33 2000-6 ed. 2 – Revize",
];

/** Deklarace rozvodnice pod omítku (DBO). */
export const FULL_COVER_NOTE =
  "Rozvodnice pro domovní a podobné pevné instalace (DBO) pod omítku – „Úplný kryt“ dle ČSN EN 60670-24.";
export const isFlushEnclosure = (text: string | null | undefined) =>
  /pod omítk|zapušt|flush|\bUP\b/i.test(text ?? "");

export interface InfluenceRow {
  code: string;
  name: string;
  /** Třída vnějšího vlivu (AA5, AD1 …). */
  value: string;
  description: string;
  measure: string;
}

type Influence = Omit<InfluenceRow, "code">;

/** Normální prostředí (byt, technická místnost) – výchozí třídy 15 sledovaných vlivů. */
const NORMAL: Record<string, Influence> = {
  AA: {
    name: "Teplota okolí",
    value: "AA5",
    description: "+5 až +40 °C",
    measure: "Běžné provedení, oteplení rozváděče pro +25 °C",
  },
  AB: {
    name: "Atmosférická vlhkost",
    value: "AB5",
    description: "relativní vlhkost 5–85 %",
    measure: "Běžné provedení",
  },
  AC: {
    name: "Nadmořská výška",
    value: "AC1",
    description: "≤ 2 000 m n. m.",
    measure: "Bez opatření",
  },
  AD: {
    name: "Výskyt vody",
    value: "AD1",
    description: "zanedbatelný",
    measure: "IP X0",
  },
  AE: {
    name: "Cizí pevná tělesa",
    value: "AE1",
    description: "zanedbatelný výskyt",
    measure: "IP 2X",
  },
  AF: {
    name: "Korozivní látky",
    value: "AF1",
    description: "zanedbatelné",
    measure: "Bez opatření",
  },
  AG: {
    name: "Mechanické namáhání – rázy",
    value: "AG1",
    description: "mírné",
    measure: "Běžné provedení",
  },
  AH: {
    name: "Vibrace",
    value: "AH1",
    description: "mírné",
    measure: "Bez opatření",
  },
  AN: {
    name: "Sluneční záření",
    value: "AN1",
    description: "nízké",
    measure: "Bez opatření",
  },
  BA: {
    name: "Schopnost osob",
    value: "BA1",
    description: "běžné osoby",
    measure: "Ochrana dle ČSN 33 2000-4-41, doplňková ochrana RCD 30 mA",
  },
  BC: {
    name: "Dotyk osob s potenciálem země",
    value: "BC2",
    description: "malá četnost",
    measure: "Ochranné pospojování",
  },
  BD: {
    name: "Podmínky úniku v nebezpečí",
    value: "BD1",
    description: "nízká hustota osob, snadný únik",
    measure: "Bez opatření",
  },
  BE: {
    name: "Zpracovávané nebo skladované látky",
    value: "BE1",
    description: "bez významného nebezpečí",
    measure: "Bez opatření",
  },
  CA: {
    name: "Stavební materiály",
    value: "CA1",
    description: "nehořlavé",
    measure: "Bez opatření",
  },
  CB: {
    name: "Konstrukce budovy",
    value: "CB1",
    description: "zanedbatelná rizika",
    measure: "Bez opatření",
  },
};

const OVERRIDES: Record<
  EnvironmentId,
  Partial<Record<keyof typeof NORMAL, Partial<Influence>>>
> = {
  INDOOR_DRY: {},
  GARAGE: {
    AA: {
      value: "AA4",
      description: "−5 až +40 °C",
      measure: "Provedení pro nevytápěné prostory",
    },
    AB: {
      value: "AB4",
      description: "vlhkost 5–95 %",
      measure: "Provedení do vlhka",
    },
    AD: {
      value: "AD2",
      description: "kapající voda",
      measure: "min. IP X4 (kapající / stříkající voda)",
    },
    AE: {
      value: "AE4",
      description: "prach – lehká prašnost",
      measure: "min. IP 5X",
    },
    AG: {
      value: "AG2",
      description: "střední rázy",
      measure: "Odolnost min. IK 07",
    },
    BC: {
      value: "BC3",
      description: "častý dotyk",
      measure: "Ochranné pospojování, RCD 30 mA na všech zásuvkách",
    },
  },
  OUTDOOR: {
    AA: {
      value: "AA7",
      description: "−25 až +55 °C",
      measure: "UV stabilní skříň, oteplení pro +40 °C",
    },
    AB: {
      value: "AB7",
      description: "vlhkost 10–100 %, kondenzace",
      measure: "Provedení venkovní, odvětrání kondenzátu",
    },
    AD: {
      value: "AD4",
      description: "stříkající voda, déšť",
      measure: "min. IP X4, doporučeno IP 65",
    },
    AE: {
      value: "AE3",
      description: "velmi malé předměty",
      measure: "min. IP 4X",
    },
    AF: {
      value: "AF2",
      description: "atmosférické korozivní látky",
      measure: "Nerezové nebo povrchově chráněné spojovací prvky",
    },
    AG: {
      value: "AG2",
      description: "střední rázy",
      measure: "Odolnost min. IK 07",
    },
    AN: {
      value: "AN2",
      description: "střední sluneční záření",
      measure: "UV stabilní materiály",
    },
    BC: {
      value: "BC3",
      description: "častý dotyk",
      measure: "Ochranné pospojování, RCD 30 mA",
    },
  },
  TIMBER: {
    CA: {
      value: "CA2",
      description: "hořlavé stavební materiály (dřevostavba)",
      measure:
        "Skříň se zkouškou žhavou smyčkou 850 °C, krabice do hořlavých podkladů, doporučeno AFDD",
    },
    CB: {
      value: "CB1",
      description: "zanedbatelná rizika šíření požáru",
      measure:
        "Vzduchotěsné prostupy parozábranou (membránové krabice, EPDM manžety)",
    },
  },
  HOT: {
    AA: {
      value: "AA6",
      description: "+5 až +60 °C",
      measure: "Oteplení pro +35 °C, derating jističů",
    },
    AE: { value: "AE2", description: "malé předměty", measure: "min. IP 3X" },
  },
};

/** Protokol o určení vnějších vlivů z prostředí instalace (15 vlivů + požadované krytí IP / IK a stavební detaily). */
export function externalInfluencesProtocol(
  environmentId: string | null | undefined,
) {
  const environment = environmentOf(environmentId);
  const overrides = OVERRIDES[environment.id];
  const rows: InfluenceRow[] = Object.entries(NORMAL).map(([code, base]) => ({
    code,
    ...base,
    ...overrides[code],
  }));
  return {
    environment: environment.label,
    codes: environment.codes,
    rows,
    requiredIp: ipLabel(environment.minIp),
    recommendedIp: ipLabel(environment.recommendedIp),
    requiredIk: environment.minIk
      ? `IK ${String(environment.minIk).padStart(2, "0")}`
      : null,
    notes: environment.notes,
    construction: constructionDetails(environment.id),
    basis: "TNI 33 2000-5-51:2022 a ČSN 33 2000-5-51 ed. 3+Z1+Z2",
  };
}

export type ExternalInfluencesProtocol = ReturnType<
  typeof externalInfluencesProtocol
>;
