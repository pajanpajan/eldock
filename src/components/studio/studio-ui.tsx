"use client";

import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const selectClass = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function NumberField({
  id,
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(event) => event.target.value !== "" && onChange(Number(event.target.value))}
        className="h-10 font-mono"
      />
    </div>
  );
}

export function ChoiceButton({ active, onClick, disabled = false, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "touch-target rounded-lg border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
        active ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function FloorTabs({ items, active, onActive }: { items: { id: string; label: string; isNew?: boolean }[]; active: string; onActive: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-background p-1" role="tablist" aria-label="Patro">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === active}
          onClick={() => onActive(item.id)}
          title={item.isNew ? "Nové patro" : undefined}
          className={cn("flex h-9 items-center gap-1.5 rounded-md px-3 font-mono text-sm", item.id === active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
        >
          {item.label}
          {item.isNew ? <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden /> : null}
        </button>
      ))}
    </div>
  );
}
