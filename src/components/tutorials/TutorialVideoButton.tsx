"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { chapterLabel, tutorialById, type Tutorial, type TutorialId } from "@/lib/tutorials";
import { TUTORIAL_MEDIA } from "@/lib/tutorials.generated";
import { cn } from "@/lib/utils";

import { TutorialPlayer } from "./TutorialPlayer";
import { TUTORIAL_CHAPTER_EVENT } from "@/lib/panel-builder/floorplan-wizard";

const NO_TARGETS: readonly string[] = [];

/**
 * Fáze 87: tlačítko „🎬 Video-návod“ v horní liště editoru půdorysu a AI Panel Builderu. Otevře dialog s přehrávačem
 * a kapitolami; u editoru půdorysu a v projektu rozváděče (`tour`, fáze 98) navíc přepínač Interactive Tour – přehrávač
 * se přesune do rohu obrazovky a prvky, o kterých kapitola mluví (`TutorialChapter.targets`), se na skutečné obrazovce
 * živě zvýrazní (v projektu rozváděče kroková karta fáze kapitoly).
 */
export function TutorialVideoButton({ tutorialId, tour = false, size = "sm", className }: { tutorialId: TutorialId; tour?: boolean; size?: "sm" | "default"; className?: string }) {
  const tutorial = tutorialById(tutorialId);
  const media = TUTORIAL_MEDIA[tutorialId];
  const [open, setOpen] = useState(false);
  const [touring, setTouring] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [resume, setResume] = useState({ at: 0, playing: false });
  const [time, setTime] = useState({ at: 0, playing: false });

  // Fáze 89: v Interactive Tour přepne průvodce 2D půdorysem na krok kapitoly, ať jsou zvýrazněné prvky na obrazovce
  useEffect(() => {
    if (touring) window.dispatchEvent(new CustomEvent(TUTORIAL_CHAPTER_EVENT, { detail: { tutorialId, chapter } }));
  }, [touring, chapter, tutorialId]);

  const startTour = () => {
    setResume(time);
    setTouring(true);
    setOpen(false);
  };
  const stopTour = () => {
    setResume(time);
    setTouring(false);
    setOpen(true);
  };

  return (
    <>
      <Button type="button" variant="outline" size={size} className={cn("gap-1.5 border-primary/50 text-foreground", className)} onClick={() => (touring ? stopTour() : setOpen(true))} data-testid="tutorial-open">
        🎬 Video-návod
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // po zavření se video při dalším otevření rozběhne tam, kde divák skončil
          if (!next) setResume({ at: time.at, playing: false });
          setOpen(next);
        }}
      >
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl" data-testid="tutorial-dialog">
          <DialogHeader>
            <DialogTitle>🎬 Video-návod: {tutorial.title}</DialogTitle>
            <DialogDescription>{tutorial.description}</DialogDescription>
          </DialogHeader>
          {open ? <TutorialPlayer tutorial={tutorial} media={media} startAt={resume.at} autoPlay={resume.playing} onChapter={setChapter} onTime={(at, playing) => setTime({ at, playing })} /> : null}
          <div className="flex flex-wrap items-center gap-2">
            {tour ? (
              <label className="mr-auto flex cursor-pointer items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-sm font-medium" data-testid="tutorial-tour-toggle">
                <input type="checkbox" role="switch" checked={touring} onChange={(event) => (event.target.checked ? startTour() : stopTour())} className="size-4 accent-[var(--primary)]" />
                <Sparkles className="size-4 text-primary" aria-hidden /> Živé zvýraznění prvků na obrazovce (Interactive Tour)
              </label>
            ) : null}
            <Button asChild variant="outline" size="sm" className={cn("gap-1.5", tour ? "" : "mr-auto")}>
              <a href={tutorial.file} download>
                <Download className="size-4" aria-hidden /> Stáhnout MP4
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/navody" target="_blank">
                <ExternalLink className="size-4" aria-hidden /> Všechny video-návody
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* portál do <body>: obal stránky má animovaný transform a `position: fixed` by se počítalo od něj, ne od okna */}
      {touring
        ? createPortal(<TourDock tutorial={tutorial} chapter={chapter} resume={resume} onChapter={setChapter} onTime={(at, playing) => setTime({ at, playing })} onClose={() => (setTouring(false), setResume(time))} onExpand={stopTour} />, document.body)
        : null}
    </>
  );
}

/** Interactive Tour: malý přehrávač v rohu + zvýraznění prvků aktuální kapitoly přímo v aplikaci. */
function TourDock({
  tutorial,
  chapter,
  resume,
  onChapter,
  onTime,
  onClose,
  onExpand,
}: {
  tutorial: Tutorial;
  chapter: number;
  resume: { at: number; playing: boolean };
  onChapter: (index: number) => void;
  onTime: (at: number, playing: boolean) => void;
  onClose: () => void;
  onExpand: () => void;
}) {
  const media = TUTORIAL_MEDIA[tutorial.id];
  const targets = tutorial.chapters[chapter]?.targets ?? NO_TARGETS;
  return (
    <>
      <TourHighlights key={chapter} targets={targets} label={tutorial.chapters[chapter] ? chapterLabel(tutorial, chapter) : ""} />
      <aside className="fixed right-3 bottom-3 z-[60] flex w-[min(440px,calc(100vw-1.5rem))] flex-col gap-2 rounded-2xl border border-primary/50 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur" aria-label="Interactive Tour video-návodu" data-testid="tutorial-tour">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden /> Interactive Tour
          <button type="button" onClick={onExpand} className="ml-auto rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            Zvětšit
          </button>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Ukončit Interactive Tour" data-testid="tutorial-tour-close">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <TutorialPlayer tutorial={tutorial} media={media} startAt={resume.at} autoPlay={resume.playing} compact onChapter={onChapter} onTime={onTime} />
        </div>
      </aside>
    </>
  );
}

/** Pulzující rámečky kolem prvků kapitoly (pozice se sleduje při posunu stránky a změnách rozvržení). */
function TourHighlights({ targets, label }: { targets: readonly string[]; label: string }) {
  const [boxes, setBoxes] = useState<{ top: number; left: number; width: number; height: number }[]>([]);

  useEffect(() => {
    const find = () => targets.flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)].slice(0, 1)).filter((element) => element.getClientRects().length > 0);
    const first = find()[0];
    first?.scrollIntoView({ block: "center", behavior: "smooth" });
    let frame = 0;
    const measure = () => {
      const next = find().map((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 };
      });
      setBoxes((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
      frame = window.requestAnimationFrame(measure);
    };
    frame = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(frame);
  }, [targets]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[55]" aria-hidden data-testid="tutorial-highlights">
      {boxes.map((box, index) => (
        <div key={index} className="absolute rounded-xl border-[3px] border-primary shadow-[0_0_0_4px_rgba(250,204,21,0.25),0_0_32px_rgba(250,204,21,0.45)] motion-safe:animate-pulse" style={box} data-testid="tutorial-highlight">
          {index === 0 ? <span className="absolute -top-7 left-0 max-w-[70vw] truncate rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground shadow-lg">🎬 {label}</span> : null}
        </div>
      ))}
    </div>
  );
}
