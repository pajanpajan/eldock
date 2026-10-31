import type { AccountType, EquipmentType } from "@/generated/prisma/enums";

import { ALL_LAYERS, MAP_LAYERS, type LayerKey } from "./map-layers";
import type { AppRole } from "./roles";

// Víceúrovňové účty (RBAC): každý typ účtu má výřez dat (kategorie zařízení = vrstvy mapy),
// oprávnění k akcím a domovskou stránku. Workflow role pro stavový automat požadavků se
// z typu účtu odvozuje. Soubor je bezpečný pro klient i server (bez Prismy).

export type Permission =
  | "manageUsers" // správa podúčtů (/admin/users)
  | "manageModules" // správa modulů a tarifů (/admin/modules)
  | "studio" // Studio výstavby závodu (/studio)
  | "audit" // Auditní report / Kniha revizí
  | "kpi" // manažerské KPI
  | "approveRevision" // schválení / vrácení CAE revize
  | "submitChange" // Zadat změnu (redlining)
  | "temporaryMods" // dočasná provizoria
  | "resolveDefects" // potvrzení odstranění revizní závady
  | "recordInspection" // zápis revize, hromadná revize
  | "inspections" // přehled revizí a hlídač lhůt
  | "planner" // plánovač revizí
  | "rapid" // rychlá revize spotřebičů
  | "panelBuilder" // AI Panel Builder (/panel-builder)
  | "caeOffice"; // CAE Back-Office

export interface AccountDefinition {
  label: string;
  /** Co účet vidí – do přepínače a správy účtů. */
  scopeDescription: string;
  /** Výchozí výřez kategorií (vrstvy mapy). */
  layers: readonly LayerKey[];
  permissions: readonly Permission[];
  /** Workflow role pro stavový automat požadavků na změnu. */
  workflowRole: AppRole;
  /** Zobrazovat lhůtník revizí, odznaky a bannery expirace (CAE ne). */
  showInspections: boolean;
  /** Odznak účtu (Tailwind třídy zapsané doslova). */
  badge: string;
  /** Kam účet po přepnutí přistane: „plant“ = mapa závodu. */
  home: "plant" | "/cae" | "/inspections/rapid" | "/inspections/planner";
  /**
   * Terénní pohled (směnový údržbář): rychlý přístup ke schématu, QR štítku a nahlášení změny,
   * bez manažerských přehledů (KPI, hlídač lhůt, pasport, lhůtník).
   */
  fieldView?: boolean;
}

const ALL = [...ALL_LAYERS];
const FIXED: LayerKey[] = ["ENERGY", "MACHINES"];

export const ACCOUNT_TYPES: Record<AccountType, AccountDefinition> = {
  PLANT_ADMIN: {
    label: "Technický ředitel",
    scopeDescription: "Celý závod – všechna zařízení, KPI, audit, Studio a správa podúčtů.",
    layers: ALL,
    permissions: [
      "manageUsers",
      "manageModules",
      "studio",
      "audit",
      "kpi",
      "approveRevision",
      "submitChange",
      "temporaryMods",
      "resolveDefects",
      "recordInspection",
      "inspections",
      "planner",
      "rapid",
      "panelBuilder",
    ],
    workflowRole: "MAINTENANCE",
    showInspections: true,
    badge: "border-yellow-500/50 bg-yellow-500/15 text-yellow-300",
    home: "plant",
  },
  MAINTENANCE_LEAD: {
    label: "Vedoucí údržby",
    scopeDescription: "Všechna zařízení – schvaluje CAE revize, řídí LOTO, provizoria a odstraňování závad.",
    layers: ALL,
    permissions: ["manageModules", "studio", "audit", "kpi", "approveRevision", "submitChange", "temporaryMods", "resolveDefects", "recordInspection", "inspections", "planner", "rapid", "panelBuilder"],
    workflowRole: "MAINTENANCE",
    showInspections: true,
    badge: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
    home: "plant",
  },
  MAINTENANCE_TECH: {
    label: "Směnový údržbář",
    scopeDescription: "Pevná zařízení (rozváděče, trafo, linky, stroje) – zadává změny ve výkresech a provizoria.",
    layers: FIXED,
    permissions: ["submitChange", "temporaryMods", "resolveDefects", "inspections"],
    workflowRole: "MAINTENANCE",
    showInspections: true,
    badge: "border-orange-500/50 bg-orange-500/15 text-orange-300",
    home: "plant",
    fieldView: true,
  },
  INSPECTOR_VTZ: {
    label: "Revizní technik VTZ",
    scopeDescription: "Jen vyhrazená technická zařízení (ČSN 33 1500, NV 190/2022 Sb.) – bez spotřebičů a nářadí.",
    layers: [...FIXED, "SAFETY"],
    permissions: ["recordInspection", "inspections", "planner", "temporaryMods", "resolveDefects"],
    workflowRole: "MAINTENANCE",
    showInspections: true,
    badge: "border-red-500/50 bg-red-500/15 text-red-300",
    home: "/inspections/planner",
  },
  INSPECTOR_APPLIANCES: {
    label: "Technik revizí spotřebičů",
    scopeDescription: "Jen přenosné spotřebiče, nářadí, prodlužováky a svářečky (ČSN 33 1600 ed. 2).",
    layers: ["TOOLS", "APPLIANCES"],
    permissions: ["recordInspection", "inspections", "planner", "rapid"],
    workflowRole: "MAINTENANCE",
    showInspections: true,
    badge: "border-sky-500/50 bg-sky-500/15 text-sky-300",
    home: "/inspections/rapid",
  },
  CAE_ENGINEER: {
    label: "CAE projektant",
    scopeDescription: "Zařízení s výkresovou dokumentací a požadavky na změnu – bez lhůtníku revizí.",
    layers: FIXED,
    permissions: ["caeOffice", "panelBuilder"],
    workflowRole: "CAE_ENGINEER",
    showInspections: false,
    badge: "border-violet-500/50 bg-violet-500/15 text-violet-300",
    home: "/cae",
  },
};

