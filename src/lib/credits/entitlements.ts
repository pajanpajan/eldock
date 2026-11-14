// Fáze 111: nárok na výstupy podle licence projektu a zkušebního projektu firmy – kolik stojí nový rozváděč / 2D
// půdorys, kdy nese výstup zkušební označení a kdy se otevře prodejní modal. Čisté funkce (server, klient, testy).

import { ACTION_PRICES, BUNDLE_SWITCHBOARD_PRICE, HLIDAC_TRIAL_DEVICES, subscriptionOf } from "./pricing";

/** Licence výstupů projektu rozváděče / půdorysu. */
/** Fáze 113: `UNLIMITED` = ⭐ neomezený přístup (účet provozovatele, ukázková firma) – plná verze bez kreditů. */
export type License = "TRIAL" | "PAID" | "BUNDLE" | "SAMPLE" | "UNLIMITED";
export const LICENSES: readonly License[] = ["TRIAL", "PAID", "BUNDLE", "SAMPLE", "UNLIMITED"];
export const licenseOf = (value: string | null | undefined): License => (LICENSES as readonly string[]).includes(value ?? "") ? (value as License) : "PAID";

export const LICENSE_LABELS: Record<License, string> = {
  TRIAL: "🎁 Zkušební projekt (výstupy se zkušebním označením)",
  PAID: "✅ Plná verze",
  BUNDLE: "✅ Plná verze – balíček celá zakázka (cenová nabídka v ceně)",
  SAMPLE: "Vzorový projekt",
  UNLIMITED: "⭐ Neomezený přístup – plná verze bez kreditů (provozovatel / ukázka)",
};

export interface TrialState {
  trialFloorplanUsed: boolean;
  trialSwitchboardUsed: boolean;
}

/** Zbývající testovací projekt (1 = ještě zbývá zkušební půdorys nebo zkušební rozváděč). */
export const freeTrialProjectsRemaining = (state: TrialState) => (!state.trialFloorplanUsed || !state.trialSwitchboardUsed ? 1 : 0);

/** Co z testovacího projektu zbývá („zkušební 2D půdorys + zkušební rozváděč“). */
export function trialRemainingText(state: TrialState): string | null {
  const parts = [!state.trialFloorplanUsed ? "zkušební 2D půdorys" : null, !state.trialSwitchboardUsed ? "zkušební rozváděč" : null].filter(Boolean);
  return parts.length ? `🎁 1 testovací projekt zdarma: ${parts.join(" + ")}` : null;
}

export type ChargeReason = "TRIAL" | "SWITCHBOARD" | "FLOORPLAN" | "BUNDLE_SWITCHBOARD" | "REGENERATE" | "UNLIMITED";

export interface ChargePlan {
  license: License;
  cost: number;
  reason: ChargeReason;
  label: string;
}

/**
 * Nový rozváděč: první je zkušební (zdarma, výstupy se zkušebním označením); z už zaplaceného 2D půdorysu doplatek do
 * balíčku celá zakázka (10 kr. → celkem 25 kr. i s nabídkou), znovu z půdorysu téže zakázky zdarma, jinak 15 kr.
 */
export function switchboardCharge(state: TrialState, options: { floorplanLicense?: License | null } = {}): ChargePlan {
  if (!state.trialSwitchboardUsed) return { license: "TRIAL", cost: 0, reason: "TRIAL", label: "🎁 Zkušební rozváděč zdarma (1. testovací projekt)" };
  if (options.floorplanLicense === "PAID") return { license: "BUNDLE", cost: BUNDLE_SWITCHBOARD_PRICE, reason: "BUNDLE_SWITCHBOARD", label: `Rozváděč k zaplacenému půdorysu – doplatek ${BUNDLE_SWITCHBOARD_PRICE} kr. do balíčku celá zakázka (${ACTION_PRICES.bundle} kr.)` };
  if (options.floorplanLicense === "BUNDLE") return { license: "BUNDLE", cost: 0, reason: "REGENERATE", label: "Rozváděč z půdorysu zakázky v balíčku – bez dalšího kreditu" };
  return { license: "PAID", cost: ACTION_PRICES.switchboard, reason: "SWITCHBOARD", label: `Kompletní rozváděč – ${ACTION_PRICES.switchboard} kreditů` };
}

/** Nový 2D půdorys (uložení na server): první zkušební zdarma, další 15 kr. */
export function floorplanCharge(state: TrialState): ChargePlan {
  if (!state.trialFloorplanUsed) return { license: "TRIAL", cost: 0, reason: "TRIAL", label: "🎁 Zkušební 2D půdorys zdarma (1. testovací projekt)" };
  return { license: "PAID", cost: ACTION_PRICES.floorplan, reason: "FLOORPLAN", label: `Kompletní 2D půdorys – ${ACTION_PRICES.floorplan} kreditů` };
}

export type OutputKind = "pdf" | "dxf" | "xlsx" | "quote" | "cnc";

export interface OutputAccess {
  /** Výstup jde stáhnout hned (případně se zkušebním označením). */
  allowed: boolean;
  watermark: boolean;
  /** Kredity za odemčení (0 = v ceně). */
  cost: number;
}

/**
 * Výstup podle licence: zkušební projekt vše se zkušebním označením; plná verze PDF elaborát, výkres DXF a kusovník XLSX,
 * cenová nabídka a CNC balíček samostatně za 8 kr. (nabídka v balíčku celá zakázka zdarma).
 */
