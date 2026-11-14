"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const STORAGE_KEY = "eldock-identity-strip";
const noopSubscribe = () => () => undefined;

function storedCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

/**
 * Fáze 116: kompaktní identifikační pruh stroje / rozváděče pod lištou záložek – fotka zařízení, výrobní štítek
 * s AI čtením a QR štítek ve 3 sloupcích (každá karta do 145 px). „▴ Sbalit identifikační pruh“ uvolní místo pro
 * schéma a kusovník; volba se pamatuje v prohlížeči.
 */
export function EquipmentIdentityStrip({ tag, children }: { tag: string; children: ReactNode }) {
  const stored = useSyncExternalStore(noopSubscribe, storedCollapsed, () => false);
  const [picked, setPicked] = useState<boolean | null>(null);
  const collapsed = picked ?? stored;

  function toggle() {
    const next = !collapsed;
    setPicked(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "collapsed" : "open");
    } catch {
      // bez úložiště – jen pro tuto návštěvu
    }
  }

  return (
    <section aria-label={`Identifikace zařízení ${tag}`} className="flex flex-col gap-2" data-testid="identity-strip" data-collapsed={collapsed ? "true" : "false"}>
      <div className="flex items-center justify-end">
        <button type="button" onClick={toggle} aria-expanded={!collapsed} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground" data-testid="identity-strip-toggle">
          {collapsed ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronUp className="size-3.5" aria-hidden />}
          {collapsed ? "▾ Rozbalit identifikační pruh (fotka, štítek, QR)" : "▴ Sbalit identifikační pruh"}
        </button>
      </div>
      {collapsed ? null : <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{children}</div>}
    </section>
  );
}
