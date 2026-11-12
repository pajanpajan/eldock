"use client";

import { useEffect, useRef, useState } from "react";

import { chapterMark, formatClock, posterOf, type Tutorial } from "@/lib/tutorials";
import type { TutorialMedia } from "@/lib/tutorials.generated";
import { cn } from "@/lib/utils";

/** Index kapitoly, ve které je čas `seconds` (začátky kapitol vzestupně). */
export function chapterAt(starts: readonly number[], seconds: number): number {
  let index = 0;
  starts.forEach((start, at) => {
    if (seconds + 0.05 >= start) index = at;
  });
  return index;
}

/**
 * Fáze 87: HTML5 přehrávač video-návodu s klikacími kapitolami (přetočí `video.currentTime` na začátek kapitoly).
 * Používá ho veřejná stránka `/navody` i dialog „🎬 Video-návod“ v editoru půdorysu a v AI Panel Builderu.
 */
export function TutorialPlayer({
  tutorial,
  media,
  startAt = 0,
  autoPlay = false,
  compact = false,
  onChapter,
  onTime,
}: {
  tutorial: Tutorial;
  media: TutorialMedia | undefined;
  /** Čas, od kterého se má přehrávat (přechod mezi dialogem a Interactive Tour). */
  startAt?: number;
  autoPlay?: boolean;
  compact?: boolean;
  onChapter?: (index: number) => void;
  onTime?: (seconds: number, playing: boolean) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const starts = media?.chapters ?? tutorial.chapters.map(() => 0);
  const [current, setCurrent] = useState(() => chapterAt(starts, startAt));
  const reported = useRef(current);

  useEffect(() => {
    const element = video.current;
    if (!element || startAt <= 0) return;
    const jump = () => {
      element.currentTime = startAt;
      if (autoPlay) void element.play().catch(() => {});
    };
    if (element.readyState >= 1) jump();
    else element.addEventListener("loadedmetadata", jump, { once: true });
    return () => element.removeEventListener("loadedmetadata", jump);
  }, [startAt, autoPlay]);

  const update = () => {
    const element = video.current;
    if (!element) return;
    const index = chapterAt(starts, element.currentTime);
    if (index !== reported.current) {
      reported.current = index;
      setCurrent(index);
      onChapter?.(index);
    }
    onTime?.(element.currentTime, !element.paused);
  };

  const seek = (index: number) => {
    const element = video.current;
    if (!element) return;
    element.currentTime = starts[index] ?? 0;
    void element.play().catch(() => {});
    reported.current = index;
    setCurrent(index);
    onChapter?.(index);
  };

  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")} data-testid={`tutorial-${tutorial.id}`}>
      <video
        ref={video}
        controls
        preload="metadata"
        playsInline
        autoPlay={autoPlay && startAt <= 0}
        poster={posterOf(tutorial.file)}
        className="aspect-video w-full rounded-xl border border-border bg-black shadow-xl"
        onTimeUpdate={update}
        onSeeked={update}
        onPause={update}
        data-testid={`tutorial-video-${tutorial.id}`}
      >
        <source src={tutorial.file} type="video/mp4" />
        Váš prohlížeč video nepřehraje – <a href={tutorial.file}>stáhněte si MP4</a>.
      </video>
      <ol className={cn("grid gap-1.5", compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-5")} aria-label={`Kapitoly – ${tutorial.title}`}>
        {tutorial.chapters.map((chapter, index) => (
          <li key={chapter.id}>
            <button
              type="button"
              onClick={() => seek(index)}
              aria-current={current === index ? "step" : undefined}
              className={cn(
                "flex h-full w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                current === index ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card/60 text-muted-foreground hover:border-primary/60 hover:text-foreground",
              )}
              data-testid="tutorial-chapter"
              data-start={starts[index] ?? 0}
              data-phase={chapter.phase}
            >
              {/* Fáze 98: ve videu AI Panel Builderu kolečko = číslo fáze projektu (▶ = úvod), jako krokové karty v aplikaci */}
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold", current === index ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>{chapterMark(tutorial, index)}</span>
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block font-semibold text-foreground">{chapter.title}</span>
                <span className="font-mono text-[11px]">{formatClock(starts[index] ?? 0)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
