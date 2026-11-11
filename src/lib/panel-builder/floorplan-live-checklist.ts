// Fáze 92: živý tahák vlastní zakázky ve 2D půdorysu („🧭 Tahák zakázky – Co teď udělat“). Pět bodů se odškrtává samo
// podle stavu nákresu (všechna podlaží): podklad se zkalibrovaným měřítkem nebo místnosti, výrobce a řada přístrojů,
// hlavní rozváděč RH, osazené zásuvky / světla / spotřebiče a vygenerovaný rozváděč. Aktuální bod = první nehotový.
// Čisté funkce.

import { floorsOf, paletteItem, type FloorplanDraft } from "./floorplan-editor";

export type LiveChecklistId = "base" | "series" | "panel" | "devices" | "output";

export interface LiveChecklistItem {
  id: LiveChecklistId;
  /** „1. Podklad nebo místnosti“. */
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

/** Počty osazených prvků ve všech podlažích. */
export function deviceCounts(draft: FloorplanDraft): { sockets: number; lights: number; appliances: number; rooms: number; panel: boolean } {
  let sockets = 0;
  let lights = 0;
  let appliances = 0;
  let rooms = 0;
  let panel = false;
  for (const floor of floorsOf(draft)) {
    rooms += floor.rooms.length;
    for (const element of floor.elements) {
      const kind = paletteItem(element.item)?.kind;
      if (kind === "single_socket" || kind === "double_socket") sockets += 1;
      else if (kind === "light") lights += 1;
      else if (kind === "appliance") appliances += 1;
      if (element.item === "panel") panel = true;
    }
  }
  return { sockets, lights, appliances, rooms, panel };
}

/** Podklad PDF / obrázek se zkalibrovaným měřítkem nebo výkres DXF (má vlastní jednotky) na některém podlaží. */
export function calibratedUnderlay(draft: FloorplanDraft): boolean {
  return floorsOf(draft).some((floor) => Boolean(floor.cad) || (Boolean(floor.background) && floor.calibration.state !== "none"));
}

/**
 * Stav taháku. `seriesLabel` = zvolený vzhled („ABB Levit M · Bílá“), `defaultSeries` = řada je výchozí z nového
 * nákresu (bod je splněný, ale tahák připomene změnu podle zákazníka), `generated` = z půdorysu už vznikl rozváděč.
 */
export function liveChecklist(draft: FloorplanDraft, options: { seriesLabel: string; defaultSeries?: boolean; generated: boolean; boxMaker: string }): LiveChecklist {
  const counts = deviceCounts(draft);
  const underlay = calibratedUnderlay(draft);
  const items: LiveChecklistItem[] = [
    {
      id: "base",
      label: "1. Podklad nebo místnosti",
      ok: underlay || counts.rooms > 0,
      detail: [counts.rooms ? plural(counts.rooms, "místnost", "místnosti", "místností") : null, underlay ? "podklad se zkalibrovaným měřítkem" : null].filter(Boolean).join(" · ") || "Nahrajte PDF / DXF a zkalibrujte měřítko, nebo vložte místnost X × Y",
    },
    {
      id: "series",
      label: "2. Zvolen výrobce a řada vypínačů",
      ok: Boolean(draft.series),
      detail: draft.series ? `${options.seriesLabel}${options.defaultSeries ? " (výchozí – změňte podle zákazníka)" : ""}` : "Vyberte výrobce, řadu a barvu přístrojů",
    },
    {
      id: "panel",
      label: "3. Umístěn hlavní rozváděč (RH)",
      ok: counts.panel,
      detail: counts.panel ? "Rozváděč RH je na plátně – trasy kabelů vedou z něj" : "Rozváděč chybí – bez něj nejsou trasy ani okruhy",
    },
    {
      id: "devices",
      label: "4. Osazeny zásuvky, světla a spotřebiče",
      ok: counts.sockets > 0 && counts.lights > 0,
      detail: `${plural(counts.sockets, "zásuvka", "zásuvky", "zásuvek")} · ${plural(counts.lights, "světlo", "světla", "světel")} · ${plural(counts.appliances, "spotřebič", "spotřebiče", "spotřebičů")}`,
    },
    {
      id: "output",
      label: "5. Kontrola tras, kusovníku a generování rozváděče",
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
