"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WIZARD_STEPS, nextStep, wizardStep, type FloorplanUiMode, type WizardStep, type WizardStepStatus } from "@/lib/panel-builder/floorplan-wizard";
import { cn } from "@/lib/utils";

/**
 * Fáze 89: přepínač zobrazení horní lišty 2D půdorysu – 🧭 průvodce v 5 krocích, nebo ⚡ kompaktní CAD lišta pro
 * zkušené (volba se pamatuje v prohlížeči i v profilu firmy).
 */
export function UiModeToggle({ mode, onMode }: { mode: FloorplanUiMode; onMode: (mode: FloorplanUiMode) => void }) {
  return (
    <span className="flex overflow-hidden rounded-md border border-border text-xs" role="radiogroup" aria-label="Zobrazení lišty půdorysu" data-testid="ui-mode">
      {(
        [
          ["wizard", "🧭 Průvodce (Krok 1–5)"],
          ["compact", "⚡ Kompaktní lišta (Bez průvodce)"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          onClick={() => onMode(value)}
          className={cn("px-2 py-1 font-semibold", mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          data-testid={`ui-mode-${value}`}
        >
          {label}
        </button>
      ))}
    </span>
  );
}

/**
 * Fáze 89: průvodce 2D půdorysem – 5 fází nad plátnem, vždy jen jedna kontextová lišta nástrojů (obsah `children`
 * podle aktivního kroku), krátká nápověda a tlačítko na další krok. Souhrnný odznak vzhledu (řada a barva) je vidět
 * ve všech krocích a vrací na krok 2.
 * Fáze 90: kroky jako velké kontrastní krokové karty – kroužek s číslem (✓ u hotového kroku), tučný nadpis, živý
 * podtitul („3 místnosti · měřítko OK“), šipka mezi kroky a žluté podsvícení aktivního kroku s horním a spodním
 * akcentem. Krok mění jen uživatel (karta nebo tlačítko na další krok).
 */
export function FloorplanWizardBar({
  step,
  onStep,
  status,
  summary,
  aside,
  children,
}: {
  step: WizardStep;
  onStep: (step: WizardStep) => void;
  /** Fáze 90: podtitul a fajfka krokových karet (`wizardStatus`). */
  status?: readonly WizardStepStatus[];
  /** Souhrn zvoleného designu („🎨 ABB Levit M · bílá“) – klik vrátí na krok 2. */
  summary?: ReactNode;
  /** Pravá část lišty (přepínač režimu). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  const info = wizardStep(step);
  return (
    <section className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-1.5" aria-label="Průvodce 2D půdorysem" data-testid="floorplan-wizard" data-step={step}>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Krokové karty mají přednost – odznak designu a přepínač režimu se při nedostatku místa zalomí pod ně */}
        <nav className="flex min-w-0 flex-[1_1_62rem] items-stretch gap-0.5 overflow-x-auto" aria-label="Kroky průvodce" data-testid="wizard-stepper">
          {WIZARD_STEPS.map((item, index) => {
            const active = item.id === step;
            const state = status?.find((entry) => entry.id === item.id);
            const done = Boolean(state?.done) && !active;
            return (
              <Fragment key={item.id}>
                {index > 0 ? (
                  <span className={cn("flex shrink-0 items-center px-0.5 text-base font-black", item.id <= step ? "text-yellow-400" : "text-muted-foreground/60")} aria-hidden>
                    →
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onStep(item.id)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`${item.label}${state ? ` – ${state.subtitle}` : ""}${done ? " (hotovo)" : ""}`}
                  className={cn(
                    "relative flex min-w-[10.5rem] flex-1 items-center gap-2 rounded-lg border-2 px-2 py-1 text-left transition-colors",
                    active
                      ? "border-yellow-400 bg-yellow-400/15 text-foreground shadow-[inset_0_3px_0_0_#facc15,inset_0_-3px_0_0_#facc15,0_0_14px_rgba(250,204,21,0.25)]"
                      : done
                        ? "border-emerald-500/60 bg-emerald-500/10 text-foreground hover:border-emerald-400"
                        : "border-border bg-background/40 text-muted-foreground hover:border-primary/60 hover:text-foreground",
                  )}
                  title={item.hint}
                  data-testid={`wizard-step-${item.id}`}
                  data-done={done ? "true" : undefined}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black",
                      active ? "border-yellow-200 bg-yellow-400 text-zinc-950" : done ? "border-emerald-300 bg-emerald-500 text-white" : "border-zinc-500 bg-zinc-900/40 text-zinc-200",
                    )}
                    aria-hidden
                  >
                    {done ? "✓" : item.id}
                  </span>
                  <span className="min-w-0">
                    <b className={cn("block truncate text-[13px] font-extrabold leading-tight", active && "text-yellow-100")}>{item.short}</b>
                    <span className={cn("block truncate text-[11px] leading-tight", active ? "text-yellow-200/90" : "text-muted-foreground")} data-testid={`wizard-step-${item.id}-status`}>
                      {state?.subtitle ?? item.label}
                    </span>
                  </span>
                </button>
              </Fragment>
            );
          })}
        </nav>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {summary}
          {aside}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2" data-testid={`wizard-panel-${step}`}>
        {children}
        {/* Nápověda a další krok ve stejném řádku jako nástroje (zalomí se jen u dlouhé lišty) */}
        <span className="ml-auto flex min-w-[18rem] flex-1 basis-[24rem] items-center justify-end gap-2">
          <span className="min-w-0 flex-1 text-right text-[11px] leading-tight text-muted-foreground" data-testid="wizard-hint">
            💡 {info.hint}
          </span>
          {info.next ? (
            <Button type="button" size="sm" className="h-7 shrink-0 gap-1" onClick={() => onStep(nextStep(step))} data-testid="wizard-next">
              {info.next}
            </Button>
          ) : null}
        </span>
      </div>
    </section>
  );
}

/** Prvky z portálů (dialogy, nabídky, oznámení) nezavírají rozbalovací panel lišty. */
const insidePortal = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper], [data-sonner-toaster]'));

