// Fáze 53: kontrola dimenzování a zatížení průmyslových kabelových tras dle ČSN 33 2000-5-52 ed. 2
// (zatížitelnost Itab pro způsoby uložení B2 / C / E / D, korekce teplotou okolí a seskupením),
// podmínka jištění IB ≤ In ≤ Iz (ČSN 33 2000-4-43 čl. 433.1), úbytek napětí 3f 400 V a simulátor
// „co když připojím nový stroj?“ s přírůstkem proudu kaskádou až k transformátoru. Čisté funkce.

export type CableInstallMethod = "B2" | "C" | "E" | "D";
export type ConductorMaterial = "CU" | "AL";
export type CableInsulation = "PVC" | "XLPE";

export const CABLE_INSTALL_METHODS: readonly {
  id: CableInstallMethod;
  label: string;
}[] = [
  { id: "B2", label: "B2 – v trubce / liště na zdi" },
  { id: "C", label: "C – přímo na zdi / lávce" },
  { id: "E", label: "E – perforovaný žlab / rošt na vzduchu" },
  { id: "D", label: "D – v zemi (chránička)" },
];
export const isCableInstallMethod = (
  value: unknown,
): value is CableInstallMethod =>
  CABLE_INSTALL_METHODS.some((method) => method.id === value);

export const CROSS_SECTIONS = [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240,
] as const;

/**
 * Základní zatížitelnost Itab [A], měď, 3 zatížené žíly, okolí 30 °C (v zemi 20 °C) – ČSN 33 2000-5-52
 * ed. 2 tab. B.52.4 / B.52.5 (B2, C, D) a B.52.10 / B.52.12 (E, vícežilové kabely na vzduchu).
 */
const ITAB_CU: Record<
  CableInsulation,
  Record<CableInstallMethod, readonly number[]>
> = {
  PVC: {
    B2: [15, 20, 27, 34, 46, 62, 80, 99, 118, 149, 179, 206, 236, 268, 313],
    C: [17.5, 24, 32, 41, 57, 76, 96, 119, 144, 184, 223, 259, 299, 341, 403],
    E: [18.5, 25, 34, 43, 60, 80, 101, 126, 153, 196, 238, 276, 319, 364, 430],
    D: [18, 24, 30, 38, 50, 64, 82, 98, 116, 143, 169, 192, 217, 243, 280],
  },
  XLPE: {
    B2: [19.5, 26, 35, 44, 60, 80, 105, 128, 154, 194, 233, 268, 300, 340, 398],
    C: [22, 30, 40, 51, 70, 94, 119, 148, 180, 232, 282, 328, 379, 434, 514],
    E: [23, 32, 42, 54, 75, 100, 127, 158, 192, 246, 298, 346, 399, 456, 538],
    D: [21, 28, 36, 44, 58, 75, 96, 115, 135, 167, 197, 223, 251, 281, 324],
  },
};
/** Hliník: zjednodušeně 78 % zatížitelnosti mědi (tabulky Al uvádějí 0,77–0,79). */
export const ALUMINIUM_FACTOR = 0.78;

/** Izolace podle typu kabelu: CXKH / CXKE / N2XH / XLPE = síťovaný polyetylen, ostatní PVC. */
export const insulationOf = (
  cableType: string | null | undefined,
): CableInsulation =>
  /CXK|N2X|XLPE|CXKE|1-CX/i.test(cableType ?? "") ? "XLPE" : "PVC";

export function tabulatedAmpacity(input: {
  crossSectionMm2: number;
  method: CableInstallMethod;
  material: ConductorMaterial;
  insulation: CableInsulation;
}): number {
  const index = CROSS_SECTIONS.indexOf(
    input.crossSectionMm2 as (typeof CROSS_SECTIONS)[number],
  );
  if (index < 0) return 0;
  const cu = ITAB_CU[input.insulation][input.method][index];
  return (
    Math.round((input.material === "AL" ? cu * ALUMINIUM_FACTOR : cu) * 10) / 10
  );
}

