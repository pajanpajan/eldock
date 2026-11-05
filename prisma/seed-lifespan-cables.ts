// Ukázková data fáze 53 pro Závod Jablonec: kabelové pasporty páteřních a koncových tras
// (ČSN 33 2000-5-52 ed. 2) a sledované součástky s omezenou životností (B10d, motohodiny, Arrhenius).
// Přírůstkově – nic nemaže, kabel doplní jen zařízení bez pasportu a součástky jen tam, kde se zatím
// nic nesleduje (`npm run db:demo-lifespan`, entrypoint, plný seed).
import type { ComponentWearCategory } from "../src/generated/prisma/enums";
import type { PrismaClient } from "../src/generated/prisma/client";
import { hoursPerDay } from "../src/lib/component-lifespan";

const PLANT = "plant-jbc";
export const LIFESPAN_MARKER = "demo.lifespan-cables";
export const LIFESPAN_VERSION = 53;
const DAY_MS = 86_400_000;

interface CableSeed {
  shiftRegime?: number;
  internalTempC?: number;
  cableType: string;
  material?: "CU" | "AL";
  crossSectionMm2: number;
  parallelRuns?: number;
  lengthM: number;
  method: "B2" | "C" | "E" | "D";
  groupingCount?: number;
  ambientTempC?: number;
  upstreamBreakerA: number;
  nominalCurrentA?: number;
  measuredCurrentA?: number;
}

/**
 * Kabely: TR1 ➔ RM1 páteř 3× (3× 1-CXKH-R 1×240), R-LIS-01 s nízkou rezervou, R-CNC-04 s chybou
 * jištění (In 125 A > Iz po korekci 6 kabely ve žlabu a 35 °C), ostatní v pořádku.
 */
const CABLES: Record<string, CableSeed> = {
  RM1: {
    shiftRegime: 3,
    cableType: "1-CXKH-R",
    crossSectionMm2: 240,
    parallelRuns: 3,
    lengthM: 18,
    method: "E",
    upstreamBreakerA: 1600,
    measuredCurrentA: 980,
  },
  // Odchylka od zadání: 3×95+50 by podle tabulek dalo Iz ≈ 151 A < In 160 A (nejištěný) – pro ukázku „nízké rezervy“ 3×120+70
  "R-LIS-01": {
    shiftRegime: 3,
    cableType: "CYKY-J",
    crossSectionMm2: 120,
    lengthM: 65,
    method: "E",
    groupingCount: 7,
    ambientTempC: 38,
    upstreamBreakerA: 160,
    measuredCurrentA: 138,
  },
  "R-CNC-04": {
    shiftRegime: 2,
    internalTempC: 48,
    cableType: "CYKY-J",
    crossSectionMm2: 50,
    lengthM: 48,
    method: "E",
    groupingCount: 6,
    ambientTempC: 35,
    upstreamBreakerA: 125,
    nominalCurrentA: 82,
  },
  "R-ML-01": {
    shiftRegime: 2,
    cableType: "CYKY-J",
    crossSectionMm2: 95,
    lengthM: 55,
    method: "E",
    groupingCount: 7,
    ambientTempC: 35,
    upstreamBreakerA: 160,
    nominalCurrentA: 95,
  },
  "LIS-01": {
    shiftRegime: 3,
    cableType: "CYKY-J",
    crossSectionMm2: 70,
    lengthM: 12,
    method: "C",
    upstreamBreakerA: 125,
    nominalCurrentA: 110,
  },
  "CNC-04": {
    shiftRegime: 2,
    cableType: "CYKY-J",
    crossSectionMm2: 16,
    lengthM: 6,
    method: "C",
    upstreamBreakerA: 63,
    nominalCurrentA: 50,
  },
};

interface ComponentSeed {
  designation: string;
  name: string;
  manufacturer: string;
  modelNumber: string;
  wearCategory: ComponentWearCategory;
  cyclesPerHour?: number;
  maxElectricalCycles?: number;
  maxOperatingHours?: number;
  maxCalendarMonths?: number;
  replacementStockCount: number;
  notes?: string;
  /** Stáří kusu: odpracované hodiny (podle směnnosti), nebo měsíce od výměny. */
  age: { hours: number } | { months: number };
}

