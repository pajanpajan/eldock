// Výpočet oteplení rozváděče podle ČSN EN 61439 (ověření výpočtem dle IEC TR 60890) a fázová
// bilance. Deterministický a čistý – stejný výsledek v prohlížeči (živý přepočet) i v PDF.
//
// Postup (IEC TR 60890, skříň bez větracích otvorů):
//  1. Proudy: koncový vývod nese výpočtový proud Ib, jinak In snížené na vnitřní teplotu
//     (In · (1 − (T − 30 °C) / 80)); nadřazené prvky nesou součet potomků po fázích, N fázorově.
//  2. Ztráty: Pv = Pn · (Imax / In)², u chráničů Pn na pól · Σ (Ipól / In)²; redukce soudobostí
//     Pv · SF². SPD a přístroje bez proudu jen konstantní ztráta Pconst. P = přístroje + vodiče.
//  3. Účinná chladicí plocha Ae = Σ A0 · b (b: strop 1,4 / zakrytý 0,7, volné stěny 0,9,
//     zakryté 0,5, podlaha 0). Δt0,5 = k · d · P^x (x = 0,804, d = 1), Δt1,0 = c · Δt0,5.
//  4. Vnitřní teplota = okolí + Δt0,5 (výška přístrojů), pod stropem okolí + Δt1,0.
// Konstanty k a c jsou aproximace křivek IEC TR 60890 kalibrované na referenční výpočet
// (public/demo-docs/domovni-rozvadec-rh1.pdf: 30 + 12,4 = 42,4 °C, P = 17,75 W).

import type { ComponentCategory, EnclosureType } from "@/generated/prisma/enums";

export const DERATING_REFERENCE_C = 30;
export const DEFAULT_LIMIT_C = 70;
/** Obvyklá maximální okolní teplota modulových přístrojů (jističe, chrániče). */
export const DEVICE_AMBIENT_MAX_C = 55;
const EXPONENT = 0.804; // x – skříň bez větracích otvorů
const K_AE = 0.4498; // k · Ae (kalibrace na referenční rozváděč)
const PHASES = ["L1", "L2", "L3"] as const;
type Phase = (typeof PHASES)[number];

export interface ThermalEnclosure {
  heightMm: number;
  widthMm: number;
  depthMm: number;
  installation: EnclosureType;
  ambientTempC: number;
  simultaneityFactor: number;
  internalWiringLossW: number;
  limitTempC?: number;
}

export interface ThermalDevice {
  id: string;
  designation: string;
  typeCode: string;
  description: string;
  category: ComponentCategory | null;
  poles: string | null;
  ratedCurrentA: number;
  ratedLossW: number;
  operatingCurrentA: number | null;
  parentItemId: string | null;
  phaseAssignment: string | null;
}

export interface ThermalRow {
  id: string;
  designation: string;
  typeCode: string;
  description: string;
  ratedCurrentA: number;
  ratedLossW: number;
  /** Výpočtový proud obvodu (vývod: Ib nebo snížené In; nadřazený prvek: Imax · SF). */
  operatingCurrentA: number;
  L1: number;
  L2: number;
  L3: number;
  N: number;
  imax: number;
  lossW: number;
  reducedLossW: number;
  constantLossW: number;
  imaxSf: number;
  leaf: boolean;
}

export interface Surface {
  name: string;
  areaM2: number;
  factor: number;
}

