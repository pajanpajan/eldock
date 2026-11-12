"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Maximize, Minimize, Pencil, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_PITCH_CONFIG, PITCH_SLIDE_COUNT, PITCH_STORAGE_KEY, clampSlide, parsePitchConfig, slideFromHash, slideKey, type PitchConfig } from "@/lib/pitch";
import { cn } from "@/lib/utils";

import { OnePager, SLIDE_TITLES, pitchSlides } from "./PitchSlides";

type Mode = "deck" | "onepager";

/** Adresa (#slide-4, ?rezim=one-pager) a uložené údaje jednání jako vnější úložiště – server vykreslí výchozí stav. */
const PITCH_EVENT = "eldock:pitch-change";
const subscribe = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  window.addEventListener(PITCH_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener(PITCH_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};
const readStored = () => {
  try {
    return window.localStorage.getItem(PITCH_STORAGE_KEY);
  } catch {
    return null;
  }
};
const notify = () => window.dispatchEvent(new Event(PITCH_EVENT));

/** Tisk: prezentace = každý slide na vlastní stránku A4 na šířku, One-Pager = jedna stránka A4 na výšku. */
const PRINT_CSS: Record<Mode, string> = {
  deck: `@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { background: #09090b !important; }
  .pitch-no-print { display: none !important; }
  .pitch-stage { position: static !important; height: auto !important; overflow: visible !important; }
  .pitch-slide { position: relative !important; inset: auto !important; opacity: 1 !important; visibility: visible !important; animation: none !important; display: flex !important; width: 297mm !important; height: 210mm !important; min-height: 0 !important; overflow: hidden !important; page-break-after: always; break-after: page; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}`,
  onepager: `@page { size: A4 portrait; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .pitch-no-print { display: none !important; }
  .pitch-onepager-wrap { padding: 0 !important; background: #fff !important; }
  .onepager { width: 210mm !important; height: 297mm !important; box-shadow: none !important; margin: 0 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}`,
};

/**
 * Fáze 99: interaktivní prezentace ELDOCK (`/prezentace`) – 10 slidů (šipky ← / →, mezerník, Home / End, tečky dole),
 * celá obrazovka, přepínač Prezentace ⇄ Executive One-Pager A4, tisk / uložení do PDF a úprava čísel jednání
 * (částka, partner, kontakt, rozpad využití) uložená jen v prohlížeči.
 */
export function PitchDeck() {
  const [modeOverride, setMode] = useState<Mode | null>(null);
  const [editing, setEditing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Slide z adresy (#slide-4), režim z ?rezim=one-pager a údaje jednání z localStorage – až v prohlížeči
  const slide = slideFromHash(useSyncExternalStore(subscribe, () => window.location.hash, () => ""));
  const queryMode = useSyncExternalStore(subscribe, () => (new URLSearchParams(window.location.search).get("rezim") === "one-pager" ? "onepager" : "deck"), () => "deck") as Mode;
  const mode = modeOverride ?? queryMode;
  const stored = useSyncExternalStore(subscribe, readStored, () => null);
  const config = useMemo(() => parsePitchConfig(stored), [stored]);

  const go = useCallback((index: number) => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#slide-${clampSlide(index) + 1}`);
    notify();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (mode !== "deck" || editing || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName))) {
        // Mezerník na tlačítku / odkazu ho stiskne – šipky ale listují vždy
        if (event.key === " ") return;
      }
      const action = slideKey(event.key);
      if (!action) return;
      event.preventDefault();
      const current = slideFromHash(window.location.hash);
      go(action === "next" ? current + 1 : action === "prev" ? current - 1 : action === "first" ? 0 : PITCH_SLIDE_COUNT - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, editing, go]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const save = (next: PitchConfig) => {
    try {
      window.localStorage.setItem(PITCH_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // soukromý režim – úprava se neuloží
    }
    notify();
  };

  const slides = pitchSlides(config);
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950 text-zinc-50" data-testid="pitch-deck" data-mode={mode} data-slide={slide + 1}>
      <style>{PRINT_CSS[mode]}</style>
      {/* Ovládání – při tisku skryté */}
      <div className="pitch-no-print sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-white/10 bg-zinc-950/90 px-3 py-2 backdrop-blur">
        <Link href="/" className="mr-1 text-sm font-black tracking-tight" aria-label="ELDOCK – úvodní stránka">
          <span className="text-yellow-400">EL</span>DOCK
        </Link>
        <span className="flex overflow-hidden rounded-lg border border-white/15 text-sm" role="radiogroup" aria-label="Režim prezentace">
          <button type="button" role="radio" aria-checked={mode === "deck"} onClick={() => setMode("deck")} className={cn("px-3 py-1.5 font-semibold", mode === "deck" ? "bg-yellow-400 text-zinc-950" : "text-zinc-300 hover:text-white")} data-testid="pitch-mode-deck">
            📊 Prezentace (10 slidů)
          </button>
          <button type="button" role="radio" aria-checked={mode === "onepager"} onClick={() => setMode("onepager")} className={cn("px-3 py-1.5 font-semibold", mode === "onepager" ? "bg-yellow-400 text-zinc-950" : "text-zinc-300 hover:text-white")} data-testid="pitch-mode-onepager">
            📄 Executive One-Pager (Tisk A4)
          </button>
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-zinc-400 hover:text-white" onClick={() => setEditing(true)} data-testid="pitch-edit">
            <Pencil className="size-3.5" aria-hidden /> ✏️ Upravit čísla a požadavek na podporu
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={toggleFullscreen} data-testid="pitch-fullscreen">
            {fullscreen ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />} {fullscreen ? "Ukončit celou obrazovku" : "⛶ Celá obrazovka (F11)"}
          </Button>
          <Button type="button" size="sm" className="gap-1.5 bg-yellow-400 text-zinc-950 hover:bg-yellow-300" onClick={() => window.print()} data-testid="pitch-print">
            <Printer className="size-4" aria-hidden /> 🖨️ Vytisknout / Uložit do PDF
          </Button>
        </span>
      </div>

      {mode === "deck" ? (
        <>
          <main className="pitch-stage relative flex-1 overflow-hidden" aria-roledescription="prezentace" aria-label="Prezentace ELDOCK">
            {slides.map((content, index) => (
              <section
                key={index}
                className={cn(
                  "pitch-slide absolute inset-0 flex flex-col overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,rgba(250,204,21,0.10),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(56,189,248,0.07),transparent_50%)]",
                  // Bez prolínání: předchozí slide zmizí hned, nový se jen krátce rozsvítí (text se nepřekrývá)
                  index === slide ? "z-10 animate-in fade-in-0 duration-300" : "invisible pointer-events-none opacity-0",
                )}
                aria-roledescription="slide"
                aria-label={`${index + 1} z ${PITCH_SLIDE_COUNT}: ${SLIDE_TITLES[index]}`}
                aria-hidden={index !== slide}
                data-testid="pitch-slide"
                data-slide={index + 1}
                data-active={index === slide ? "true" : undefined}
              >
                {content}
              </section>
            ))}
          </main>
          <nav className="pitch-no-print flex items-center justify-center gap-3 border-t border-white/10 px-3 py-2" aria-label="Slidy prezentace">
            <Button type="button" size="sm" variant="ghost" onClick={() => go(slide - 1)} disabled={slide === 0} aria-label="Předchozí slide (←)" data-testid="pitch-prev">
              <ChevronLeft className="size-5" aria-hidden />
            </Button>
            <span className="flex items-center gap-1.5">
              {SLIDE_TITLES.map((title, index) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => go(index)}
                  aria-label={`Slide ${index + 1}: ${title}`}
                  aria-current={index === slide ? "step" : undefined}
                  className={cn("size-2.5 rounded-full transition-all", index === slide ? "w-7 bg-yellow-400" : "bg-white/25 hover:bg-white/50")}
                  data-testid={`pitch-dot-${index + 1}`}
                />
              ))}
            </span>
            <span className="w-14 text-center font-mono text-xs text-zinc-400 tabular-nums" data-testid="pitch-counter">
              {slide + 1} / {PITCH_SLIDE_COUNT}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={() => go(slide + 1)} disabled={slide === PITCH_SLIDE_COUNT - 1} aria-label="Další slide (→ / mezerník)" data-testid="pitch-next">
              <ChevronRight className="size-5" aria-hidden />
            </Button>
          </nav>
        </>
      ) : (
        <main className="pitch-onepager-wrap flex-1 overflow-auto bg-zinc-800 px-3 py-6">
          <OnePager config={config} />
        </main>
      )}

      {editing ? <PitchEditDialog config={config} onClose={() => setEditing(false)} onSave={save} /> : null}
    </div>
  );
}

