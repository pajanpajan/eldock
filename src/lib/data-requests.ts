import type { DataRequestKind, DataRequestStatus } from "@/generated/prisma/enums";

// Fáze 69 (GDPR): konstanty a popisky žádostí o data – sdílí server i obrazovky (bez I/O).

/** Lhůta mezi žádostí o zrušení účtu firmy a výmazem dat (do té doby jde žádost zrušit a data stáhnout). */
export const CLOSURE_GRACE_DAYS = 30;

/** Slovo, které správce napíše pro potvrzení zrušení účtu (bez diakritiky se přijme také). */
export const CLOSURE_CONFIRM_WORD = "ZRUŠIT";

export const isClosureConfirmed = (value: string) => ["ZRUŠIT", "ZRUSIT"].includes(value.trim().toUpperCase());

export const DATA_REQUEST_KIND_LABELS: Record<DataRequestKind, string> = {
  COMPANY_EXPORT: "Export dat firmy",
  PERSONAL_EXPORT: "Export vlastních údajů",
  COMPANY_CLOSURE: "Zrušení účtu firmy",
  USER_REMOVAL: "Odebrání zaměstnance",
};

export const DATA_REQUEST_STATUS_LABELS: Record<DataRequestStatus, { label: string; tone: "ok" | "warn" | "bad" }> = {
  PENDING: { label: "čeká na lhůtu", tone: "warn" },
  DONE: { label: "vyřízeno", tone: "ok" },
  CANCELLED: { label: "zrušeno", tone: "ok" },
  FAILED: { label: "selhalo", tone: "bad" },
};

/** Kdo žádost podal (evidence bez jmen). */
export const DATA_REQUESTER_LABELS: Record<string, string> = {
  "company-admin": "správce firmy",
  "panel-company": "firma (Panel Builder)",
  superadmin: "velín Eldock",
  user: "uživatel sám",
};