/**
 * Fáze 89: rozbalovací panel kompaktní lišty (Design, Trasy & výšky, Podklad & uložení, Export & rozváděč) – otevře
 * se kliknutím pod lištou, zavře klikem mimo nebo Esc. Obsah je připojený jen otevřený (žádné zdvojené ovládání).
 */
export function ToolbarPopover({ label, testId, children, align = "left", wide = false }: { label: ReactNode; testId: string; children: ReactNode; align?: "left" | "right"; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node) || insidePortal(event.target)) return;
      setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !insidePortal(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Button type="button" variant={open ? "secondary" : "outline"} size="sm" className="h-8 gap-1" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)} data-testid={testId}>
        {label} <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </Button>
      {open ? (
        <div
          className={cn(
            "absolute top-full z-40 mt-1 flex max-h-[75vh] flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-2xl shadow-black/40",
            align === "right" ? "right-0" : "left-0",
            wide ? "w-[min(64rem,calc(100vw-2rem))]" : "w-[min(36rem,calc(100vw-2rem))]",
          )}
          role="group"
          aria-label={typeof label === "string" ? label : undefined}
          data-testid={`${testId}-panel`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Fáze 89: kompaktní CAD lišta – jeden štíhlý řádek: primární nástroje plátna, 4 rozbalovací menu a přepínač režimu. */
export function CompactCadBar({ tools, menus, aside }: { tools: ReactNode; menus: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-1.5" aria-label="Kompaktní lišta půdorysu" data-testid="floorplan-compact-bar">
      <span className="flex flex-wrap items-center gap-1">{tools}</span>
      <span className="mx-1 h-6 w-px bg-border" aria-hidden />
      <span className="flex flex-wrap items-center gap-1">{menus}</span>
      <span className="ml-auto flex flex-wrap items-center gap-1.5">{aside}</span>
    </section>
  );
}

/** Fáze 89: nápověda „(?)“ na najetí myší místo dvouřádkového popisu pod nadpisem. */
export function HelpTip({ text }: { text: string }) {
  return (
    <span className="inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-full border border-border text-[11px] font-bold text-muted-foreground hover:border-primary hover:text-foreground" title={text} aria-label={`Nápověda: ${text}`} role="img" data-testid="floorplan-help">
      ?
    </span>
  );
}
