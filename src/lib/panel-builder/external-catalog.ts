// Most na externí databázi prvků „ai-panel-builder“ (fáze 43): záznamy `catalog_upsert_product`
// (JSON v SQL seedech nebo v exportu `prisma/external-catalog/catalog.json`) → CatalogComponent
// a PanelEnclosure Eldocku, 2D vektorové archetypy a vazby příslušenství. Čisté funkce.

import type { ComponentCategory } from "@/generated/prisma/enums";

import { buildSearchText, estimatePowerLoss, iecSymbolFor } from "./catalog";

/** Záznam produktu z externí databáze (podmnožina polí, kterou Eldock používá). */
export interface ExternalProduct {
  manufacturer: string;
  series?: string | null;
  category: string;
  mpn: string;
  type_designation?: string | null;
  ean?: string | null;
  name_cs: string;
  current_kind?: string | null;
  poles?: string | null;
  in_a?: number | null;
  ue_ac_v?: number | null;
  ue_dc_v?: number | null;
  icn_ka?: number | null;
  icu_ac_ka?: number | null;
  icu_dc_ka?: number | null;
  trip_characteristic?: string | null;
  idn_ma?: number | null;
  rcd_type?: string | null;
  rcd_time_class?: string | null;
  p_loss_w?: number | null;
  width_modules?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  depth_mm?: number | null;
  mounting?: string[] | null;
  features?: Record<string, unknown> | null;
  coil?: { uc_v: number; uc_kind: string } | null;
  enclosure?: { rows: number; modules_per_row: number; installation: string; ip_code: string; p_max_w?: number | null } | null;
  relations?: { kind?: string; manufacturer?: string; mpn?: string; qty?: number; note?: string }[] | null;
}

export const EXTERNAL_SOURCE = "ai-panel-builder";

/** Kódy výrobců externí databáze → názvy v Eldocku (karty kaskádového menu). */
const MANUFACTURERS: Record<string, string> = {
  ABB: "ABB",
  EATON: "Eaton",
  OEZ: "OEZ",
  SCHNEIDER: "Schneider",
  HAGER: "Hager",
  NOARK: "Noark",
  BONEGA: "Bonega",
  SCHRACK: "Schrack",
  SIEMENS: "Siemens",
  ETI: "ETI",
  SEZ: "SEZ",
  SALTEK: "Saltek",
  HAKEL: "Hakel",
  DEHN: "Dehn",
  ELKOEP: "Elko EP",
  FINDER: "Finder",
  RELPOL: "Relpol",
  LOXONE: "Loxone",
  SHELLY: "Shelly",
  EASTRON: "Eastron",
  WAGO: "Wago",
  PHOENIX: "Phoenix Contact",
  PHOENIX_CONTACT: "Phoenix Contact",
  WEIDMULLER: "Weidmüller",
  POLLMANN: "Pollmann",
  MEANWELL: "Mean Well",
  PILZ: "Pilz",
  OMRON: "Omron",
  HENSEL: "Hensel",
  RITTAL: "Rittal",
  LOVATO: "Lovato",
  CHINT: "Chint",
};

export const externalManufacturer = (code: string) => MANUFACTURERS[code.toUpperCase()] ?? code.charAt(0) + code.slice(1).toLowerCase();

/** Kategorie externí databáze → kategorie a podtyp Eldocku (null = mimo DIN modulový sortiment). */
const CATEGORY_MAP: Record<string, { category: ComponentCategory; subtype?: string }> = {
  MCB: { category: "MCB" },
  RCBO: { category: "RCBO" },
  RCD: { category: "RCD" },
  RCCB: { category: "RCD" },
  SPD: { category: "SPD" },
  CONTACTOR: { category: "CONTACTOR" },
  RELAY: { category: "RELAY" },
  SWITCH_DISCONNECTOR: { category: "MAIN_SWITCH" },
  PSU: { category: "PSU", subtype: "PSU_DC" },
  BELL_TRANSFORMER: { category: "PSU", subtype: "BELL_TRANSFORMER" },
  METER: { category: "OTHER", subtype: "METER" },
  AUTOMATION: { category: "PLC", subtype: "PLC" },
  FUSE_DISCONNECTOR: { category: "OTHER", subtype: "FUSE_DISCONNECTOR" },
  TERMINAL: { category: "TERMINAL", subtype: "TERMINAL_BLOCK" },
  BUSBAR: { category: "OTHER", subtype: "BUSBAR" },
  BUSBAR_END_CAP: { category: "OTHER", subtype: "BUSBAR_END_CAP" },
  AUX_CONTACT: { category: "OTHER", subtype: "AUX_CONTACT" },
  SHUNT_TRIP: { category: "OTHER", subtype: "SHUNT_TRIP" },
  UNDERVOLTAGE_TRIP: { category: "OTHER", subtype: "UNDERVOLTAGE_TRIP" },
  FUSE_LINK: { category: "OTHER", subtype: "FUSE_LINK" },
  DIN_SOCKET: { category: "OTHER", subtype: "DIN_SOCKET" },
  INDICATOR_LIGHT: { category: "OTHER", subtype: "INDICATOR" },
  BLANK_COVER: { category: "OTHER", subtype: "BLANK_COVER" },
};

