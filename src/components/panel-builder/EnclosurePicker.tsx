"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { brandOf } from "@/lib/panel-builder/brands";
import { ENCLOSURE_MANUFACTURERS, INSTALLATION_LABELS, MOUNTING_FILTERS, fitEnclosures, reservePercent, type EnclosureInstallation, type EnclosureLike, type EnclosureNeed, type MountingFilter } from "@/lib/panel-builder/enclosures";
import { cn } from "@/lib/utils";
import { listEnclosuresAction, selectEnclosureAction } from "@/server/actions/panel-design";

import { BrandBadge } from "./CascadePicker";

const RITTAL = { color: "#e2001a", mark: "R" };
const HENSEL = { color: "#005ca9", mark: "HE" };
const badgeOf = (manufacturer: string) => brandOf(manufacturer) ?? (manufacturer === "Rittal" ? RITTAL : manufacturer === "Hensel" ? HENSEL : { color: "#475569", mark: manufacturer.slice(0, 2) });

/**
 * „🗄️ Výběr skříně rozváděče (Rozvodnice)“: nejdřív výrobce skříně (karty + montáž), pak jen skříně,
 * které pojmou návrh (řady ≥ lišty, moduly na řadu ≥ nejširší lišta, celkem ≥ obsazeno). Klik propíše
 * rozměry, model a P_max do projektu i výpočtu oteplení.
 */
export function EnclosurePicker({ projectId, need, current }: { projectId: string; need: EnclosureNeed; current: { model: string; enclosureId: string | null } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [manufacturer, setManufacturer] = useState<string | null>(null);
  const [mounting, setMounting] = useState<MountingFilter>("ALL");
  const [list, setList] = useState<{ manufacturer: string; rows: EnclosureLike[] } | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  function pickManufacturer(value: string) {
    setManufacturer(value);
    startLoading(async () => {
      const result = await listEnclosuresAction(value);
      if (!result.ok) return void toast.error(result.error);
      setList({ manufacturer: value, rows: result.data });
    });
  }

  function choose(enclosure: EnclosureLike) {
    startSaving(async () => {
      const result = await selectEnclosureAction(projectId, enclosure.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Skříň ${result.data.enclosureModel} propsána do projektu a výpočtu oteplení.`);
      setOpen(false);
      router.refresh();
    });
  }

  const rows = list && list.manufacturer === manufacturer ? fitEnclosures(list.rows, need, { manufacturer, mounting }) : [];
  const n = (value: number) => String(value).replace(".", ",");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="touch-target gap-2">
          🗄️ Výběr skříně rozváděče
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>🗄️ Výběr skříně rozváděče (Rozvodnice)</DialogTitle>
          <DialogDescription>
            Návrh: {need.rails} {need.rails === 1 ? "řada" : need.rails <= 4 ? "řady" : "řad"}, nejširší lišta {need.maxModulesPerRail} M, obsazeno {n(need.usedModules)} M. Nejdřív vyberte výrobce skříně.
            {current.model ? ` Aktuálně: ${current.model}.` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="group" aria-label="Výrobce skříně">
          {ENCLOSURE_MANUFACTURERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={manufacturer === value}
              onClick={() => pickManufacturer(value)}
              className={cn("flex min-h-11 items-center gap-2 rounded-lg border px-2 text-sm font-bold", manufacturer === value ? "border-primary bg-primary/15" : "border-border hover:border-primary/60")}
            >
              <BrandBadge brand={badgeOf(value)} size="sm" /> {value.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Montáž skříně">
          <span className="text-muted-foreground">Montáž:</span>
          {MOUNTING_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={mounting === filter.value}
              onClick={() => setMounting(filter.value)}
              className={cn("min-h-8 rounded-md border px-2.5 font-semibold", mounting === filter.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {!manufacturer ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground" data-testid="enclosure-hint">
            Vyberte výrobce skříně – zobrazí se jen rozvodnice, do kterých se návrh vejde.
          </p>
        ) : loading || !list ? (
          <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Načítám skříně {manufacturer}…
          </p>
        ) : rows.length ? (
          <ul className="flex flex-col gap-1.5" aria-label="Vyhovující skříně" data-testid="enclosure-list">
            {rows.map((enclosure) => {
              const active = current.enclosureId === enclosure.id;
              return (
                <li key={enclosure.id}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => choose(enclosure)}
                    className={cn("grid w-full gap-x-4 gap-y-0.5 rounded-lg border px-3 py-2 text-left text-sm sm:grid-cols-[1.6fr_1fr_1fr]", active ? "border-emerald-500 bg-emerald-500/10" : "border-border hover:border-primary")}
                  >
                    <span className="flex flex-col">
                      <b className="flex items-center gap-1.5">
                        {active ? <Check className="size-4 text-emerald-400" aria-hidden /> : null}
                        {enclosure.manufacturer} {enclosure.model}
                      </b>
                      <span className="text-xs text-muted-foreground">
                        {enclosure.rows} × {enclosure.modulesPerRow} M = {enclosure.totalModules} M · {INSTALLATION_LABELS[enclosure.installation as EnclosureInstallation] ?? enclosure.installation}
                        {enclosure.dataSource === "STANDARD_MATRIX" ? " · orientační" : ""}
                      </span>
                    </span>
                    <span className="font-mono text-xs">
                      V×Š×H {enclosure.heightMm} × {enclosure.widthMm} × {enclosure.depthMm} mm
                      <br />
                      {enclosure.ipRating}
                    </span>
                    <span className="text-xs">
                      P<sub>max</sub> {enclosure.pMaxW ? `${n(enclosure.pMaxW)} W` : "neuveden"}
                      <br />
                      <b className="text-emerald-300">rezerva {reservePercent(enclosure, need)} %</b>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-amber-500/60 p-4 text-sm text-amber-200" data-testid="enclosure-empty">
            Žádná skříň {manufacturer} s touto montáží návrh nepojme (potřeba {need.rails} řad × {need.maxModulesPerRail} M). Zkuste jiného výrobce nebo montáž.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
