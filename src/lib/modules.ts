// Licenční moduly a jejich podfunkce – jediný zdroj pravdy (Single Source of Truth) pro celou
// aplikaci. CORE je vždy aktivní; add-on moduly a podfunkce se zapínají podle tarifu zákazníka.
// Stav je v databázi (TenantModule, TenantFeature, TenantSetting); chybějící záznam = zapnuto.

import { ACCOUNT_TYPES, type Permission } from "@/lib/accounts";
import type { AccountType } from "@/generated/prisma/enums";

export const ADDON_MODULES = ["INSPECTIONS_PRO", "CAE_ADVANCED", "ENTERPRISE_TOOLS"] as const;
export type AddonModule = (typeof ADDON_MODULES)[number];
export type ModuleKey = "CORE" | AddonModule;

export const FEATURE_KEYS = [
  "inspections.planner",
  "inspections.pdf_reports",
  "inspections.alerts",
  "inspections.audit",
  "cae.ticketing",
  "cae.canvas_annotation",
  "cae.visual_diff",
  "cae.hotspots",
  "enterprise.csv_import",
  "enterprise.studio",
  "enterprise.ai_panel_builder",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type DisplayMode = "CLEAN" | "UPSELL";
export const DISPLAY_MODES: Record<DisplayMode, { label: string; description: string }> = {
  CLEAN: { label: "Čisté pracoviště", description: "Vypnuté moduly a funkce se v aplikaci vůbec nezobrazí." },
  UPSELL: { label: "Obchodní demo", description: "Vypnuté funkce zůstanou vidět se zámkem a vysvětlením přínosu." },
};

export interface ModuleDefinition {
  label: string;
  /** Krátký název do odznaku „Dostupné v modulu …“. */
  badge: string;
  tier: "Core" | "Add-on";
  /** Obchodní přínos modulu (karta ve správě modulů, okno se zámkem). */
  description: string;
  features: readonly string[];
}

export interface FeatureDefinition {
  module: AddonModule;
  label: string;
  /** Přínos funkce pro zákazníka (okno „Modul Pro“). */
  benefit: string;
  /** Stránky a API, které funkce vlastní (prefix cesty). */
  routes?: readonly string[];
  /** Připravovaná funkce (Roadmap / AI Labs) – jen ukázka, nelze zapnout. */
  labs?: boolean;
}

export const FEATURES: Record<FeatureKey, FeatureDefinition> = {
  "inspections.planner": {
    module: "INSPECTIONS_PRO",
    label: "Plánovač revizí a rychlé revize",
    benefit: "Měsíční plán revizí, pochůzkové listy a rychlá revize spotřebičů přímo v hale – bez Excelu.",
    routes: ["/inspections/planner", "/inspections/rapid"],
  },
  "inspections.pdf_reports": {
    module: "INSPECTIONS_PRO",
    label: "Generátor PDF revizních protokolů",
    benefit: "Revizní zpráva dle NV 190/2022 Sb. a ČSN 33 1600 ed. 2 jedním klikem – s měřením, posudkem a místem pro podpis.",
    routes: ["/inspections/report"],
  },
  "inspections.alerts": {
    module: "INSPECTIONS_PRO",
    label: "E-mailový hlídač lhůt",
    benefit: "Vedení závodu dostane souhrn zařízení 30 a 14 dní před koncem platnosti revize i po termínu.",
    routes: ["/inspections/alerts", "/api/cron/inspection-alerts"],
  },
  "inspections.audit": {
    module: "INSPECTIONS_PRO",
    label: "Auditní report závodu",
    benefit: "Kniha revizí, otevřené závady a provizoria v jednom tisknutelném přehledu pro audit TIČR / ISO.",
    routes: ["/inspections/audit-report"],
  },
  "cae.ticketing": {
    module: "CAE_ADVANCED",
    label: "CAE ticketing a schvalování výkresů",
    benefit: "Červenky z haly jdou rovnou do back-office CAE projektanta, nová revize se schvaluje v aplikaci a archivuje.",
    routes: ["/cae"],
  },
  "cae.canvas_annotation": {
    module: "CAE_ADVANCED",
    label: "Kreslení do fotek u červenky",
    benefit: "Údržbář zakroužkuje změnu přímo ve fotce rozváděče – projektant přesně ví, co se změnilo.",
  },
  "cae.visual_diff": {
    module: "CAE_ADVANCED",
    label: "Vizuální porovnávač revizí",
    benefit: "Stará a nová verze výkresu vedle sebe, posuvníkem nebo barevným rozdílem – schválení za pár vteřin.",
  },
  "cae.hotspots": {
    module: "CAE_ADVANCED",
    label: "Interaktivní prokliky ve schématu",
    benefit: "Klik na -Q1 nebo -M1 ve výkresu otevře kartu propojeného zařízení se stavem revize a historií změn.",
  },
  "enterprise.csv_import": {
    module: "ENTERPRISE_TOOLS",
    label: "Hromadný import z Excelu / CSV",
    benefit: "Stovky spotřebičů z dosavadní evidence do systému za pár minut, včetně lokací a QR kódů.",
    routes: ["/inspections/import"],
  },
  "enterprise.studio": {
    module: "ENTERPRISE_TOOLS",
    label: "Studio výstavby závodu",
    benefit: "Budovy, patra, rastr a osazení zařízení tažením myší – nový závod digitalizujete bez CAD.",
    routes: ["/studio"],
  },
  "enterprise.ai_panel_builder": {
    module: "ENTERPRISE_TOOLS",
    label: "AI pasportizace rozváděčů z fotky",
    benefit: "Fotka dvířek rozváděče → návrh kusovníku, pasportu a výpočtu oteplení. Připravujeme.",
    labs: true,
  },
};

export const MODULES: Record<ModuleKey, ModuleDefinition> = {
  CORE: {
    label: "Eldock Core",
    badge: "Core",
    tier: "Core",
    description: "Základní platforma digitální dokumentace závodu – vždy aktivní.",
    features: [
      "Hierarchie závodu (závod → budova → patro → zařízení)",
      "Karty zařízení, fotodokumentace a online prohlížeč PDF schémat",
      "Správa a tisk průmyslových QR štítků",
      "Základní hlášení změny / závady (červenka z provozu)",
      "Řízení přístupů a 6 průmyslových rolí",
    ],
  },
  INSPECTIONS_PRO: {
    label: "Revize & Legislativa VTZ",
    badge: "Revize Pro",
    tier: "Add-on",
    description: "Plánování a dokladování revizí VTZ a spotřebičů podle legislativy – vždy připraveni na audit.",
    features: featureLabels("INSPECTIONS_PRO"),
  },
  CAE_ADVANCED: {
    label: "CAE Projekce & Verzování",
    badge: "CAE Pro",
    tier: "Add-on",
    description: "Přesná komunikace údržby a CAE projektanta: od červenky po schválenou revizi výkresu.",
    features: featureLabels("CAE_ADVANCED"),
  },
  ENTERPRISE_TOOLS: {
    label: "Enterprise & Onboarding",
    badge: "Enterprise",
    tier: "Add-on",
    description: "Rychlé zavedení a rozšiřování závodů ve velkém.",
    features: featureLabels("ENTERPRISE_TOOLS"),
  },
};

function featureLabels(module: AddonModule) {
  return FEATURE_KEYS.filter((key) => FEATURES[key].module === module).map((key) => FEATURES[key].label);
}

export const featuresOf = (module: AddonModule): FeatureKey[] => FEATURE_KEYS.filter((key) => FEATURES[key].module === module);

// ---------------------------------------------------------------------------
//  Konfigurace tenantu
// ---------------------------------------------------------------------------

export interface ModuleConfig {
  modules: Record<AddonModule, boolean>;
  /** Vlastní přepínač podfunkce (účinná je jen se zapnutým modulem – viz `effectiveFeatures`). */
  features: Record<FeatureKey, boolean>;
  displayMode: DisplayMode;
}

export type FeatureFlags = Record<FeatureKey, boolean>;

const allModules = (value: boolean) => Object.fromEntries(ADDON_MODULES.map((key) => [key, value])) as Record<AddonModule, boolean>;
const allFeatures = (value: boolean) => Object.fromEntries(FEATURE_KEYS.map((key) => [key, value && !FEATURES[key].labs])) as Record<FeatureKey, boolean>;

/** Výchozí stav: všechno zapnuté, obchodní demo (labs funkce nikdy). */
export const DEFAULT_MODULE_CONFIG: ModuleConfig = { modules: allModules(true), features: allFeatures(true), displayMode: "UPSELL" };

export const isAddonModule = (value: string): value is AddonModule => (ADDON_MODULES as readonly string[]).includes(value);
export const isFeatureKey = (value: string): value is FeatureKey => (FEATURE_KEYS as readonly string[]).includes(value);

/** Konfigurace z řádků databáze (neznámé klíče se ignorují, chybějící = výchozí). */
export function moduleConfigFrom(
  modules: readonly { key: string; enabled: boolean }[],
  features: readonly { key: string; enabled: boolean }[],
  displayMode: string | null | undefined,
): ModuleConfig {
  const config: ModuleConfig = { modules: { ...DEFAULT_MODULE_CONFIG.modules }, features: { ...DEFAULT_MODULE_CONFIG.features }, displayMode: DEFAULT_MODULE_CONFIG.displayMode };
  for (const row of modules) if (isAddonModule(row.key)) config.modules[row.key] = row.enabled;
  for (const row of features) if (isFeatureKey(row.key) && !FEATURES[row.key].labs) config.features[row.key] = row.enabled;
  if (displayMode === "CLEAN" || displayMode === "UPSELL") config.displayMode = displayMode;
  return config;
}

/** Účinný stav podfunkcí: modul zapnutý A podfunkce zapnutá (labs nikdy). */
export function effectiveFeatures(config: ModuleConfig): FeatureFlags {
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, !FEATURES[key].labs && config.modules[FEATURES[key].module] && config.features[key]])) as FeatureFlags;
}

