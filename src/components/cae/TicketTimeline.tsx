import { ArrowRight } from "lucide-react";

import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDateTime, formatRelative } from "@/lib/format";
import { CHANGE_REQUEST_EVENT } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { TicketEvent } from "@/server/queries/cae";

/** Timeline událostí ticketu (stavový automat + komentáře), nejstarší nahoře. */
export function TicketTimeline({ events, now }: { events: TicketEvent[]; now: Date }) {
  return (
    <ol className="space-y-4" aria-label="Historie ticketu">
      {events.map((event) => {
        const style = CHANGE_REQUEST_EVENT[event.type];
        const Icon = style.icon;
        const fromCae = event.actor.role === "CAE_ENGINEER";
        return (
          <li key={event.id} className="relative flex gap-3">
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border", style.badge)} aria-hidden>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-medium">{style.label}</span>
                {event.revision ? <span className="font-mono text-sm text-primary">{event.revision.version}</span> : null}
                <time dateTime={event.createdAt.toISOString()} title={formatDateTime(event.createdAt)} className="ml-auto text-xs text-muted-foreground">
                  {formatRelative(event.createdAt, now)}
                </time>
              </div>
              <div className="text-xs text-muted-foreground">
                {event.actor.name} · {fromCae ? "CAE" : "údržba"} · {formatDateTime(event.createdAt)}
              </div>
              {event.fromStatus && event.toStatus && event.fromStatus !== event.toStatus ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge kind="changeRequest" status={event.fromStatus} plain />
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-label="na" />
                  <StatusBadge kind="changeRequest" status={event.toStatus} plain />
                </div>
              ) : null}
              {event.comment ? (
                <p
                  className={cn(
                    "rounded-lg border p-2.5 text-sm whitespace-pre-line",
                    event.type === "REJECTED" ? style.soft : fromCae ? "border-border bg-muted/40" : "border-border bg-card",
                  )}
                >
                  {event.comment}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
