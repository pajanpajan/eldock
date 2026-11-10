"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { releaseEnclosureLimitAction } from "@/server/actions/panel-design";

/**
 * Fáze 85: skříň zvolená už při zakládání projektu – lišty návrhu nepřekročí její řady ani moduly na řadu.
 * „🔓 Uvolnit omezení skříně“ vrátí běžné limity editoru (skříň zůstává vybraná, jde změnit v kroku 3).
 */
export function EnclosureLockBanner({ projectId, title, rows, modulesPerRow }: { projectId: string; title: string; rows: number; modulesPerRow: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function release() {
    startTransition(async () => {
      const result = await releaseEnclosureLimitAction(projectId);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Omezení skříně je uvolněné – lišty jde rozšířit, skříň zůstává vybraná.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm" data-testid="enclosure-lock">
      <span>
        🔒 Skříň zvolená při zakládání: <b>{title}</b> – nejvýš {rows} {rows === 1 ? "DIN lišta" : rows < 5 ? "DIN lišty" : "DIN lišt"} po {modulesPerRow} M.
      </span>
      <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={release} disabled={pending} data-testid="enclosure-release">
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} 🔓 Uvolnit omezení skříně
      </Button>
    </div>
  );
}
