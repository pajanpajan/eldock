"use client";

import { useEffect, useRef, useState } from "react";

import { COMB_SETTING_HINT, COMB_SETTING_LABEL, COMB_SETTINGS, type CombKind, type CombSetting } from "@/lib/panel-builder/comb-busbars";
import { cn } from "@/lib/utils";

const KIND_TEXT: Record<CombKind, string> = { "3P": "3P", "3PN": "3P+N", "1P": "1P", "1PN": "1P+N" };

/** Text tlačítka „Hřeben: …“ (u Auto skutečně použité druhy na liště). */
export function combMenuText(setting: CombSetting, kinds: readonly CombKind[]): string {
  if (setting === "AUTO") {
    const used = [...new Set(kinds.map((kind) => KIND_TEXT[kind]))];
    return `Auto${used.length ? ` (${used.join(" / ")})` : ""}`;
  }
  return setting === "OFF" ? "Bez hřebenu" : KIND_TEXT[setting];
}

/**
 * Fáze 115: tlačítko „Hřeben: …“ v záhlaví DIN lišty – režim propojovacího hřebenu lišty (Auto / 3P / 3P+N / 1P / Bez
 * hřebenu). Hřeben se zasouvá do svorek přístrojů a nezabírá moduly na liště (v kaskádě přístrojů není).
 */
export function RailCombMenu({ rail, setting, kinds, busy = false, onChange }: { rail: number; setting: CombSetting; kinds: readonly CombKind[]; busy?: boolean; onChange: (setting: CombSetting) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);
  const text = combMenuText(setting, kinds);
  return (
    <div ref={box} className="relative inline-flex">
      <button
        type="button"
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title="Propojovací hřeben lišty – zasouvá se do svorek přístrojů, nezabírá moduly na liště"
        aria-label={`Hřeben lišty ${rail}: ${text}`}
        className="rounded px-1 py-0.5 font-semibold text-amber-300 hover:bg-amber-500/15 disabled:opacity-50"
        data-testid={`rail-comb-${rail}`}
        data-comb={setting}
      >
        ⫼ Hřeben: {text}
      </button>
      {open ? (
        <div role="menu" aria-label={`Hřeben lišty ${rail}`} className="absolute top-full left-0 z-30 mt-1 flex w-64 flex-col gap-0.5 rounded-md border border-border bg-popover p-1 text-[11px] whitespace-normal text-popover-foreground shadow-lg" data-testid={`rail-comb-menu-${rail}`}>
          {COMB_SETTINGS.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === setting}
              onClick={() => {
                setOpen(false);
                if (option !== setting) onChange(option);
              }}
              className={cn("flex flex-col rounded px-2 py-1 text-left hover:bg-muted", option === setting && "bg-amber-500/15")}
              data-testid={`rail-comb-${rail}-${option}`}
            >
              <span className="font-semibold">[ {COMB_SETTING_LABEL[option]} ]</span>
              <span className="text-[10px] text-muted-foreground">{COMB_SETTING_HINT[option]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