/** Úprava čísel jednání – formulář vzniká při otevření z aktuálních údajů (zavřením zmizí). */
function PitchEditDialog({ config, onClose, onSave }: { config: PitchConfig; onClose: () => void; onSave: (config: PitchConfig) => void }) {
  const [form, setForm] = useState(config);
  const field = (key: Exclude<keyof PitchConfig, "funds">, label: string, placeholder: string) => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`pitch-${key}`}>{label}</Label>
      <Input id={`pitch-${key}`} value={form[key]} placeholder={placeholder} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} data-testid={`pitch-edit-${key}`} />
    </div>
  );
  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" data-testid="pitch-edit-dialog">
        <DialogHeader>
          <DialogTitle>✏️ Čísla a požadavek na podporu</DialogTitle>
          <DialogDescription>Úpravy se uloží jen do tohoto prohlížeče (localStorage) – na server nic nejde. Prázdná částka se zobrazí jako „podle domluvy na jednání“.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("amount", "Cílová částka podpory", "např. 8 mil. Kč")}
          {field("form", "Forma podpory", "investice / grant / partnerství")}
          <div className="sm:col-span-2">{field("partner", "Partner / investor (oslovení)", "např. název fondu nebo agentury")}</div>
          {field("contactName", "Kontakt – jméno", "Jméno a příjmení")}
          {field("contactEmail", "Kontakt – e-mail", "info@eldock.cz")}
          {field("contactPhone", "Kontakt – telefon", "+420 …")}
        </div>
        <fieldset className="grid grid-cols-3 gap-2">
          <legend className="mb-1 text-sm font-medium">Rozpad využití podpory v % (nepovinné)</legend>
          {["Obchod a B2B prodej", "Produkt a integrace", "Podpora a onboarding"].map((label, index) => (
            <div key={label} className="flex flex-col gap-1">
              <Label htmlFor={`pitch-fund-${index}`} className="text-xs text-muted-foreground">
                {label}
              </Label>
              <Input
                id={`pitch-fund-${index}`}
                inputMode="decimal"
                value={form.funds[index]}
                placeholder="%"
                onChange={(event) => setForm((current) => ({ ...current, funds: current.funds.map((value, other) => (other === index ? event.target.value : value)) as PitchConfig["funds"] }))}
                data-testid={`pitch-edit-fund-${index}`}
              />
            </div>
          ))}
        </fieldset>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => setForm({ ...DEFAULT_PITCH_CONFIG, funds: [...DEFAULT_PITCH_CONFIG.funds] })}>
            Obnovit výchozí
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(form);
              onClose();
            }}
            data-testid="pitch-edit-save"
          >
            Uložit do prohlížeče
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
