// Fáze 100: plynulých 60 FPS na plátně 2D půdorysu – pohyb myši se zpracuje nejvýš jednou za snímek
// (requestAnimationFrame): z dávky událostí v jednom snímku platí poslední poloha. Puštění tlačítka (`flush`) zpracuje
// čekající polohu hned, aby tažení skončilo přesně tam, kde je ukazatel. Čistá logika bez Reactu (testuje se s vlastním
// plánovačem snímků).

export interface FrameThrottle<T> {
  /** Nová poloha – zpracuje se v příštím snímku (starší čekající se zahodí). */
  push: (sample: T) => void;
  /** Čeká poloha na zpracování? */
  pending: () => boolean;
  /** Zpracuje čekající polohu hned (true = byla nějaká). */
  flush: () => boolean;
  /** Zahodí čekající polohu (ukazatel opustil plátno, odpojení komponenty). */
  cancel: () => void;
}

export function frameThrottle<T>(
  run: (sample: T) => void,
  schedule: (callback: () => void) => number = (callback) => window.requestAnimationFrame(callback),
  unschedule: (handle: number) => void = (handle) => window.cancelAnimationFrame(handle),
): FrameThrottle<T> {
  let frame: number | null = null;
  let queued: { sample: T } | null = null;
  const take = () => {
    const next = queued;
    queued = null;
    if (next) run(next.sample);
    return Boolean(next);
  };
  return {
    push(sample) {
      queued = { sample };
      if (frame === null)
        frame = schedule(() => {
          frame = null;
          take();
        });
    },
    pending: () => queued !== null,
    flush() {
      if (frame !== null) unschedule(frame);
      frame = null;
      return take();
    },
    cancel() {
      if (frame !== null) unschedule(frame);
      frame = null;
      queued = null;
    },
  };
}
