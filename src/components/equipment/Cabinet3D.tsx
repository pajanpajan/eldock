"use client";

import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { DoorClosed, DoorOpen, RotateCcw, RotateCw, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { layoutCabinet, type BomLike, type CabinetModule, type CabinetModuleKind } from "@/lib/mock-graphics/cabinet";
import { cn } from "@/lib/utils";

// Rozměry skříně v px scény a šířka 1 TE.
const W = 320;
const H = 440;
const D = 150;
const TE = 11;
const DEFAULT_VIEW = { rx: -10, ry: -30 };

const MODULE_STYLE: Record<CabinetModuleKind, string> = {
  switch: "bg-zinc-200 border-zinc-400",
  breaker: "bg-zinc-100 border-zinc-400",
  contactor: "bg-zinc-300 border-zinc-500",
  psu: "bg-zinc-700 border-zinc-500",
  plc: "bg-slate-800 border-sky-700",
  terminal: "bg-[repeating-linear-gradient(90deg,#9ca3af_0_3px,#6b7280_3px_4px)] border-zinc-500",
  other: "bg-zinc-400 border-zinc-500",
};

/** Jednoduchý CSS 3D náhled rozváděče: otáčení tažením / tlačítky, dvířka, DIN lišty s moduly podle kusovníku. */
export function Cabinet3D({ bom, tag }: { bom: BomLike[]; tag: string }) {
  const rails = useMemo(() => layoutCabinet(bom), [bom]);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, ...view };
    setDragging(true);
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const { x, y, rx, ry } = drag.current;
    setView({
      ry: ry + (event.clientX - x) * 0.4,
      rx: Math.max(-35, Math.min(25, rx - (event.clientY - y) * 0.3)),
    });
  }
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const face = (style: CSSProperties, className: string, children?: React.ReactNode) => (
    <div className={cn("absolute top-1/2 left-1/2 [backface-visibility:visible]", className)} style={style}>
      {children}
    </div>
  );
  const railGap = (H - 60) / Math.max(rails.length, 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="touch-target gap-2" onClick={() => setOpen((value) => !value)} aria-pressed={open}>
          {open ? <DoorClosed className="size-4" /> : <DoorOpen className="size-4" />}
          {open ? "Zavřít dvířka" : "Otevřít dvířka"}
        </Button>
        <Button variant="outline" size="icon" className="touch-target" onClick={() => setView((v) => ({ ...v, ry: v.ry - 30 }))} aria-label="Otočit doleva">
          <RotateCcw className="size-4" />
        </Button>
        <Button variant="outline" size="icon" className="touch-target" onClick={() => setView((v) => ({ ...v, ry: v.ry + 30 }))} aria-label="Otočit doprava">
          <RotateCw className="size-4" />
        </Button>
        <Button variant="ghost" className="touch-target gap-2" onClick={() => setView(DEFAULT_VIEW)}>
          <Undo2 className="size-4" />
          Výchozí pohled
        </Button>
      </div>

      <div
        className="relative h-[580px] cursor-grab touch-none overflow-hidden rounded-xl border border-border bg-[radial-gradient(ellipse_at_center,#1f2937_0%,#0b0f13_70%)] select-none active:cursor-grabbing"
        style={{ perspective: 1400 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="img"
        aria-label={`3D náhled rozváděče ${tag}: ${rails.flat().length} modulů na ${rails.length} DIN lištách. Tažením otočíte.`}
      >
        <div
          className="absolute top-1/2 left-1/2 size-0 [transform-style:preserve-3d]"
          style={{ transform: `rotateX(${view.rx}deg) rotateY(${view.ry}deg)`, transition: dragging ? "none" : "transform 300ms ease-out" }}
        >
          {/* Zadní stěna s montážní deskou, lištami a moduly */}
          {face(
            { width: W, height: H, transform: `translate(-50%, -50%) translateZ(${-D / 2}px)` },
            "rounded-sm border border-zinc-600 bg-zinc-500 [transform-style:preserve-3d]",
            <div className="absolute inset-3 flex flex-col justify-around rounded-sm bg-[#c8b88a] px-4 py-3 [transform-style:preserve-3d]">
              {rails.map((rail, index) => (
                <Rail key={index} modules={rail} height={railGap} />
              ))}
            </div>,
          )}
          {/* Boky, strop, dno */}
          {face({ width: D, height: H, transform: `translate(-50%, -50%) rotateY(-90deg) translateZ(${W / 2}px)` }, "border border-zinc-600 bg-zinc-600")}
          {face({ width: D, height: H, transform: `translate(-50%, -50%) rotateY(90deg) translateZ(${W / 2}px)` }, "border border-zinc-600 bg-zinc-500")}
          {face({ width: W, height: D, transform: `translate(-50%, -50%) rotateX(90deg) translateZ(${H / 2}px)` }, "border border-zinc-600 bg-zinc-400")}
          {face({ width: W, height: D, transform: `translate(-50%, -50%) rotateX(-90deg) translateZ(${H / 2}px)` }, "border border-zinc-700 bg-zinc-700")}
          {/* Dvířka – pant vlevo */}
          {face(
            {
              width: W,
              height: H,
              transformOrigin: "left center",
              transform: `translate(-50%, -50%) translateZ(${D / 2}px) rotateY(${open ? -115 : 0}deg)`,
              transition: "transform 600ms cubic-bezier(.2,.8,.2,1)",
            },
            "[transform-style:preserve-3d]",
            <>
              {/* Vnitřní strana dvířek (s kapsou na výkresy) – bez zrcadleného štítku */}
              <div className="absolute inset-0 rounded-sm border-4 border-zinc-600 bg-zinc-400 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div className="absolute inset-x-8 top-10 h-28 rounded-sm border border-zinc-500 bg-zinc-300/70" />
              </div>
              <div className="absolute inset-0 rounded-sm border border-zinc-500 bg-gradient-to-br from-zinc-300 to-zinc-400 shadow-inner [backface-visibility:hidden]">
              <div className="absolute top-8 left-1/2 w-40 -translate-x-1/2 rounded-sm border border-zinc-600 bg-zinc-100 px-2 py-1.5 text-center">
                <div className="font-mono text-lg font-bold text-zinc-900">{tag}</div>
              </div>
              <div className="absolute top-24 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center">
                <svg viewBox="0 0 60 52" className="size-14" aria-hidden>
                  <path d="M30 2 58 50H2Z" fill="#facc15" stroke="#111" strokeWidth="3" strokeLinejoin="round" />
                  <path d="M33 14 23 31h8l-4 13 12-19h-8l4-11Z" fill="#111" />
                </svg>
              </div>
              <div className="absolute top-1/2 right-4 h-20 w-3 -translate-y-1/2 rounded-full bg-zinc-700 shadow" />
              <div className="absolute inset-x-10 bottom-8 grid grid-cols-6 gap-1 opacity-50">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="h-1.5 rounded-full bg-zinc-600" />
                ))}
              </div>
              </div>
            </>,
          )}
        </div>
        <p className="pointer-events-none absolute bottom-3 left-3 text-xs text-muted-foreground">
          Tažením otočíte · {rails.flat().length} modulů na {rails.length} lištách
        </p>
      </div>
    </div>
  );
}

