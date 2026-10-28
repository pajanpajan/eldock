"use client";

import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { HardHat, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setRole } from "@/server/actions/session";

/** Výzva k přepnutí na pohled Údržba – uživatel zůstane na stejné stránce. */
export function SwitchToMaintenance() {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className="touch-target gap-2"
      disabled={pending}
      onClick={() => startTransition(() => setRole("MAINTENANCE", pathname, pathname))}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <HardHat className="size-4" />}
      Přepnout na pohled Údržba
    </Button>
  );
}
