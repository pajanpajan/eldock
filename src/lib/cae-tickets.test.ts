import { describe, expect, it } from "vitest";

import {
  DEFAULT_FILTER,
  computeKpis,
  filterTickets,
  formatDuration,
  parseTicketFilter,
  serializeTicketFilter,
  slaLevel,
  type TicketLike,
} from "./cae-tickets";

const now = new Date("2026-10-28T12:00:00Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600 * 1000);

const ticket = (overrides: Partial<TicketLike & { id: string }>): TicketLike & { id: string } => ({
  id: "t",
  status: "SUBMITTED",
  priority: "NORMAL",
  submittedAt: hoursAgo(1),
  plantId: "jbc",
  assigneeId: null,
  ...overrides,
});

describe("slaLevel", () => {
  it("rozliší termín podle priority", () => {
    expect(slaLevel(ticket({ priority: "NORMAL", submittedAt: hoursAgo(10) }), now)).toBe("OK");
    expect(slaLevel(ticket({ priority: "NORMAL", submittedAt: hoursAgo(80) }), now)).toBe("WARNING");
    expect(slaLevel(ticket({ priority: "NORMAL", submittedAt: hoursAgo(200) }), now)).toBe("OVERDUE");
    expect(slaLevel(ticket({ priority: "CRITICAL", submittedAt: hoursAgo(10) }), now)).toBe("WARNING");
    expect(slaLevel(ticket({ priority: "HIGH", submittedAt: hoursAgo(120) }), now)).toBe("OVERDUE");
  });

  it("neběží u ticketů čekajících na údržbu ani uzavřených", () => {
    expect(slaLevel(ticket({ status: "WAITING_APPROVAL", submittedAt: hoursAgo(500) }), now)).toBeNull();
    expect(slaLevel(ticket({ status: "APPROVED", submittedAt: hoursAgo(500) }), now)).toBeNull();
  });
});

describe("filterTickets", () => {
  const rows = [
    ticket({ id: "a", status: "SUBMITTED", submittedAt: hoursAgo(5), plantId: "jbc" }),
    ticket({ id: "b", status: "IN_PROGRESS", submittedAt: hoursAgo(50), assigneeId: "me", priority: "HIGH" }),
    ticket({ id: "c", status: "APPROVED", submittedAt: hoursAgo(900), plantId: "lbc" }),
    ticket({ id: "d", status: "WAITING_APPROVAL", submittedAt: hoursAgo(20) }),
  ];
  const ids = (filter: Partial<typeof DEFAULT_FILTER>) => filterTickets(rows, { ...DEFAULT_FILTER, ...filter }, "me").map((r) => r.id);

  it("výchozí = otevřené, nejstarší nahoře", () => expect(ids({})).toEqual(["b", "d", "a"]));
  it("nejnovější nahoře", () => expect(ids({ sort: "newest" })).toEqual(["a", "d", "b"]));
  it("uzavřené a vše", () => {
    expect(ids({ status: "closed" })).toEqual(["c"]);
    expect(ids({ status: "all" })).toHaveLength(4);
  });
  it("priorita, závod a přiřazeno mně", () => {
    expect(ids({ priority: "HIGH" })).toEqual(["b"]);
    expect(ids({ status: "all", plantId: "lbc" })).toEqual(["c"]);
    expect(ids({ mine: true })).toEqual(["b"]);
  });
});

describe("URL filtru", () => {
  it("přežije cestu tam a zpět a neznámé hodnoty ignoruje", () => {
    const filter = { status: "closed", priority: "HIGH", plantId: "lbc", mine: true, sort: "newest" } as const;
    const query = serializeTicketFilter(filter);
    expect(parseTicketFilter(new URLSearchParams(query), ["HIGH"])).toEqual(filter);
    expect(serializeTicketFilter(DEFAULT_FILTER)).toBe("");
    expect(parseTicketFilter(new URLSearchParams("status=xx&priority=YY"), ["HIGH"])).toEqual(DEFAULT_FILTER);
  });
});

describe("computeKpis", () => {
  it("spočítá stavy, uzavřené za 30 dní a průměr vyřízení", () => {
    const kpis = computeKpis(
      [
        ticket({ status: "SUBMITTED" }),
        ticket({ status: "IN_PROGRESS" }),
        ticket({ status: "WAITING_APPROVAL" }),
        ticket({ status: "APPROVED", submittedAt: hoursAgo(100), closedAt: hoursAgo(52) }),
        ticket({ status: "APPROVED", submittedAt: hoursAgo(2000), closedAt: hoursAgo(1976) }),
        ticket({ status: "CANCELLED", submittedAt: hoursAgo(30), closedAt: hoursAgo(10) }),
      ],
      now,
    );
    expect(kpis).toEqual({
      submitted: 1,
      inProgress: 1,
      waitingApproval: 1,
      closedLast30Days: 2,
      averageResolutionHours: 36,
      resolvedCount: 2,
    });
    expect(computeKpis([], now).averageResolutionHours).toBeNull();
  });
});

describe("formatDuration", () => {
  it("hodiny a dny česky", () => {
    expect(formatDuration(5.2)).toBe("5 h");
    expect(formatDuration(24)).toBe("1 den");
    expect(formatDuration(36)).toBe("1,5 dne");
    expect(formatDuration(72)).toBe("3 dny");
    expect(formatDuration(240)).toBe("10 dní");
  });
});
