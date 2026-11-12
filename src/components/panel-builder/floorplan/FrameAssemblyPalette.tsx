"use client";

import { LayoutGrid, Minus, Plus, Save, Star, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InstallLevel } from "@/engine/floorplan-bridge";
import { MAX_FRAME_GANGS, assembliesFor, assemblyError, assemblyGangs, assemblyLabel, frameableItems, gangsOf, type FrameAssembly, type FrameLimit } from "@/lib/panel-builder/floorplan-frames";
import { TEMPLATE_LABEL_MAX, favoritesFirst, templatesFor, type AssemblyTemplate } from "@/lib/panel-builder/floorplan-library";
import { cn } from "@/lib/utils";

export interface AssemblyPick {
  key: string;
  members: string[];
  label: string;
  /** Fáze 101: svislá sestava (vypínač nad zásuvkou). */
  orientation?: "vertical";
}

/** Fáze 101: skupina sestav uvnitř sekce palety (zásuvky ve fázi 3, vypínače a ovládání ve fázi 4). */
export const ASSEMBLY_GROUP_TITLE: Record<FrameAssembly["group"], string> = {
  sockets: "Vícerámečky se zásuvkami (2R–5R)",
  controls: "Vícerámečky s vypínači (u dveří / u postele)",
};


/** Fáze 78: hvězdička oblíbené položky (zežloutne; oblíbené jdou na začátek seznamu). */
export function FavoriteStar({ on, label, onToggle, className }: { on: boolean; label: string; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-pressed={on}
      // Krátký název (stav nese aria-pressed) – název položky by se pletl s jejím tlačítkem při hledání podle názvu
      aria-label="Oblíbené"
      title={on ? `${label}: odebrat z oblíbených (vrátí se na své místo)` : `${label}: přidat do oblíbených (přesune se nahoru)`}
      className={cn("shrink-0 rounded p-0.5", on ? "text-amber-300" : "text-muted-foreground/50 hover:text-amber-200", className)}
      data-testid="favorite-star"
    >
      <Star className={cn("size-3.5", on && "fill-current")} aria-hidden />
    </button>
  );
}

/** Fáze 78: pojmenování a uložení sestavy jako šablony firmy (vlastní sestava i osazený víceramček). */
export function SaveTemplateControl({ members, onSave, compact = false, limit }: { members: readonly string[]; onSave: (members: string[], label: string) => string | null; compact?: boolean; limit?: FrameLimit }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const invalid = assemblyError([...members], limit) ?? (members.length < 2 ? "Šablona potřebuje aspoň 2 přístroje v rámečku." : null);
  if (!open)
    return (
      <Button type="button" size="sm" variant="outline" className={cn("h-7 gap-1 text-xs", compact && "px-2")} disabled={Boolean(invalid)} title={invalid ?? undefined} onClick={() => (setLabel(assemblyLabel([...members])), setError(null), setOpen(true))} data-testid="template-save-open">
        <Save className="size-3.5" aria-hidden /> 💾 Uložit tuto sestavu jako šablonu
      </Button>
    );
  const submit = () => {
    const failure = onSave([...members], label);
    if (failure) return setError(failure);
    setOpen(false);
  };
  return (
    <div className="flex flex-col gap-1 rounded-md border border-amber-500/40 bg-background/60 p-1.5" data-testid="template-save">
      <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
        Název šablony (např. „Sestava TV stěna 4R“, „U postele 3R“)
        <Input value={label} maxLength={TEMPLATE_LABEL_MAX} autoFocus onChange={(event) => setLabel(event.target.value)} onKeyDown={(event) => (event.key === "Enter" ? submit() : event.key === "Escape" ? setOpen(false) : undefined)} aria-label="Název šablony sestavy" className="h-7 text-xs" />
      </label>
      {error ? <p className="text-[11px] text-amber-200">{error}</p> : null}
      <div className="flex gap-1">
        <Button type="button" size="sm" className="h-7 flex-1 gap-1 text-xs" onClick={submit} data-testid="template-save-confirm">
          <Save className="size-3.5" aria-hidden /> Uložit šablonu
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>
          Zrušit
        </Button>
      </div>
    </div>
  );
}

/**
 * Fáze 62: sestavy ve víceramečku – samostatný panel nad paletou značek (ne v ní: „2× vypínač č. 1“ se nesmí plést
 * s jednotlivou značkou). Hotové sestavy (zásuvky, vypínače, kombinace) a vlastní složení po pozicích (nejvýš 5 pozic,
 * dvojzásuvka = 2). Vybraná sestava se vloží jedním klikem do půdorysu, přisazená a vyrovnaná v jednom rámečku.
 * Fáze 78: šablony firmy („💾 Uložit tuto sestavu jako šablonu“) a ⭐ oblíbené nahoře (po odebrání zpět na své místo).
 * Fáze 91: jen sestavy, které zvolená řada vyrábí (`limit` – Decento a nástěnné řady bez víceramečku, Time Arbo do 4R …).
 */
