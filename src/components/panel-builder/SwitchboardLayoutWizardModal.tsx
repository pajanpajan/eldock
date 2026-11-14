"use client";

import { useState } from "react";
import { Check, Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EnclosureOptionDto, LayoutBoardDto, LayoutChoice, LayoutOptionDto, LayoutPreviewDto, LayoutRailDto, SizeTierDto } from "@/lib/panel-builder/layout-options";
import type { LayoutConcept } from "@/lib/panel-builder/rail-layout";
import { cn } from "@/lib/utils";

const n = (value: number) => value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });
const INSTALLATION: Record<string, string> = { FLUSH: "pod omítku", SURFACE: "na omítku", HOLLOW_WALL: "do dutých stěn", FLOOR: "stojanová" };

/**
 * Fáze 111: průvodce „📐 Uspořádání skříně a lišt (Silnoproud / Slaboproud)“ – při generování rozváděče z 2D půdorysu
 * i z horní lišty plátna AI Panel Builderu. Čtyři koncepce (dvoupolová skříň vedle sebe, široké 24M lišty, kompaktní 18M
 * lišty, dva rozváděče) s náhledem lišt po polích a skutečnými rozvodnicemi z databáze (objednací číslo, P_max, rezerva).
 * Data načte rodič předem (server action) – modal jen vybírá.
 */
