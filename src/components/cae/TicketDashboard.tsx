"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Camera, Inbox, UserRound, X } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ChangeRequestPriority } from "@/generated/prisma/enums";
import {
  DEFAULT_FILTER,
  SLA_HOURS,
  filterTickets,
  formatDuration,
  matchesStatus,
  serializeTicketFilter,
  slaLevel,
  type StatusFilter,
  type TicketFilter,
} from "@/lib/cae-tickets";
import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { formatDateTime, formatRelative } from "@/lib/format";
import { caeTicketHref } from "@/lib/routes";
import { CHANGE_REQUEST_PRIORITY, CHANGE_REQUEST_STATUS, SLA_LEVEL } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { CaeTicketRow } from "@/server/queries/cae";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Otevřené" },
  { value: "SUBMITTED", label: CHANGE_REQUEST_STATUS.SUBMITTED.label },
  { value: "IN_PROGRESS", label: CHANGE_REQUEST_STATUS.IN_PROGRESS.label },
  { value: "WAITING_APPROVAL", label: CHANGE_REQUEST_STATUS.WAITING_APPROVAL.label },
  { value: "closed", label: "Uzavřené" },
  { value: "all", label: "Vše" },
];

const PRIORITIES: ChangeRequestPriority[] = ["CRITICAL", "HIGH", "NORMAL", "LOW"];