/** Slug kategorie pro archetyp (shodně s `category_slug()` externí databáze). */
const CATEGORY_SLUG: Record<string, string> = {
  MCB: "mcb",
  RCCB: "rcd",
  RCD: "rcd",
  RCBO: "rcbo",
  SPD: "spd",
  RELAY: "relay",
  CONTACTOR: "contactor",
  MCCB: "mccb",
  FUSE_DISCONNECTOR: "disconnector",
  SWITCH_DISCONNECTOR: "disconnector",
  FUSE_LINK: "fuse_link",
  DIN_SOCKET: "din_socket",
  BLANK_COVER: "blank_cover",
  INDICATOR_LIGHT: "indicator",
  BELL_TRANSFORMER: "bell_transformer",
  AUX_CONTACT: "accessory",
  BUSBAR_END_CAP: "accessory",
  SHUNT_TRIP: "accessory",
  UNDERVOLTAGE_TRIP: "accessory",
  PSU: "power_supply",
  TERMINAL: "terminal",
  METER: "meter",
  AUTOMATION: "automation",
  DISTRIBUTION_BOARD: "enclosure",
  CABINET: "enclosure",
  BUSBAR: "busbar",
};

const trimNumber = (value: number) => String(Math.round(value * 100) / 100);

/** „din_mcb_1M_1P“, „din_rcd_4M_4P“, „din_relay_1M“ – 2D vektorový archetyp jako v externí databázi. */
export function dinArchetypeId(category: string, widthModules: number | null | undefined, poles: string | null | undefined): string {
  const slug = CATEGORY_SLUG[category] ?? category.toLowerCase();
  if (widthModules === null || widthModules === undefined) return `din_${slug}`;
  const division = poles ? `${trimNumber(widthModules)}M_${poles.replace("P+N", "PN").replace("+", "")}` : `${trimNumber(widthModules)}M`;
  return `din_${slug}_${division}`;
}

const RELAY_KINDS: Record<string, string> = { timer: "TIMER", impulse: "IMPULSE", monitoring: "MONITORING", staircase: "STAIRCASE", auxiliary: "AUXILIARY", installation: "AUXILIARY", level: "LEVEL", thermostat: "THERMOSTAT" };
const SPD_TYPES = new Set(["T1", "T1+T2", "T2", "T2+T3", "T3"]);

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

function contactConfig(features: Record<string, unknown>): string | null {
  const no = num(features.contacts_no) ?? 0;
  const nc = num(features.contacts_nc) ?? 0;
  const co = num(features.contacts_co) ?? 0;
  const parts = [no ? `${no}NO` : "", nc ? `${nc}NC` : "", co ? `${co}CO` : ""].filter(Boolean);
  return parts.length ? parts.join("+") : null;
}

/** Šířka v modulech: z katalogu, jinak z mm (17,5 mm = 1M), jinak 1. */
export function externalModules(product: Pick<ExternalProduct, "width_modules" | "width_mm" | "mounting">): number {
  const din = !product.mounting?.length || product.mounting.includes("din_th35");
  if (product.width_modules && product.width_modules > 0 && product.width_modules <= 24 && din) return Math.round(product.width_modules * 2) / 2;
  if (product.width_mm && product.width_mm > 0 && product.width_mm <= 420 && din) return Math.max(0.5, Math.round((product.width_mm / 17.5) * 2) / 2);
  return product.width_modules && product.width_modules <= 24 ? Math.max(0.5, Math.round(product.width_modules * 2) / 2) : 1;
}

