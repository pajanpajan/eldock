// Fáze 111: data průvodce uspořádáním skříně a lišt pro klienta (koncepce, lišty po polích a skutečné skříně
// z databáze s objednacím číslem výrobce, P_max a rezervou). Čisté funkce – server je sestaví, modal je jen vykreslí.

import { enclosureMpn } from "./enclosure-choice";
import type { EnclosureLike } from "./enclosures";
import { CONCEPT_INFO, reserveText, tierLabel, type ConceptOption, type EnclosureMatch, type LayoutConcept, type LayoutNeed, type PackDevice, type SizeTier } from "./rail-layout";

export interface LayoutDeviceDto {
  designation: string;
  label: string;
  modules: number;
  low: boolean;
}

export interface LayoutRailDto {
  field: 0 | 1;
  capacity: number;
  used: number;
  low: boolean;
  devices: LayoutDeviceDto[];
}

export interface EnclosureOptionDto {
  id: string;
  manufacturer: string;
  series: string;
  model: string;
  /** Objednací číslo výrobce; orientační skříň Eldocku (`STD-…`) = null. */
  mpn: string | null;
  rows: number;
  modulesPerRow: number;
  totalModules: number;
  fields: number;
  fieldWidth: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  ipRating: string;
  installation: string;
  pMaxW: number;
  pMaxEstimated: boolean;
  verified: boolean;
  sameManufacturer: boolean;
  reservePercent: number;
}

/** Fáze 114: velikost rozvodnice s rezervou v % a skutečnými modely z databáze. */
export interface SizeTierDto {
  key: string;
  /** „168 M (2 pole × 7 řad)“. */
  label: string;
  /** „🟢 Rezerva 34 % (57 volných M – Doporučeno pro budoucí rozšíření)“. */
  reserve: string;
  fields: number;
  rows: number;
  rowWidth: number;
  totalModules: number;
  freeModules: number;
  reservePercent: number;
  recommended: boolean;
  enclosures: EnclosureOptionDto[];
}

export interface LayoutBoardDto {
  rails: LayoutRailDto[];
  need: LayoutNeed;
  enclosures: EnclosureOptionDto[];
  /** Fáze 114: velikosti od nejmenší vyhovující po větší (rezerva v % a v modulech). */
  tiers: SizeTierDto[];
}

export function sizeTierDto<E extends EnclosureLike>(tier: SizeTier<E>): SizeTierDto {
  return {
    key: tier.key,
    label: tierLabel(tier),
    reserve: reserveText(tier),
    fields: tier.fields,
    rows: tier.rows,
    rowWidth: tier.rowWidth,
    totalModules: tier.totalModules,
    freeModules: tier.freeModules,
    reservePercent: tier.reservePercent,
    recommended: tier.recommended,
    enclosures: tier.matches.map(enclosureOptionDto),
  };
}

export interface LayoutOptionDto {
  concept: LayoutConcept;
  icon: string;
  title: string;
  short: string;
  description: string;
  examples: string;
  recommended: boolean;
  available: boolean;
  summary: string;
  warning: string | null;
  fields: 1 | 2;
  partitionAfterRail: number | null;
  fieldBLow: boolean;
  main: LayoutBoardDto;
  second: LayoutBoardDto | null;
}

export interface LayoutPreviewDto {
  options: LayoutOptionDto[];
  /** Obsazené moduly přístrojů a ztrátový výkon (W). */
  totalModules: number;
  totalPowerLossW: number;
  /** Rozváděč má slaboproud / Smart Home (moduly, zdroje). */
  smart: boolean;
}

export function enclosureOptionDto<E extends EnclosureLike>(match: EnclosureMatch<E>): EnclosureOptionDto {
  const { enclosure } = match;
  return {
    id: enclosure.id,
    manufacturer: enclosure.manufacturer,
    series: enclosure.series,
    model: enclosure.model,
    mpn: enclosureMpn(enclosure),
    rows: enclosure.rows,
    modulesPerRow: enclosure.modulesPerRow,
    totalModules: enclosure.totalModules,
    fields: match.fields.fields,
    fieldWidth: match.fields.fieldWidth,
    widthMm: enclosure.widthMm,
    heightMm: enclosure.heightMm,
    depthMm: enclosure.depthMm,
    ipRating: enclosure.ipRating,
    installation: enclosure.installation,
    pMaxW: Math.round(match.pMax.w),
    pMaxEstimated: match.pMax.estimated,
    verified: match.verified,
    sameManufacturer: match.sameManufacturer,
    reservePercent: match.reservePercent,
  };
}

type Describable = PackDevice & { designation?: string; label?: string; circuitLabel?: string; powerLossW?: number };

const railDto = <T extends Describable>(rail: { field: 0 | 1; capacity: number; used: number; low: boolean; devices: T[] }): LayoutRailDto => ({
  field: rail.field,
  capacity: rail.capacity,
  used: rail.used,
  low: rail.low,
  devices: rail.devices.map((device) => ({ designation: device.designation ?? "", label: (device.label ?? device.circuitLabel ?? "").slice(0, 60), modules: device.modules, low: rail.low })),
});

/** Koncepce → data modalu (lišty, požadavek na skříň a skříně z databáze). */
export function layoutPreviewDto<T extends Describable, E extends EnclosureLike>(options: readonly ConceptOption<T, E>[], totals: { totalModules: number; totalPowerLossW: number; smart: boolean }): LayoutPreviewDto {
  return {
    ...totals,
    options: options.map((option) => {
      const info = CONCEPT_INFO[option.concept];
      return {
        concept: option.concept,
        icon: info.icon,
        title: info.title,
        short: info.short,
        description: info.description,
        examples: info.examples,
        recommended: option.recommended,
        available: option.available,
        summary: option.summary,
        warning: option.warning,
        fields: option.plan.layout.fields,
        partitionAfterRail: option.plan.layout.partitionAfterRail,
        fieldBLow: option.plan.layout.fieldBLow,
        main: { rails: option.main.rails.map(railDto), need: option.main.need, enclosures: option.main.matches.map(enclosureOptionDto), tiers: (option.main.tiers ?? []).map(sizeTierDto) },
        second: option.second ? { rails: option.second.rails.map(railDto), need: option.second.need, enclosures: option.second.matches.map(enclosureOptionDto), tiers: (option.second.tiers ?? []).map(sizeTierDto) } : null,
      };
    }),
  };
}

/** Volba z průvodce (koncepce a skříně) – vstup generování z půdorysu i přeuspořádání projektu. */
export interface LayoutChoice {
  concept: LayoutConcept;
  enclosureId?: string | null;
  secondEnclosureId?: string | null;
  /** Fáze 114: rozváděč s tolika DIN lištami, kolik má zvolená skříň řad (rezerva pro rozšíření). */
  fillRows?: boolean;
}
