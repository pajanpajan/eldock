"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createBimBoardProjectAction } from "@/server/actions/bim";

/** Fáze 95: rozváděč importovaný z BIMu → nový návrh v AI Panel Builderu (vývody k napájeným zařízením). */
export function BimBoardButton({ equipmentId, feeds }: { equipmentId: string; feeds: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      className="touch-target h-auto min-h-10 gap-2 whitespace-normal text-left"
      disabled={busy || feeds === 0}
      title={feeds === 0 ? "Rozváděč v závodě nenapájí žádné zařízení" : undefined}
      onClick={async () => {
        setBusy(true);
        const response = await createBimBoardProjectAction({ equipmentId });
        setBusy(false);
        if (!response.ok) {
          // Fáze 111: bez kreditů prodejní modal (je v layoutu AI Panel Builderu), jinak toast s odkazem na dobití
          if (response.paywall) return void toast.error(response.error, { duration: 12_000, action: { label: "💎 Dobít kredity / Tarify", onClick: () => router.push("/panel-builder/credits") } });
          return void toast.error(response.error, { duration: 10_000 });
        }
        toast.success(`⚡ Návrh rozváděče: ${response.data.devices} přístrojů, ${response.data.circuits} vývodů z BIMu.`);
        router.push(`/panel-builder/${response.data.id}`);
      }}
      data-testid="bim-board-to-panel-builder"
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Zap className="size-4" aria-hidden />} ⚡ Otevřít tento BIM rozváděč v AI Panel Builderu a vygenerovat vnitřní osazení
    </Button>
  );
}
