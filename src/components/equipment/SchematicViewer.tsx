"use client";

import Link from "next/link";
import { Download, Maximize, Minus, Plus } from "lucide-react";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";

import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import type { RevisionStatus, SchematicFormat } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ViewerRevision {
  id: string;
  version: string;
  status: RevisionStatus;
  title: string;
  schematicUrl: string;
  schematicFormat: SchematicFormat;
  sheetCount: number;
  createdAt: Date;
}

/** Prohlížeč schématu vybrané revize (`?rev=`): SVG/obrázek přes `<img>` se zoomem, PDF v `<iframe>`. */
export function SchematicViewer({
  revisions,
  selectedId,
  basePath,
}: {
  revisions: ViewerRevision[];
  selectedId: string;
  basePath: string;
}) {
  const revision = revisions.find((item) => item.id === selectedId) ?? revisions[0];
  if (!revision) return <p className="text-muted-foreground">Zařízení zatím nemá žádnou revizi dokumentace.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Revize" className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          {revisions.map((item) => (
            <Link
              key={item.id}
              href={`${basePath}?rev=${item.id}`}
              scroll={false}
              replace
              aria-current={item.id === revision.id ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-lg px-3 font-mono text-sm",
                item.id === revision.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                item.status === "REJECTED" && item.id !== revision.id && "line-through decoration-red-400/70",
              )}
              title={`${item.version} – ${formatDate(item.createdAt)}`}
            >
              {item.version}
            </Link>
          ))}
        </nav>
        <StatusBadge kind="revision" status={revision.status} />
        <span className="text-sm text-muted-foreground">
          List 1 / {revision.sheetCount} · {formatDate(revision.createdAt)}
        </span>
        <Button asChild variant="outline" className="touch-target ml-auto gap-2">
          <a href={`${revision.schematicUrl}?download=1`} download>
            <Download className="size-4" />
            Stáhnout
          </a>
        </Button>
      </div>

      {revision.schematicFormat === "PDF" ? (
        <iframe src={revision.schematicUrl} title={revision.title} className="aspect-[1.414] w-full rounded-xl border border-border bg-white" />
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-border bg-white">
          <TransformWrapper key={revision.id} maxScale={8} doubleClick={{ mode: "zoomIn", step: 0.7 }} wheel={{ step: 0.12 }}>
            <TransformComponent wrapperClass="!w-full" contentClass="!w-full">
              {/* eslint-disable-next-line @next/next/no-img-element -- soubory z /api/files; SVG přes <img> nespouští skripty */}
              <img src={revision.schematicUrl} alt={`${revision.title} ${revision.version}`} className="w-full" />
            </TransformComponent>
            <ViewerControls />
          </TransformWrapper>
        </div>
      )}
    </div>
  );
}

function ViewerControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute top-3 right-3 flex gap-1 rounded-xl border border-border bg-zinc-950/90 p-1 shadow-lg">
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => zoomIn(0.5)} aria-label="Přiblížit">
        <Plus className="size-5" />
      </Button>
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => zoomOut(0.5)} aria-label="Oddálit">
        <Minus className="size-5" />
      </Button>
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => resetTransform()} aria-label="Celý list">
        <Maximize className="size-4" />
      </Button>
    </div>
  );
}
