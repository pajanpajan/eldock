"use client";

import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { HardHat, Loader2, PencilRuler } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AppRole } from "@/lib/roles";
import { setRole } from "@/server/actions/session";

const LABELS: Partial<Record<AppRole, { label: string; icon: typeof HardHat }>> = {
  MAINTENANCE: { label: "Přepnout na pohled Údržba", icon: HardHat },
  CAE_ENGINEER: { label: "Přepnout na pohled CAE Projektant", icon: PencilRuler },
};

/** Výzva k přepnutí pohledu – uživatel zůstane na stejné stránce. */
export function SwitchRoleButton({ role }: { role: "MAINTENANCE" | "CAE_ENGINEER" }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const { label, icon: Icon } = LABELS[role]!;
  return (
    <Button
      className="touch-target gap-2"
      disabled={pending}
      onClick={() => startTransition(() => setRole(role, pathname, pathname))}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      {label}
    </Button>
  );
}
