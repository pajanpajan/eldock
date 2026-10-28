"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { HardHat, PencilRuler } from "lucide-react";
import { toast } from "sonner";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ROLE_LABELS, roleSchema, type AppRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { setRole } from "@/server/actions/session";

const ITEMS: { role: AppRole; icon: typeof HardHat }[] = [
  { role: "MAINTENANCE", icon: HardHat },
  { role: "CAE_ENGINEER", icon: PencilRuler },
];

/** Přepínač pohledu `[Pohled: Údržba v hale] / [Pohled: CAE Projektant]`. */
export function RoleSwitcher({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<AppRole | null>(null);
  const active = pending && optimistic ? optimistic : role;

  function onChange(value: string) {
    const next = roleSchema.safeParse(value);
    // Radix vrací prázdný řetězec při opětovném kliknutí na vybranou položku.
    if (!next.success || next.data === role) return;
    setOptimistic(next.data);
    startTransition(async () => {
      try {
        await setRole(next.data, pathname);
      } catch (error) {
        // `redirect()` v akci se do klienta propaguje jako speciální výjimka – tu nechat projít.
        if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
        toast.error("Pohled se nepodařilo přepnout.");
      }
    });
  }

  return (
    <ToggleGroup
      type="single"
      value={active}
      onValueChange={onChange}
      variant="outline"
      spacing={0}
      aria-label="Přepínač pohledu"
      className={cn("border border-border bg-card/60 p-0.5", pending && "opacity-80")}
    >
      {ITEMS.map(({ role: itemRole, icon: Icon }) => (
        <ToggleGroupItem
          key={itemRole}
          value={itemRole}
          aria-label={ROLE_LABELS[itemRole].full}
          className="touch-target gap-2 rounded-md border-0! px-3 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground sm:px-4"
        >
          <Icon className="size-4" aria-hidden />
          <span className="hidden lg:inline">{ROLE_LABELS[itemRole].full}</span>
          <span className="lg:hidden">{ROLE_LABELS[itemRole].short}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