/** Korekční součinitel teploty okolí (tab. B.52.14; v zemi tab. B.52.15 vztažená k 20 °C). */
export function temperatureFactor(
  ambientC: number,
  insulation: CableInsulation,
  method: CableInstallMethod,
): number {
  const air: Record<CableInsulation, [number, number][]> = {
    PVC: [
      [25, 1.03],
      [30, 1],
      [35, 0.94],
      [40, 0.87],
      [45, 0.79],
      [50, 0.71],
      [55, 0.61],
    ],
    XLPE: [
      [25, 1.02],
      [30, 1],
      [35, 0.96],
      [40, 0.91],
      [45, 0.87],
      [50, 0.82],
      [55, 0.76],
    ],
  };
  const ground: Record<CableInsulation, [number, number][]> = {
    PVC: [
      [15, 1.05],
      [20, 1],
      [25, 0.95],
      [30, 0.89],
      [35, 0.84],
      [40, 0.77],
      [45, 0.71],
    ],
    XLPE: [
      [15, 1.04],
      [20, 1],
      [25, 0.96],
      [30, 0.93],
      [35, 0.89],
      [40, 0.85],
      [45, 0.8],
    ],
  };
  const table = method === "D" ? ground[insulation] : air[insulation];
  // Nejbližší vyšší teplota tabulky (na stranu bezpečnosti)
  return (table.find(([temp]) => temp >= ambientC) ??
    table[table.length - 1])[1];
}

/** Součinitel seskupení souběžných třífázových kabelů ve žlabu / trase (tab. B.52.17 – hodnoty metodiky). */
export function groupFactor(count: number): number {
  const n = Math.max(1, Math.round(count));
  if (n === 1) return 1;
  if (n === 2) return 0.88;
  if (n === 3) return 0.82;
  if (n <= 5) return 0.77;
  if (n <= 8) return 0.73;
  return 0.7;
}

export interface FeederCable {
  cableType: string | null;
  material: ConductorMaterial;
  crossSectionMm2: number;
  parallelRuns: number;
  lengthM: number | null;
  method: CableInstallMethod;
  groupingCount: number;
  ambientTempC: number;
  upstreamBreakerA: number | null;
}

/** Měrný odpor při provozní teplotě [Ω·mm²/m]: Cu 0,0225, Al 0,036. */
const RESISTIVITY: Record<ConductorMaterial, number> = {
  CU: 0.0225,
  AL: 0.036,
};
/** Limit úbytku napětí: motory / stroje 5 %, světla 3 %. */
export const DROP_LIMIT = { machines: 5, lighting: 3 } as const;
/** Soudobost podřízených odběrů. */
export const SIMULTANEITY = 0.8;
export const U_LINE = 400;
export const POWER_FACTOR = 0.9;

/** Úbytek napětí 3f 400 V [%] (činný odpor, cos φ ≈ 1 – na stranu bezpečnosti). */
export function voltageDrop3f(
  currentA: number,
  lengthM: number,
  crossSectionMm2: number,
  parallelRuns: number,
  material: ConductorMaterial,
): number {
  const volts =
    (Math.sqrt(3) * currentA * lengthM * RESISTIVITY[material]) /
    (crossSectionMm2 * Math.max(1, parallelRuns));
  return Math.round((volts / U_LINE) * 10000) / 100;
}

/** Příkon [kW] → proud 3f 400 V [A] při cos φ 0,9. */
export const kwToAmps = (kw: number) =>
  Math.round(((kw * 1000) / (Math.sqrt(3) * U_LINE * POWER_FACTOR)) * 10) / 10;

export type CableStatus = "OK" | "WARNING" | "CRITICAL";
export const CABLE_STATUS: Record<
  CableStatus,
  { label: string; emoji: string; text: string; bar: string }
> = {
  OK: {
    label: "V pořádku",
    emoji: "🟢",
    text: "text-emerald-300",
    bar: "bg-emerald-500",
  },
  WARNING: {
    label: "Nízká rezerva",
    emoji: "🟡",
    text: "text-amber-300",
    bar: "bg-amber-400",
  },
  CRITICAL: {
    label: "Přetížený / nejištěný",
    emoji: "🔴",
    text: "text-red-300",
    bar: "bg-red-500",
  },
};
/** Vytížení od 75 % Iz = nízká rezerva pro další stroje. */
export const WARNING_LOAD = 75;