export function outputAccess(license: License, output: OutputKind, unlocked: { quote?: boolean; cnc?: boolean } = {}): OutputAccess {
  if (license === "SAMPLE" || license === "UNLIMITED") return { allowed: true, watermark: false, cost: 0 };
  if (license === "TRIAL") return { allowed: true, watermark: true, cost: 0 };
  if (output === "quote") return unlocked.quote || license === "BUNDLE" ? { allowed: true, watermark: false, cost: 0 } : { allowed: false, watermark: false, cost: ACTION_PRICES.quote };
  if (output === "cnc") return unlocked.cnc ? { allowed: true, watermark: false, cost: 0 } : { allowed: false, watermark: false, cost: ACTION_PRICES.cnc };
  return { allowed: true, watermark: false, cost: 0 };
}

/** Odemčení plné verze zkušebního projektu (bez zkušebního označení) – cena rozváděče / půdorysu. */
export const fullVersionCost = (kind: "switchboard" | "floorplan") => (kind === "switchboard" ? ACTION_PRICES.switchboard : ACTION_PRICES.floorplan);

/** Data prodejního modalu (akce, cena, zůstatek) – posílá server při nedostatku kreditů. */
export interface PaywallInfo {
  reason: "NO_CREDITS" | "TRIAL_OUTPUT" | "EXPIRED";
  action: string;
  cost: number;
  balance: number;
  /** Odemčení konkrétního projektu / půdorysu z modalu (když kredity stačí). */
  unlock?: { kind: "switchboard" | "floorplan" | "quote" | "cnc"; id: string } | null;
}

/** Fáze 113: ⭐ neomezený přístup – nový rozváděč / půdorys bez kreditů a bez zkušebního označení. */
export const unlimitedPlan = (kind: "switchboard" | "floorplan"): ChargePlan => ({
  license: "UNLIMITED",
  cost: 0,
  reason: "UNLIMITED",
  label: `⭐ Neomezený přístup – ${kind === "switchboard" ? "rozváděč" : "2D půdorys"} v plné verzi bez kreditů`,
});

// -----------------------------------------------------------------------------
//  Fáze 113: limit zařízení Hlídače revizí podle tarifu závodu
// -----------------------------------------------------------------------------

export interface PlantCompanyState {
  id: string;
  unlimitedAccess: boolean;
  subscriptionPlan: string | null;
  subscriptionUntil: Date | null;
}

export interface DeviceEntitlement {
  /** Bez limitu: ⭐ neomezený přístup, nebo závod bez registrované firmy (ukázkové a interní závody). */
  unlimited: boolean;
  limit: number | null;
  used: number;
  reason: "UNLIMITED" | "INTERNAL" | "SUBSCRIPTION" | "TRIAL";
  /** Název tarifu, který limit dává. */
  plan: string | null;
}

/**
 * Limit zařízení závodu: firma s ⭐ neomezeným přístupem = bez limitu; aktivní tarif REVIZE & BUDOVY (500) nebo
 * PRŮMYSL & ENTERPRISE (5 000) = jeho limit; jinak zkušební limit `HLIDAC_TRIAL_DEVICES`. Závod bez registrované firmy
 * (ukázkový, interní) limit nemá.
 */
export function deviceEntitlement(companies: readonly PlantCompanyState[], used: number, now: Date = new Date(), demoIds: readonly string[] = []): DeviceEntitlement {
  if (!companies.length) return { unlimited: true, limit: null, used, reason: "INTERNAL", plan: null };
  if (companies.some((company) => company.unlimitedAccess || demoIds.includes(company.id))) return { unlimited: true, limit: null, used, reason: "UNLIMITED", plan: null };
  const plans = companies
    .filter((company) => company.subscriptionUntil && company.subscriptionUntil > now)
    .map((company) => subscriptionOf(company.subscriptionPlan))
    .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan?.deviceLimit))
    .sort((a, b) => (b.deviceLimit ?? 0) - (a.deviceLimit ?? 0));
  if (plans.length) return { unlimited: false, limit: plans[0].deviceLimit, used, reason: "SUBSCRIPTION", plan: plans[0].name };
  return { unlimited: false, limit: HLIDAC_TRIAL_DEVICES, used, reason: "TRIAL", plan: null };
}

/** Vejde se `adding` dalších zařízení? */
export const deviceCapacityLeft = (entitlement: DeviceEntitlement) => (entitlement.unlimited || entitlement.limit === null ? Infinity : Math.max(0, entitlement.limit - entitlement.used));

/** Hláška po dosažení limitu zařízení. */
export function deviceLimitMessage(entitlement: DeviceEntitlement): string {
  if (entitlement.reason === "SUBSCRIPTION")
    return `Tarif ${entitlement.plan ?? ""} pokrývá ${entitlement.limit} zařízení a závod jich má ${entitlement.used}. Pro další zařízení přejděte na vyšší tarif – napište nám přes 💬 Kontakt & Spolupráce.`;
  return `Zkušební limit Hlídače revizí je ${entitlement.limit} zařízení (závod jich má ${entitlement.used}). Pro neomezenou správu aktivujte tarif ELDOCK REVIZE & BUDOVY (až 500 zařízení) nebo PRŮMYSL & ENTERPRISE (až 5 000) – napište nám přes 💬 Kontakt & Spolupráce.`;
}

/** Krátký stav limitu pro hlavičku Hlídače („📦 12 / 50 zařízení – zkušební limit“). */
export function deviceEntitlementLabel(entitlement: DeviceEntitlement): string {
  if (entitlement.unlimited) return entitlement.reason === "UNLIMITED" ? `⭐ Neomezený přístup · ${entitlement.used} zařízení` : `${entitlement.used} zařízení · bez limitu`;
  return entitlement.reason === "SUBSCRIPTION" ? `✅ ${entitlement.plan}: ${entitlement.used} / ${entitlement.limit} zařízení` : `📦 ${entitlement.used} / ${entitlement.limit} zařízení – zkušební limit`;
}
