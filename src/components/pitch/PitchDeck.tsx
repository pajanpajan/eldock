"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Maximize, Minimize, Pencil, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PITCH_CONFIG, PITCH_PLAN, PITCH_SLIDE_COUNT, PITCH_STORAGE_KEY, clampSlide, parsePitchConfig, slideFromHash, slideKey, type PitchConfig } from "@/lib/pitch";
import type { PitchLiveData } from "@/lib/pitch-live";
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

/** Fáze 101: pevné plátno slidu – celé se zmenší / zvětší na obrazovku (CSS `zoom`), obsah se nikdy nepřeskládá. */
const CANVAS = { width: 1280, height: 720 } as const;
/** Tisk A4 na šířku: 297 mm = 1280 px plátna × 0,8771; výška stránky 210 mm = 905 px plátna. */
const PRINT_ZOOM = 0.8771;
const PRINT_SLIDE_HEIGHT = Math.floor(((210 / 25.4) * 96) / PRINT_ZOOM);

/** Tisk: prezentace = každý slide na vlastní stránku A4 na šířku, One-Pager = jedna stránka A4 na výšku. */
const PRINT_CSS: Record<Mode, string> = {
  deck: `@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { background: #090d16 !important; }
  .pitch-no-print { display: none !important; }
  .pitch-root { height: auto !important; overflow: visible !important; }
  .pitch-stage { position: static !important; height: auto !important; overflow: visible !important; flex: none !important; }
  .pitch-fit { position: static !important; display: block !important; }
  .pitch-canvas { zoom: ${PRINT_ZOOM} !important; width: ${CANVAS.width}px !important; height: auto !important; }
  .pitch-slide { position: relative !important; inset: auto !important; opacity: 1 !important; visibility: visible !important; animation: none !important; display: block !important; width: ${CANVAS.width}px !important; height: ${PRINT_SLIDE_HEIGHT}px !important; overflow: hidden !important; page-break-after: always; break-after: page; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
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
 * Fáze 101: měřítko plátna 1280 × 720 podle volné plochy (ResizeObserver hlásí i první velikost); `active` = plocha
 * prezentace je vykreslená (po přepnutí z One-Pageru se pozorovatel připojí znovu).
 */
function useFitScale(active: boolean) {
  const ref = useRef<HTMLElement | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setScale(Math.max(0.25, Math.min(width / CANVAS.width, height / CANVAS.height)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);
  return [ref, scale] as const;
}

/**
 * Fáze 99 / 101: interaktivní prezentace ELDOCK (`/prezentace`) – 8 věcných slidů (šipky ← / →, mezerník, Home / End,
 * tečky dole) na pevném plátně 1280 × 720 přizpůsobeném obrazovce, celá obrazovka, přepínač Prezentace ⇄ One-Pager A4,
 * tisk / uložení do PDF a úprava textů a čísel jednání (částka, partner, kontakt, plán využití) uložená jen v prohlížeči.
 */
export function PitchDeck({ live }: { live: PitchLiveData }) {
  const [modeOverride, setMode] = useState<Mode | null>(null);
  const [editing, setEditing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Slide z adresy (#slide-4), režim z ?rezim=one-pager a údaje jednání z localStorage – až v prohlížeči
  const slide = slideFromHash(useSyncExternalStore(subscribe, () => window.location.hash, () => ""));
  const queryMode = useSyncExternalStore(subscribe, () => (new URLSearchParams(window.location.search).get("rezim") === "one-pager" ? "onepager" : "deck"), () => "deck") as Mode;
  const mode = modeOverride ?? queryMode;
  const [stage, scale] = useFitScale(mode === "deck");
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

  const slides = pitchSlides(config, live, () => setEditing(true));
  return (
    <div className={cn("pitch-root flex flex-col bg-[#090d16] text-slate-100", mode === "deck" ? "h-dvh overflow-hidden" : "min-h-dvh")} data-testid="pitch-deck" data-mode={mode} data-slide={slide + 1}>
      <style>{PRINT_CSS[mode]}</style>
      {/* Ovládání – při tisku skryté */}
      <div className="pitch-no-print sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-slate-700/70 bg-[#090d16]/95 px-3 py-2 backdrop-blur">
        <Link href="/" className="mr-1 text-sm font-black tracking-tight" aria-label="ELDOCK – úvodní stránka">
          <span className="text-yellow-400">EL</span>DOCK
        </Link>
        <span className="flex overflow-hidden rounded-lg border border-slate-600 text-sm" role="radiogroup" aria-label="Režim prezentace">
          <button type="button" role="radio" aria-checked={mode === "deck"} onClick={() => setMode("deck")} className={cn("px-3 py-1.5 font-semibold", mode === "deck" ? "bg-yellow-400 text-slate-950" : "text-slate-300 hover:text-white")} data-testid="pitch-mode-deck">
            📊 Prezentace (8 slidů)
          </button>
          <button type="button" role="radio" aria-checked={mode === "onepager"} onClick={() => setMode("onepager")} className={cn("px-3 py-1.5 font-semibold", mode === "onepager" ? "bg-yellow-400 text-slate-950" : "text-slate-300 hover:text-white")} data-testid="pitch-mode-onepager">
            📄 One-Pager (Tisk A4)
          </button>
        </span>
        {/* Fáze 107: kontakt, schůzka a spolupráce (plovoucí tlačítko na prezentaci není – překáželo by slidům na projektoru) */}
        <Link href="/kontakt" className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:border-yellow-400 hover:text-white" data-testid="pitch-contact">
          🤝 Kontakt & Spolupráce
        </Link>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-slate-400 hover:text-white" onClick={() => setEditing(true)} data-testid="pitch-edit">
            <Pencil className="size-3.5" aria-hidden /> ✏️ Upravit text / částku
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={toggleFullscreen} data-testid="pitch-fullscreen">
            {fullscreen ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />} {fullscreen ? "Ukončit celou obrazovku" : "⛶ Celá obrazovka (F11)"}
          </Button>
          <Button type="button" size="sm" className="gap-1.5 bg-yellow-400 text-slate-950 hover:bg-yellow-300" onClick={() => window.print()} data-testid="pitch-print">
            <Printer className="size-4" aria-hidden /> 🖨️ Vytisknout / Uložit do PDF
          </Button>
        </span>
      </div>

      {mode === "deck" ? (
        <>
          <main ref={stage} className="pitch-stage relative min-h-0 flex-1 overflow-hidden" aria-roledescription="prezentace" aria-label="Prezentace ELDOCK">
            <div className="pitch-fit absolute inset-0 flex items-center justify-center">
              {/* Fáze 101: pevné plátno 1280 × 720 – na projektoru 1366 × 768 i na 1920 × 1080 celé bez posuvníku */}
              <div className="pitch-canvas relative shrink-0" style={{ width: CANVAS.width, height: CANVAS.height, zoom: scale }} data-testid="pitch-canvas" data-scale={scale.toFixed(3)}>
                {slides.map((content, index) => (
                  <section
                    key={index}
                    className={cn(
                      // Švýcarský inženýrský styl: břidlicový podklad #090d16 s jemnou technickou mřížkou
                      "pitch-slide absolute inset-0 overflow-hidden bg-[#090d16] bg-[linear-gradient(rgba(148,163,184,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.045)_1px,transparent_1px)] bg-[size:40px_40px]",
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
              </div>
            </div>
          </main>
          <nav className="pitch-no-print flex items-center justify-center gap-3 border-t border-slate-700/70 px-3 py-2" aria-label="Slidy prezentace">
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
            <span className="w-14 text-center font-mono text-xs text-slate-400 tabular-nums" data-testid="pitch-counter">
              {slide + 1} / {PITCH_SLIDE_COUNT}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={() => go(slide + 1)} disabled={slide === PITCH_SLIDE_COUNT - 1} aria-label="Další slide (→ / mezerník)" data-testid="pitch-next">
              <ChevronRight className="size-5" aria-hidden />
            </Button>
          </nav>
        </>
      ) : (
        <main className="pitch-onepager-wrap flex-1 overflow-auto bg-slate-800 px-3 py-6">
          <OnePager config={config} live={live} />
        </main>
      )}

      {editing ? <PitchEditDialog config={config} onClose={() => setEditing(false)} onSave={save} /> : null}
    </div>
  );
}

/** Úprava textů a čísel jednání – formulář vzniká při otevření z aktuálních údajů (zavřením zmizí). */
function PitchEditDialog({ config, onClose, onSave }: { config: PitchConfig; onClose: () => void; onSave: (config: PitchConfig) => void }) {
  const [form, setForm] = useState(config);
  const field = (key: Exclude<keyof PitchConfig, "funds" | "plan">, label: string, placeholder: string) => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`pitch-${key}`}>{label}</Label>
      <Input id={`pitch-${key}`} value={form[key]} placeholder={placeholder} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} data-testid={`pitch-edit-${key}`} />
    </div>
  );
  const setAt = (key: "funds" | "plan", index: number, value: string) =>
    setForm((current) => ({ ...current, [key]: current[key].map((old, other) => (other === index ? value : old)) as [string, string, string] }));
  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" data-testid="pitch-edit-dialog">
        <DialogHeader>
          <DialogTitle>✏️ Text a částka žádosti o podporu</DialogTitle>
          <DialogDescription>Úpravy se uloží jen do tohoto prohlížeče (localStorage) – na server nic nejde. Prázdná částka se zobrazí jako „podle domluvy na jednání“, prázdný text bodu plánu jako výchozí text.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("amount", "Cílová částka podpory", "např. 8 mil. Kč")}
          {field("form", "Forma podpory", "investice / grant / partnerství")}
          <div className="sm:col-span-2">{field("partner", "Partner / investor (oslovení)", "např. název fondu nebo agentury")}</div>
          {field("contactName", "Kontakt – jméno", "Jméno a příjmení")}
          {field("contactEmail", "Kontakt – e-mail", "info@eldock.cz")}
          {field("contactPhone", "Kontakt – telefon", "+420 …")}
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">Plán využití podpory – text bodu a podíl v % (nepovinné)</legend>
          {PITCH_PLAN.map((item, index) => (
            <div key={item.title} className="grid gap-2 sm:grid-cols-[1fr_5.5rem]">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`pitch-plan-${index}`} className="text-xs">
                  {index + 1}. {item.title}
                </Label>
                <Textarea id={`pitch-plan-${index}`} rows={2} value={form.plan[index]} placeholder={item.text} onChange={(event) => setAt("plan", index, event.target.value)} data-testid={`pitch-edit-plan-${index}`} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`pitch-fund-${index}`} className="text-xs text-muted-foreground">
                  Podíl %
                </Label>
                <Input id={`pitch-fund-${index}`} inputMode="decimal" value={form.funds[index]} placeholder="%" onChange={(event) => setAt("funds", index, event.target.value)} data-testid={`pitch-edit-fund-${index}`} />
              </div>
            </div>
          ))}
        </fieldset>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => setForm({ ...DEFAULT_PITCH_CONFIG, funds: [...DEFAULT_PITCH_CONFIG.funds], plan: [...DEFAULT_PITCH_CONFIG.plan] })}>
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