function Rail({ modules, height }: { modules: CabinetModule[]; height: number }) {
  return (
    <div className="relative flex items-center [transform-style:preserve-3d]" style={{ height: Math.min(height, 80) }}>
      {/* Lišta DIN */}
      <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 bg-gradient-to-b from-zinc-300 to-zinc-500" />
      <div className="relative flex items-center gap-px [transform-style:preserve-3d]">
        {modules.map((module) => (
          <div
            key={module.designation}
            title={`${module.designation} – ${module.description}`}
            className={cn("relative flex flex-col items-center justify-between rounded-[2px] border py-1", MODULE_STYLE[module.kind])}
            style={{ width: module.width * TE, height: Math.min(height, 80) - 10, transform: "translateZ(14px)" }}
          >
            <span className={cn("font-mono text-[8px] leading-none font-bold", module.kind === "plc" || module.kind === "psu" ? "text-zinc-100" : "text-zinc-800")}>
              {module.designation}
            </span>
            {module.kind === "breaker" || module.kind === "switch" ? <span className="h-3 w-1.5 rounded-sm bg-zinc-800" /> : null}
            {module.kind === "plc" ? (
              <span className="grid grid-cols-4 gap-0.5">
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className={cn("size-1 rounded-full", i % 3 ? "bg-emerald-400" : "bg-amber-400")} />
                ))}
              </span>
            ) : null}
            <span className="h-1 w-3/4 rounded-full bg-black/20" />
          </div>
        ))}
      </div>
    </div>
  );
}
