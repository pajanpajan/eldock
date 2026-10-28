import Link from "next/link";
import { ArrowRight, Hourglass, Mic, TriangleAlert } from "lucide-react";

import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatRelative } from "@/lib/format";
import { parseMarkup } from "@/lib/markup";
import { EQUIPMENT_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { EquipmentRevision, OpenChangeRequest } from "@/server/queries/equipment";

import { MarkupPreview } from "./MarkupPreview";
import { PhotoGallery } from "./PhotoGallery";

/**
 * Výstraha pro další směny. Oranžová: změna nahlášená, výkres zatím neodpovídá skutečnosti
 * (fotky, přepis, zákres). Modrá: CAE nahrál novou revizi a čeká se na potvrzení údržbou.
 */
export function SafetyBanner({
  change,
  pendingRevision,
  reviewHref,
  now,
}: {
  change: OpenChangeRequest;
  pendingRevision: EquipmentRevision | null;
  reviewHref: string;
  now: Date;
}) {
  if (change.status === "WAITING_APPROVAL") {
    const style = EQUIPMENT_STATUS.WAITING_APPROVAL;
    return (
      <section
        aria-label="Nová revize čeká na schválení"
        className={cn("flex flex-col gap-4 rounded-xl border-2 p-4 sm:flex-row sm:items-center sm:p-5", style.soft)}
      >
        <Hourglass className={cn("size-8 shrink-0", style.text)} aria-hidden />
        <div className="flex-1 space-y-1">
          <h2 className="text-lg font-semibold">
            Nová revize {pendingRevision?.version ?? ""} čeká na vaše potvrzení
          </h2>
          <p className="text-sm text-muted-foreground">
            {pendingRevision
              ? `${pendingRevision.author.name} nahrál(a) revizi ${formatRelative(pendingRevision.createdAt, now)} k požadavku ${change.number}.`
              : `Požadavek ${change.number} čeká na schválení.`}
            {pendingRevision?.summary ? ` „${pendingRevision.summary}“` : ""}
          </p>
        </div>
        <Button asChild size="lg" className="touch-target gap-2 bg-sky-500 text-sky-950 hover:bg-sky-400">
          <Link href={reviewHref}>
            Zkontrolovat novou revizi
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>
    );
  }

  const style = EQUIPMENT_STATUS.PENDING_UPDATE;
  const photos = change.attachments.filter((attachment) => attachment.type === "PHOTO");
  const markup = parseMarkup(change.markupData);
  const transcript = change.voiceTranscript ?? change.note;
  const shift = change.reporter.company?.split("–").pop()?.trim();

  return (
    <section
      aria-label="Výstraha: nahlášená změna"
      role="alert"
      className={cn("space-y-4 rounded-xl border-2 p-4 sm:p-5", style.soft, "border-orange-500/70")}
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className={cn("mt-0.5 size-8 shrink-0", style.text)} aria-hidden />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-orange-200 sm:text-xl">
            Pozor – nahlášená změna. Oficiální výkres zatím neodpovídá skutečnosti.
          </h2>
          <p className="text-sm text-orange-100/80">
            {change.reporter.name}
            {shift ? ` (${shift})` : ""} · {formatDateTime(change.submittedAt)} ({formatRelative(change.submittedAt, now)}) ·
            požadavek <span className="font-mono">{change.number}</span>
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <StatusBadge kind="changeRequest" status={change.status} />
            <StatusBadge kind="priority" status={change.priority} />
            {change.assignee ? (
              <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                Řeší: {change.assignee.name}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {markup && change.baseRevision ? (
          <figure className="space-y-2">
            <figcaption className="text-xs font-medium tracking-wide text-orange-200/90 uppercase">
              Zákres technika nad revizí {change.baseRevision.version}
            </figcaption>
            <MarkupPreview src={change.baseRevision.schematicUrl} markup={markup} alt={`Schéma ${change.baseRevision.version} se zákresem změny`} />
          </figure>
        ) : null}
        <div className="space-y-4">
          {transcript ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-orange-200/90 uppercase">
                <Mic className="size-3.5" aria-hidden />
                Přepis poznámky
              </div>
              <blockquote className="rounded-lg border-l-4 border-orange-400 bg-zinc-950/50 p-3 text-base">„{transcript}“</blockquote>
            </div>
          ) : null}
          {photos.length ? (
            <div className="space-y-1.5">
              <div className="text-xs font-medium tracking-wide text-orange-200/90 uppercase">Fotky z haly ({photos.length})</div>
              <PhotoGallery photos={photos.map(({ id, url, caption }) => ({ id, url, caption }))} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
