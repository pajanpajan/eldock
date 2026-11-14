"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { getFloorPlanAction, type FloorPlanData } from "@/server/actions/floor-plan";

const plans = new Map<string, Promise<{ ok: true; data: FloorPlanData } | { ok: false; error: string }>>();

export interface MiniMapPin {
  id: string;
  x: number;
  y: number;
  label: string;
  number?: number;
  done?: boolean;
}

/**
 * Fáze 116: 📍 2D minimapa patra pro pochůzku revizního technika – půdorys patra s vyznačenými vrati / vchodem,
 * pulzujícím špendlíkem hledaného zařízení nebo očíslovanými špendlíky 1 ➔ 2 ➔ 3 spojenými čárkovanou trasou.
 */
export function FloorMiniMap({ floorId, pins, highlightId = null, route = false, className }: { floorId: string; pins: readonly MiniMapPin[]; highlightId?: string | null; route?: boolean; className?: string }) {
  const [plan, setPlan] = useState<FloorPlanData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let request = plans.get(floorId);
    if (!request) {
      request = getFloorPlanAction(floorId);
      plans.set(floorId, request);
    }
    void request.then((result) => {
      if (!alive) return;
      if (result.ok) setPlan(result.data);
      else {
        plans.delete(floorId);
        setError(result.error);
      }
    });
    return () => {
      alive = false;
    };
  }, [floorId]);

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!plan)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Načítám půdorys patra…
      </p>
    );
  const ordered = route ? [...pins].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)) : pins;
  return (
    <div className={cn("relative w-full overflow-hidden rounded-lg border border-border bg-zinc-950", className)} style={{ aspectRatio: `${plan.viewBoxW} / ${plan.viewBoxH}` }} data-testid="floor-minimap" data-route={route ? "true" : "false"}>
      {plan.svg ? (
        // Půdorys generovaný Studiem / seedem (stejně jako náhled patra v areálu)
        <div className="absolute inset-0 opacity-90 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: plan.svg }} aria-hidden />
      ) : (
        <div className="bg-blueprint absolute inset-0" aria-hidden />
      )}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        {route && ordered.length > 1 ? <polyline points={ordered.map((pin) => `${pin.x},${pin.y}`).join(" ")} fill="none" stroke="#38bdf8" strokeWidth={0.5} strokeDasharray="1.8 1.2" strokeLinecap="round" /> : null}
      </svg>
      {plan.gates.map((gate, index) => (
        <span key={`${gate.label}-${index}`} className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-cyan-500/90 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-zinc-950 shadow" style={{ left: `${gate.x}%`, top: `${gate.y}%` }} data-testid="minimap-gate">
          🚪 {gate.label}
        </span>
      ))}
      {ordered.map((pin) => {
        const active = pin.id === highlightId;
        return (
          <span key={pin.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pin.x}%`, top: `${pin.y}%` }} data-testid="minimap-pin" data-equipment={pin.label} data-active={active ? "true" : undefined}>
            {active ? <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-red-500/70" aria-hidden /> : null}
            <span className={cn("relative flex min-w-6 items-center justify-center rounded-full border-2 px-1 text-[11px] font-bold shadow-lg", active ? "size-7 border-white bg-red-500 text-white" : pin.done ? "h-6 border-emerald-200 bg-emerald-500 text-white" : "h-6 border-white bg-sky-500 text-white")} title={pin.label}>
              {pin.number ?? (active ? "📍" : "")}
            </span>
            {active || route ? <span className="absolute top-full left-1/2 mt-0.5 -translate-x-1/2 rounded bg-zinc-950/85 px-1 text-[10px] whitespace-nowrap text-white">{pin.label}</span> : null}
          </span>
        );
      })}
    </div>
  );
}