export interface CableCheck {
  itabA: number;
  kTemp: number;
  kGroup: number;
  izA: number;
  designCurrentA: number;
  loadPercent: number;
  /** In ≤ Iz (čl. 433.1) – false = nejištěný kabel. */
  protectedOk: boolean;
  voltageDropPct: number | null;
  status: CableStatus;
  messages: string[];
  /** Nejmenší vyhovující průřez při stejném uložení (null = nevyhoví ani 240 mm²). */
  recommendedMm2: number | null;
}

const fmt = (value: number, digits = 1) =>
  value.toLocaleString("cs-CZ", { maximumFractionDigits: digits });

/** Skutečná zatížitelnost Iz = Itab · paralelní běhy · k_temp · k_group. */
export function cableAmpacityOf(
  cable: FeederCable,
  crossSectionMm2 = cable.crossSectionMm2,
) {
  const insulation = insulationOf(cable.cableType);
  const itab = tabulatedAmpacity({
    crossSectionMm2,
    method: cable.method,
    material: cable.material,
    insulation,
  });
  const kTemp = temperatureFactor(cable.ambientTempC, insulation, cable.method);
  const kGroup = groupFactor(cable.groupingCount);
  const iz =
    Math.round(itab * Math.max(1, cable.parallelRuns) * kTemp * kGroup * 10) /
    10;
  return { itab, kTemp, kGroup, iz };
}

/** Kontrola 3 normativních podmínek: vytížení, IB ≤ In ≤ Iz, úbytek napětí; doporučený průřez. */
export function checkCable(
  cable: FeederCable,
  designCurrentA: number,
  dropLimit: number = DROP_LIMIT.machines,
): CableCheck {
  const { itab, kTemp, kGroup, iz } = cableAmpacityOf(cable);
  const loadPercent =
    iz > 0 ? Math.round((designCurrentA / iz) * 1000) / 10 : 0;
  const protectedOk =
    cable.upstreamBreakerA === null || cable.upstreamBreakerA <= iz;
  const voltageDropPct = cable.lengthM
    ? voltageDrop3f(
        designCurrentA,
        cable.lengthM,
        cable.crossSectionMm2,
        cable.parallelRuns,
        cable.material,
      )
    : null;
  const messages: string[] = [];
  if (!protectedOk)
    messages.push(
      `🔴 NEJIŠTĚNÝ KABEL: Jistič In (${fmt(cable.upstreamBreakerA!)} A) je vyšší než skutečná zatížitelnost kabelu Iz (${fmt(iz)} A po korekci seskupením a teplotou)!`,
    );
  if (designCurrentA > iz)
    messages.push(
      `🔴 PŘETÍŽENÝ KABEL: zatížení IB ${fmt(designCurrentA)} A překračuje Iz ${fmt(iz)} A (${fmt(loadPercent)} %).`,
    );
  if (
    cable.upstreamBreakerA !== null &&
    designCurrentA > cable.upstreamBreakerA
  )
    messages.push(
      `🔴 Zatížení IB ${fmt(designCurrentA)} A je vyšší než jistič In ${fmt(cable.upstreamBreakerA)} A.`,
    );
  if (voltageDropPct !== null && voltageDropPct > dropLimit)
    messages.push(
      `🔴 Úbytek napětí ${fmt(voltageDropPct, 2)} % překračuje ${dropLimit} %.`,
    );
  const critical = messages.length > 0;
  if (!critical && loadPercent >= WARNING_LOAD)
    messages.push(
      `🟡 Vytížení ${fmt(loadPercent)} % Iz – nízká rezerva pro další stroje.`,
    );
  const required = Math.max(designCurrentA, cable.upstreamBreakerA ?? 0);
  const recommendedMm2 =
    CROSS_SECTIONS.find((size) => {
      if (cableAmpacityOf(cable, size).iz < required) return false;
      return (
        !cable.lengthM ||
        voltageDrop3f(
          designCurrentA,
          cable.lengthM,
          size,
          cable.parallelRuns,
          cable.material,
        ) <= dropLimit
      );
    }) ?? null;
  return {
    itabA: itab,
    kTemp,
    kGroup,
    izA: iz,
    designCurrentA,
    loadPercent,
    protectedOk,
    voltageDropPct,
    status: critical
      ? "CRITICAL"
      : loadPercent >= WARNING_LOAD
        ? "WARNING"
        : "OK",
    messages,
    recommendedMm2,
  };
}