const COMPONENTS: Record<string, ComponentSeed[]> = {
  "R-LIS-01": [
    // 120 sepnutí/h, 3 směny: 940 000 z 1 000 000 cyklů = 94 % → naplánovat výměnu
    {
      designation: "-K1",
      name: "Stykač hlavního čerpadla hydrauliky",
      manufacturer: "ABB",
      modelNumber: "AF38-30-00-13",
      wearCategory: "SWITCHING_CONTACTOR",
      cyclesPerHour: 120,
      maxElectricalCycles: 1_000_000,
      replacementStockCount: 1,
      age: { hours: 940_000 / 120 },
    },
    // B10d 1 000 000 cyklů, doba mise T_M 20 let; 20 cyklů/h → 42 %
    {
      designation: "-K_SAF1",
      name: "Bezpečnostní modul lisu (Total Stop, ISO 13849-1 PL e)",
      manufacturer: "Pilz",
      modelNumber: "PNOZsigma s4",
      wearCategory: "SAFETY_ELEMENT",
      cyclesPerHour: 20,
      maxElectricalCycles: 1_000_000,
      maxCalendarMonths: 240,
      replacementStockCount: 1,
      age: { hours: 420_000 / 20 },
    },
  ],
  "R-CNC-04": [
    // 50 000 h při 40 °C → při 48 °C dle Arrhenia ≈ 28 700 h; 97 % vyčerpáno, 0 ks skladem
    {
      designation: "-T1",
      name: "Spínaný zdroj 24 V DC / 10 A",
      manufacturer: "Siemens",
      modelNumber: "SITOP PSU8200 6EP3334-8SB00-0AY0",
      wearCategory: "POWER_ELECTRONICS",
      maxOperatingHours: 50_000,
      replacementStockCount: 0,
      notes:
        "Zdroj převzatý z předchozího stroje – kondenzátory stárnou v přehřátém rozváděči.",
      age: { hours: 0.97 * 50_000 * Math.pow(2, -0.8) },
    },
    {
      designation: "-FAN1",
      name: "Filtrační vložka ventilátoru rozváděče",
      manufacturer: "Rittal",
      modelNumber: "SK 3238 + filtrační rohož 3238.200",
      wearCategory: "COOLING_FAN_FILTER",
      maxCalendarMonths: 6,
      replacementStockCount: 4,
      notes: "Zanesený filtr = příčina zvýšené teploty 48 °C v rozváděči.",
      age: { months: 8 },
    },
    // DC meziobvod měniče: 60 000 h při 40 °C → při 48 °C ≈ 34 500 h; 58 %
    {
      designation: "-U1",
      name: "Frekvenční měnič vřetene",
      manufacturer: "Siemens",
      modelNumber: "SINAMICS G120 PM240-2",
      wearCategory: "POWER_ELECTRONICS",
      maxOperatingHours: 60_000,
      replacementStockCount: 0,
      age: { hours: 0.58 * 60_000 * Math.pow(2, -0.8) },
    },
  ],
};

export async function seedLifespanCables(
  prisma: PrismaClient,
  options: { force?: boolean; now?: Date } = {},
) {
  const result = { skipped: false, cables: 0, components: 0 };
  const marker = await prisma.tenantSetting.findUnique({
    where: { key: LIFESPAN_MARKER },
    select: { value: true },
  });
  if (!options.force && Number(marker?.value ?? 0) >= LIFESPAN_VERSION)
    return { ...result, skipped: true };
  const now = options.now ?? new Date();
  const equipment = await prisma.equipment.findMany({
    where: {
      tag: {
        in: [...new Set([...Object.keys(CABLES), ...Object.keys(COMPONENTS)])],
      },
      floor: { building: { plantId: PLANT } },
    },
    select: {
      id: true,
      tag: true,
      feederCrossSectionMm2: true,
      shiftRegime: true,
      _count: { select: { monitoredComponents: true } },
    },
  });
  const byTag = new Map(equipment.map((row) => [row.tag, row]));

  for (const [tag, cable] of Object.entries(CABLES)) {
    const row = byTag.get(tag);
    if (!row || row.feederCrossSectionMm2 !== null) continue; // vlastní pasport se nepřepisuje
    await prisma.equipment.update({
      where: { id: row.id },
      data: {
        ...(cable.shiftRegime ? { shiftRegime: cable.shiftRegime } : {}),
        ...(cable.internalTempC !== undefined
          ? { internalTempC: cable.internalTempC }
          : {}),
        feederCableType: cable.cableType,
        feederConductorMaterial: cable.material ?? "CU",
        feederCrossSectionMm2: cable.crossSectionMm2,
        feederParallelRuns: cable.parallelRuns ?? 1,
        feederLengthM: cable.lengthM,
        feederInstallMethod: cable.method,
        feederGroupingCount: cable.groupingCount ?? 1,
        feederAmbientTempC: cable.ambientTempC ?? 30,
        feederUpstreamBreakerA: cable.upstreamBreakerA,
        nominalCurrentA: cable.nominalCurrentA ?? null,
        measuredCurrentA: cable.measuredCurrentA ?? null,
      },
    });
    result.cables++;
  }

  for (const [tag, components] of Object.entries(COMPONENTS)) {
    const row = byTag.get(tag);
    if (!row || row._count.monitoredComponents > 0) continue;
    const shiftRegime = CABLES[tag]?.shiftRegime ?? row.shiftRegime;
    for (const { age, ...component } of components) {
      const installedAt =
        "hours" in age
          ? new Date(
              now.getTime() - (age.hours / hoursPerDay(shiftRegime)) * DAY_MS,
            )
          : (() => {
              const date = new Date(now);
              date.setMonth(date.getMonth() - age.months);
              return date;
            })();
      await prisma.monitoredComponent.create({
        data: {
          equipmentId: row.id,
          ...component,
          installedAt,
          cyclesPerHour: component.cyclesPerHour ?? null,
          maxElectricalCycles: component.maxElectricalCycles ?? null,
          maxOperatingHours: component.maxOperatingHours ?? null,
          maxCalendarMonths: component.maxCalendarMonths ?? null,
          notes: component.notes ?? null,
        },
      });
      result.components++;
    }
  }
  await prisma.tenantSetting.upsert({
    where: { key: LIFESPAN_MARKER },
    create: { key: LIFESPAN_MARKER, value: String(LIFESPAN_VERSION) },
    update: { value: String(LIFESPAN_VERSION) },
  });
  return result;
}