// ---------------------------------------------------------------------------
//  Presety tarifů (1 klik na obchodní schůzce)
// ---------------------------------------------------------------------------

export type PresetKey = "START" | "PROFI" | "ENTERPRISE";

export const PRESETS: Record<PresetKey, { label: string; description: string; apply: (current: ModuleConfig) => ModuleConfig }> = {
  START: {
    label: "Tarif START",
    description: "Jen Core a čisté pracoviště – schémata, QR štítky a hlášení změn.",
    apply: () => ({ modules: allModules(false), features: allFeatures(true), displayMode: "CLEAN" }),
  },
  PROFI: {
    label: "Tarif PROFI ÚDRŽBA",
    description: "Core + Revize & Legislativa VTZ.",
    apply: (current) => ({ modules: { ...allModules(false), INSPECTIONS_PRO: true }, features: allFeatures(true), displayMode: current.displayMode }),
  },
  ENTERPRISE: {
    label: "Tarif KOMPLET ENTERPRISE",
    description: "Všechny moduly a podfunkce.",
    apply: (current) => ({ modules: allModules(true), features: allFeatures(true), displayMode: current.displayMode }),
  },
};

/** Který preset odpovídá aktuálnímu stavu (pro zvýraznění), jinak null = vlastní nastavení. */
export function matchingPreset(config: ModuleConfig): PresetKey | null {
  for (const key of ["START", "PROFI", "ENTERPRISE"] as const) {
    const preset = PRESETS[key].apply(config);
    const same =
      ADDON_MODULES.every((module) => preset.modules[module] === config.modules[module]) &&
      FEATURE_KEYS.every((feature) => preset.features[feature] === config.features[feature]) &&
      preset.displayMode === config.displayMode;
    if (same) return key;
  }
  return null;
}

