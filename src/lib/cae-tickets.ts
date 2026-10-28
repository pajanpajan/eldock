import type { ChangeRequestPriority, ChangeRequestStatus } from "@/generated/prisma/enums";
import type { SlaLevel } from "@/lib/status";

// Pravidla CAE dashboardu: SLA podle stáří a priority, filtry, řazení a KPI. Čisté funkce.

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** Hranice stáří (hodiny) pro „blíží se termín“ a „po termínu“ podle priority. */
export const SLA_HOURS: Record<ChangeRequestPriority, readonly [warning: number, overdue: number]> = {
  CRITICAL: [4, 24],
  HIGH: [24, 72],
  NORMAL: [72, 168],
  LOW: [168, 336],
};

export interface TicketLike {
  status: ChangeRequestStatus;
  priority: ChangeRequestPriority;
  submittedAt: Date;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  plantId: string;
  assigneeId: string | null;
}

/**
 * SLA běží jen u ticketů, které leží na CAE (Nová / V řešení). Čekání na schválení údržbou
 * a uzavřené tickety SLA nemají → `null`.
 */
export function slaLevel(ticket: Pick<TicketLike, "status" | "priority" | "submittedAt">, now: Date): SlaLevel | null {
  if (ticket.status !== "SUBMITTED" && ticket.status !== "IN_PROGRESS") return null;
  const ageHours = (now.getTime() - ticket.submittedAt.getTime()) / HOUR;
  const [warning, overdue] = SLA_HOURS[ticket.priority];
  if (ageHours >= overdue) return "OVERDUE";
  if (ageHours >= warning) return "WARNING";
  return "OK";
}

export const STATUS_FILTERS = ["open", "SUBMITTED", "IN_PROGRESS", "WAITING_APPROVAL", "closed", "all"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export interface TicketFilter {
  status: StatusFilter;
  priority: ChangeRequestPriority | "all";
  plantId: string | "all";
  mine: boolean;
  sort: "oldest" | "newest";
}

export const DEFAULT_FILTER: TicketFilter = { status: "open", priority: "all", plantId: "all", mine: false, sort: "oldest" };

const isOpen = (status: ChangeRequestStatus) =>
  status === "SUBMITTED" || status === "IN_PROGRESS" || status === "WAITING_APPROVAL";

export function matchesStatus(status: ChangeRequestStatus, filter: StatusFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "open":
      return isOpen(status);
    case "closed":
      return !isOpen(status);
    default:
      return status === filter;
  }
}

/** Filtr + řazení podle stáří (nejstarší nahoře = nejdéle čeká). */
export function filterTickets<T extends TicketLike>(rows: readonly T[], filter: TicketFilter, userId: string): T[] {
  const result = rows.filter(
    (row) =>
      matchesStatus(row.status, filter.status) &&
      (filter.priority === "all" || row.priority === filter.priority) &&
      (filter.plantId === "all" || row.plantId === filter.plantId) &&
      (!filter.mine || row.assigneeId === userId),
  );
  const direction = filter.sort === "oldest" ? 1 : -1;
  return result.sort((a, b) => direction * (a.submittedAt.getTime() - b.submittedAt.getTime()));
}

/** Načte filtr z URL (`?status=…&priority=…&plant=…&mine=1&sort=newest`); neznámé hodnoty → výchozí. */
export function parseTicketFilter(params: URLSearchParams, priorities: readonly string[]): TicketFilter {
  const status = params.get("status");
  const priority = params.get("priority");
  return {
    status: (STATUS_FILTERS as readonly string[]).includes(status ?? "") ? (status as StatusFilter) : DEFAULT_FILTER.status,
    priority: priority && priorities.includes(priority) ? (priority as ChangeRequestPriority) : "all",
    plantId: params.get("plant") || "all",
    mine: params.get("mine") === "1",
    sort: params.get("sort") === "newest" ? "newest" : "oldest",
  };
}

/** Opak `parseTicketFilter` – jen hodnoty odlišné od výchozích. */
export function serializeTicketFilter(filter: TicketFilter): string {
  const params = new URLSearchParams();
  if (filter.status !== DEFAULT_FILTER.status) params.set("status", filter.status);
  if (filter.priority !== "all") params.set("priority", filter.priority);
  if (filter.plantId !== "all") params.set("plant", filter.plantId);
  if (filter.mine) params.set("mine", "1");
  if (filter.sort !== DEFAULT_FILTER.sort) params.set("sort", filter.sort);
  return params.toString();
}

export interface TicketKpis {
  submitted: number;
  inProgress: number;
  waitingApproval: number;
  closedLast30Days: number;
  /** Průměrná doba od nahlášení po schválení (hodiny); `null` = zatím nic schváleno. */
  averageResolutionHours: number | null;
  resolvedCount: number;
}

export function computeKpis(rows: readonly TicketLike[], now: Date): TicketKpis {
  const since = now.getTime() - 30 * DAY;
  const approved = rows.filter((row) => row.status === "APPROVED" && row.closedAt);
  const totalHours = approved.reduce((sum, row) => sum + (row.closedAt!.getTime() - row.submittedAt.getTime()) / HOUR, 0);
  return {
    submitted: rows.filter((row) => row.status === "SUBMITTED").length,
    inProgress: rows.filter((row) => row.status === "IN_PROGRESS").length,
    waitingApproval: rows.filter((row) => row.status === "WAITING_APPROVAL").length,
    closedLast30Days: rows.filter((row) => !isOpen(row.status) && row.closedAt && row.closedAt.getTime() >= since).length,
    averageResolutionHours: approved.length ? totalHours / approved.length : null,
    resolvedCount: approved.length,
  };
}

const decimal = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });

/** „5 h“, „1,5 dne“, „12 dní“. */
export function formatDuration(hours: number): string {
  if (hours < 24) return `${Math.max(1, Math.round(hours))} h`;
  const days = Math.round((hours / 24) * 10) / 10;
  if (days === 1) return "1 den";
  if (!Number.isInteger(days)) return `${decimal.format(days)} dne`;
  return days >= 2 && days <= 4 ? `${days} dny` : `${days} dní`;
}
