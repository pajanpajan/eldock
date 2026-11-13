// Fáze 111: nárok na výstupy podle licence projektu a zkušebního projektu firmy – kolik stojí nový rozváděč / 2D
// půdorys, kdy nese výstup zkušební označení a kdy se otevře prodejní modal. Čisté funkce (server, klient, testy).

import { ACTION_PRICES, BUNDLE_SWITCHBOARD_PRICE } from "./pricing";

/** Licence výstupů projektu rozváděče / půdorysu. */
export type License = "TRIAL" | "PAID" | "BUNDLE" | "SAMPLE";
export const LICENSES: readonly License[] = ["TRIAL", "PAID", "BUNDLE", "SAMPLE"];
export const licenseOf = (value: string | null | undefined): License => (LICENSES as readonly string[]).includes(value ?? "") ? (value as License) : "PAID";

export const LICENSE_LABELS: Record<License, string> = {
  TRIAL: "🎁 Zkušební projekt (výstupy se zkušebním označením)",
  PAID: "✅ Plná verze",
  BUNDLE: "✅ Plná verze – balíček celá zakázka (cenová nabídka v ceně)",
  SAMPLE: "Vzorový projekt",
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

export type ChargeReason = "TRIAL" | "SWITCHBOARD" | "FLOORPLAN" | "BUNDLE_SWITCHBOARD" | "REGENERATE";

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
  if (license === "SAMPLE") return { allowed: true, watermark: false, cost: 0 };
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
