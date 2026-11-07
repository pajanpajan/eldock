"use client";

import { AlertTriangle, CheckCircle2, Info, LayoutGrid, Plug, RotateCw, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PlanCheck {
  id: string;
  level: "error" | "warning" | "info" | "ok";
  text: string;
  /** Norma / zdroj pravidla (zobrazí se menším písmem). */
  source?: string;
  action?: { label: string; onClick: () => void };
}

const ICON = { error: AlertTriangle, warning: AlertTriangle, info: Info, ok: CheckCircle2 } as const;
const TONE = {
  error: "border-red-500/60 bg-red-500/10 text-red-100",
  warning: "border-amber-400/60 bg-amber-400/10 text-amber-100",
  info: "border-sky-400/40 bg-sky-500/10 text-sky-100",
  ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
} as const;

/** Kontrola půdorysu (fáze 59: ovládání světel, stoupací vedení; fáze 61: normový hlídač) s opravou jedním klikem. */
export function PlanChecks({ checks, title = "Kontrola půdorysu" }: { checks: readonly PlanCheck[]; title?: string }) {
  if (!checks.length) return null;
  return (
    <section className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-xs" aria-label={title} data-testid="plan-checks">
      <h3 className="text-sm font-bold">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {checks.map((check) => {
          const Icon = ICON[check.level];
          return (
            <li key={check.id} className={cn("flex flex-wrap items-start gap-2 rounded-md border px-2 py-1.5", TONE[check.level])} data-check={check.id} data-level={check.level}>
              <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                {check.text}
                {check.source ? <span className="block text-[10px] opacity-75">{check.source}</span> : null}
              </span>
              {check.action ? (
                <button type="button" onClick={check.action.onClick} className="rounded border border-current/40 px-1.5 py-0.5 font-semibold whitespace-nowrap hover:bg-white/10" data-testid={`check-fix-${check.id}`}>
                  {check.action.label}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Fáze 59: vícenásobný výběr – víceramček, otočení, smazání. */
export function SelectionPanel({
  count,
  gangs,
  frameError,
  onFrame,
  onRotate,
  onDelete,
  onClear,
  sockets = 0,
  onJoinSockets,
  onAutoSockets,
}: {
  count: number;
  gangs: number;
  /** Proč nejde vytvořit víceramček (null = jde). */
  frameError: string | null;
  onFrame: () => void;
  onRotate: () => void;
  onDelete: () => void;
  onClear: () => void;
  /** Fáze 65: zásuvky ve výběru – spojení do ručního okruhu / automatické rozdělení. */
  sockets?: number;
  onJoinSockets?: () => void;
  onAutoSockets?: () => void;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border-2 border-sky-500/50 bg-card p-3 text-sm" aria-label="Vybrané prvky" data-testid="selection-panel">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Vybráno {count} prvků</h3>
        <button type="button" onClick={onClear} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Zrušit výběr">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <Button type="button" size="sm" className="gap-1.5" disabled={frameError !== null} onClick={onFrame} data-testid="make-frame">
        <LayoutGrid className="size-4" aria-hidden /> Vložit do víceramečku {gangs >= 2 && gangs <= 5 ? `(${gangs}R)` : ""} a přisadit
      </Button>
      {frameError ? <p className="text-xs text-amber-200">{frameError}</p> : <p className="text-xs text-muted-foreground">Přístroje se seřadí vedle sebe do jedné řady se stejným natočením, výškou, řadou a barvou.</p>}
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onRotate}>
          <RotateCw className="size-4" aria-hidden /> Otočit vše o 90°
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5 border-red-500/50 text-red-300" onClick={onDelete}>
          <Trash2 className="size-4" aria-hidden /> Smazat vybrané
        </Button>
      </div>
      {/* Fáze 65: vybrané zásuvky do jednoho ručního okruhu / zpět na automatické rozdělení */}
      {sockets ? (
        <div className="flex flex-col gap-1 border-t border-border pt-2" data-testid="selection-sockets">
          <p className="text-xs text-muted-foreground">
            Zásuvek ve výběru: <b className="text-foreground">{sockets}</b>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onJoinSockets} data-testid="join-sockets">
              <Plug className="size-4" aria-hidden /> Spojit do jednoho okruhu
            </Button>
            <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={onAutoSockets} data-testid="auto-sockets">
              Automatické rozdělení
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