export function SwitchboardLayoutWizardModal({
  preview,
  onClose,
  onConfirm,
  confirmLabel,
  busy = false,
  context,
}: {
  /** Koncepce ze serveru; null = zavřeno. */
  preview: LayoutPreviewDto | null;
  onClose: () => void;
  onConfirm: (choice: LayoutChoice) => void;
  confirmLabel: string;
  busy?: boolean;
  context: "floorplan" | "project";
}) {
  return (
    <Dialog open={preview !== null} onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl" data-testid="layout-wizard">
        {preview ? <WizardBody key={preview.options.map((option) => option.summary).join("|")} preview={preview} onClose={onClose} onConfirm={onConfirm} confirmLabel={confirmLabel} busy={busy} context={context} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function WizardBody({ preview, onClose, onConfirm, confirmLabel, busy, context }: { preview: LayoutPreviewDto; onClose: () => void; onConfirm: (choice: LayoutChoice) => void; confirmLabel: string; busy: boolean; context: "floorplan" | "project" }) {
  const initial = preview.options.find((option) => option.recommended) ?? preview.options.find((option) => option.available) ?? preview.options[0];
  const [concept, setConcept] = useState<LayoutConcept>(initial.concept);
  // Fáze 114: volba velikosti rozvodnice (karta s rezervou v %) a konkrétního modelu pro každý rozváděč koncepce
  const [picked, setPicked] = useState<Partial<Record<LayoutConcept, { main?: string; second?: string; mainTier?: string; secondTier?: string }>>>({});
  const option = preview.options.find((candidate) => candidate.concept === concept) ?? initial;
  const tierOf = (board: LayoutBoardDto | null, key: string | undefined) => (board ? (board.tiers.find((tier) => tier.key === key) ?? board.tiers[0] ?? null) : null);
  const mainTier = tierOf(option.main, picked[concept]?.mainTier);
  const secondTier = tierOf(option.second, picked[concept]?.secondTier);
  const mainId = picked[concept]?.main ?? mainTier?.enclosures[0]?.id ?? option.main.enclosures[0]?.id ?? null;
  const secondId = picked[concept]?.second ?? secondTier?.enclosures[0]?.id ?? option.second?.enclosures[0]?.id ?? null;
  // Vlastní volba velikosti / modelu = rozváděč s tolika DIN lištami, kolik má zvolená skříň řad
  const explicit = Boolean(picked[concept]?.mainTier || picked[concept]?.main || picked[concept]?.secondTier || picked[concept]?.second);
  const pick = (part: "main" | "second", id: string) => setPicked((current) => ({ ...current, [concept]: { ...current[concept], [part]: id } }));
  const pickTier = (part: "main" | "second", tier: SizeTierDto) =>
    setPicked((current) => ({ ...current, [concept]: { ...current[concept], [part === "main" ? "mainTier" : "secondTier"]: tier.key, [part]: tier.enclosures[0]?.id } }));
  return (
    <>
      <DialogHeader>
        <DialogTitle>📐 Uspořádání skříně a lišt (Silnoproud / Slaboproud)</DialogTitle>
        <DialogDescription>
          {context === "floorplan" ? "Než vznikne rozváděč z půdorysu, vyberte, jak má vypadat." : "Přeuspořádejte přístroje rozváděče do zvolené koncepce."} Každá koncepce je spárovaná se skutečnými rozvodnicemi z databáze ELDOCK. Přístroje celkem {n(preview.totalModules)} M · ztráty {n(preview.totalPowerLossW)} W
          {preview.smart ? " · obsahuje slaboproud / Smart Home" : ""}. Skupina chrániče zůstává na jedné liště, na každé liště zůstane ~15 % rezervy.
        </DialogDescription>
      </DialogHeader>

      <div role="radiogroup" aria-label="Koncepce uspořádání skříně" className="grid gap-3 md:grid-cols-2">
        {preview.options.map((candidate) => (
          <ConceptCard key={candidate.concept} option={candidate} selected={candidate.concept === concept} onSelect={() => setConcept(candidate.concept)} />
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-3" aria-label="Rozvodnice z databáze" data-testid="layout-enclosures">
        <h3 className="text-sm font-semibold">
          {option.icon} {option.short} – rozvodnice z databáze
        </h3>
        {option.available ? (
          <>
            <SizePicker title={option.concept === "two_boards" ? "RH1 – Silnoproud 230/400 V" : null} board={option.main} tier={mainTier} onTier={(tier) => pickTier("main", tier)} testId="layout-tier" />
            <EnclosureList title={option.concept === "two_boards" ? "RH1 – Silnoproud 230/400 V" : null} board={option.main} enclosures={mainTier?.enclosures ?? option.main.enclosures} selected={mainId} onPick={(id) => pick("main", id)} testId="layout-enclosure" />
            {option.second ? (
              <>
                <SizePicker title="RH2 – Slaboproud / Smart Home" board={option.second} tier={secondTier} onTier={(tier) => pickTier("second", tier)} testId="layout-tier-second" />
                <EnclosureList title="RH2 – Slaboproud / Smart Home" board={option.second} enclosures={secondTier?.enclosures ?? option.second.enclosures} selected={secondId} onPick={(id) => pick("second", id)} testId="layout-enclosure-second" />
              </>
            ) : null}
          </>
        ) : (
          <p className="flex items-start gap-2 text-sm text-amber-200" role="alert">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {option.warning}
          </p>
        )}
      </section>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Zpět
        </Button>
        <Button
          type="button"
          className="touch-target gap-2"
          disabled={busy || !option.available}
          onClick={() => onConfirm({ concept, enclosureId: mainId, secondEnclosureId: option.second ? secondId : null, ...(explicit ? { fillRows: true } : {}) })}
          data-testid="layout-wizard-confirm"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {confirmLabel} – {option.short}
        </Button>
      </DialogFooter>
    </>
  );
}

function ConceptCard({ option, selected, onSelect }: { option: LayoutOptionDto; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={!option.available}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-2 rounded-xl border-2 bg-card p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        selected ? "border-primary shadow-lg shadow-primary/10" : "border-border hover:border-primary/50",
      )}
      data-testid={`layout-option-${option.concept}`}
      data-available={option.available}
    >
      <span className="flex items-start gap-2">
        <span className="text-xl leading-none" aria-hidden>
          {option.icon}
        </span>
        <span className="min-w-0 flex-1 font-semibold">{option.title}</span>
        {option.recommended ? <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">Doporučeno</span> : null}
        {selected ? <Check className="size-5 shrink-0 text-primary" aria-hidden /> : null}
      </span>
      <span className="text-xs text-muted-foreground">{option.description}</span>
      <RailsPreview option={option} />
      <span className="font-mono text-xs" data-testid={`layout-summary-${option.concept}`}>
        {option.summary}
      </span>
      {option.available ? (
        <span className="text-xs text-emerald-300">
          ✓ {option.main.enclosures[0] ? `${option.main.enclosures[0].manufacturer} ${option.main.enclosures[0].model}` : ""}
          {option.second?.enclosures[0] ? ` + ${option.second.enclosures[0].manufacturer} ${option.second.enclosures[0].model}` : ""}
        </span>
      ) : (
        <span className="text-xs text-amber-200">{option.warning}</span>
      )}
      <span className="text-[11px] text-muted-foreground">{option.examples}</span>
    </button>
  );
}

/** Miniatura lišt: dvě pole vedle sebe, přepážka, obsazenost lišt. */
function RailsPreview({ option }: { option: LayoutOptionDto }) {
  const boards: { title: string | null; rails: LayoutRailDto[]; fields: 1 | 2; partition: number | null }[] =
    option.concept === "two_boards"
      ? [{ title: "RH1", rails: option.main.rails, fields: 1, partition: null }, ...(option.second ? [{ title: "RH2", rails: option.second.rails, fields: 1 as const, partition: null }] : [])]
      : [{ title: null, rails: option.main.rails, fields: option.fields, partition: option.partitionAfterRail }];
  return (
    <span className="flex flex-wrap items-start gap-3" aria-hidden>
      {boards.map((board, index) => (
        <span key={index} className="flex flex-col gap-1 rounded-md border border-border bg-zinc-950/70 p-1.5">
          {board.title ? <span className="font-mono text-[10px] text-muted-foreground">{board.title}</span> : null}
          <span className="flex gap-1.5">
            {(board.fields === 2 ? [0, 1] : [0]).map((field) => (
              <span key={field} className={cn("flex flex-col gap-1", field === 1 && "border-l-2 border-dashed border-zinc-500 pl-1.5")}>
                {board.rails
                  .map((rail, railIndex) => ({ rail, railIndex }))
                  .filter(({ rail }) => board.fields === 1 || rail.field === field)
                  .map(({ rail, railIndex }) => (
                    <span key={railIndex} className="flex flex-col">
                      <span className="relative block h-2.5 overflow-hidden rounded-sm bg-zinc-800" style={{ width: Math.max(28, rail.capacity * 4) }}>
                        <span className={cn("absolute inset-y-0 left-0", rail.low ? "bg-cyan-400" : "bg-amber-400")} style={{ width: `${Math.min(100, (rail.used / rail.capacity) * 100)}%` }} />
                      </span>
                      {board.partition !== null && railIndex + 1 === board.partition ? <span className="mt-0.5 block h-px w-full bg-amber-500" /> : null}
                    </span>
                  ))}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

/** Krátký název modelu bez závorky s poli („ComfortLine CA27V“). */
const modelName = (enclosure: Pick<EnclosureOptionDto, "manufacturer" | "model">) => `${enclosure.manufacturer} ${enclosure.model.replace(/\s*\(.*\)$/, "")}`;

/**
 * Fáze 114: „📦 Zvolte velikost rozvodnice a požadovanou rezervu“ – karty od nejmenší vyhovující po větší skříně
 * (kapacita, rezerva v % a ve volných modulech, skutečné modely z databáze); zvolená velikost = počet DIN lišt rozváděče.
 */
function SizePicker({ title, board, tier, onTier, testId }: { title: string | null; board: LayoutBoardDto; tier: SizeTierDto | null; onTier: (tier: SizeTierDto) => void; testId: string }) {
  if (!board.tiers.length) return null;
  return (
    <div className="flex flex-col gap-2" data-testid={`${testId}s`}>
      <p className="text-sm font-semibold">
        📦 Zvolte velikost rozvodnice a požadovanou rezervu (dle ČSN EN IEC 61439 min. 20 %){title ? ` – ${title}` : ""}:
      </p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label={`Velikost rozvodnice${title ? ` ${title}` : ""}`}>
        {board.tiers.map((candidate) => {
          const selected = candidate.key === tier?.key;
          const makers = [...new Set(candidate.enclosures.map(modelName))].slice(0, 4);
          return (
            <button
              key={candidate.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onTier(candidate)}
              className={cn("flex min-w-0 flex-col gap-1 rounded-xl border-2 bg-card p-2.5 text-left text-xs transition-colors", selected ? "border-primary shadow-lg shadow-primary/10" : "border-border hover:border-primary/50")}
              data-testid={`${testId}-${candidate.key}`}
              data-reserve={candidate.reservePercent}
            >
              <span className="flex items-start gap-1.5">
                <b className="min-w-0 flex-1 text-sm leading-snug">{candidate.label}</b>
                {candidate.recommended ? <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">Doporučeno</span> : null}
                {selected ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
              </span>
              <b className={cn("leading-snug", candidate.reservePercent >= 20 ? "text-emerald-300" : "text-amber-200")} data-testid={`${testId}-reserve`}>
                {candidate.reserve}
              </b>
              <span className="leading-snug text-muted-foreground">{makers.join(" · ")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EnclosureList({ title, board, enclosures, selected, onPick, testId }: { title: string | null; board: LayoutBoardDto; enclosures: readonly EnclosureOptionDto[]; selected: string | null; onPick: (id: string) => void; testId: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {title ? <p className="text-xs font-semibold text-muted-foreground">{title}</p> : null}
      <p className="text-xs text-muted-foreground">
        Potřeba: {board.need.fields === 2 ? `2 pole × ${board.need.rows} řad po ${board.need.fieldWidth} M` : `${board.need.rows} × ${board.need.fieldWidth} M`} · obsazeno {n(board.need.usedModules)} M, se zálohou 25 % {board.need.requiredModules} M · ztráty {n(board.need.lossW)} W
      </p>
      <ul className="flex flex-col gap-1.5" role="radiogroup" aria-label={title ?? "Rozvodnice"}>
        {enclosures.map((enclosure) => (
          <li key={enclosure.id}>
            <EnclosureRow enclosure={enclosure} selected={enclosure.id === selected} onPick={() => onPick(enclosure.id)} testId={`${testId}-${enclosure.id}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EnclosureRow({ enclosure, selected, onPick, testId }: { enclosure: EnclosureOptionDto; selected: boolean; onPick: () => void; testId: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onPick}
      className={cn("flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-left text-sm", selected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50")}
      data-testid={testId}
    >
      <span className="font-semibold">
        {enclosure.manufacturer} {enclosure.model}
      </span>
      <span className="font-mono text-xs text-muted-foreground">
        {enclosure.fields >= 2 ? `${enclosure.fields} pole × ${enclosure.rows} řad po ${enclosure.fieldWidth} M` : `${enclosure.rows} × ${enclosure.modulesPerRow} M`} = {enclosure.totalModules} M
      </span>
      <span className="text-xs text-muted-foreground">
        {enclosure.widthMm} × {enclosure.heightMm} × {enclosure.depthMm} mm · {enclosure.ipRating} · {INSTALLATION[enclosure.installation] ?? enclosure.installation}
      </span>
      <span className="text-xs">{enclosure.mpn ? `obj. č. ${enclosure.mpn}` : "orientační typ – objednací číslo ověřte u výrobce"}</span>
      <span className="text-xs text-muted-foreground">
        P<sub>max</sub> {enclosure.pMaxW} W{enclosure.pMaxEstimated ? " (odhad – výrobce neuvádí)" : ""} · rezerva {enclosure.reservePercent} %
      </span>
      {enclosure.verified ? <span className="rounded-full border border-emerald-500/50 px-1.5 text-[11px] text-emerald-300">katalog výrobce</span> : null}
      {selected ? <Check className="ml-auto size-4 text-primary" aria-hidden /> : null}
    </button>
  );
}
