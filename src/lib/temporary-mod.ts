import type { UserRole } from "@/generated/prisma/enums";

import { daysUntil } from "./inspection";

// Dočasná provizoria: číslování, lhůta odstranění a odpočet. Čisté funkce (seed, služby, UI).

/** Povolené lhůty odstranění provizoria v dnech (výchozí 7). */
export const TEMP_MOD_DAYS = [7, 14] as const;
export type TempModDays = (typeof TEMP_MOD_DAYS)[number];

export const formatTempModNumber = (year: number, sequence: number) => `PROV-${year}-${String(sequence).padStart(4, "0")}`;

/** Další pořadí v roce podle existujících čísel `PROV-RRRR-NNNN`. */
export function nextTempModSequence(numbers: readonly string[], year: number): number {
  let max = 0;
  for (const number of numbers) {
    const match = /^PROV-(\d{4})-(\d{4})$/.exec(number);
    if (match && Number(match[1]) === year) max = Math.max(max, Number(match[2]));
  }
  return max + 1;
}

export function tempModExpiry(createdAt: Date, days: number): Date {
  const expiresAt = new Date(createdAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + days);
  return expiresAt;
}

/** Odpočet do povinného odstranění; záporné = po termínu. */
export function tempModCountdown(expiresAt: Date, now: Date | number = new Date()): { daysLeft: number; overdue: boolean } {
  const daysLeft = daysUntil(expiresAt, now);
  return { daysLeft, overdue: daysLeft < 0 };
}

/** Role autora provizoria do záznamu. */
export const TEMP_MOD_ROLE_LABEL: Record<UserRole, string> = {
  MAINTENANCE: "Údržba",
  CAE_ENGINEER: "CAE projektant",
  ADMIN: "Revizní technik",
};
