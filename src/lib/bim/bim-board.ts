// Fáze 95: rozváděč z BIMu → okruhy výpočtu AI Panel Builderu. Každé zařízení napájené z rozváděče (stroj, VZT,
// podružný rozváděč) je vývod: jmenovitý proud jističe ≥ Ib (příkon / Ib z BIMu), charakteristika C (motory, rozběh),
// kabel z BIMu (jinak podle In), délka přívodu, úbytek napětí a kontrola impedance smyčky (TN-S 230 V, vybavení
// zkratovou spouští 10 × In do 0,4 s / 5 s). Hlavní vypínač podle In rozváděče. Čisté funkce.

import type { Circuit } from "@/engine/floorplan-bridge";

export interface BimBoardFeed {
  id: string;
  tag: string;
  name: string;
  type: string;
  circuit: string | null;
  zone: string | null;
  ratedPowerKw: number | null;
  nominalCurrentA: number | null;
  ratedCurrent: string | null;
  ratedVoltage: string | null;
  feederCableType: string | null;
  feederLengthM: number | null;
}

export interface BimBoardSource {
  tag: string;
  name: string;
  ratedCurrent: string | null;
  ratedPowerKw: number | null;
  feeds: readonly BimBoardFeed[];
}

/** Řada jmenovitých proudů jističů / vypínačů [A]. */
export const BOARD_RATINGS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600] as const;

/** Průřez Cu [mm²] podle jištění (uložení C / E, 3 zatížené vodiče) a zatížitelnost Iz [A]. */
const SECTIONS: readonly [maxA: number, mm2: number, izA: number][] = [
  [16, 2.5, 26],
  [20, 2.5, 26],
  [25, 4, 35],
  [32, 6, 45],
  [40, 10, 63],
  [50, 10, 63],
  [63, 16, 85],
  [80, 25, 112],
  [100, 35, 138],
  [125, 50, 168],
  [160, 70, 213],
  [200, 95, 258],
  [250, 120, 299],
  [315, 185, 392],
  [400, 240, 461],
];

const amps = (text: string | null | undefined) => {
  const match = /(\d+(?:[.,]\d+)?)\s*A\b/.exec(text ?? "");
  return match ? Number(match[1].replace(",", ".")) : null;
};

export const ratingFor = (ib: number) => BOARD_RATINGS.find((value) => value >= ib) ?? BOARD_RATINGS[BOARD_RATINGS.length - 1];

/** Průřez fázového vodiče z typu kabelu („CYKY-J 5×25“ → 25, „4× 1-AYKY 3×240+120“ → 240). */
export function sectionOf(cable: string | null | undefined): number | null {
  const match = /[x×]\s*(\d+(?:[.,]\d+)?)/i.exec(cable ?? "");
  return match ? Number(match[1].replace(",", ".")) : null;
}

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

export interface BimBoardPlan {
  circuits: Circuit[];
  mainSwitchA: number;
  warnings: string[];
}

