import Link from "next/link";
import { Download, Eye, MessageSquareWarning } from "lucide-react";

import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";
import { REVISION_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { EquipmentRevision } from "@/server/queries/equipment";

/** Historie změn: revize od nejnovější s autorem, schvalovatelem, shrnutím a důvodem vrácení. */
export function RevisionTimeline({
  revisions,
  basePath,
  selectedId,
}: {
  revisions: EquipmentRevision[];
  basePath: string;
  selectedId: string | null;
}) {
  return (
    <ol className="relative space-y-4 border-l-2 border-border pl-6" aria-label="Historie revizí">
      {revisions.map((revision) => {
        const style = REVISION_STATUS[revision.status];
        return (
          <li key={revision.id} className="relative">
            <span className={cn("absolute top-5 -left-[33px] size-4 rounded-full border-4 border-background", style.dot)} aria-hidden />
            <article
              className={cn(
                "space-y-2 rounded-xl border bg-card p-4",
                revision.id === selectedId ? "border-primary/60" : "border-border",
              )}
            >
              <header className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xl font-bold">{revision.version}</span>
                <StatusBadge kind="revision" status={revision.status} />
                {revision.changeRequest ? (
                  <span className="rounded-full border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground">
                    {revision.changeRequest.number}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Výchozí digitalizace</span>
                )}
                <span className="ml-auto text-sm text-muted-foreground">{formatDate(revision.createdAt)}</span>
              </header>

              {revision.summary ? <p className="text-sm">{revision.summary}</p> : null}

              {revision.status === "REJECTED" && revision.rejectionComment ? (
                <p className={cn("flex items-start gap-2 rounded-lg border p-2.5 text-sm", style.soft)}>
                  <MessageSquareWarning className={cn("mt-0.5 size-4 shrink-0", style.text)} aria-hidden />
                  <span>
                    <span className="font-medium">Vráceno k přepracování: </span>
                    {revision.rejectionComment}
                  </span>
                </p>
              ) : null}

              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Autor:</dt>
                  <dd>{revision.author.name}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">
                    {revision.status === "REJECTED" ? "Vrátil(a):" : "Schválil(a):"}
                  </dt>
                  <dd>
                    {revision.approver
                      ? `${revision.approver.name}${revision.approvedAt ? `, ${formatDateTime(revision.approvedAt)}` : ""}`
                      : "—"}
                  </dd>
                </div>
              </dl>

              <footer className="flex flex-wrap gap-2 pt-1">
                <Button asChild variant="outline" className="touch-target gap-2">
                  <Link href={`${basePath}?rev=${revision.id}&tab=schema`} scroll={false}>
                    <Eye className="size-4" />
                    Zobrazit
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="touch-target gap-2">
                  <a href={`${revision.schematicUrl}?download=1`} download>
                    <Download className="size-4" />
                    Stáhnout schéma
                  </a>
                </Button>
              </footer>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
