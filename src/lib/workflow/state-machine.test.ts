import { describe, expect, it } from "vitest";

import type { ChangeRequestStatus, UserRole } from "@/generated/prisma/enums";

import {
  WorkflowError,
  assertCanPerform,
  canPerform,
  deriveEquipmentStatus,
  formatTicketNumber,
  formatVersion,
  isOpenStatus,
  nextTicketSequence,
  nextVersion,
  type WorkflowAction,
} from "./state-machine";

const STATUSES: (ChangeRequestStatus | null)[] = [null, "SUBMITTED", "IN_PROGRESS", "WAITING_APPROVAL", "APPROVED", "CANCELLED"];
const ROLES: UserRole[] = ["MAINTENANCE", "CAE_ENGINEER"];

/** Očekávané povolené kombinace (akce → role → výchozí stavy) podle PLAN sekce B. */
const ALLOWED: Record<WorkflowAction, Partial<Record<UserRole, (ChangeRequestStatus | null)[]>>> = {
  submit: { MAINTENANCE: [null] },
  assign: { CAE_ENGINEER: ["SUBMITTED"] },
  uploadRevision: { CAE_ENGINEER: ["SUBMITTED", "IN_PROGRESS"] },
  approve: { MAINTENANCE: ["WAITING_APPROVAL"] },
  reject: { MAINTENANCE: ["WAITING_APPROVAL"] },
  comment: {
    MAINTENANCE: ["SUBMITTED", "IN_PROGRESS", "WAITING_APPROVAL"],
    CAE_ENGINEER: ["SUBMITTED", "IN_PROGRESS", "WAITING_APPROVAL"],
  },
  cancel: { CAE_ENGINEER: ["SUBMITTED", "IN_PROGRESS"] },
};

describe("canPerform – úplná matice akcí, rolí a stavů", () => {
  for (const action of Object.keys(ALLOWED) as WorkflowAction[]) {
    it(`${action}`, () => {
      for (const role of ROLES) {
        for (const status of STATUSES) {
          const expected = ALLOWED[action][role]?.includes(status) ?? false;
          expect(canPerform(action, role, status), `${action} / ${role} / ${status}`).toBe(expected);
        }
      }
    });
  }

  it("ADMIN nemá v MVP žádnou workflow akci", () => {
    for (const action of Object.keys(ALLOWED) as WorkflowAction[]) {
      for (const status of STATUSES) expect(canPerform(action, "ADMIN", status)).toBe(false);
    }
  });
});

describe("assertCanPerform – cílové stavy", () => {
  it("submit → SUBMITTED", () => expect(assertCanPerform("submit", "MAINTENANCE", null)).toBe("SUBMITTED"));
  it("assign → IN_PROGRESS", () => expect(assertCanPerform("assign", "CAE_ENGINEER", "SUBMITTED")).toBe("IN_PROGRESS"));
  it("uploadRevision z SUBMITTED i IN_PROGRESS → WAITING_APPROVAL", () => {
    expect(assertCanPerform("uploadRevision", "CAE_ENGINEER", "SUBMITTED")).toBe("WAITING_APPROVAL");
    expect(assertCanPerform("uploadRevision", "CAE_ENGINEER", "IN_PROGRESS")).toBe("WAITING_APPROVAL");
  });
  it("approve → APPROVED", () => expect(assertCanPerform("approve", "MAINTENANCE", "WAITING_APPROVAL")).toBe("APPROVED"));
  it("reject → IN_PROGRESS", () => expect(assertCanPerform("reject", "MAINTENANCE", "WAITING_APPROVAL")).toBe("IN_PROGRESS"));
  it("cancel → CANCELLED", () => expect(assertCanPerform("cancel", "CAE_ENGINEER", "IN_PROGRESS")).toBe("CANCELLED"));
  it("comment stav nemění", () => expect(assertCanPerform("comment", "CAE_ENGINEER", "WAITING_APPROVAL")).toBe("WAITING_APPROVAL"));
});

