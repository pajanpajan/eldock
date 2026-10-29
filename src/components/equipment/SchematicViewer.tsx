"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, Download, FileImage, Maximize, Minus, Plus } from "lucide-react";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";

import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import type { RevisionStatus, SchematicFormat } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/format";
import { PC_HEIGHT, PC_WIDTH, columnRect } from "@/lib/mock-graphics/pcschematic";
import { parseXref } from "@/lib/panel-model";
import { openSheet } from "@/lib/sheet-nav";
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

export interface BookSheet {
  number: number;
  title: string;
  pageRef: string;
  /** SVG listu vygenerované aplikací (`renderPanelSheetSvg`) – vkládá se inline kvůli klikacím odkazům. */
  svg: string;
}

/**
 * Prohlížeč dokumentace vybrané revize (`?rev=`). U rozváděčů a strojů je to vícelistová kniha
 * PCSCHEMATIC s obsahem (`?sheet=1…6`, křížové odkazy „/4.6“ otevřou list a zvýrazní sloupec)
 * a původní výkres revize od CAE (`?sheet=orig`): SVG/obrázek přes `<img>` se zoomem, PDF v `<iframe>`.
 */
export function SchematicViewer({
  revisions,
  selectedId,
  basePath,
  book,
}: {
  revisions: ViewerRevision[];
  selectedId: string;
  basePath: string;
  book?: { sheets: BookSheet[] };
}) {
  const searchParams = useSearchParams();
  const revision = revisions.find((item) => item.id === selectedId) ?? revisions[0];
  if (!revision && !book) return <p className="text-muted-foreground">Zařízení zatím nemá žádnou revizi dokumentace.</p>;

  const sheetParam = searchParams.get("sheet");
  const sheets = book?.sheets ?? [];
  const sheetNumber = sheets.length && sheetParam !== "orig" ? Math.min(sheets.length, Math.max(1, Number(sheetParam) || 1)) : 0;
  const sheet = sheets.find((entry) => entry.number === sheetNumber) ?? null;
  const column = sheet ? Number(searchParams.get("col")) || null : null;

  function onSheetClick(event: MouseEvent<HTMLDivElement>) {
    const target = (event.target as Element).closest("[data-xref]");
    const ref = target ? parseXref(target.getAttribute("data-xref") ?? "") : null;
    if (ref) openSheet(ref.sheet, ref.column);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {revision ? (
          <>
            <nav aria-label="Revize" className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
              {revisions.map((item) => (
                <Link
                  key={item.id}
                  href={`${basePath}?rev=${item.id}${sheetParam ? `&sheet=${sheetParam}` : ""}`}
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
          </>
        ) : null}
        <span className="text-sm text-muted-foreground" data-testid="sheet-indicator">
          {sheet ? `List ${sheet.number} / ${sheets.length} · ${sheet.pageRef}` : revision ? `Výkres revize · ${revision.sheetCount} ${revision.sheetCount === 1 ? "list" : "listy"} · ${formatDate(revision.createdAt)}` : ""}
        </span>
        {revision && !sheet ? (
          <Button asChild variant="outline" className="touch-target ml-auto gap-2">
            <a href={`${revision.schematicUrl}?download=1`} download>
              <Download className="size-4" />
              Stáhnout
            </a>
          </Button>
        ) : null}
        {sheet ? (
          <div className="ml-auto flex gap-1">
            <Button variant="outline" size="icon" className="touch-target" disabled={sheet.number <= 1} onClick={() => openSheet(sheet.number - 1)} aria-label="Předchozí list">
              <ChevronLeft className="size-5" />
            </Button>
            <Button variant="outline" size="icon" className="touch-target" disabled={sheet.number >= sheets.length} onClick={() => openSheet(sheet.number + 1)} aria-label="Další list">
              <ChevronRight className="size-5" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className={cn(book ? "grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)]" : undefined)}>
        {book ? (
          <nav aria-label="Obsah dokumentace" className="rounded-xl border border-border bg-card p-2">
            <p className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <BookOpen className="size-4" aria-hidden />
              Kniha PCSCHEMATIC
            </p>
            <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {sheets.map((entry) => (
                <li key={entry.number}>
                  <button
                    type="button"
                    onClick={() => openSheet(entry.number)}
                    aria-current={entry.number === sheetNumber ? "page" : undefined}
                    className={cn(
                      "touch-target flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      entry.number === sheetNumber ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span className="w-5 shrink-0 font-mono font-bold">{entry.number}</span>
                    <span className="leading-snug">{entry.title}</span>
                  </button>
                </li>
              ))}
              {revision ? (
                <li>
                  <button
                    type="button"
                    onClick={() => openSheet("orig")}
                    aria-current={!sheet ? "page" : undefined}
                    className={cn(
                      "touch-target flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      !sheet ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <FileImage className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span className="leading-snug">Původní výkres revize {revision.version} (CAE)</span>
                  </button>
                </li>
              ) : null}
            </ol>
          </nav>
        ) : null}

        {sheet ? (
          <div className="relative overflow-hidden rounded-xl border border-border bg-white">
            <TransformWrapper key={`sheet-${sheet.number}`} maxScale={8} doubleClick={{ mode: "zoomIn", step: 0.7 }} wheel={{ step: 0.12 }}>
              <TransformComponent wrapperClass="!w-full" contentClass="!w-full">
                <div className="relative w-full" style={{ aspectRatio: `${PC_WIDTH} / ${PC_HEIGHT}` }}>
                  <div
                    role="img"
                    aria-label={`List ${sheet.number}: ${sheet.title}`}
                    data-testid="pc-sheet"
                    data-sheet={sheet.number}
                    className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
                    onClick={onSheetClick}
                    // SVG generuje aplikace (`renderPanelSheetSvg`, texty escapované) – inline kvůli klikacím odkazům.
                    dangerouslySetInnerHTML={{ __html: sheet.svg }}
                  />
                  {column ? <ColumnHighlight column={column} /> : null}
                </div>
              </TransformComponent>
              <ViewerControls />
            </TransformWrapper>
          </div>
        ) : revision?.schematicFormat === "PDF" ? (
          <iframe src={revision.schematicUrl} title={revision.title} className="aspect-[1.414] w-full rounded-xl border border-border bg-white" />
        ) : revision ? (
          <div className="relative overflow-hidden rounded-xl border border-border bg-white">
            <TransformWrapper key={revision.id} maxScale={8} doubleClick={{ mode: "zoomIn", step: 0.7 }} wheel={{ step: 0.12 }}>
              <TransformComponent wrapperClass="!w-full" contentClass="!w-full">
                {/* eslint-disable-next-line @next/next/no-img-element -- soubory z /api/files; SVG přes <img> nespouští skripty */}
                <img src={revision.schematicUrl} alt={`${revision.title} ${revision.version}`} className="w-full" />
              </TransformComponent>
              <ViewerControls />
            </TransformWrapper>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Zvýraznění sloupce cíle křížového odkazu (procenta listu). */
function ColumnHighlight({ column }: { column: number }) {
  const rect = columnRect(column);
  return (
    <div
      className="pointer-events-none absolute animate-pulse rounded-sm border-2 border-amber-500 bg-amber-400/15"
      style={{ left: `${(rect.x / PC_WIDTH) * 100}%`, top: `${(rect.y / PC_HEIGHT) * 100}%`, width: `${(rect.w / PC_WIDTH) * 100}%`, height: `${(rect.h / PC_HEIGHT) * 100}%` }}
      data-testid="sheet-column-highlight"
      data-column={column}
      aria-hidden
    />
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
