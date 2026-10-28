import { z } from "zod";

// Role aplikace (MVP bez přihlášení). Soubor je bezpečný pro klient i server.

export const ROLE_COOKIE = "digitry-role";
export const PLANT_COOKIE = "digitry-plant";

export const roleSchema = z.enum(["MAINTENANCE", "CAE_ENGINEER"]);
export type AppRole = z.infer<typeof roleSchema>;

export const DEFAULT_ROLE: AppRole = "MAINTENANCE";

export const ROLE_LABELS: Record<AppRole, { full: string; short: string }> = {
  MAINTENANCE: { full: "Pohled: Údržba v hale", short: "Údržba" },
  CAE_ENGINEER: { full: "Pohled: CAE Projektant", short: "CAE" },
};

/** Demo uživatelé jednotlivých rolí (id ze seedu). */
export const DEMO_USER_ID: Record<AppRole, string> = {
  MAINTENANCE: "user-novak",
  CAE_ENGINEER: "user-kral",
};

export function parseRole(value: string | undefined): AppRole {
  const parsed = roleSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_ROLE;
}
