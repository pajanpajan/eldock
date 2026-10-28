"use client";

import Link from "next/link";
import { ArrowRight, FileText, TriangleAlert } from "lucide-react";

import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EQUIPMENT_TYPE_LABELS, formatDate, formatDateTime } from "@/lib/format";
import { equipmentHref } from "@/lib/routes";
import { CHANGE_REQUEST_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { FloorEquipment } from "@/server/queries/floor";

/** Rychlý náhled zařízení po kliknutí na pin. */
export function EquipmentQuickView({
  equipment,
  onOpenChange,
}: {
  equipment: FloorEquipment | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={equipment !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {equipment ? (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-secondary px-2 py-0.5 font-mono text-sm font-bold text-primary">{equipment.tag}</span>
                <StatusBadge kind="equipment" status={equipment.status} />
              </div>
              <SheetTitle className="text-lg">{equipment.name}</SheetTitle>
              <SheetDescription>
                {EQUIPMENT_TYPE_LABELS[equipment.type]}
                {equipment.description ? ` · ${equipment.description}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4">
              {equipment.openChange ? (
                <section className={cn("space-y-2 rounded-xl border p-3", CHANGE_REQUEST_STATUS[equipment.openChange.status].soft)}>
                  <div className="flex items-center gap-2 font-medium">
                    <TriangleAlert className="size-4" aria-hidden />
                    Otevřená změna <span className="font-mono">{equipment.openChange.number}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge kind="changeRequest" status={equipment.openChange.status} />
                    <StatusBadge kind="priority" status={equipment.openChange.priority} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Nahlásil(a) {equipment.openChange.reporter.name}, {formatDateTime(equipment.openChange.submittedAt)}
                  </p>
                  {equipment.openChange.voiceTranscript ?? equipment.openChange.note ? (
                    <blockquote className="border-l-2 border-current/40 pl-3 text-sm italic">
                      „{equipment.openChange.voiceTranscript ?? equipment.openChange.note}“
                    </blockquote>
                  ) : null}
                </section>
              ) : null}

              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Platná revize</dt>
                <dd className="flex items-center gap-1.5">
                  <FileText className="size-4 text-muted-foreground" aria-hidden />
                  {equipment.activeRevision ? (
                    <>
                      <span className="font-mono">{equipment.activeRevision.version}</span>
                      <span className="text-muted-foreground">
                        · {formatDate(equipment.activeRevision.approvedAt ?? equipment.activeRevision.createdAt)}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
                {equipment.manufacturer ? (
                  <>
                    <dt className="text-muted-foreground">Výrobce</dt>
                    <dd>
                      {equipment.manufacturer}
                      {equipment.model ? ` ${equipment.model}` : ""}
                    </dd>
                  </>
                ) : null}
                {equipment.ratedVoltage ? (
                  <>
                    <dt className="text-muted-foreground">Napětí</dt>
                    <dd>{equipment.ratedVoltage}</dd>
                  </>
                ) : null}
                {equipment.ratedCurrent ? (
                  <>
                    <dt className="text-muted-foreground">Proud</dt>
                    <dd>{equipment.ratedCurrent}</dd>
                  </>
                ) : null}
              </dl>
            </div>

            <SheetFooter>
              <Button asChild size="lg" className="touch-target w-full text-base">
                <Link href={equipmentHref(equipment.id)}>
                  Otevřít detail
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