/** Okruhy vývodů rozváděče z BIMu (pořadí = pořadí vývodů). */
export function bimBoardPlan(board: BimBoardSource): BimBoardPlan {
  const warnings: string[] = [];
  const circuits: Circuit[] = board.feeds.map((feed, index) => {
    const singlePhase = /\b230\s*V/.test(feed.ratedVoltage ?? "") && !/400/.test(feed.ratedVoltage ?? "");
    const phases: 1 | 3 = singlePhase ? 1 : 3;
    const powerW = (feed.ratedPowerKw ?? 0) * 1000;
    const ib = feed.nominalCurrentA ?? (powerW ? (phases === 3 ? powerW / (Math.sqrt(3) * 400 * 0.85) : powerW / (230 * 0.95)) : null) ?? amps(feed.ratedCurrent) ?? 16;
    // Podružný rozváděč: jištění přívodu podle jeho In
    const ratedA = feed.type === "SWITCHBOARD" ? ratingFor(amps(feed.ratedCurrent) ?? ib) : ratingFor(ib);
    const table = SECTIONS.find(([maxA]) => maxA >= ratedA) ?? SECTIONS[SECTIONS.length - 1];
    const own = sectionOf(feed.feederCableType);
    const mm2 = own ?? table[1];
    const iz = SECTIONS.find(([, section]) => section >= mm2)?.[2] ?? table[2];
    const lengthM = feed.feederLengthM ?? 20;
    // Úbytek napětí při Ib (cos φ 0,85, Cu γ = 56 m/(Ω·mm²))
    const resistance = lengthM / (56 * mm2);
    const dropPct = phases === 3 ? ((Math.sqrt(3) * ib * resistance * 0.85) / 400) * 100 : ((2 * ib * resistance * 0.95) / 230) * 100;
    // Impedance smyčky: přívod 0,15 Ω + fázový a ochranný vodič stejného průřezu; vybavení 10 × In
    const zs = 0.15 + 2 * resistance;
    const ia = 10 * ratedA;
    const zsMax = 230 / ia;
    if (ratedA > 125) warnings.push(`${feed.tag}: vývod ${ratedA} A je nad řadou modulárních jističů (125 A) – v návrhu orientační kus, doplňte výkonový jistič.`);
    if (zs > zsMax) warnings.push(`${feed.tag}: impedance smyčky ${round(zs, 3)} Ω > ${round(zsMax, 3)} Ω pro ${ratedA} A C – zvětšete průřez nebo použijte chránič.`);
    if (ratedA > iz) warnings.push(`${feed.tag}: jistič ${ratedA} A je nad zatížitelností kabelu ${mm2} mm² (Iz ≈ ${iz} A) – ověřte průřez.`);
    const label = `${feed.tag} – ${feed.name.replace(new RegExp(`^${feed.tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*-\\s*`), "")}${feed.circuit ? ` (${feed.circuit})` : ""}`.slice(0, 80);
    return {
      id: `bim-${index + 1}`,
      label,
      kind: feed.type === "SWITCHBOARD" ? "feeder" : "dedicated",
      phases,
      protection: { device: "MCB", poles: phases === 3 ? "3P" : "1P+N", curve: "C", ratedA },
      cable: feed.feederCableType ?? `CYKY-J ${phases === 3 ? 5 : 3}x${String(mm2).replace(".", ",")}`,
      crossSectionMm2: mm2,
      rooms: feed.zone ? [feed.zone] : [],
      nodeIds: [feed.id],
      outlets: 0,
      installedW: Math.round(powerW || ib * (phases === 3 ? Math.sqrt(3) * 400 * 0.85 : 230 * 0.95)),
      designW: Math.round(powerW || ib * (phases === 3 ? Math.sqrt(3) * 400 * 0.85 : 230 * 0.95)),
      lengthMm: Math.round(lengthM * 1000),
      voltageDropPct: round(dropPct),
      rcd: "none",
      ...(feed.type === "SWITCHBOARD" ? { feeds: feed.tag } : {}),
      izA: iz,
      loop: { zsOhm: round(zs, 3), zsMaxOhm: round(zsMax, 3), iaA: ia, ikMinA: Math.round((230 * 0.95) / zs), ok: zs <= zsMax },
    } satisfies Circuit;
  });
  const own = amps(board.ratedCurrent);
  const demand = circuits.reduce((sum, circuit) => sum + circuit.designW, 0) / (Math.sqrt(3) * 400 * 0.85);
  const mainSwitchA = ratingFor(own ?? Math.max(40, demand * 0.8));
  if (mainSwitchA > 125) warnings.push(`${board.tag}: hlavní vypínač ${mainSwitchA} A je nad řadou modulárních přístrojů – v návrhu orientační kus (výkonový odpínač / jistič).`);
  return { circuits, mainSwitchA, warnings };
}
