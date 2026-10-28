import type { ChangeRequestStatus, EquipmentStatus, UserRole } from "@/generated/prisma/enums";
import { CHANGE_REQUEST_STATUS } from "@/lib/status";

// Pravidla stavového automatu požadavku na změnu (PLAN sekce B). Čisté funkce bez Prismy.

export type WorkflowAction = "submit" | "assign" | "uploadRevision" | "approve" | "reject" | "comment" | "cancel";

export const OPEN_STATUSES: readonly ChangeRequestStatus[] = ["SUBMITTED", "IN_PROGRESS", "WAITING_APPROVAL"];

interface Transition {
  roles: readonly UserRole[];
  /** Povolené výchozí stavy; `null` = zařízení nemá otevřený požadavek. */
  from: readonly (ChangeRequestStatus | null)[];
  /** Cílový stav; `null` = stav se nemění. */
  to: ChangeRequestStatus | null;
  /** Popis akce pro chybové hlášky („Požadavek nelze …“). */
  verb: string;
}

export const TRANSITIONS: Record<WorkflowAction, Transition> = {
  submit: { roles: ["MAINTENANCE"], from: [null], to: "SUBMITTED", verb: "zadat" },
  assign: { roles: ["CAE_ENGINEER"], from: ["SUBMITTED"], to: "IN_PROGRESS", verb: "převzít" },
  uploadRevision: { roles: ["CAE_ENGINEER"], from: ["SUBMITTED", "IN_PROGRESS"], to: "WAITING_APPROVAL", verb: "doplnit o novou revizi" },
  approve: { roles: ["MAINTENANCE"], from: ["WAITING_APPROVAL"], to: "APPROVED", verb: "schválit" },
  reject: { roles: ["MAINTENANCE"], from: ["WAITING_APPROVAL"], to: "IN_PROGRESS", verb: "vrátit k přepracování" },
  comment: { roles: ["MAINTENANCE", "CAE_ENGINEER"], from: OPEN_STATUSES, to: null, verb: "komentovat" },
  cancel: { roles: ["CAE_ENGINEER"], from: ["SUBMITTED", "IN_PROGRESS"], to: "CANCELLED", verb: "stornovat" },
};

const ROLE_NAMES: Record<UserRole, string> = {
  MAINTENANCE: "údržba",
  CAE_ENGINEER: "CAE projektant",
  ADMIN: "administrátor",
};

export type WorkflowErrorCode = "FORBIDDEN" | "INVALID_STATE" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "INVARIANT";

/** Chyba workflow s českou hláškou pro uživatele (UI ji ukáže v toastu). */
export class WorkflowError extends Error {
  constructor(
    public readonly code: WorkflowErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}

export const isOpenStatus = (status: ChangeRequestStatus | null | undefined): status is ChangeRequestStatus =>
  !!status && OPEN_STATUSES.includes(status);

export function canPerform(action: WorkflowAction, role: UserRole, status: ChangeRequestStatus | null): boolean {
  const transition = TRANSITIONS[action];
  return transition.roles.includes(role) && transition.from.includes(status);
}

/** Ověří roli a stav; jinak vyhodí `WorkflowError` s českou hláškou. Vrací cílový stav. */
export function assertCanPerform(action: WorkflowAction, role: UserRole, status: ChangeRequestStatus | null): ChangeRequestStatus | null {
  const transition = TRANSITIONS[action];
  if (!transition.roles.includes(role)) {
    const allowed = transition.roles.map((item) => ROLE_NAMES[item]).join(" nebo ");
    throw new WorkflowError("FORBIDDEN", `Tuto akci může provést jen ${allowed}.`);
  }
  if (!transition.from.includes(status)) {
    if (status === null) throw new WorkflowError("INVALID_STATE", `Zařízení nemá otevřený požadavek na změnu, nelze ho ${transition.verb}.`);
    if (action === "submit") throw new WorkflowError("CONFLICT", "Zařízení už má otevřený požadavek na změnu.");
    throw new WorkflowError(
      "INVALID_STATE",
      `Požadavek ve stavu „${CHANGE_REQUEST_STATUS[status].label}“ nelze ${transition.verb}.`,
    );
  }
  return transition.to ?? status;
}

/** Stav zařízení (barva pinu) odvozený z otevřeného požadavku. */
export function deriveEquipmentStatus(openStatus: ChangeRequestStatus | null | undefined): EquipmentStatus {
  switch (openStatus) {
    case "SUBMITTED":
    case "IN_PROGRESS":
      return "PENDING_UPDATE";
    case "WAITING_APPROVAL":
      return "WAITING_APPROVAL";
    default:
      return "ACTIVE";
  }
}

export type VersionBump = "minor" | "major";

/**
 * Další číslo revize z maxima **všech** revizí zařízení (i zamítnutých – drží si číslo kvůli
 * auditní stopě). Minor +0.1, major +1.0. Bez revizí → v1.0.
 */
export function nextVersion(revisions: readonly { major: number; minor: number }[], bump: VersionBump = "minor") {
  if (revisions.length === 0) return { major: 1, minor: 0 };
  const max = revisions.reduce((best, item) =>
    item.major > best.major || (item.major === best.major && item.minor > best.minor) ? item : best,
  );
  return bump === "major" ? { major: max.major + 1, minor: 0 } : { major: max.major, minor: max.minor + 1 };
}

export const formatVersion = ({ major, minor }: { major: number; minor: number }) => `v${major}.${minor}`;

/** `ZM-2026-0043` */
export const formatTicketNumber = (year: number, sequence: number) => `ZM-${year}-${String(sequence).padStart(4, "0")}`;

/** Pořadí ticketu v roce z existujících čísel (`ZM-2026-0042` → 43). */
export function nextTicketSequence(numbers: readonly string[], year: number): number {
  const prefix = `ZM-${year}-`;
  const max = numbers
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number.parseInt(number.slice(prefix.length), 10))
    .filter(Number.isFinite)
    .reduce((a, b) => Math.max(a, b), 0);
  return max + 1;
}
