"use client";

import { BACKGROUND_LOOKS, type BackgroundLook } from "@/lib/panel-builder/background-look";
import { cn } from "@/lib/utils";

/**
 * Fáze 100: rychlý přepínač „🌗 Podklad: [ 100 % | 60 % (Doporučeno) | 35 % | Tmavý CAD ]“ v horní liště plátna (vlastní
 * řádek lepkavé lišty probíhajícího kroku nad výkresem – přes výkres by zakrýval jeho horní okraj, kde se kalibruje
 * a kreslí) – krytí bílého stavebního výkresu (PDF / obrázek) a jeho inverze do tmavého CADu.
 */
export function BackgroundLookSwitch({ value, onChange }: { value: BackgroundLook; onChange: (look: BackgroundLook) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-background/60 p-0.5 text-[11px]" role="radiogroup" aria-label="Podklad – krytí a vzhled výkresu" data-testid="background-look" data-look={value}>
      <span className="px-1.5 font-semibold whitespace-nowrap text-muted-foreground" aria-hidden>
        🌗 Podklad:
      </span>
      {BACKGROUND_LOOKS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          aria-label={option.title}
          title={option.title}
          onClick={() => onChange(option.id)}
          className={cn("rounded-md px-1.5 py-0.5 font-semibold whitespace-nowrap", value === option.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
          data-testid={`background-look-${option.id}`}
        >
          {option.label}
          {option.id === "dim60" ? (
            <>
              {" "}
              <span className="font-normal opacity-80">(Doporučeno)</span>
            </>
          ) : null}
        </button>
      ))}
    </div>
  );
}
