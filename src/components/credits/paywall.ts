"use client";

import { toast } from "sonner";

import type { PaywallInfo } from "@/lib/credits/entitlements";

// Fáze 111: prodejní modal „💎 Odemkněte plnou verzi ELDOCK“ – akce, které narazí na nedostatek kreditů (nebo uživatel
// chce výstup bez zkušebního označení), pošlou událost; modal v layoutu AI Panel Builderu (`PaywallHost`) ji zobrazí.

export const PAYWALL_EVENT = "eldock:paywall";

export function showPaywall(info: PaywallInfo) {
  window.dispatchEvent(new CustomEvent<PaywallInfo>(PAYWALL_EVENT, { detail: info }));
}

/** Chyba akce: s daty prodejního modalu otevře modal, jinak toast. */
export function reportActionError(result: { error: string; paywall?: PaywallInfo }) {
  if (result.paywall) showPaywall(result.paywall);
  else toast.error(result.error);
}