describe("assertCanPerform – chyby", () => {
  const error = (fn: () => unknown) => {
    try {
      fn();
    } catch (caught) {
      return caught;
    }
    throw new Error("Očekávána chyba");
  };

  it("špatná role → FORBIDDEN s českou hláškou", () => {
    const caught = error(() => assertCanPerform("approve", "CAE_ENGINEER", "WAITING_APPROVAL"));
    expect(caught).toBeInstanceOf(WorkflowError);
    expect((caught as WorkflowError).code).toBe("FORBIDDEN");
    expect((caught as WorkflowError).message).toBe("Tuto akci může provést jen údržba.");
  });

  it("špatný stav → INVALID_STATE s popiskem stavu", () => {
    const caught = error(() => assertCanPerform("approve", "MAINTENANCE", "IN_PROGRESS")) as WorkflowError;
    expect(caught.code).toBe("INVALID_STATE");
    expect(caught.message).toBe("Požadavek ve stavu „V řešení“ nelze schválit.");
  });

  it("druhý otevřený požadavek → CONFLICT", () => {
    expect((error(() => assertCanPerform("submit", "MAINTENANCE", "SUBMITTED")) as WorkflowError).code).toBe("CONFLICT");
  });

  it("uzavřený požadavek nelze stornovat ani komentovat", () => {
    expect(() => assertCanPerform("cancel", "CAE_ENGINEER", "APPROVED")).toThrow(WorkflowError);
    expect(() => assertCanPerform("comment", "MAINTENANCE", "CANCELLED")).toThrow(WorkflowError);
  });
});

describe("deriveEquipmentStatus", () => {
  it("bez otevřeného požadavku → ACTIVE", () => {
    expect(deriveEquipmentStatus(null)).toBe("ACTIVE");
    expect(deriveEquipmentStatus("APPROVED")).toBe("ACTIVE");
    expect(deriveEquipmentStatus("CANCELLED")).toBe("ACTIVE");
  });
  it("SUBMITTED / IN_PROGRESS → PENDING_UPDATE", () => {
    expect(deriveEquipmentStatus("SUBMITTED")).toBe("PENDING_UPDATE");
    expect(deriveEquipmentStatus("IN_PROGRESS")).toBe("PENDING_UPDATE");
  });
  it("WAITING_APPROVAL → WAITING_APPROVAL", () => expect(deriveEquipmentStatus("WAITING_APPROVAL")).toBe("WAITING_APPROVAL"));
  it("isOpenStatus", () => {
    expect(isOpenStatus("WAITING_APPROVAL")).toBe(true);
    expect(isOpenStatus("APPROVED")).toBe(false);
    expect(isOpenStatus(null)).toBe(false);
  });
});

describe("nextVersion", () => {
  it("bez revizí → v1.0", () => expect(nextVersion([])).toEqual({ major: 1, minor: 0 }));
  it("minor přičte 0.1", () => expect(nextVersion([{ major: 1, minor: 0 }, { major: 1, minor: 2 }])).toEqual({ major: 1, minor: 3 }));
  it("major přičte 1.0 a vynuluje minor", () => expect(nextVersion([{ major: 1, minor: 2 }], "major")).toEqual({ major: 2, minor: 0 }));
  it("počítá i se zamítnutými revizemi (maximum ze všech)", () => {
    // R-ML-01: v1.0 ARCHIVED, v1.1 REJECTED, v1.2 ACTIVE → další v1.3
    expect(nextVersion([{ major: 1, minor: 0 }, { major: 1, minor: 2 }, { major: 1, minor: 1 }])).toEqual({ major: 1, minor: 3 });
  });
  it("vyšší major vyhrává nad vyšším minor", () => {
    expect(nextVersion([{ major: 1, minor: 9 }, { major: 2, minor: 0 }])).toEqual({ major: 2, minor: 1 });
  });
  it("formatVersion", () => expect(formatVersion({ major: 1, minor: 10 })).toBe("v1.10"));
});

describe("čísla ticketů", () => {
  it("formatTicketNumber doplní nuly", () => {
    expect(formatTicketNumber(2026, 43)).toBe("ZM-2026-0043");
    expect(formatTicketNumber(2027, 1)).toBe("ZM-2027-0001");
  });
  it("nextTicketSequence bere jen daný rok", () => {
    const numbers = ["ZM-2025-0033", "ZM-2026-0041", "ZM-2026-0042", "ZM-2026-0019"];
    expect(nextTicketSequence(numbers, 2026)).toBe(43);
    expect(nextTicketSequence(numbers, 2027)).toBe(1);
  });
});
