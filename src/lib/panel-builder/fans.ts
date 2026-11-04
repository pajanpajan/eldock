// Ventilátory skříně (fáze 47): potřebný průtok vzduchu podle výrobců (Rittal, Pfannenberg)
// V = f · Q / ΔT, kde Q je teplo, které neodvede povrch skříně, a f = 3,1 m³·K/(W·h) pro nadmořskou
// výšku do 100 m. Čisté funkce.

/** Součinitel f pro 0–100 m n. m. [m³·K/(W·h)]. */
export const AIR_FACTOR = 3.1;
/** Cílová vnitřní teplota pro dimenzování ventilátoru (přístroje do 35 °C bez deratingu). */
export const FAN_TARGET_C = 35;
/** Součinitel přestupu tepla povrchem lakované ocelové skříně [W/(m²·K)]. */
export const SURFACE_K = 5.5;
/** Bez údaje s filtrem se počítá 70 % volného průtoku (výstupní filtr ubere tlak). */
export const FILTER_DERATING = 0.7;

export interface FanSpec {
  id: string;
  manufacturer: string;
  typeCode: string;
  articleNumber: string;
  airflowFreeM3h: number;
  airflowFilterM3h: number | null;
  ratedVoltage: string;
  powerW: number | null;
  ipRating: string;
  cutoutMm: string | null;
  noiseDbA: number | null;
  datasheetUrl: string | null;
}

export interface AirflowNeed {
  /** Teplo odváděné ventilací [W] (ztráty − přestup povrchem). */
  heatW: number;
  /** ΔT = cílová vnitřní − okolí [K]; ≤ 0 = ventilátor nepomůže. */
  deltaK: number;
  /** Potřebný průtok [m³/h]; 0 = ventilátor není potřeba, null = nutná klimatizace. */
  requiredM3h: number | null;
}

/** Potřebný průtok vzduchu pro udržení vnitřní teploty na `target` °C. */
export function requiredAirflow(input: { lossW: number; ambientTempC: number; surfaceM2: number; targetC?: number }): AirflowNeed {
  const deltaK = (input.targetC ?? FAN_TARGET_C) - input.ambientTempC;
  if (deltaK <= 0) return { heatW: Math.max(0, input.lossW), deltaK, requiredM3h: input.lossW > 0 ? null : 0 };
  const heatW = Math.max(0, input.lossW - SURFACE_K * Math.max(0, input.surfaceM2) * deltaK);
  return { heatW: Math.round(heatW * 10) / 10, deltaK, requiredM3h: heatW > 0 ? Math.ceil((AIR_FACTOR * heatW) / deltaK) : 0 };
}

/** Účinný průtok ventilátoru s výstupním filtrem (× počet kusů). */
export const effectiveAirflow = (fan: Pick<FanSpec, "airflowFreeM3h" | "airflowFilterM3h">, count = 1) =>
  Math.round((fan.airflowFilterM3h ?? fan.airflowFreeM3h * FILTER_DERATING) * Math.max(1, count));

/** Nejmenší ventilátor, který potřebu pokryje jedním kusem (jinak nejsilnější). */
export function recommendFan<T extends Pick<FanSpec, "airflowFreeM3h" | "airflowFilterM3h">>(fans: readonly T[], requiredM3h: number | null): T | null {
  if (!requiredM3h || !fans.length) return null;
  const sorted = [...fans].sort((a, b) => effectiveAirflow(a) - effectiveAirflow(b));
  return sorted.find((fan) => effectiveAirflow(fan) >= requiredM3h) ?? sorted[sorted.length - 1];
}

/** Verdikt vybraného ventilátoru vůči potřebě. */
export function fanVerdict(fan: Pick<FanSpec, "airflowFreeM3h" | "airflowFilterM3h"> | null, count: number, need: AirflowNeed): { ok: boolean; text: string } {
  if (need.requiredM3h === null) return { ok: false, text: `Okolí ${FAN_TARGET_C - need.deltaK} °C je nad cílovou vnitřní teplotou ${FAN_TARGET_C} °C – ventilátor nestačí, navrhněte chladicí jednotku.` };
  if (need.requiredM3h === 0) return { ok: true, text: "Povrch skříně odvede ztráty sám – ventilátor není potřeba." };
  if (!fan) return { ok: false, text: `Potřebný průtok ${need.requiredM3h} m³/h – vyberte ventilátor s filtrem.` };
  const flow = effectiveAirflow(fan, count);
  return flow >= need.requiredM3h
    ? { ok: true, text: `Ventilátor ${count > 1 ? `${count}× ` : ""}${flow} m³/h pokryje potřebu ${need.requiredM3h} m³/h (rezerva ${Math.round(((flow - need.requiredM3h) / need.requiredM3h) * 100)} %).` }
    : { ok: false, text: `Ventilátor ${count > 1 ? `${count}× ` : ""}${flow} m³/h nestačí na potřebu ${need.requiredM3h} m³/h.` };
}