/** „CYKY-J 3×50 · 48 m · uložení E (6 kabelů) · 35 °C“. */
export function cableLabel(cable: FeederCable): string {
  const runs = cable.parallelRuns > 1 ? `${cable.parallelRuns}× ` : "";
  return `${runs}${cable.cableType ?? "Kabel"} ${fmt(cable.crossSectionMm2)} mm²${cable.material === "AL" ? " Al" : ""}`;
}

// ---------------------------------------------------------------------------
//  Strom napájení, výpočtové proudy a simulátor nového stroje
// ---------------------------------------------------------------------------

export interface PowerCableNode {
  id: string;
  tag: string;
  parentId: string | null;
  type?: string;
  nominalCurrentA: number | null;
  measuredCurrentA: number | null;
  /** Jmenovitý proud zdroje (transformátor) – kořen kaskády. */
  ratedCurrentA?: number | null;
  cable: FeederCable | null;
}

/** „1443 A“ → 1443. */
export const parseAmps = (text: string | null | undefined): number | null => {
  const match = /([\d\s]+(?:[.,]\d+)?)\s*A\b/.exec(text ?? "");
  return match ? Number(match[1].replace(/\s/g, "").replace(",", ".")) : null;
};

/**
 * Výpočtový proud IB uzlu: naměřený klešťákem má přednost, jinak součet podřízených odběrů se soudobostí
 * 0,8, jinak jmenovitý odběr. `extra` = přírůstek proudu na uzlu (simulace).
 */
export function designCurrents(
  nodes: readonly PowerCableNode[],
  extra: ReadonlyMap<string, number> = new Map(),
): Map<string, number> {
  const children = new Map<string, PowerCableNode[]>();
  for (const node of nodes)
    if (node.parentId)
      children.set(node.parentId, [
        ...(children.get(node.parentId) ?? []),
        node,
      ]);
  const memo = new Map<string, number>();
  const visit = (node: PowerCableNode, depth: number): number => {
    if (memo.has(node.id)) return memo.get(node.id)!;
    if (depth > 50) return 0; // ochrana proti cyklu v datech
    const kids = children.get(node.id) ?? [];
    const sum = kids.reduce((total, kid) => total + visit(kid, depth + 1), 0);
    const own =
      node.measuredCurrentA ??
      (kids.length && sum > 0
        ? sum * SIMULTANEITY
        : (node.nominalCurrentA ?? 0));
    const value = Math.round((own + (extra.get(node.id) ?? 0)) * 10) / 10;
    memo.set(node.id, value);
    return value;
  };
  for (const node of nodes) visit(node, 0);
  return memo;
}

export interface SimulationRow {
  id: string;
  tag: string;
  kind: "cable" | "source";
  label: string;
  beforeA: number;
  afterA: number;
  capacityA: number;
  beforePercent: number;
  afterPercent: number;
  breakerA: number | null;
  status: CableStatus;
  recommendedMm2: number | null;
  messages: string[];
}

/**
 * Simulátor „Co když sem připojím další stroj?“: přírůstek proudu na cílovém rozváděči se propíše jeho
 * přívodním kabelem a dál nahoru kaskádou (vyšší úrovně se soudobostí 0,8) až ke zdroji (transformátor).
 */