export const ACCOUNT_ORDER: AccountType[] = ["PLANT_ADMIN", "MAINTENANCE_LEAD", "MAINTENANCE_TECH", "INSPECTOR_VTZ", "INSPECTOR_APPLIANCES", "CAE_ENGINEER"];

export const PERMISSION_LABELS: Record<Permission, string> = {
  manageUsers: "Správa podúčtů",
  manageModules: "Správa modulů a tarifů",
  studio: "Studio výstavby",
  audit: "Auditní report",
  kpi: "Manažerské KPI",
  approveRevision: "Schvaluje revize CAE",
  submitChange: "Zadává změny",
  temporaryMods: "Provizoria",
  resolveDefects: "Odstraňuje závady",
  recordInspection: "Zapisuje revize",
  inspections: "Přehled revizí",
  planner: "Plánovač",
  rapid: "Rychlá revize",
  caeOffice: "CAE Back-Office",
  panelBuilder: "AI Panel Builder",
};

/** Účet = typ + případný vlastní výřez kategorií (podúčet ze správy uživatelů). */
export interface AccountLike {
  accountType: AccountType;
  scopeLayers?: string | null;
}

/** Výřez kategorií účtu: vlastní (`scopeLayers`) nebo výchozí pro typ účtu. */
export function accountLayers(account: AccountLike): LayerKey[] {
  const custom = (account.scopeLayers ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is LayerKey => (ALL_LAYERS as ReadonlySet<string>).has(value));
  return custom.length ? custom : [...ACCOUNT_TYPES[account.accountType].layers];
}

/** Viditelné typy zařízení; `null` = bez omezení (všechny kategorie). */
export function visibleTypes(account: AccountLike): EquipmentType[] | null {
  const layers = accountLayers(account);
  if (layers.length === ALL_LAYERS.size) return null;
  return MAP_LAYERS.filter((layer) => layers.includes(layer.key)).flatMap((layer) => [...layer.types]);
}

export const canSeeType = (account: AccountLike, type: EquipmentType) => {
  const types = visibleTypes(account);
  return types === null || types.includes(type);
};

export const can = (account: AccountLike, permission: Permission) => ACCOUNT_TYPES[account.accountType].permissions.includes(permission);

/** Prisma filtr výřezu pro `equipment` (`{}` = bez omezení). */
export function equipmentScope(account: AccountLike): { type?: { in: EquipmentType[] } } {
  const types = visibleTypes(account);
  return types === null ? {} : { type: { in: types } };
}

/** Odfiltruje položky mimo výřez účtu (pro data, která už jsou v paměti). */
export function filterByAccount<T extends { type: EquipmentType }>(account: AccountLike, items: readonly T[]): T[] {
  const types = visibleTypes(account);
  return types === null ? [...items] : items.filter((item) => types.includes(item.type));
}
