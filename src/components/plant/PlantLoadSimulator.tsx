"use client";

import { useState } from "react";

import { LoadSimulator } from "@/components/equipment/FeederCableCard";
import type { PowerCableNode } from "@/lib/cable-sizing";

/**
 * Fáze 98: What-If simulátor zátěže v agendě „4. Kniha revizí, Legislativa & Simulátor“ – výběr rozváděče závodu, ke
 * kterému se připojí nový stroj, a dopad přírůstku proudu kaskádou přívod → hlavní rozváděč → transformátor (stejný
 * výpočet jako v kartě přívodního kabelu zařízení).
 */
export function PlantLoadSimulator({ nodes, boards }: { nodes: PowerCableNode[]; boards: readonly { id: string; tag: string; name: string }[] }) {
  const [target, setTarget] = useState(boards[0]?.id ?? "");
  return (
    <section aria-labelledby="plant-simulator" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4" data-testid="plant-simulator">
      <h2 id="plant-simulator" className="font-semibold">
        🧪 What-If simulátor zátěže napájení
      </h2>
      {boards.length ? (
        <>
          <label className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            Nový stroj připojím do rozváděče:
            <select className="h-9 min-w-0 max-w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30" value={target} onChange={(event) => setTarget(event.target.value)} aria-label="Rozváděč pro nový stroj" data-testid="plant-simulator-target">
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name.startsWith(board.tag) ? board.name : `${board.tag} – ${board.name}`}
                </option>
              ))}
            </select>
          </label>
          <LoadSimulator key={target} equipmentId={target} nodes={nodes} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Závod zatím nemá rozváděče – simulátor počítá dopad nového stroje na přívody a transformátor.</p>
      )}
    </section>
  );
}
