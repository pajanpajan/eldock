"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SectionNavItem = { kind: "link"; href: string; label: string; hint?: string } | { kind: "locked"; key: string; node: ReactNode };

export interface SectionNavSection {
  id: string;
  label: string;
  srLabel: string;
  icon: ReactNode;
  /** Adresy, pod kterými je sekce aktivní (zvýraznění v liště). */
  match: readonly string[];
  items: readonly SectionNavItem[];
}

/** Aktivní sekce podle adresy (nejdelší shoda předpony). */
function activeSection(sections: readonly SectionNavSection[], pathname: string): string | null {
  let best: { id: string; length: number } | null = null;
  for (const section of sections) {
    for (const prefix of section.match) {
      const hit = pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`);
      if (hit && (!best || prefix.length > best.length)) best = { id: section.id, length: prefix.length };
    }
  }
  return best?.id ?? null;
}

function Section({ section, active }: { section: SectionNavSection; active: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLLIElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      // Okno otevřené z položky sekce (např. „Modul Pro“ u zamčené funkce) sekci nezavírá
      const target = event.target as Element | null;
      if (target?.closest?.('[role="dialog"], [role="alertdialog"]')) return;
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
  return (
    <li ref={box} className="relative" data-testid={`nav-section-${section.id}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-current={active ? "page" : undefined}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "touch-target flex items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          active ? "bg-primary/15 font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        title={section.srLabel}
      >
        {/* Popisek sekce nese emoji – ikona jen bez popisku (užší okno) */}
        <span className="lg:hidden">{section.icon}</span>
        <span className="hidden lg:inline">{section.label}</span>
        <span className="sr-only lg:hidden">{section.srLabel}</span>
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div id={panelId} className="absolute top-full left-0 z-50 mt-1 flex w-72 flex-col gap-0.5 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl" data-testid={`nav-panel-${section.id}`}>
          <p className="px-2 pt-1 pb-1.5 text-[11px] text-muted-foreground">{section.srLabel}</p>
          {section.items.map((item) =>
            item.kind === "link" ? (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex flex-col rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                <span className="font-medium">{item.label}</span>
                {item.hint ? <span className="text-[11px] text-muted-foreground">{item.hint}</span> : null}
              </Link>
            ) : (
              <div key={item.key}>{item.node}</div>
            ),
          )}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Fáze 115: horní navigace průmyslového portálu v 5 sekcích (Areál & Budovy, Rozváděče & Stroje, Schémata & Červenka,
 * Revize & Hlídač, Správa & Účty) – sekce rozbalí své stránky; aktivní sekce podle adresy.
 */
export function SectionNav({ sections }: { sections: readonly SectionNavSection[] }) {
  const pathname = usePathname() ?? "";
  const active = activeSection(sections, pathname);
  return (
    <nav aria-label="Hlavní navigace">
      <ul className="flex flex-wrap items-center gap-1">
        {/* Klíč s adresou: po přechodu na jinou stránku (i z okna „Modul Pro“) se rozbalená sekce zavře */}
        {sections.map((section) => (
          <Section key={`${section.id}:${pathname}`} section={section} active={active === section.id} />
        ))}
      </ul>
    </nav>
  );
}
