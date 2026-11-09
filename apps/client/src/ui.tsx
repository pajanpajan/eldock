// Fáze 71 a 73: drobné prvky rozhraní aplikace ve stylu webu Eldock (tmavé téma, žlutý akcent, velké dotykové cíle).
// Na telefonu jsou dialogy spodní panely a systémové tlačítko Zpět zavře nejvyšší otevřený dialog.

import { Loader2, X } from "lucide-react";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import type { StatusStyle } from "@/lib/status";
import { cn } from "@/lib/utils";

import { touchUi } from "./bridge";

// ---------------------------------------------------------------------------
//  Tlačítko Zpět (Android): nejdřív zavře nejvyšší dialog, pak teprve obrazovku
// ---------------------------------------------------------------------------

const backHandlers: Array<{ handler: () => void }> = [];

/** Dokud je `active`, zavře tlačítko Zpět tuto vrstvu (dialog, párování) místo obrazovky. */
export function useBackHandler(active: boolean, handler: () => void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    if (!active) return;
    const entry = { handler: () => latest.current() };
    backHandlers.push(entry);
    return () => {
      const index = backHandlers.indexOf(entry);
      if (index >= 0) backHandlers.splice(index, 1);
    };
  }, [active]);
}

/** Zavře nejvyšší vrstvu; `false` = žádná není (Zpět patří navigaci). */
export function closeTopLayer(): boolean {
  const top = backHandlers[backHandlers.length - 1];
  if (!top) return false;
  top.handler();
  return true;
}

type Variant = "primary" | "outline" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border border-border bg-transparent hover:bg-muted",
  ghost: "bg-transparent hover:bg-muted",
  danger: "border border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20",
};

export function Button({ variant = "primary", size = "md", className, busy, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; busy?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || busy}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-sm" : size === "lg" ? "h-12 px-5 text-base" : "h-10 px-4 text-sm",
        VARIANTS[variant],
        className,
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function StatusBadge({ style, className, testId }: { style: StatusStyle; className?: string; testId?: string }) {
  const Icon = style.icon;
  return (
    <span className={cn("inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap", style.badge, className)} title={style.description} data-testid={testId}>
      <Icon className="size-3" aria-hidden />
      {style.label}
    </span>
  );
}

export function Section({ title, icon, actions, children, testId }: { title: string; icon?: ReactNode; actions?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {icon}
          {title}
        </h2>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

// Na telefonu písmo 16 px – menší iOS při psaní přibližuje
export const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus:border-primary sm:text-sm";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">{children}</p>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

/** Modální dialog (Esc, Zpět a klik vedle zavřou; fokus na první pole – na dotykovém zařízení ne, vyskočila by klávesnice). */
export function Dialog({ open, title, onClose, children, footer, wide, testId }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; testId?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  useBackHandler(open, onClose);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    if (!touchUi) panel.current?.querySelector<HTMLElement>("input, textarea, select, button[data-autofocus]")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className={cn("flex max-h-[94dvh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:max-h-[92vh] sm:rounded-xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")} style={{ paddingBottom: "var(--safe-bottom)" }} data-testid={testId}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} aria-label="Zavřít">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Řádek „popis: hodnota“ v údajích zařízení (prázdná hodnota se nezobrazí). */
export function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm">{value}</dd>
    </div>
  );
}
