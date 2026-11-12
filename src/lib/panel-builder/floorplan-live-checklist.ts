// Fáze 92: živý tahák vlastní zakázky ve 2D půdorysu („🧭 Tahák zakázky – Co teď udělat“). Pět bodů se odškrtává samo
// podle stavu nákresu (všechna podlaží): podklad se zkalibrovaným měřítkem nebo místnosti, výrobce a řada přístrojů,
// hlavní rozváděč RH, osazené zásuvky / světla / spotřebiče a vygenerovaný rozváděč. Aktuální bod = první nehotový.
// Čisté funkce.
// Fáze 98: tahák kopíruje 5 fází průvodce (půdorys a místnosti → rozváděč, okna, dveře a nábytek → zásuvkové okruhy
// a spotřebiče → světla, vypínače a Smart Home → kontrola, kusovník a rozváděč); klik na bod přepne editor do fáze.

import { floorsOf, paletteItem, type FloorplanDraft } from "./floorplan-editor";
import { CHECKLIST_PHASES, type FloorplanPhase } from "./floorplan-phases";

export type LiveChecklistId = "base" | "panel" | "sockets" | "lights" | "output";

export interface LiveChecklistItem {
  id: LiveChecklistId;
  /** Fáze průvodce, do které bod patří (klik na bod ji otevře). */
  phase: FloorplanPhase;
  /** „1. Půdorys a místnosti“. */
  label: string;
  ok: boolean;
  detail: string;
}

export interface LiveChecklist {
  items: LiveChecklistItem[];
  done: number;
  /** První nehotový bod (aktuální doporučený krok), null = vše hotovo. */
  current: LiveChecklistId | null;
}

/** České tvary počtu („1 zásuvka“, „3 zásuvky“, „14 zásuvek“). */
export function plural(count: number, one: string, few: string, many: string): string {
  return `${count} ${count === 1 ? one : count >= 2 && count <= 4 ? few : many}`;
}

/** Počty osazených prvků ve všech podlažích (fáze 98 i vybavení – okna, dveře, nábytek, zařizovací předměty). */
export function deviceCounts(draft: FloorplanDraft): { sockets: number; lights: number; appliances: number; controls: number; fittings: number; rooms: number; panel: boolean } {
  let sockets = 0;
  let lights = 0;
  let appliances = 0;
  let controls = 0;
  let fittings = 0;
  let rooms = 0;
  let panel = false;
  for (const floor of floorsOf(draft)) {
    rooms += floor.rooms.length;
    for (const element of floor.elements) {
      const item = paletteItem(element.item);
      const kind = item?.kind;
      if (kind === "single_socket" || kind === "double_socket") sockets += 1;
      else if (kind === "light") lights += 1;
      else if (kind === "appliance") appliances += 1;
      if (item?.group === "controls" || item?.group === "shading") controls += 1;
      if (item?.group === "fixtures" || item?.group === "architecture" || item?.group === "medical") fittings += 1;
      if (element.item === "panel") panel = true;
    }
  }
  return { sockets, lights, appliances, controls, fittings, rooms, panel };
}

/** Podklad PDF / obrázek se zkalibrovaným měřítkem nebo výkres DXF (má vlastní jednotky) na některém podlaží. */
export function calibratedUnderlay(draft: FloorplanDraft): boolean {
  return floorsOf(draft).some((floor) => Boolean(floor.cad) || (Boolean(floor.background) && floor.calibration.state !== "none"));
}

/**
 * Stav taháku. `seriesLabel` = zvolený vzhled („ABB Levit M · Bílá“), `defaultSeries` = řada je výchozí z nového
 * nákresu (tahák připomene změnu podle zákazníka), `generated` = z půdorysu už vznikl rozváděč.
 */
export function liveChecklist(draft: FloorplanDraft, options: { seriesLabel: string; defaultSeries?: boolean; generated: boolean; boxMaker: string }): LiveChecklist {
  const counts = deviceCounts(draft);
  const underlay = calibratedUnderlay(draft);
  const label = (phase: FloorplanPhase) => CHECKLIST_PHASES.find((entry) => entry.phase === phase)!.label;
  const items: LiveChecklistItem[] = [
    {
      id: "base",
      phase: 1,
      label: label(1),
      ok: underlay || counts.rooms > 0,
      detail: [counts.rooms ? plural(counts.rooms, "místnost", "místnosti", "místností") : null, underlay ? "podklad se zkalibrovaným měřítkem" : null].filter(Boolean).join(" · ") || "Nahrajte PDF / DXF a zkalibrujte měřítko, nebo vložte místnost X × Y",
    },
    {
      id: "panel",
      phase: 2,
      label: label(2),
      ok: counts.panel,
      detail: `${counts.panel ? "Rozváděč RH je na plátně – trasy kabelů vedou z něj" : "Rozváděč RH chybí – bez něj nejsou trasy ani okruhy"}${counts.fittings ? ` · ${plural(counts.fittings, "prvek vybavení", "prvky vybavení", "prvků vybavení")}` : ""}`,
    },
    {
      id: "sockets",
      phase: 3,
      label: label(3),
      ok: counts.sockets + counts.appliances > 0,
      detail: `${plural(counts.sockets, "zásuvka", "zásuvky", "zásuvek")} · ${plural(counts.appliances, "spotřebič", "spotřebiče", "spotřebičů")}`,
    },
    {
      id: "lights",
      phase: 4,
      label: label(4),
      ok: counts.lights > 0 && Boolean(draft.series),
      detail: `${draft.series ? `${options.seriesLabel}${options.defaultSeries ? " (výchozí – změňte podle zákazníka)" : ""}` : "Vyberte výrobce, řadu a barvu"} · ${plural(counts.lights, "světlo", "světla", "světel")} · ${plural(counts.controls, "ovladač", "ovladače", "ovladačů")}`,
    },
    {
      id: "output",
      phase: 5,
      label: label(5),
      ok: options.generated,
      detail: options.generated ? "Rozváděč z tohoto půdorysu je vygenerovaný" : `Zkontrolujte trasy, kusovník s krabičkami ${options.boxMaker} a vygenerujte rozváděč`,
    },
  ];
  return { items, done: items.filter((item) => item.ok).length, current: items.find((item) => !item.ok)?.id ?? null };
}

/** Stav taháku v prohlížeči: rozbalený, sbalený do pilulky, trvale vypnutý. */
export type LiveChecklistMode = "open" | "pill" | "off";
export const LIVE_CHECKLIST_KEY = "eldock-floorplan-checklist";
export const isLiveChecklistMode = (value: unknown): value is LiveChecklistMode => value === "open" || value === "pill" || value === "off";