export interface ThermalResult {
  rows: ThermalRow[];
  incoming: { L1: number; L2: number; L3: number; N: number; imax: number };
  /** Provozní proud rozváděče = nejzatíženější fáze · SF. */
  operatingCurrentA: number;
  phaseLoads: { L1: number; L2: number; L3: number; N: number };
  phaseImbalancePct: number;
  deviceLossW: number;
  wiringLossW: number;
  totalLossW: number;
  surfaces: Surface[];
  effectiveAreaM2: number;
  k: number;
  c: number;
  deltaT05: number;
  deltaT10: number;
  internalTempC: number;
  topTempC: number;
  derating: number;
  limitTempC: number;
  ok: boolean;
  verdict: string;
  warnings: string[];
  /** Teplota podle výšky skříně (0 = podlaha, 1 = strop). */
  curve: { height: number; tempC: number }[];
  iterations: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const cz = (value: number, digits = 1) => value.toLocaleString("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Snížení proudové zatížitelnosti přístroje s teplotou (pod 30 °C bez zvýšení). */
export const deratingFactor = (tempC: number) => Math.min(1, Math.max(0.3, 1 - (tempC - DERATING_REFERENCE_C) / 80));

/** Plochy skříně a součinitele b podle způsobu instalace (IEC TR 60890, tab. III). */
export function coolingSurfaces(enclosure: Pick<ThermalEnclosure, "heightMm" | "widthMm" | "depthMm" | "installation">): Surface[] {
  const h = enclosure.heightMm / 1000;
  const w = enclosure.widthMm / 1000;
  const d = enclosure.depthMm / 1000;
  const factors: Record<EnclosureType, { top: number; front: number; back: number; sides: number }> = {
    WALL_MOUNTED: { top: 1.4, front: 0.9, back: 0.5, sides: 0.9 },
    FLUSH_MOUNTED: { top: 0.7, front: 0.9, back: 0.5, sides: 0.5 },
    FREE_STANDING: { top: 1.4, front: 0.9, back: 0.9, sides: 0.9 },
  };
  const b = factors[enclosure.installation];
  return [
    { name: "Strop", areaM2: w * d, factor: b.top },
    { name: "Čelo", areaM2: h * w, factor: b.front },
    { name: "Záda", areaM2: h * w, factor: b.back },
    { name: "Boky", areaM2: 2 * h * d, factor: b.sides },
  ];
}

/** Konstanta skříně k (aproximace obr. 3 a 4 IEC TR 60890, bez větracích otvorů). */
export const enclosureConstant = (effectiveAreaM2: number) => K_AE / Math.max(effectiveAreaM2, 0.05);

/** Teplotní rozložení c = Δt1,0 / Δt0,5 z poměru f = h^1,35 / Ab (aproximace obr. 5). */
export function temperatureDistribution(enclosure: Pick<ThermalEnclosure, "heightMm" | "widthMm" | "depthMm">): number {
  const h = enclosure.heightMm / 1000;
  const base = (enclosure.widthMm / 1000) * (enclosure.depthMm / 1000);
  const f = h ** 1.35 / Math.max(base, 0.005);
  return Math.min(1.6, Math.max(1.05, 1 + 0.12 * Math.log(1 + f)));
}

const phasesOf = (device: ThermalDevice): Phase[] => {
  const listed = (device.phaseAssignment ?? "").split(",").filter((phase): phase is Phase => (PHASES as readonly string[]).includes(phase));
  if (listed.length) return listed;
  return device.poles && /^(3P|3P\+N|4P)$/.test(device.poles) ? [...PHASES] : [];
};
const hasNeutral = (device: ThermalDevice) => /N|4P|2P/.test(device.poles ?? "") || phasesOf(device).length === 1;
const neutralCurrent = (l1: number, l2: number, l3: number) => Math.sqrt(Math.max(0, l1 * l1 + l2 * l2 + l3 * l3 - l1 * l2 - l2 * l3 - l3 * l1));

/** Jeden průchod výpočtem při dané vnitřní teplotě (pro derating). */
function evaluate(devices: readonly ThermalDevice[], enclosure: ThermalEnclosure, tempC: number) {
  const sf = enclosure.simultaneityFactor;
  const derating = deratingFactor(tempC);
  const children = new Map<string | null, ThermalDevice[]>();
  for (const device of devices) {
    const parent = device.parentItemId && devices.some((other) => other.id === device.parentItemId) ? device.parentItemId : null;
    children.set(parent, [...(children.get(parent) ?? []), device]);
  }
  const currents = new Map<string, Record<Phase | "N", number>>();
  const visiting = new Set<string>();

  const currentOf = (device: ThermalDevice): Record<Phase | "N", number> => {
    const cached = currents.get(device.id);
    if (cached) return cached;
    const zero = { L1: 0, L2: 0, L3: 0, N: 0 };
    if (visiting.has(device.id)) return zero; // cyklus – hlídač stromu ho hlásí
    visiting.add(device.id);
    const kids = children.get(device.id) ?? [];
    let result = zero;
    if (kids.length) {
      const sum = { L1: 0, L2: 0, L3: 0 };
      for (const kid of kids) {
        const sub = currentOf(kid);
        for (const phase of PHASES) sum[phase] += sub[phase];
      }
      result = { ...sum, N: neutralCurrent(sum.L1, sum.L2, sum.L3) };
    } else if (device.category !== "SPD" && device.category !== "ENCLOSURE" && device.ratedCurrentA > 0) {
      const current = device.operatingCurrentA ?? device.ratedCurrentA * derating;
      const phases = phasesOf(device);
      result = { L1: 0, L2: 0, L3: 0, N: 0 };
      for (const phase of phases) result[phase] = current;
      if (phases.length === 1 && hasNeutral(device)) result.N = current;
    }
    currents.set(device.id, result);
    return result;
  };

  const rows: ThermalRow[] = devices.map((device) => {
    const leaf = !(children.get(device.id) ?? []).length;
    const current = currentOf(device);
    const imax = Math.max(current.L1, current.L2, current.L3);
    const constant = device.category === "SPD" || (imax === 0 && device.category !== "ENCLOSURE") ? device.ratedLossW : 0;
    let loss = 0;
    if (!constant && device.ratedCurrentA > 0) {
      const ratio = (value: number) => (value / device.ratedCurrentA) ** 2;
      loss =
        device.category === "RCD" || device.category === "RCBO"
          ? device.ratedLossW * (phasesOf(device).reduce((sum, phase) => sum + ratio(current[phase]), 0) + (hasNeutral(device) ? ratio(current.N) : 0))
          : device.ratedLossW * ratio(imax);
    }
    return {
      id: device.id,
      designation: device.designation,
      typeCode: device.typeCode,
      description: device.description,
      ratedCurrentA: device.ratedCurrentA,
      ratedLossW: device.ratedLossW,
      operatingCurrentA: leaf ? imax : imax * sf,
      ...current,
      imax,
      lossW: loss,
      reducedLossW: loss * sf * sf,
      constantLossW: constant,
      imaxSf: imax * sf,
      leaf,
    };
  });

  const roots = children.get(null) ?? [];
  const incoming = { L1: 0, L2: 0, L3: 0 };
  for (const root of roots) {
    const current = currentOf(root);
    for (const phase of PHASES) incoming[phase] += current[phase];
  }
  const deviceLossW = rows.reduce((sum, row) => sum + row.reducedLossW + row.constantLossW, 0);
  return { rows, incoming: { ...incoming, N: neutralCurrent(incoming.L1, incoming.L2, incoming.L3) }, deviceLossW, derating };
}

/**
 * Výpočet oteplení: iterace teploty (ztráty závisí na proudech, ty na deratingu při vnitřní
 * teplotě) do ustálení na 0,01 K.
 */
export function calculateThermal(devices: readonly ThermalDevice[], enclosure: ThermalEnclosure): ThermalResult {
  const limit = enclosure.limitTempC ?? DEFAULT_LIMIT_C;
  const surfaces = coolingSurfaces(enclosure);
  const effectiveAreaM2 = surfaces.reduce((sum, surface) => sum + surface.areaM2 * surface.factor, 0);
  const k = enclosureConstant(effectiveAreaM2);
  const c = temperatureDistribution(enclosure);

  let tempC = enclosure.ambientTempC;
  let state = evaluate(devices, enclosure, tempC);
  let deltaT05 = 0;
  let iterations = 0;
  for (; iterations < 50; iterations++) {
    const total = state.deviceLossW + enclosure.internalWiringLossW;
    deltaT05 = total > 0 ? k * total ** EXPONENT : 0;
    const next = enclosure.ambientTempC + deltaT05;
    if (Math.abs(next - tempC) < 0.01) {
      tempC = next;
      break;
    }
    tempC = next;
    state = evaluate(devices, enclosure, tempC);
  }

  const sf = enclosure.simultaneityFactor;
  const totalLossW = state.deviceLossW + enclosure.internalWiringLossW;
  const deltaT10 = c * deltaT05;
  const internalTempC = enclosure.ambientTempC + deltaT05;
  const topTempC = enclosure.ambientTempC + deltaT10;
  const phaseLoads = { L1: state.incoming.L1 * sf, L2: state.incoming.L2 * sf, L3: state.incoming.L3 * sf, N: state.incoming.N * sf };
  const loads = [phaseLoads.L1, phaseLoads.L2, phaseLoads.L3];
  const average = loads.reduce((sum, value) => sum + value, 0) / 3;
  const phaseImbalancePct = average > 0 ? ((Math.max(...loads) - Math.min(...loads)) / average) * 100 : 0;
  const operatingCurrentA = Math.max(...loads);

  const ok = topTempC <= limit;
  const verdict = ok
    ? `VYHOVUJE dle ČSN EN 61439 – Vypočítaná teplota ${cz(internalTempC)} °C (pod stropem ${cz(topTempC)} °C) je pod limitem ${cz(limit, 0)} °C`
    : `NEVYHOVUJE dle ČSN EN 61439 – Teplota pod stropem ${cz(topTempC)} °C překračuje limit ${cz(limit, 0)} °C`;
  const warnings: string[] = [];
  if (ok && topTempC > DEVICE_AMBIENT_MAX_C) warnings.push(`Pod stropem skříně je ${cz(topTempC)} °C – modulové přístroje jsou obvykle dimenzovány na okolí do ${DEVICE_AMBIENT_MAX_C} °C, ověřte odlehčení u výrobce.`);
  if (phaseImbalancePct > 20) warnings.push(`Nesymetrie fází ${cz(phaseImbalancePct, 0)} % – zvažte přeskupení jednofázových vývodů.`);
  const incomplete = devices.filter((device) => device.category !== "ENCLOSURE" && !device.ratedCurrentA);
  if (incomplete.length) warnings.push(`Bez katalogových dat (In, Pn): ${incomplete.map((device) => device.designation).join(", ")} – výpočet je neúplný.`);

  const atZero = Math.max(0, 2 * deltaT05 - deltaT10);
  const curve = [0, 0.25, 0.5, 0.75, 1].map((height) => ({
    height,
    tempC: round2(enclosure.ambientTempC + (height <= 0.5 ? atZero + (deltaT05 - atZero) * (height / 0.5) : deltaT05 + (deltaT10 - deltaT05) * ((height - 0.5) / 0.5))),
  }));

  return {
    rows: state.rows,
    incoming: { ...state.incoming, imax: Math.max(state.incoming.L1, state.incoming.L2, state.incoming.L3) },
    operatingCurrentA,
    phaseLoads,
    phaseImbalancePct,
    deviceLossW: state.deviceLossW,
    wiringLossW: enclosure.internalWiringLossW,
    totalLossW,
    surfaces,
    effectiveAreaM2,
    k,
    c,
    deltaT05,
    deltaT10,
    internalTempC,
    topTempC,
    derating: state.derating,
    limitTempC: limit,
    ok,
    verdict,
    warnings,
    curve,
    iterations,
  };
}
