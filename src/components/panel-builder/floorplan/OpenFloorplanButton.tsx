"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { openProjectFloorplanAction } from "@/server/actions/floorplans";

/** Fáze 64: „📐 Upravit půdorys“ u rozváděče vygenerovaného z 2D půdorysu – otevře uložený půdorys (případně ho založí). */
export function OpenFloorplanButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className="touch-target gap-1.5"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await openProjectFloorplanAction(projectId);
          if (!result.ok) return void toast.error(result.error);
          if (result.data.created) toast.success("Půdorys projektu je uložený mezi půdorysy – úpravy se ukládají průběžně.");
          router.push(`/panel-builder/floorplan/${result.data.id}`);
        })
      }
      data-testid="open-floorplan"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} 📐 Upravit půdorys
    </Button>
  );
}
