// Licenční moduly Eldock: CORE je vždy aktivní, add-ony se zapínají podle tarifu zákazníka
// (globální konfigurace tenantu v tabulce TenantModule; chybějící záznam = zapnuto).

export const ADDON_MODULES = ["INSPECTIONS_PRO", "CAE_ADVANCED", "ENTERPRISE_TOOLS"] as const;
export type AddonModule = (typeof ADDON_MODULES)[number];
export type ModuleKey = "CORE" | AddonModule;
export type ModuleState = Record<AddonModule, boolean>;

export interface ModuleDefinition {
  label: string;
  /** Krátký název do odznaku „Dostupné v modulu …“. */
  badge: string;
  tier: "Core" | "Add-on";
  description: string;
  features: string[];
}

export const MODULES: Record<ModuleKey, ModuleDefinition> = {
  CORE: {
    label: "Eldock Core",
    badge: "Core",
    tier: "Core",
    description: "Základ digitální dokumentace závodu – vždy aktivní.",
    features: [
      "Hierarchie závod → budova → patro → zařízení",
      "Karty zařízení, fotografie a prohlížeč PDF schémat",
      "QR štítky a jejich tisk",
      "Zadání požadavku na změnu (červenka) a schválení revize",
      "Přehled revizí a zápis revizí, správa uživatelů",
    ],
  },
  INSPECTIONS_PRO: {
    label: "Revize & Legislativa",
    badge: "Revize Pro",
    tier: "Add-on",
    description: "Plánování a dokladování revizí VTZ a spotřebičů podle legislativy.",
    features: [
      "Chytrý plánovač revizí a pochůzkové listy",
      "Rychlá revize spotřebičů v hale",
      "Auditní report a kniha revizí",
      "Generování PDF revizních zpráv",
      "E-mailový hlídač lhůt (avízo vedení závodu)",
    ],
  },
  CAE_ADVANCED: {
    label: "Pokročilá CAE projekce",
    badge: "CAE Pro",
    tier: "Add-on",
    description: "Nástroje pro přesnou komunikaci údržby a CAE projektanta.",
    features: [
      "Kreslení do fotek u červenky",
      "Vizuální porovnání revizí (posuvník, barevný diff, prolínání)",
      "Interaktivní prokliky ve schématu (CAE reference)",
    ],
  },
  ENTERPRISE_TOOLS: {
    label: "Hromadné nástroje",
    badge: "Enterprise",
    tier: "Add-on",
    description: "Rychlé zavedení a rozšiřování závodu ve velkém.",
    features: ["Hromadný import zařízení z CSV / Excelu", "Studio výstavby závodu (budovy, patra, rastr, osazení)"],
  },
};

export const ALL_MODULES_ENABLED: ModuleState = { INSPECTIONS_PRO: true, CAE_ADVANCED: true, ENTERPRISE_TOOLS: true };

export const isAddonModule = (value: string): value is AddonModule => (ADDON_MODULES as readonly string[]).includes(value);

/** Stav modulů z řádků databáze (neznámé klíče se ignorují, chybějící = zapnuto). */
export function moduleStateFrom(rows: readonly { key: string; enabled: boolean }[]): ModuleState {
  const state = { ...ALL_MODULES_ENABLED };
  for (const row of rows) if (isAddonModule(row.key)) state[row.key] = row.enabled;
  return state;
}

/** Stránky a API, které patří add-onu (prefix cesty). */
const ROUTE_MODULES: { prefix: string; module: AddonModule }[] = [
  { prefix: "/inspections/planner", module: "INSPECTIONS_PRO" },
  { prefix: "/inspections/rapid", module: "INSPECTIONS_PRO" },
  { prefix: "/inspections/audit-report", module: "INSPECTIONS_PRO" },
  { prefix: "/inspections/alerts", module: "INSPECTIONS_PRO" },
  { prefix: "/inspections/report", module: "INSPECTIONS_PRO" },
  { prefix: "/api/cron/inspection-alerts", module: "INSPECTIONS_PRO" },
  { prefix: "/inspections/import", module: "ENTERPRISE_TOOLS" },
  { prefix: "/studio", module: "ENTERPRISE_TOOLS" },
];

export function moduleForPath(pathname: string): AddonModule | null {
  return ROUTE_MODULES.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`))?.module ?? null;
}

/** Domovská stránka účtu s ohledem na moduly (revizní technik bez Revize Pro → přehled revizí). */
export function resolveHome<T extends string>(home: T, state: ModuleState): T | "/inspections" {
  const owner = moduleForPath(home);
  return owner && !state[owner] ? "/inspections" : home;
}