export interface MappedComponent {
  manufacturer: string;
  series: string;
  typeCode: string;
  articleNumber: string;
  ean: string | null;
  category: ComponentCategory;
  poles: string;
  ratedCurrentA: number;
  trippingCurve: string | null;
  breakingCapacityKa: number | null;
  rcdSensitivityMa: number | null;
  rcdType: string | null;
  spdType: string | null;
  surgeCurrentKa: number | null;
  contactConfig: string | null;
  coilVoltage: string | null;
  relaySubtype: string | null;
  moduleSubtype: string | null;
  modulesCount: number;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  powerLossWatts: number;
  iecSymbol: string;
  description: string;
  dataSource: "SEED_CATALOG" | "IEC_ESTIMATE";
  searchText: string;
  archetypeId: string;
  facetsJson: string;
  externalSource: string;
}

export interface MappedEnclosure {
  manufacturer: string;
  series: string;
  model: string;
  articleNumber: string;
  rows: number;
  modulesPerRow: number;
  totalModules: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  ipRating: string;
  installation: string;
  material: string;
  pMaxW: number | null;
  dataSource: "EXTERNAL";
  description: string;
}

export type MappedProduct = { kind: "component"; key: string; data: MappedComponent } | { kind: "enclosure"; key: string; data: MappedEnclosure } | { kind: "skip"; key: string; reason: string };

/** Klíč vazeb: výrobce + MPN (jako `component_relations` externí databáze). */
export const productKey = (manufacturer: string, mpn: string) => `${manufacturer.toUpperCase()}|${mpn}`;

/** Objednací číslo v Eldocku – MPN, u čistě číselných / obecných MPN s prefixem výrobce (unikátnost napříč značkami). */
export function externalArticleNumber(manufacturerCode: string, mpn: string): string {
  const clean = mpn.trim();
  if (clean.toUpperCase().startsWith(`${manufacturerCode.toUpperCase()}:`)) return clean;
  return /^\d{3,9}$/.test(clean) || clean.length < 5 ? `${manufacturerCode.toUpperCase()}:${clean}` : clean;
}

const ENCLOSURE_INSTALL: Record<string, string> = { flush: "FLUSH", surface: "SURFACE", hollow_wall: "HOLLOW_WALL", floor: "FLOOR", wall: "SURFACE" };

