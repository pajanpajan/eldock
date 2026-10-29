import { z } from "zod";

// Role aplikace (MVP bez přihlášení). Soubor je bezpečný pro klient i server.

export const ROLE_COOKIE = "digitry-role";
/** Id uživatele aktuálního účtu (přepínač účtů); bez něj platí role z `ROLE_COOKIE`. */
export const ACCOUNT_COOKIE = "digitry-account";
export const PLANT_COOKIE = "digitry-plant";

export const roleSchema = z.enum(["MAINTENANCE", "CAE_ENGINEER"]);
export type AppRole = z.infer<typeof roleSchema>;

export const DEFAULT_ROLE: AppRole = "MAINTENANCE";

export const ROLE_LABELS: Record<AppRole, { full: string; short: string }> = {
  MAINTENANCE: { full: "Pohled: Údržba v hale", short: "Údržba" },
  CAE_ENGINEER: { full: "Pohled: CAE Projektant", short: "CAE" },
};

/** Výchozí účet workflow role (id ze seedu): údržba = vedoucí údržby, CAE = projektant. */
export const DEMO_USER_ID: Record<AppRole, string> = {
  MAINTENANCE: "acc-novotny",
  CAE_ENGINEER: "acc-krejci",
};

export function parseRole(value: string | undefined): AppRole {
  const parsed = roleSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_ROLE;
}
