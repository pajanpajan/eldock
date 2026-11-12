"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePlantDesignerAction } from "@/server/actions/plant-settings";

type Plant = { id: string; name: string; designerName: string | null; designerEmail: string | null };

/**
 * Fáze 103: Nastavení závodu – firemní (interní nebo smluvní) projektant, kterému údržba předává Červenky k překreslení
 * (cesta A „🏢 Přiřadit našemu firemnímu projektantovi“). Bez projektanta lze Červenku poptat v ELDOCK Poolu.
 */
export function PlantDesignerSettings({ plants }: { plants: Plant[] }) {
  if (!plants.length) return null;
  return (
    <section id="firemni-projektant" className="mb-6 scroll-mt-24 space-y-3 rounded-xl border border-border bg-card p-4" data-testid="plant-designer-settings">
      <div>
        <h2 className="font-semibold">🏢 Nastavení závodu – firemní projektant pro překreslení Červenek</h2>
        <p className="text-sm text-muted-foreground">Údržba při odeslání Červenky zvolí „Přiřadit našemu firemnímu projektantovi“ (podklady mu přijdou e-mailem) nebo „Poptat překreslení přes ELDOCK Pool“ externích projektantů.</p>
      </div>
      {plants.map((plant) => (
        <PlantRow key={plant.id} plant={plant} />
      ))}
    </section>
  );
}

function PlantRow({ plant }: { plant: Plant }) {
  const [name, setName] = useState(plant.designerName ?? "");
  const [email, setEmail] = useState(plant.designerEmail ?? "");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await savePlantDesignerAction({ plantId: plant.id, designerName: name, designerEmail: email });
          if (!result.ok) return void toast.error(result.error);
          toast.success(email ? `Firemní projektant závodu ${plant.name} uložen.` : `Projektant závodu ${plant.name} odebrán – Červenky jdou do fronty CAE nebo do ELDOCK Poolu.`);
        });
      }}
      data-testid="plant-designer-row"
    >
      <span className="text-sm font-medium">{plant.name}</span>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Jméno projektanta
        <Input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className="h-10" data-testid="plant-designer-name" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        E-mail projektanta
        <Input type="email" value={email} maxLength={160} onChange={(event) => setEmail(event.target.value)} className="h-10" data-testid="plant-designer-email" />
      </label>
      <Button type="submit" variant="outline" className="h-10" disabled={pending} data-testid="plant-designer-save">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}Uložit
      </Button>
    </form>
  );
}