/** Jeden externí záznam → kus katalogu, skříň, nebo přeskočit (s důvodem). */
export function mapExternalProduct(product: ExternalProduct): MappedProduct {
  const key = productKey(product.manufacturer, product.mpn);
  const manufacturer = externalManufacturer(product.manufacturer);
  const features = product.features ?? {};
  const typeCode = (text(product.type_designation) ?? product.mpn).slice(0, 120);
  const articleNumber = externalArticleNumber(product.manufacturer, product.mpn);

  if (product.category === "DISTRIBUTION_BOARD" || product.category === "CABINET") {
    const spec = product.enclosure;
    if (!spec || !product.width_mm || !product.height_mm) return { kind: "skip", key, reason: "skříň bez rozložení řad / rozměrů" };
    const material = text(features.enclosure_material) ?? "";
    return {
      kind: "enclosure",
      key,
      data: {
        manufacturer,
        series: text(product.series) ?? manufacturer,
        model: typeCode,
        articleNumber,
        rows: spec.rows,
        modulesPerRow: spec.modules_per_row,
        totalModules: spec.rows * spec.modules_per_row,
        widthMm: Math.round(product.width_mm),
        heightMm: Math.round(product.height_mm),
        depthMm: Math.round(product.depth_mm ?? 100),
        ipRating: spec.ip_code,
        installation: ENCLOSURE_INSTALL[spec.installation] ?? "SURFACE",
        material: /steel|ocel|metal|kov/i.test(material) ? "PAINTED_STEEL" : "PLASTIC",
        pMaxW: num(spec.p_max_w),
        dataSource: "EXTERNAL",
        description: product.name_cs,
      },
    };
  }

  const mapped = CATEGORY_MAP[product.category];
  if (!mapped) return { kind: "skip", key, reason: `kategorie ${product.category} není modulový přístroj na DIN lištu` };

  const poles = text(product.poles) ?? (mapped.category === "SPD" ? "1P" : "1P");
  const modules = externalModules(product);
  const ratedCurrentA = num(product.in_a) ?? 0;
  const spdType = mapped.category === "SPD" ? (text(features.spd_type) && SPD_TYPES.has(String(features.spd_type)) ? String(features.spd_type) : "T2") : null;
  const coilVoltage = product.coil ? `${trimNumber(product.coil.uc_v)}V ${product.coil.uc_kind}` : null;
  const lossKnown = num(product.p_loss_w);
  const powerLossWatts = lossKnown ?? estimatePowerLoss(mapped.category, poles, ratedCurrentA);
  // Chránič: typ AC / A / F / B, selektivní (S) a krátkodobě zpožděný (G) jako v konfigurátoru
  const rcdType = product.rcd_time_class === "S" ? "S" : product.rcd_time_class === "G" ? "G" : text(product.rcd_type);
  const data: MappedComponent = {
    manufacturer,
    series: (text(product.series) ?? manufacturer).slice(0, 120),
    typeCode,
    articleNumber,
    ean: text(product.ean),
    category: mapped.category,
    poles,
    ratedCurrentA,
    trippingCurve: ["B", "C", "D", "K", "Z"].includes(product.trip_characteristic ?? "") ? (product.trip_characteristic as string) : null,
    breakingCapacityKa: num(product.icn_ka) ?? num(product.icu_ac_ka) ?? num(product.icu_dc_ka),
    rcdSensitivityMa: num(product.idn_ma) !== null ? Math.round(product.idn_ma as number) : null,
    rcdType,
    spdType,
    surgeCurrentKa: mapped.category === "SPD" ? (num(features.spd_in_ka) ?? num(features.spd_imax_ka) ?? num(features.spd_iimp_ka)) : null,
    contactConfig: mapped.category === "CONTACTOR" || mapped.category === "RELAY" ? contactConfig(features) : null,
    coilVoltage,
    relaySubtype: mapped.category === "RELAY" ? (RELAY_KINDS[String(features.relay_kind ?? "")] ?? "AUXILIARY") : null,
    moduleSubtype: mapped.subtype ?? null,
    modulesCount: modules,
    widthMm: num(product.width_mm),
    heightMm: num(product.height_mm),
    depthMm: num(product.depth_mm),
    powerLossWatts: Math.round(powerLossWatts * 100) / 100,
    iecSymbol: iecSymbolFor(mapped.category, poles),
    description: product.name_cs.slice(0, 300),
    dataSource: lossKnown === null ? "IEC_ESTIMATE" : "SEED_CATALOG",
    searchText: "",
    archetypeId: dinArchetypeId(product.category, product.width_modules ?? null, product.poles ?? null),
    facetsJson: JSON.stringify({ ...features, current_kind: product.current_kind ?? null, ue_ac_v: product.ue_ac_v ?? null, ue_dc_v: product.ue_dc_v ?? null, mounting: product.mounting ?? [] }),
    externalSource: EXTERNAL_SOURCE,
  };
  data.searchText = buildSearchText({ ...data, ean: data.ean ?? undefined });
  return { kind: "component", key, data };
}

// ---------------------------------------------------------------------------
//  Vazby příslušenství (component_relations)
// ---------------------------------------------------------------------------

export interface ExternalRelation {
  parent: string;
  child: string;
  relationType: "SIDE_LEFT" | "SIDE_RIGHT" | "SIDE_UNSPECIFIED" | "REQUIRES_BOM_ITEM" | "COMPATIBLE_BUSBAR" | "ACCESSORY";
  basis: "catalog" | "derived";
  verified: boolean;
  note: string;
}

interface RelationRule {
  parent: { manufacturer: string; series: readonly string[]; category: string };
  child: { manufacturer: string; series: string; categories: readonly string[] };
  relationType: ExternalRelation["relationType"];
  basis: ExternalRelation["basis"];
  verified: boolean;
  note: string;
  /** Odvozená vazba jen pro stejné póly (hřebeny). */
  samePoles?: boolean;
}