function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-11 items-center gap-2 rounded-full border px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? (className ?? "border-primary/60 bg-primary/15 text-primary") : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Dashboard ticketů napříč závody: filtry (stav, priorita, závod, přiřazeno mně), řazení podle stáří, SLA. */
export function TicketDashboard({
  tickets,
  plants,
  userId,
  initialFilter,
  now,
}: {
  tickets: CaeTicketRow[];
  plants: { id: string; code: string; name: string }[];
  userId: string;
  initialFilter: TicketFilter;
  now: Date;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState(initialFilter);
  const rows = useMemo(() => filterTickets(tickets, filter, userId), [tickets, filter, userId]);

  function update(patch: Partial<TicketFilter>) {
    const next = { ...filter, ...patch };
    setFilter(next);
    const query = serializeTicketFilter(next);
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  const countFor = (status: StatusFilter) => tickets.filter((ticket) => matchesStatus(ticket.status, status)).length;
  const filtered = serializeTicketFilter({ ...filter, sort: DEFAULT_FILTER.sort }) !== "";

  return (
    <section aria-labelledby="tickets-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="tickets-title" className="text-lg font-semibold">
          Požadavky na změnu
        </h2>
        <Button
          variant="outline"
          className="touch-target gap-2"
          onClick={() => update({ sort: filter.sort === "oldest" ? "newest" : "oldest" })}
          aria-label={filter.sort === "oldest" ? "Řazeno od nejstarších, přepnout na nejnovější" : "Řazeno od nejnovějších, přepnout na nejstarší"}
        >
          {filter.sort === "oldest" ? <ArrowDownWideNarrow className="size-4" /> : <ArrowUpNarrowWide className="size-4" />}
          {filter.sort === "oldest" ? "Nejdéle čekající nahoře" : "Nejnovější nahoře"}
        </Button>
      </div>

      <div className="space-y-2">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtr stavu">
          {STATUS_OPTIONS.map((option) => (
            <Chip key={option.value} active={filter.status === option.value} onClick={() => update({ status: option.value })}>
              {option.label}
              <span className="font-mono text-xs tabular-nums opacity-80">{countFor(option.value)}</span>
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtr priority">
            {PRIORITIES.map((priority) => {
              const style = CHANGE_REQUEST_PRIORITY[priority];
              return (
                <Chip
                  key={priority}
                  active={filter.priority === priority}
                  className={style.badge}
                  onClick={() => update({ priority: filter.priority === priority ? "all" : priority })}
                >
                  <style.icon className="size-4" aria-hidden />
                  {style.label}
                </Chip>
              );
            })}
          </div>
          <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtr závodu">
            {plants.map((plant) => (
              <Chip key={plant.id} active={filter.plantId === plant.id} onClick={() => update({ plantId: filter.plantId === plant.id ? "all" : plant.id })}>
                <span className="font-mono text-xs">{plant.code}</span>
                {plant.name}
              </Chip>
            ))}
          </div>
          <Chip active={filter.mine} onClick={() => update({ mine: !filter.mine })}>
            <UserRound className="size-4" aria-hidden />
            Přiřazeno mně
          </Chip>
          {filtered ? (
            <Button variant="ghost" className="touch-target gap-1" onClick={() => update({ ...DEFAULT_FILTER, sort: filter.sort })}>
              <X className="size-4" />
              Zrušit filtry
            </Button>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Inbox} title="Žádné tickety" description="Filtru neodpovídá žádný požadavek na změnu." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Zařízení</TableHead>
                <TableHead className="hidden xl:table-cell">Lokace</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead className="hidden md:table-cell">Priorita</TableHead>
                <TableHead>Stáří</TableHead>
                <TableHead className="hidden lg:table-cell">Řeší</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((ticket) => {
                const sla = slaLevel(ticket, now);
                const slaStyle = sla ? SLA_LEVEL[sla] : null;
                const { equipment } = ticket;
                const Icon = EQUIPMENT_TYPE_ICONS[equipment.type];
                const href = caeTicketHref(ticket.id);
                const text = ticket.voiceTranscript ?? ticket.note;
                return (
                  <TableRow
                    key={ticket.id}
                    className={cn("cursor-pointer", ticket.status === "SUBMITTED" && "bg-orange-500/5")}
                    onClick={() => router.push(href)}
                  >
                    <TableCell className="py-3 align-top">
                      <Link
                        href={href}
                        className="rounded font-mono font-semibold whitespace-nowrap text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {ticket.number}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted-foreground">{ticket.reporter.name}</div>
                    </TableCell>
                    <TableCell className="max-w-[18rem] py-3 align-top whitespace-normal">
                      <div className="flex items-center gap-2 font-medium">
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="font-mono">{equipment.tag}</span>
                        {ticket._count.attachments ? (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground" title="Počet příloh">
                            <Camera className="size-3.5" aria-hidden />
                            {ticket._count.attachments}
                          </span>
                        ) : null}
                      </div>
                      {text ? <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">„{text}“</p> : null}
                      <p className="mt-0.5 text-xs text-muted-foreground xl:hidden">
                        {equipment.floor.building.plant.code} · {equipment.floor.building.name}
                      </p>
                    </TableCell>
                    <TableCell className="hidden py-3 align-top text-sm whitespace-normal xl:table-cell">
                      <div>{equipment.floor.building.plant.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {equipment.floor.building.name} · {equipment.floor.name}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 align-top">
                      <StatusBadge kind="changeRequest" status={ticket.status} />
                    </TableCell>
                    <TableCell className="hidden py-3 align-top md:table-cell">
                      <StatusBadge kind="priority" status={ticket.priority} />
                    </TableCell>
                    <TableCell className="py-3 align-top">
                      <div className="flex items-center gap-2 text-sm whitespace-nowrap" title={`Nahlášeno ${formatDateTime(ticket.submittedAt)}${slaStyle ? ` · ${slaStyle.label}` : ""}`}>
                        <span className={cn("size-2.5 shrink-0 rounded-full", slaStyle?.dot ?? "bg-transparent")} aria-hidden />
                        <span className={slaStyle?.text}>{formatRelative(ticket.submittedAt, now)}</span>
                      </div>
                      {slaStyle && sla !== "OK" ? <div className={cn("mt-0.5 pl-4.5 text-xs", slaStyle.text)}>{slaStyle.label}</div> : null}
                    </TableCell>
                    <TableCell className="hidden py-3 align-top text-sm lg:table-cell">
                      {ticket.assignee ? (
                        <span className={cn(ticket.assigneeId === userId && "font-medium text-primary")}>
                          {ticket.assigneeId === userId ? "Já" : ticket.assignee.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Nepřiřazeno</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Barva stáří: {SLA_LEVEL.OK.label} · {SLA_LEVEL.WARNING.label} · {SLA_LEVEL.OVERDUE.label}. Lhůty podle priority:{" "}
        {PRIORITIES.map((priority) => `${CHANGE_REQUEST_PRIORITY[priority].label.toLowerCase()} ${SLA_HOURS[priority].map(formatDuration).join(" / ")}`).join(", ")}.
        U ticketů čekajících na schválení údržbou se nepočítají.
      </p>
    </section>
  );
}