export function simulateAddedLoad(
  nodes: readonly PowerCableNode[],
  targetId: string,
  addedA: number,
): SimulationRow[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const before = designCurrents(nodes);
  const rows: SimulationRow[] = [];
  let node = byId.get(targetId);
  let delta = Math.max(0, addedA);
  const seen = new Set<string>();
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    const beforeA = before.get(node.id) ?? 0;
    const afterA = Math.round((beforeA + delta) * 10) / 10;
    if (node.cable) {
      const check = checkCable(node.cable, afterA);
      const { izA } = check;
      rows.push({
        id: node.id,
        tag: node.tag,
        kind: "cable",
        label: `${byId.get(node.parentId ?? "")?.tag ?? "?"} ➔ ${node.tag} · ${cableLabel(node.cable)}`,
        beforeA,
        afterA,
        capacityA: izA,
        beforePercent: izA ? Math.round((beforeA / izA) * 1000) / 10 : 0,
        afterPercent: check.loadPercent,
        breakerA: node.cable.upstreamBreakerA,
        status: check.status,
        recommendedMm2:
          check.status === "CRITICAL" ? check.recommendedMm2 : null,
        messages: check.messages,
      });
    } else if (node.ratedCurrentA) {
      const afterPercent =
        Math.round((afterA / node.ratedCurrentA) * 1000) / 10;
      rows.push({
        id: node.id,
        tag: node.tag,
        kind: "source",
        label: `${node.tag} · zdroj ${fmt(node.ratedCurrentA, 0)} A`,
        beforeA,
        afterA,
        capacityA: node.ratedCurrentA,
        beforePercent: Math.round((beforeA / node.ratedCurrentA) * 1000) / 10,
        afterPercent,
        breakerA: null,
        status:
          afterPercent > 100
            ? "CRITICAL"
            : afterPercent >= WARNING_LOAD
              ? "WARNING"
              : "OK",
        recommendedMm2: null,
        messages:
          afterPercent > 100
            ? [
                `🔴 Zdroj ${node.tag} přetížen na ${fmt(afterPercent)} % jmenovitého proudu.`,
              ]
            : [],
      });
    }
    // Další úroveň: odběr se rozpustí v soudobosti nadřazeného rozváděče (naměřený proud se nepřepočítává)
    delta = Math.round(delta * SIMULTANEITY * 10) / 10;
    node = node.parentId ? byId.get(node.parentId) : undefined;
  }
  return rows;
}

// ---------------------------------------------------------------------------
//  Převod řádku zařízení na uzel kaskády
// ---------------------------------------------------------------------------

/** Řádek zařízení s kabelovým pasportem (Prisma select). */
export type CableRow = {
  id: string;
  tag: string;
  type: string;
  fedFromEquipmentId: string | null;
  ratedCurrent: string | null;
  nominalCurrentA: number | null;
  measuredCurrentA: number | null;
  feederCableType: string | null;
  feederConductorMaterial: string;
  feederCrossSectionMm2: number | null;
  feederParallelRuns: number;
  feederLengthM: number | null;
  feederInstallMethod: string;
  feederGroupingCount: number;
  feederAmbientTempC: number;
  feederUpstreamBreakerA: number | null;
};

/** Přívodní kabel zařízení; bez průřezu = kabelový pasport není vyplněný (null). */
export function feederCableOf(row: CableRow): FeederCable | null {
  if (!row.feederCrossSectionMm2) return null;
  return {
    cableType: row.feederCableType,
    material: row.feederConductorMaterial === "AL" ? "AL" : "CU",
    crossSectionMm2: row.feederCrossSectionMm2,
    parallelRuns: row.feederParallelRuns,
    lengthM: row.feederLengthM,
    method: isCableInstallMethod(row.feederInstallMethod)
      ? row.feederInstallMethod
      : "E",
    groupingCount: row.feederGroupingCount,
    ambientTempC: row.feederAmbientTempC,
    upstreamBreakerA: row.feederUpstreamBreakerA,
  };
}

export const toCableNode = (row: CableRow): PowerCableNode => ({
  id: row.id,
  tag: row.tag,
  parentId: row.fedFromEquipmentId,
  type: row.type,
  nominalCurrentA: row.nominalCurrentA,
  measuredCurrentA: row.measuredCurrentA,
  // Zdroj kaskády (transformátor) – jmenovitý proud z údaje „1443 A“
  ratedCurrentA:
    row.type === "TRANSFORMER" ? parseAmps(row.ratedCurrent) : null,
  cable: feederCableOf(row),
});