// ---------------------------------------------------------------------------
//  Cesty a domovské stránky
// ---------------------------------------------------------------------------

export function featureForPath(pathname: string): FeatureKey | null {
  for (const key of FEATURE_KEYS) {
    if (FEATURES[key].routes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`))) return key;
  }
  return null;
}

/** Domovská stránka účtu s ohledem na funkce (revizní technik bez plánovače → přehled revizí). */
export function resolveHome<T extends string>(home: T, features: FeatureFlags): T | "/inspections" {
  const owner = featureForPath(home);
  // CAE back-office bez ticketingu zůstává na /cae – stránka vysvětlí, že modul není aktivní.
  if (!owner || features[owner] || owner === "cae.ticketing") return home;
  return "/inspections";
}

// ---------------------------------------------------------------------------
//  Matice dopadu na role (Live Role Impact)
// ---------------------------------------------------------------------------

interface Tool {
  label: string;
  /** Oprávnění role (stačí jedno z nich); bez oprávnění = všechny role. */
  anyOf?: readonly Permission[];
  feature?: FeatureKey;
}

const TOOLS: Tool[] = [
  { label: "Mapa závodu a karty zařízení" },
  { label: "Prohlížeč PDF schémat a QR štítky" },
  { label: "Hlášení změny (červenka)", anyOf: ["submitChange"] },
  { label: "Přehled a zápis revizí", anyOf: ["inspections", "recordInspection"] },
  { label: "Správa účtů a modulů", anyOf: ["manageUsers", "manageModules"] },
  { label: "Plánovač revizí", anyOf: ["planner"], feature: "inspections.planner" },
  { label: "Rychlá revize v hale", anyOf: ["rapid"], feature: "inspections.planner" },
  { label: "PDF revizní protokoly", anyOf: ["inspections"], feature: "inspections.pdf_reports" },
  { label: "Hlídač lhůt", anyOf: ["inspections"], feature: "inspections.alerts" },
  { label: "Auditní report", anyOf: ["audit"], feature: "inspections.audit" },
  { label: "CAE back-office (tickety)", anyOf: ["caeOffice"], feature: "cae.ticketing" },
  { label: "Kreslení do fotek", anyOf: ["submitChange"], feature: "cae.canvas_annotation" },
  { label: "Porovnávač revizí", anyOf: ["approveRevision", "caeOffice"], feature: "cae.visual_diff" },
  { label: "Prokliky ve schématu", feature: "cae.hotspots" },
  { label: "Import z Excelu / CSV", anyOf: ["recordInspection", "studio"], feature: "enterprise.csv_import" },
  { label: "Studio výstavby závodu", anyOf: ["studio"], feature: "enterprise.studio" },
];

export interface RoleImpact {
  accountType: AccountType;
  label: string;
  available: string[];
  hidden: string[];
}

/** Co jednotlivé role při dané konfiguraci mají a co se jim skrylo (nástroje mimo jejich oprávnění se neuvádí). */
export function roleImpact(features: FeatureFlags): RoleImpact[] {
  return (Object.keys(ACCOUNT_TYPES) as AccountType[]).map((accountType) => {
    const definition = ACCOUNT_TYPES[accountType];
    const relevant = TOOLS.filter((tool) => !tool.anyOf || tool.anyOf.some((permission) => definition.permissions.includes(permission)));
    return {
      accountType,
      label: definition.label,
      available: relevant.filter((tool) => !tool.feature || features[tool.feature]).map((tool) => tool.label),
      hidden: relevant.filter((tool) => tool.feature && !features[tool.feature]).map((tool) => tool.label),
    };
  });
}
