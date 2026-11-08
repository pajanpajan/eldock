import type { SecurityEventKind } from "@/generated/prisma/enums";

/** Popisky bezpečnostního deníku firmy (fáze 67). */
export const SECURITY_EVENT_LABELS: Record<SecurityEventKind, { label: string; tone: "ok" | "warn" | "bad" }> = {
  LOGIN_OK: { label: "Přihlášení", tone: "ok" },
  LOGIN_FAILED: { label: "Neúspěšné přihlášení", tone: "warn" },
  LOGIN_LOCKED: { label: "Přihlášení zablokováno po opakovaných chybách", tone: "bad" },
  TOTP_FAILED: { label: "Chybný kód dvoufázového ověření", tone: "warn" },
  LOGOUT: { label: "Odhlášení", tone: "ok" },
  PASSWORD_SET: { label: "Nastavení hesla", tone: "ok" },
  PASSWORD_CHANGED: { label: "Změna hesla", tone: "ok" },
  RESET_REQUESTED: { label: "Odkaz na obnovu hesla", tone: "warn" },
  INVITE_CREATED: { label: "Pozvánka k nastavení hesla", tone: "ok" },
  SESSION_REVOKED: { label: "Odhlášení zařízení", tone: "warn" },
  USER_DISABLED: { label: "Účet zablokován", tone: "bad" },
  USER_ENABLED: { label: "Účet odblokován", tone: "ok" },
  TOTP_ENABLED: { label: "Zapnuto dvoufázové ověření", tone: "ok" },
  TOTP_DISABLED: { label: "Vypnuto dvoufázové ověření", tone: "warn" },
};
