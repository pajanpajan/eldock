"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PEN_SPLIT_LABEL, busbarSummary, type Busbar, type BusbarPlan } from "@/lib/panel-builder/pe-n-busbars";
import { cn } from "@/lib/utils";

/**
 * Fáze 55: lišta svorkovnic PE / N0 / N-FIx na vektorovém rozváděči (nahoře nebo dole podle přívodu). Klik otevře rozpis,
 * který vývod je na které svorkovnici. Výpočet je v `lib/panel-builder/pe-n-busbars.ts`.
 */
export function BusbarStrip({ plan, position }: { plan: BusbarPlan; position: "TOP" | "BOTTOM" }) {
  const bars = [plan.pe, plan.n0, ...plan.groups];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn("flex w-full flex-wrap items-stretch gap-1.5 rounded-md border border-zinc-700 bg-zinc-950/70 p-1.5 text-left hover:border-primary/60", position === "TOP" ? "mb-2" : "mt-2")}
          aria-label="Svorkovnice PE a N – rozpis zapojení"
          data-testid="busbar-strip"
        >
          {bars.map((bar, index) => (
            <span key={bar.id} className="flex items-center gap-1">
              {index === 1 && plan.penBridge ? (
                <span className="rounded bg-amber-400/20 px-1 font-mono text-[10px] font-bold text-amber-200" title={PEN_SPLIT_LABEL}>
                  PEN ⇄
                </span>
              ) : null}
              <BarChip bar={bar} />
            </span>
          ))}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Svorkovnice PE a N</DialogTitle>
          <DialogDescription>
            {plan.penBridge
              ? `${PEN_SPLIT_LABEL}: propojka mezi sběrnicí PE a N0. Za každým chráničem je samostatný izolovaný nulový můstek.`
              : "PE a N0 jsou izolované (bez propojky). Za každým chráničem je samostatný izolovaný nulový můstek – N vodiče jiných skupin na něj nepatří."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {bars.map((bar) => (
            <section key={bar.id} className="rounded-lg border border-border p-3">
              <h3 className="font-semibold">{busbarSummary(bar)}</h3>
              <ul className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                {bar.connections.length ? (
                  bar.connections.map((connection, index) => (
                    <li key={`${connection.designation}-${index}`}>
                      <span className="font-mono text-foreground">{connection.designation}</span> {connection.label}
                    </li>
                  ))
                ) : (
                  <li>zatím bez vývodů</li>
                )}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BarChip({ bar }: { bar: Busbar }) {
  const screws = Math.min(bar.size, 12);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-1 font-mono text-[10px] font-bold",
        bar.kind === "PE" ? "bg-[repeating-linear-gradient(135deg,#16a34a_0_6px,#facc15_6px_12px)] text-zinc-950" : "bg-blue-600 text-white",
      )}
      data-testid={`busbar-${bar.id}`}
    >
      {bar.kind === "PE" ? "PE" : bar.id}
      <span className="flex gap-px" aria-hidden>
        {Array.from({ length: screws }, (_, index) => (
          <span key={index} className={cn("size-1.5 rounded-full", index < Math.round((bar.used / bar.size) * screws) ? "bg-zinc-950/80" : "bg-white/60")} />
        ))}
      </span>
      {bar.used}/{bar.size}
    </span>
  );
}