/** Pravidla vazeb shodná s `014_component_relations.sql` externí databáze. */
export const RELATION_RULES: readonly RelationRule[] = [
  {
    parent: { manufacturer: "EATON", series: ["xPole PL7"], category: "MCB" },
    child: { manufacturer: "EATON", series: "PL7 příslušenství", categories: ["AUX_CONTACT", "SHUNT_TRIP", "UNDERVOLTAGE_TRIP"] },
    relationType: "SIDE_UNSPECIFIED",
    basis: "catalog",
    verified: true,
    note: "Eaton CA019068EN, PL7 – příslušenství (strana montáže v katalogu neuvedena)",
  },
  {
    parent: { manufacturer: "OEZ", series: ["LTE", "LTN"], category: "MCB" },
    child: { manufacturer: "OEZ", series: "LT příslušenství", categories: ["AUX_CONTACT"] },
    relationType: "SIDE_UNSPECIFIED",
    basis: "catalog",
    verified: true,
    note: "OEZ KAT-2026-01-MI-CZ, B2 – pomocné spínače PS-LT",
  },
  {
    parent: { manufacturer: "OEZ", series: [], category: "MCB" },
    child: { manufacturer: "OEZ", series: "", categories: ["BUSBAR"] },
    relationType: "COMPATIBLE_BUSBAR",
    basis: "derived",
    verified: false,
    note: "odvozeno: stejný výrobce, póly hřebenu = póly jističe (ověřte v katalogu OEZ)",
    samePoles: true,
  },
];

/** Vazby příslušenství podle pravidel + vazby uvedené přímo u produktu. */
export function deriveRelations(products: readonly ExternalProduct[]): ExternalRelation[] {
  const relations: ExternalRelation[] = [];
  const seen = new Set<string>();
  const push = (relation: ExternalRelation) => {
    const id = `${relation.parent}>${relation.child}>${relation.relationType}`;
    if (relation.parent === relation.child || seen.has(id)) return;
    seen.add(id);
    relations.push(relation);
  };
  for (const rule of RELATION_RULES) {
    const parents = products.filter((p) => p.manufacturer === rule.parent.manufacturer && p.category === rule.parent.category && (!rule.parent.series.length || rule.parent.series.includes(p.series ?? "")));
    const children = products.filter((p) => p.manufacturer === rule.child.manufacturer && rule.child.categories.includes(p.category) && (!rule.child.series || p.series === rule.child.series));
    for (const parent of parents) {
      for (const child of children) {
        if (rule.samePoles && (!parent.poles || !["1P", "2P", "3P", "4P"].includes(parent.poles) || child.poles !== parent.poles)) continue;
        push({ parent: productKey(parent.manufacturer, parent.mpn), child: productKey(child.manufacturer, child.mpn), relationType: rule.relationType, basis: rule.basis, verified: rule.verified, note: rule.note });
      }
    }
  }
  for (const product of products) {
    for (const relation of product.relations ?? []) {
      if (!relation.mpn) continue;
      push({ parent: productKey(product.manufacturer, product.mpn), child: productKey(relation.manufacturer ?? product.manufacturer, relation.mpn), relationType: "ACCESSORY", basis: "catalog", verified: true, note: relation.note ?? relation.kind ?? "" });
    }
  }
  return relations;
}

/** Záznamy z textu SQL seedu: `catalog_upsert_product($catalog${…}$catalog$)`. */
export function payloadsFromSql(sql: string): ExternalProduct[] {
  const out: ExternalProduct[] = [];
  const pattern = /\$catalog\$([\s\S]*?)\$catalog\$/g;
  for (let match = pattern.exec(sql); match; match = pattern.exec(sql)) {
    try {
      const value = JSON.parse(match[1]) as ExternalProduct;
      if (value && typeof value.mpn === "string" && typeof value.manufacturer === "string" && typeof value.category === "string") out.push(value);
    } catch {
      // poškozený záznam přeskočit (počítá se v souhrnu skriptu)
    }
  }
  return out;
}

/** Kompaktní záznam do exportu (bez SVG grafiky, svorek a zdrojových dokumentů). */
export function compactProduct(product: ExternalProduct & Record<string, unknown>): ExternalProduct {
  const keep: (keyof ExternalProduct)[] = [
    "manufacturer", "series", "category", "mpn", "type_designation", "ean", "name_cs", "current_kind", "poles", "in_a", "ue_ac_v", "ue_dc_v", "icn_ka", "icu_ac_ka", "icu_dc_ka",
    "trip_characteristic", "idn_ma", "rcd_type", "rcd_time_class", "p_loss_w", "width_modules", "width_mm", "height_mm", "depth_mm", "mounting", "features", "coil", "enclosure", "relations",
  ];
  const out: Record<string, unknown> = {};
  for (const key of keep) {
    const value = product[key];
    if (value !== null && value !== undefined && !(Array.isArray(value) && !value.length)) out[key] = value;
  }
  return out as unknown as ExternalProduct;
}