export function FrameAssemblyPalette({
  group,
  level,
  limit = { max: MAX_FRAME_GANGS, text: null },
  active,
  onPick,
  templates,
  favorites,
  onFavorite,
  onSaveTemplate,
  onRemoveTemplate,
}: {
  /** Fáze 101: skupina v sekci palety (zásuvky / vypínače). */
  group: FrameAssembly["group"];
  level: InstallLevel;
  active: string | null;
  onPick: (pick: AssemblyPick) => void;
  templates: readonly AssemblyTemplate[];
  favorites: readonly string[];
  onFavorite: (key: string) => void;
  onSaveTemplate: (members: string[], label: string) => string | null;
  onRemoveTemplate: (template: AssemblyTemplate) => void;
  limit?: FrameLimit;
}) {
  const options = frameableItems(level);
  const allowed = new Set(options.map((item) => item.id));
  const max = Math.min(MAX_FRAME_GANGS, limit.max);
  const fits = (members: readonly string[]) => assemblyGangs([...members]) <= max;
  const presets = favoritesFirst(assembliesFor(level).filter((preset) => preset.group === group && fits(preset.members)), (preset) => `assembly:${preset.id}`, favorites);
  // Šablony firmy v obou skupinách (uložená šablona nezmizí z očí, ať obsahuje vypínač, nebo ne)
  const own = favoritesFirst(templatesFor(templates, allowed).filter((template) => fits(template.members)), (template) => `template:${template.id}`, favorites);
  const starred = new Set(favorites);
  const firstSwitch = options.find((option) => option.kind === "switch")?.id ?? "socket";
  const [custom, setCustom] = useState<string[]>(group === "controls" ? [firstSwitch, "socket"] : ["socket", "socket"]);
  const [customOpen, setCustomOpen] = useState(false);
  // Klíč vkládání vlastní sestavy podle skupiny (v kompaktní liště jsou vidět obě skupiny najednou)
  const customKey = `custom-${group}`;
  // Po změně úrovně instalace zůstanou ve vlastní sestavě jen přístroje dostupné na nové úrovni
  const members = custom.filter((id) => allowed.has(id));
  const gangs = assemblyGangs(members);
  const error = assemblyError(members, limit);

  /** Změna vlastní sestavy; když se zrovna vkládá, vkládá se rovnou nová podoba. */
  const change = (next: string[]) => {
    setCustom(next);
    if (active === customKey && !assemblyError(next, limit)) onPick({ key: customKey, members: next, label: assemblyLabel(next) });
  };

  /** Sestava k vložení: `pick` = klíč vkládání (id sestavy / „template:…“), `favorite` = klíč hvězdičky. */
  const chip = (pick: string, favorite: string, label: string, chipMembers: readonly string[], extra?: ReactNode, orientation?: "vertical") => {
    const size = assemblyGangs([...chipMembers]);
    const pressed = active === pick;
    const name = `${label} (${size}R${orientation === "vertical" ? " svislý" : ""})`;
    return (
      <span key={pick} className={cn("flex w-full items-center rounded-md border pr-0.5", pressed ? "border-primary bg-primary/20" : "border-border")} data-favorite={starred.has(favorite) ? "true" : "false"}>
        <button
          type="button"
          aria-pressed={pressed}
          onClick={() => onPick({ key: pick, members: [...chipMembers], label: orientation === "vertical" ? `${label} (svisle)` : label, ...(orientation ? { orientation } : {}) })}
          title={`${name} – přístroje v jednom rámečku, přisazené a vyrovnané`}
          className={cn("flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-left text-[11px] leading-tight", pressed ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          data-assembly={pick}
        >
          <span className="shrink-0 rounded bg-amber-500/20 px-1 font-mono text-[10px] font-bold text-amber-200">
            {size}R{orientation === "vertical" ? " ↕" : ""}
          </span>
          <span className="min-w-0 break-words">{name}</span>
        </button>
        <FavoriteStar on={starred.has(favorite)} label={label} onToggle={() => onFavorite(favorite)} />
        {extra}
      </span>
    );
  };

  return (
    <section aria-label={ASSEMBLY_GROUP_TITLE[group]} className="flex flex-col gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 p-1.5" data-testid="assembly-palette" data-assembly-group={group}>
      <p className="text-[11.5px] leading-tight font-bold text-amber-200">▣ {ASSEMBLY_GROUP_TITLE[group]}</p>
      {/* Fáze 101: šablony přímo v sekci palety (dřív samostatný panel nad paletou) – vloží se celé jedním klikem */}
          <p className="text-[10.5px] leading-tight text-muted-foreground">Celá sestava jedním klikem – u stěny přisazená a natočená ke stěně.</p>
          {/* Fáze 91: limit víceramečku zvolené řady podle katalogu výrobce */}
          {limit.text ? (
            <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100" data-testid="assembly-limit" data-max={max}>
              ℹ️ {limit.text}
            </p>
          ) : null}
          {max >= 2 && own.length ? (
            <div className="flex flex-col gap-1" data-testid="assembly-templates">
              <p className="text-[11px] font-semibold text-amber-100">💾 Šablony firmy</p>
              <div className="flex flex-col gap-1">
                {own.map((template) =>
                  chip(
                    `template:${template.id}`,
                    `template:${template.id}`,
                    template.label,
                    template.members,
                    <button type="button" onClick={() => onRemoveTemplate(template)} aria-label="Smazat šablonu" title={`Smazat šablonu ${template.label}`} className="rounded p-0.5 text-muted-foreground/60 hover:text-red-300" data-testid="template-remove">
                      <Trash2 className="size-3" aria-hidden />
                    </button>,
                  ),
                )}
              </div>
            </div>
          ) : null}
          {max >= 2 ? (
            <div className="flex flex-col gap-1" data-testid="assembly-presets">
              {presets.map((preset) => chip(preset.id, `assembly:${preset.id}`, preset.label, preset.members, undefined, preset.orientation))}
            </div>
          ) : null}
          {max >= 2 ? (
            <button type="button" onClick={() => setCustomOpen((value) => !value)} aria-expanded={customOpen} className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-amber-500/50 px-2 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/10" data-testid="assembly-custom-toggle">
              {customOpen ? "▾" : "+"} Vlastní sestava 2R–{max}R
            </button>
          ) : null}
          {customOpen && max >= 2 ? (
            <div className="flex flex-col gap-1 rounded-lg border border-amber-500/40 bg-amber-500/5 p-1.5" data-testid="assembly-custom">
              {members.map((id, index) => (
                <div key={index} className="flex items-center gap-1">
                  <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{index + 1}.</span>
                  <select
                    value={id}
                    onChange={(event) => change(members.map((current, position) => (position === index ? event.target.value : current)))}
                    aria-label={`Pozice ${index + 1} sestavy`}
                    className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1 text-xs text-foreground dark:bg-input/30"
                  >
                    {options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => change(members.filter((_, position) => position !== index))}
                    disabled={members.length <= 2}
                    aria-label={`Odebrat pozici ${index + 1}`}
                    className="rounded p-0.5 text-muted-foreground hover:text-red-300 disabled:opacity-30"
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => change([...members, "socket"])} disabled={gangs >= max} data-testid="assembly-add">
                  <Plus className="size-3.5" aria-hidden /> Pozice
                </Button>
                <span className={cn("ml-auto font-mono text-[11px]", error ? "text-amber-200" : "text-muted-foreground")} data-testid="assembly-gangs">
                  {gangs}R
                </span>
              </div>
              {error ? <p className="text-[11px] text-amber-200">{error}</p> : null}
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={Boolean(error)}
                aria-pressed={active === customKey}
                onClick={() => onPick({ key: customKey, members, label: assemblyLabel(members) })}
                data-testid="assembly-custom-place"
              >
                <LayoutGrid className="size-3.5" aria-hidden /> Vložit sestavu {gangs}R
              </Button>
              {/* Fáze 78: vlastní sestava jako šablona firmy (vloží se jedním klikem v dalších projektech) */}
              <SaveTemplateControl members={members} onSave={onSaveTemplate} limit={limit} />
            </div>
          ) : null}
    </section>
  );
}

/**
 * Fáze 62: „▦ Přidat do rámečku“ v detailu přístroje – vedle vybraného přístroje se přidá další (stejný nebo jiný)
 * a oba skončí v jednom víceramečku; v rámečku se přidá na jeho konec.
 */
export function AddToFrameControl({ level, defaultItem, gangs, onAdd, limit = { max: MAX_FRAME_GANGS, text: null } }: { level: InstallLevel; defaultItem: string; gangs: number; onAdd: (item: string) => void; limit?: FrameLimit }) {
  const options = frameableItems(level);
  const [item, setItem] = useState(options.some((option) => option.id === defaultItem) ? defaultItem : (options[0]?.id ?? "socket"));
  const next = gangs + gangsOf({ item, frameUnits: 1 });
  const max = Math.min(MAX_FRAME_GANGS, limit.max);
  const full = next > max;
  return (
    <div className="flex flex-col gap-1" data-testid="add-to-frame">
      <div className="flex items-center gap-1 text-xs">
        <span className="shrink-0 font-semibold text-amber-200">▦ Přidat do rámečku:</span>
        <select value={item} onChange={(event) => setItem(event.target.value)} aria-label="Přístroj přidaný do rámečku" className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1 text-xs text-foreground dark:bg-input/30">
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2" disabled={full} onClick={() => onAdd(item)} data-testid="add-to-frame-button">
          <Plus className="size-3.5" aria-hidden /> Přidat
        </Button>
      </div>
      <p className={cn("text-[11px]", full ? "text-amber-200" : "text-muted-foreground")}>
        {full ? (max < MAX_FRAME_GANGS && limit.text ? limit.text : `Rámeček by měl ${next} pozic – víceramček pojme nejvýš ${max}.`) : `Přidá se vedle, přisazený a vyrovnaný (${gangs}R → ${next}R).`}
      </p>
    </div>
  );
}
