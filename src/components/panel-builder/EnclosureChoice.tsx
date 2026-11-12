"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ENCLOSURE_CHOICE_BRANDS, enclosureRails, enclosureSeries, enclosureSummary, modelLabel, modelsOfSeries } from "@/lib/panel-builder/enclosure-choice";
import type { EnclosureLike } from "@/lib/panel-builder/enclosures";
import { listEnclosuresAction } from "@/server/actions/panel-design";

import { EnclosurePhoto } from "./EnclosurePhoto";

const selectClass = "h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm disabled:opacity-50 dark:bg-input/30";

/**
 * Fáze 85: „🗄️ Výběr konkrétní skříně / rozvodnice (Volitelné)“ v dialogu nového projektu – výrobce → řada → model.
 * Zvolená skříň určí DIN lišty návrhu (řady × moduly), nepustí další řady ani širší lišty a propíše se do oteplení
 * i dokumentace. Bez volby se skříň vybere až podle velikosti návrhu (krok 3).
 */
export function EnclosureChoice({ value, onChange }: { value: EnclosureLike | null; onChange: (enclosure: EnclosureLike | null) => void }) {
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState("");
  const [list, setList] = useState<EnclosureLike[]>([]);
  const [series, setSeries] = useState("");
  const [loading, startLoading] = useTransition();
  const seriesOptions = enclosureSeries(list);
  const models = series ? modelsOfSeries(list, series) : [];
  const summary = value ? enclosureSummary(value) : null;
  const rails = value ? enclosureRails(value) : [];

  function pickBrand(next: string) {
    setBrand(next);
    setSeries("");
    setList([]);
    onChange(null);
    if (!next) return;
    startLoading(async () => {
      const result = await listEnclosuresAction(next);
      if (!result.ok) return void toast.error(result.error);
      setList(result.data);
      if (!result.data.length) toast.info("Pro tohoto výrobce zatím v katalogu skříní nic není.");
    });
  }

  function close() {
    setOpen(false);
    setBrand("");
    setSeries("");
    setList([]);
    onChange(null);
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3" aria-label="Výběr konkrétní skříně / rozvodnice" data-testid="enclosure-choice">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">🗄️ Výběr konkrétní skříně / rozvodnice (Volitelné)</span>
          <span className="text-xs text-muted-foreground">{open ? "Výrobce → řada → konkrétní model. Lišty návrhu se nastaví podle skříně." : "Bez volby se skříň vybere podle velikosti návrhu v části 1b (Skříň rozváděče)."}</span>
        </div>
        <Button type="button" size="sm" variant={open ? "ghost" : "outline"} onClick={() => (open ? close() : setOpen(true))} data-testid="enclosure-choice-toggle">
          {open ? "Bez konkrétní skříně" : "Vybrat konkrétní skříň"}
        </Button>
      </div>
      {open ? (
        <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor="pb-enclosure-brand">Výrobce</Label>
            <select id="pb-enclosure-brand" className={selectClass} value={brand} onChange={(event) => pickBrand(event.target.value)} aria-label="Výrobce skříně" data-testid="enclosure-brand">
              <option value="">– výrobce –</option>
              {ENCLOSURE_CHOICE_BRANDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor="pb-enclosure-series">Řada</Label>
            <select
              id="pb-enclosure-series"
              className={selectClass}
              value={series}
              disabled={!seriesOptions.length}
              onChange={(event) => {
                setSeries(event.target.value);
                onChange(null);
              }}
              aria-label="Řada skříně"
              data-testid="enclosure-series"
            >
              <option value="">{loading ? "načítám…" : "– řada –"}</option>
              {seriesOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor="pb-enclosure-model">Model</Label>
            <select
              id="pb-enclosure-model"
              className={selectClass}
              value={value?.id ?? ""}
              disabled={!models.length}
              onChange={(event) => onChange(models.find((model) => model.id === event.target.value) ?? null)}
              aria-label="Model skříně"
              data-testid="enclosure-model"
            >
              <option value="">– konkrétní model –</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {modelLabel(model)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Načítám skříně výrobce…
        </p>
      ) : null}
      {summary ? (
        <div className="flex flex-col gap-1 rounded-md border border-primary/40 bg-primary/10 p-2 text-xs" data-testid="enclosure-choice-summary">
          {/* Fáze 94: oficiální fotka rozvodnice (data ABB ETIM 9.0) */}
          <EnclosurePhoto articleNumber={value?.articleNumber} label={summary.title} className="self-start" />
          <p>
            ✅ <b className="text-foreground">{summary.title}</b> · {summary.layout} · {summary.dimensions} · {summary.execution}
          </p>
          <p>
            Objednací číslo: {summary.mpn ? <b className="font-mono text-foreground">{summary.mpn}</b> : <span className="text-amber-300">ověřte v katalogu výrobce (orientační typ)</span>}
          </p>
          <p className="text-muted-foreground">
            Návrh dostane {rails.length} {rails.length === 1 ? "DIN lištu" : rails.length < 5 ? "DIN lišty" : "DIN lišt"} po {rails[0]} M – další řady ani širší lišty skříň nepustí (omezení jde uvolnit v části 1b Skříň rozváděče).
          </p>
        </div>
      ) : null}
    </section>
  );
}
