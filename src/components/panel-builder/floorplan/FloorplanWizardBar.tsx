"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { phaseArrowClass, phaseBubbleClass, phaseCardClass, phaseSubtitleClass, phaseTitleClass } from "@/components/phases/phase-style";
import { Button } from "@/components/ui/button";
import { WIZARD_STEPS, nextStep, prevStep, wizardStep, type FloorplanUiMode, type WizardStep, type WizardStepStatus } from "@/lib/panel-builder/floorplan-wizard";
import { cn } from "@/lib/utils";

/**
 * Fáze 89: přepínač zobrazení horní lišty 2D půdorysu – 🧭 průvodce v 5 fázích, nebo ⚡ kompaktní CAD lišta pro
 * zkušené (volba se pamatuje v prohlížeči i v profilu firmy).
 */
export function UiModeToggle({ mode, onMode }: { mode: FloorplanUiMode; onMode: (mode: FloorplanUiMode) => void }) {
  return (
    <span className="flex overflow-hidden rounded-md border border-border text-xs" role="radiogroup" aria-label="Zobrazení lišty půdorysu" data-testid="ui-mode">
      {(
        [
          ["wizard", "🧭 Průvodce (Fáze 1–5)"],
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
        {/* Fáze 98: základ šířky = šířka karet s názvy fází (~71rem) – pravá část lišty se raději zalomí, než aby karty
            dostaly posuvník */}
        <nav className="flex min-w-0 flex-[1_1_72rem] items-stretch gap-0.5 overflow-x-auto" aria-label="Kroky průvodce" data-testid="wizard-stepper">
          {WIZARD_STEPS.map((item, index) => {
            const active = item.id === step;
            const state = status?.find((entry) => entry.id === item.id);
            const done = Boolean(state?.done) && !active;
            return (
              <Fragment key={item.id}>
                {index > 0 ? (
                  <span className={phaseArrowClass(item.id <= step)} aria-hidden>
                    →
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onStep(item.id)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`${item.label}${state ? ` – ${state.subtitle}` : ""}${done ? " (hotovo)" : ""}`}
                  // Fáze 98: stejný vzhled krokových karet jako AI Panel Builder a ELDOCK Průmysl (`phase-style.ts`)
                  className={phaseCardClass(active, done)}
                  title={item.hint}
                  data-testid={`wizard-step-${item.id}`}
                  data-done={done ? "true" : undefined}
                >
                  <span className={phaseBubbleClass(active, done)} aria-hidden>
                    {done ? "✓" : item.id}
                  </span>
                  {/* Název kroku se nezkracuje – určuje nejmenší šířku karty (při nedostatku místa se karty posouvají);
                      podtitulek do šířky karty nepřispívá (w-0 + min-w-full), vyplní ji a dlouhý dostane trojtečku */}
                  <span className="flex-1">
                    <b className={phaseTitleClass(active, true)}>{item.short}</b>
                    <span className={phaseSubtitleClass(active)} title={state?.subtitle} data-testid={`wizard-step-${item.id}-status`}>
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
          {/* Fáze 99: pod 1536 px nejvýš 2 řádky (celý text v tooltipu) – lišta neubírá výšku plátnu na projektoru */}
          <span className="line-clamp-2 min-w-0 flex-1 text-right text-[11px] leading-tight text-muted-foreground 2xl:line-clamp-none" title={info.hint} data-testid="wizard-hint">
            💡 {info.hint}
          </span>
          {/* Fáze 98: volný přechod tam i zpět mezi fázemi (data nákresu se nemění) */}
          {step > 1 ? (
            <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 gap-1" onClick={() => onStep(prevStep(step))} data-testid="wizard-prev">
              ← Předchozí fáze
            </Button>
          ) : null}
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

/** Fáze 98: navigace fází pod plátnem – „← Předchozí fáze“, pořadí fáze a „Další fáze: … →“. */
export function PhaseNav({ step, onStep, placement }: { step: WizardStep; onStep: (step: WizardStep) => void; placement: "top" | "bottom" }) {
  const info = wizardStep(step);
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-2 py-1.5" aria-label="Navigace fází průvodce" data-testid={`phase-nav-${placement}`}>
      {step > 1 ? (
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => onStep(prevStep(step))} data-testid={`wizard-prev-${placement}`}>
          ← Předchozí fáze: {wizardStep(prevStep(step)).short}
        </Button>
      ) : (
        <span />
      )}
      <span className="text-xs text-muted-foreground">
        Fáze {step} z 5 · <b className="text-foreground">{info.short}</b>
      </span>
      {info.next ? (
        <Button type="button" size="sm" className="h-8 gap-1" onClick={() => onStep(nextStep(step))} data-testid={`wizard-next-${placement}`}>
          {info.next}
        </Button>
      ) : (
        <span />
      )}
    </nav>
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
