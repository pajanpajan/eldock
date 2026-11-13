import type { InstallLevel } from "@/engine/floorplan-bridge";
import { DEFAULT_HOURLY_RATE, buildQuote } from "@/lib/quoting/quote-engine";
import { floorplanQuoteWork } from "@/lib/quoting/quote-sources";

import { createFrame } from "./floorplan-frames";
import {
  allElements,
  analyzeDraft,
  convertForLevel,
  floorsOf,
  lightSpecOf,
  paletteItem,
  switchFloor,
  type EditorElement,
  type FloorplanDraft,
  type ProjectVariant,
  type VariantMeta,
  type VariantSnapshot,
} from "./floorplan-editor";
import { roomPolygon } from "./room-geometry";
import { SMART_SYSTEMS, type SmartSystemId } from "./smart-home";
import { compileFloorplanBom } from "./wiring-bom";

// Fáze 109: převod návrhu Klasická instalace 230 V ⇄ Chytrá domácnost (Smart Home) se zachováním původního návrhu jako
// přepínatelné varianty téže zakázky (`projectVariants`). Převod vypínačů na sběrnicová tlačítka 24 V DC a zpět (řazení
// 1 / 5 / 6 / 7 podle počtu ovládacích míst), sloučení tlačítek u dveří do vícekanálového tlačítka (světla) nebo do
// víceramečku (světlo + žaluzie), hvězdicové trasy + sběrnice (úroveň instalace), volitelně stmívání hlavních světel
// a čidla přítomnosti v chodbách a koupelnách. Trasy, okruhy, rozváděč i kusovník se přepočítají z převedeného nákresu.
// Čisté funkce nad nákresem.

export type ConversionTarget = "smart" | "classic";

export interface SmartConversionOptions {
  system: SmartSystemId;
  /** Designová řada ovladačů („ABB|Zoni“); null = vlastní design systému (Loxone, TapHome). */
  series: string | null;
  /** Nahradit klasické vypínače 230 V (č. 1, 5, 6, 7) sběrnicovými tlačítky 24 V DC. */
  replaceSwitches: boolean;
  /** Sloučit vícenásobné vypínače u dveří do jednoho vícekanálového tlačítka / víceramečku. */
  mergeDoorControls: boolean;
  /** Hvězdicové větve světel a žaluzií do rozváděče + sběrnice 24 V DC; bez = hybrid / retrofit (kabeláž zůstane). */
  starTopology: boolean;
  /** Hlavní světla obytných místností stmívatelná (stmívací akční člen). */
  dimMainLights: boolean;
  /** Stropní čidla přítomnosti do chodeb a koupelen. */
  addPresence: boolean;
}

export interface ClassicConversionOptions {
  /** Designová řada vypínačů 230 V („ABB|Levit“). */
  series: string | null;
}

export type ConversionRequest = { target: "smart"; options: SmartConversionOptions } | { target: "classic"; options: ClassicConversionOptions };

/** Kompatibilní designové řady ovladačů podle systému (první = doporučená). */
export const SERIES_BY_SYSTEM: Record<SmartSystemId, readonly { value: string | null; label: string }[]> = {
  abb_freeathome: [
    { value: "ABB|Zoni", label: "ABB Zoni®" },
    { value: "ABB|Levit", label: "ABB Levit®" },
    { value: "ABB|Tango", label: "ABB Tango®" },
    { value: "ABB|future linear", label: "Busch-Jaeger future® linear" },
  ],
  abb_knx: [
    { value: "ABB|Levit", label: "ABB Levit®" },
    { value: "ABB|Zoni", label: "ABB Zoni®" },
    { value: "ABB|future linear", label: "Busch-Jaeger future® linear" },
    { value: "ABB|solo", label: "Busch-Jaeger solo®" },
  ],
  loxone: [{ value: null, label: "Loxone Touch Pure (vlastní design Loxone)" }],
  taphome: [{ value: null, label: "TapHome (vlastní design ovladačů)" }],
};

/** Designové řady vypínačů 230 V pro zpětný převod. */
export const CLASSIC_SERIES: readonly { value: string; label: string }[] = [
  { value: "ABB|Levit", label: "ABB Levit®" },
  { value: "ABB|Zoni", label: "ABB Zoni®" },
  { value: "ABB|Tango", label: "ABB Tango®" },
  { value: "ABB|Time", label: "ABB Time®" },
  { value: "Schneider|Asfora", label: "Schneider Asfora" },
  { value: "Hager|lumina", label: "Hager lumina" },
  { value: "Legrand|Valena Life", label: "Legrand Valena Life" },
];

export const SYSTEM_LABELS: Record<SmartSystemId, string> = {
  abb_freeathome: "ABB-free@home®",
  abb_knx: "ABB i-bus® KNX",
  loxone: "Loxone (Miniserver + Tree)",
  taphome: "TapHome",
};

export const defaultSmartOptions = (system: SmartSystemId = "abb_freeathome"): SmartConversionOptions => ({
  system,
  series: SERIES_BY_SYSTEM[system][0].value,
  replaceSwitches: true,
  mergeDoorControls: true,
  starTopology: true,
  dimMainLights: false,
  addPresence: false,
});

export const isSmartSystem = (value: string): value is SmartSystemId => SMART_SYSTEMS.some((system) => system.id === value);

/** Klasické ovladače → sběrnicové prvky (zbytek – termostaty, bezdrátové prvky – převede `convertForLevel`). */
const CLASSIC_TO_BUS: Readonly<Record<string, string>> = {
  "switch-1": "bus-1",
  "switch-led": "bus-1",
  "switch-ip44": "bus-1",
  "abb-1so": "bus-1",
  "abb-1s": "bus-1",
  "abb-1sso": "bus-1",
  "switch-6": "bus-1",
  "switch-7": "bus-1",
  "abb-7so": "bus-1",
  button: "bus-1",
  "abb-10so": "bus-1",
  "wireless-1": "bus-1",
  dimmer: "bus-2",
  "wireless-2": "bus-2",
  "switch-5": "bus-2",
  "switch-6-6": "bus-2",
  "abb-1-1": "bus-2",
  "abb-6-6-0": "bus-2",
  "button-2": "bus-2",
  blind: "bus-blind",
  pir: "bus-presence",
  "wireless-pir": "bus-presence",
};

/** Sběrnicová tlačítka světel podle počtu kanálů. */
const BUS_BUTTONS: readonly { item: string; channels: number }[] = [
  { item: "bus-1", channels: 1 },
  { item: "bus-2", channels: 2 },
  { item: "bus-4", channels: 4 },
  { item: "bus-6", channels: 6 },
];
const channelsOf = (item: string) => BUS_BUTTONS.find((button) => button.item === item)?.channels ?? 0;
const isLightButton = (element: EditorElement) => channelsOf(element.item) > 0;

/** Vzdálenost ovladačů „u jedněch dveří“ [mm]. */
export const DOOR_MERGE_MM = 350;

const LIVING_ROOM = /obýv|obyv|ložn|lozn|pokoj|jídel|jidel|kuchyň|kuchyn|pracovn|dětsk|detsk|salon/i;
const PRESENCE_ROOM = /chodb|předsí|predsi|hala|koupel|wc|záchod|zachod|toalet/i;

export interface ConversionSummary {
  target: ConversionTarget;
  converted: number;
  merged: number;
  framed: number;
  removed: number;
  added: number;
  dimmed: number;
  lines: string[];
}

const emptySummary = (target: ConversionTarget): ConversionSummary => ({ target, converted: 0, merged: 0, framed: 0, removed: 0, added: 0, dimmed: 0, lines: [] });

/** Prvky bez rámečků, které obsahují odebrané prvky (rámeček s 1 přístrojem zaniká). */
function withoutElements(draft: FloorplanDraft, removed: ReadonlySet<string>): FloorplanDraft {
  if (!removed.size) return draft;
  return {
    ...draft,
    elements: draft.elements.filter((element) => !removed.has(element.id)),
    frames: draft.frames.map((frame) => ({ ...frame, members: frame.members.filter((id) => !removed.has(id)) })).filter((frame) => frame.members.length >= 2),
  };
}

const framed = (draft: FloorplanDraft, id: string) => draft.frames.some((frame) => frame.members.includes(id));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Tlačítka světel u jedněch dveří → jedno vícekanálové tlačítko; světlo + žaluzie → společný víceramček. */
function mergeDoorControls(draft: FloorplanDraft, summary: ConversionSummary): FloorplanDraft {
  const removed = new Set<string>();
  let elements = draft.elements;
  const buttons = elements.filter((element) => isLightButton(element) && !framed(draft, element.id));
  for (const anchor of buttons) {
    if (removed.has(anchor.id)) continue;
    const group = buttons.filter((other) => other.id !== anchor.id && !removed.has(other.id) && other.room === anchor.room && distance(other, anchor) <= DOOR_MERGE_MM);
    if (!group.length) continue;
    let channels = channelsOf(anchor.item);
    const taken: EditorElement[] = [];
    for (const other of group) {
      if (channels + channelsOf(other.item) > 6) continue;
      channels += channelsOf(other.item);
      taken.push(other);
    }
    if (!taken.length) continue;
    const target = BUS_BUTTONS.find((button) => button.channels >= channels) ?? BUS_BUTTONS[BUS_BUTTONS.length - 1];
    const controls = [...new Set([anchor, ...taken].flatMap((element) => element.controls))];
    for (const other of taken) removed.add(other.id);
    elements = elements.map((element) => (element.id === anchor.id ? { ...element, item: target.item, controls } : element));
    summary.merged += taken.length;
  }
  let next = withoutElements({ ...draft, elements }, removed);
  // Žaluziové tlačítko u tlačítka světel → společný víceramček (párování žaluzie zůstane platné)
  for (const blind of next.elements.filter((element) => element.item === "bus-blind" && !framed(next, element.id))) {
    const partner = next.elements.find((element) => isLightButton(element) && element.room === blind.room && !framed(next, element.id) && distance(element, blind) <= DOOR_MERGE_MM);
    if (!partner) continue;
    const result = createFrame(next, [partner.id, blind.id]);
    if (result.ok) {
      next = result.draft;
      summary.framed += 1;
    }
  }
  return next;
}

/** Těžiště polygonu místnosti. */
function roomCenter(room: FloorplanDraft["rooms"][number]): { x: number; y: number } {
  const points = roomPolygon(room);
  if (!points.length) return { x: room.x + room.w / 2, y: room.y + room.h / 2 };
  return { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
}

let sequence = 0;
const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(sequence++).toString(36)}`;

function floorToSmart(draft: FloorplanDraft, options: SmartConversionOptions, summary: ConversionSummary): FloorplanDraft {
  const replace = options.replaceSwitches && options.starTopology;
  let elements = draft.elements.map((element) => {
    const target = replace ? CLASSIC_TO_BUS[element.item] : undefined;
    let next = element;
    if (target) {
      summary.converted += 1;
      // Sběrnicový prvek přebírá řadu nákresu (zvolená designová řada ovladačů), produkt a varianta panelu se ruší
      next = { ...next, item: target, series: null, product: undefined, productVariant: undefined, productBox: undefined, mountHeightMm: target === "bus-presence" ? null : next.mountHeightMm };
    }
    if (options.dimMainLights && paletteItem(next.item)?.kind === "light" && LIVING_ROOM.test(next.room) && !lightSpecOf(next).dimmable) {
      summary.dimmed += 1;
      next = { ...next, light: { ...lightSpecOf(next), dimmable: true } };
    }
    return next;
  });
  if (options.addPresence) {
    for (const room of draft.rooms) {
      if (!PRESENCE_ROOM.test(room.name)) continue;
      if (elements.some((element) => element.room === room.name && (element.item === "bus-presence" || element.item === "pir"))) continue;
      const center = roomCenter(room);
      elements = [...elements, { id: newId("e"), item: "bus-presence", x: Math.round(center.x), y: Math.round(center.y), room: room.name, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null }];
      summary.added += 1;
    }
  }
  const next = { ...draft, elements };
  return replace && options.mergeDoorControls ? mergeDoorControls(next, summary) : next;
}

function floorToClassic(draft: FloorplanDraft, summary: ConversionSummary): FloorplanDraft {
  // Ovládací místa každého světla (kolik tlačítek ho ovládá) → řazení 1 / 6 / 7
  const points = new Map<string, EditorElement[]>();
  for (const element of draft.elements) {
    if (!isLightButton(element)) continue;
    for (const light of element.controls) points.set(light, [...(points.get(light) ?? []), element]);
  }
  /** Krajní ovládací místa (nejvzdálenější dvojice) = střídavé č. 6, ostatní křížové č. 7. */
  const ends = new Set<string>();
  for (const controllers of points.values()) {
    if (controllers.length < 3) continue;
    let best: [EditorElement, EditorElement] = [controllers[0], controllers[1]];
    for (const a of controllers) for (const b of controllers) if (distance(a, b) > distance(best[0], best[1])) best = [a, b];
    ends.add(best[0].id);
    ends.add(best[1].id);
  }
  const elements = draft.elements.map((element) => {
    if (!isLightButton(element)) return element;
    const most = Math.max(1, ...element.controls.map((light) => points.get(light)?.length ?? 1));
    const dimmed = element.controls.some((light) => lightSpecOf(draft.elements.find((candidate) => candidate.id === light) ?? {}).dimmable);
    const target = most >= 3 ? (ends.has(element.id) ? "switch-6" : "switch-7") : most === 2 ? "switch-6" : element.controls.length >= 2 ? "switch-5" : dimmed ? "dimmer" : "switch-1";
    summary.converted += 1;
    return { ...element, item: target, series: null, product: undefined, productVariant: undefined, productBox: undefined };
  });
  return { ...draft, elements };
}

/** Prvky, které v cílové úrovni nemají obdobu: převod podle úrovně instalace (fáze 57) nebo odebrání. */
function finishLevel(draft: FloorplanDraft, level: InstallLevel, summary: ConversionSummary): FloorplanDraft {
  const result = convertForLevel(draft, level);
  summary.converted += result.changes.reduce((sum, row) => sum + row.count, 0);
  summary.removed += result.removed;
  return result.draft;
}

/** Převod všech podlaží (každé podlaží se převede jako aktivní, pak se vrátí původní aktivní podlaží). */
function convertFloors(draft: FloorplanDraft, convert: (floor: FloorplanDraft) => FloorplanDraft): FloorplanDraft {
  const active = draft.floorId;
  let current = draft;
  for (const floor of floorsOf(draft)) current = convert(switchFloor(current, floor.id));
  return switchFloor(current, active);
}

const levelLabel = (installation: InstallLevel, system: string | null) =>
  installation === "classic" ? "Klasická 230 V" : installation === "smart_retrofit" ? "Hybrid / Retrofit" : `Smart Home – ${system && isSmartSystem(system) ? SYSTEM_LABELS[system] : "sběrnice"}`;

/** „⚡ Varianta 1: Klasická 230 V (Původní)“ / „🤖 Varianta 2: Smart Home – ABB-free@home®“. */
export function variantLabel(index: number, installation: InstallLevel, system: string | null, original = false): string {
  return `${installation === "classic" ? "⚡" : "🤖"} Varianta ${index}: ${levelLabel(installation, system)}${original ? " (Původní)" : ""}`;
}

/** Nejvýš variant jedné zakázky (snímky se ukládají v nákresu – limit velikosti půdorysu). */
export const MAX_VARIANTS = 4;

/** Snímek „instalační“ části nákresu: prvky a rámečky všech podlaží, úroveň instalace, systém, řada, barvy a trasy. */
export function variantSnapshot(draft: FloorplanDraft): VariantSnapshot {
  return {
    floors: floorsOf(draft).map((floor) => ({ id: floor.id, elements: floor.elements, frames: floor.frames })),
    installation: draft.installation,
    smartSystem: draft.smartSystem,
    series: draft.series,
    color: draft.color,
    frameColor: draft.frameColor,
    smartExtras: draft.smartExtras,
    routeEdits: draft.routeEdits,
    mode: draft.mode,
  };
}

/** Použije snímek varianty (místnosti, podklad a ostatní nastavení zakázky zůstávají společné). */
export function applySnapshot(draft: FloorplanDraft, snapshot: VariantSnapshot): FloorplanDraft {
  const floorOf = (id: string) => snapshot.floors.find((floor) => floor.id === id);
  const active = floorOf(draft.floorId);
  return {
    ...draft,
    elements: active ? active.elements : draft.elements,
    frames: active ? active.frames : draft.frames,
    otherFloors: draft.otherFloors.map((floor) => {
      const saved = floorOf(floor.id);
      return saved ? { ...floor, elements: saved.elements, frames: saved.frames } : floor;
    }),
    installation: snapshot.installation,
    smartSystem: snapshot.smartSystem,
    series: snapshot.series,
    color: snapshot.color,
    frameColor: snapshot.frameColor,
    smartExtras: snapshot.smartExtras,
    routeEdits: snapshot.routeEdits,
    mode: snapshot.mode,
  };
}

const variantNumber = (id: string) => Number(/^v(\d+)$/.exec(id)?.[1] ?? 0);

/** Aktivní varianta (bez uloženého označení = původní návrh „Varianta 1“). */
export function activeVariantOf(draft: FloorplanDraft, now = 0): VariantMeta {
  return draft.activeVariant ?? { id: "v1", label: variantLabel(1, draft.installation, draft.smartSystem, true), installation: draft.installation, smartSystem: draft.installation === "classic" ? null : draft.smartSystem, createdAt: now };
}

/** Všechny varianty zakázky (aktivní i uložené) podle pořadí. */
export function variantList(draft: FloorplanDraft): (VariantMeta & { active: boolean })[] {
  const active = activeVariantOf(draft);
  return [{ ...active, active: true }, ...(draft.projectVariants ?? []).filter((variant) => variant.id !== active.id).map(({ snapshot: _snapshot, ...meta }) => {
    void _snapshot;
    return { ...meta, active: false };
  })].sort((a, b) => variantNumber(a.id) - variantNumber(b.id));
}

export type ConversionResult = { ok: true; draft: FloorplanDraft; summary: ConversionSummary; variant: VariantMeta } | { ok: false; error: string };

/**
 * 🔄 Převod návrhu. Původní návrh se NIKDY nepřepíše – uloží se jako varianta do `projectVariants` a převedený návrh
 * se stane aktivní variantou (přepínač nad plátnem).
 */
export function convertInstallationMode(draft: FloorplanDraft, request: ConversionRequest, now: number = Date.now()): ConversionResult {
  const smart = draft.installation !== "classic";
  if (request.target === "smart" && smart && draft.installation === "bus_loxone" && draft.smartSystem === request.options.system) {
    return { ok: false, error: "Návrh už je chytrá domácnost tohoto systému – zvolte jiný systém nebo převod na klasickou instalaci." };
  }
  if (request.target === "classic" && !smart) return { ok: false, error: "Návrh už je klasická instalace 230 V." };
  const current = activeVariantOf(draft, now);
  const others = (draft.projectVariants ?? []).filter((variant) => variant.id !== current.id);
  if (others.length + 2 > MAX_VARIANTS) return { ok: false, error: `Zakázka už má ${MAX_VARIANTS} varianty – nepotřebnou nejdřív odeberte.` };
  const saved: ProjectVariant = { ...current, snapshot: variantSnapshot(draft) };
  const summary = emptySummary(request.target);
  let converted: FloorplanDraft;
  if (request.target === "smart") {
    const options = request.options;
    converted = convertFloors(draft, (floor) => floorToSmart(floor, options, summary));
    converted = finishLevel(converted, options.starTopology ? "bus_loxone" : "smart_retrofit", summary);
    converted = {
      ...converted,
      smartSystem: options.system,
      series: options.series ?? converted.series,
      routeEdits: {},
    };
    summary.lines.push(
      `${summary.converted} vypínačů a čidel převedeno na sběrnicové prvky 24 V DC`,
      ...(summary.merged ? [`${summary.merged} tlačítek u dveří sloučeno do vícekanálových tlačítek`] : []),
      ...(summary.framed ? [`${summary.framed}× světlo + žaluzie ve společném víceramečku`] : []),
      ...(summary.dimmed ? [`${summary.dimmed} hlavních světel stmívatelných`] : []),
      ...(summary.added ? [`${summary.added} stropních čidel přítomnosti v chodbách a koupelnách`] : []),
      options.starTopology ? "Trasy světel a žaluzií přepočítány na hvězdu do rozváděče + sběrnice 24 V DC" : "Hybrid / retrofit – kabeláž 230 V zůstává, moduly pod vypínače",
    );
  } else {
    converted = convertFloors(draft, (floor) => floorToClassic(floor, summary));
    converted = finishLevel(converted, "classic", summary);
    converted = { ...converted, series: request.options.series ?? converted.series, routeEdits: {} };
    summary.lines.push(
      `${summary.converted} sběrnicových prvků převedeno na klasické vypínače (řazení 1, 5, 6, 7) a spínače`,
      ...(summary.removed ? [`${summary.removed} sběrnicových prvků bez klasické náhrady odebráno (dotykové panely, čidla)`] : []),
      "Trasy přepočítány na klasické okruhy 230 V",
    );
  }
  const index = Math.max(1, ...[current, ...others].map((variant) => variantNumber(variant.id))) + 1;
  const variant: VariantMeta = {
    id: `v${index}`,
    label: variantLabel(index, converted.installation, converted.installation === "classic" ? null : converted.smartSystem),
    installation: converted.installation,
    smartSystem: converted.installation === "classic" ? null : converted.smartSystem,
    createdAt: now,
  };
  return { ok: true, draft: { ...converted, projectVariants: [...others, saved], activeVariant: variant, updatedAt: now }, summary, variant };
}

/** Přepnutí varianty jedním klikem – aktivní návrh se uloží, zvolený se načte. */
export function switchProjectVariant(draft: FloorplanDraft, variantId: string, now: number = Date.now()): FloorplanDraft {
  const target = (draft.projectVariants ?? []).find((variant) => variant.id === variantId);
  if (!target) return draft;
  const current = activeVariantOf(draft, now);
  const saved: ProjectVariant = { ...current, snapshot: variantSnapshot(draft) };
  const others = (draft.projectVariants ?? []).filter((variant) => variant.id !== variantId && variant.id !== current.id);
  const { snapshot, ...meta } = target;
  return { ...applySnapshot(draft, snapshot), projectVariants: [...others, saved], activeVariant: meta, updatedAt: now };
}

/** Odebrání uložené (neaktivní) varianty. */
export function removeProjectVariant(draft: FloorplanDraft, variantId: string): FloorplanDraft {
  if (draft.activeVariant?.id === variantId) return draft;
  return { ...draft, projectVariants: (draft.projectVariants ?? []).filter((variant) => variant.id !== variantId) };
}

/** Nákres uložené varianty (pro srovnání metráže a ceny). */
export function variantDraft(draft: FloorplanDraft, variantId: string): FloorplanDraft | null {
  if (activeVariantOf(draft).id === variantId) return draft;
  const target = (draft.projectVariants ?? []).find((variant) => variant.id === variantId);
  return target ? applySnapshot(draft, target.snapshot) : null;
}

export interface VariantMetrics {
  /** Metráž kabelů ve zvoleném režimu tras [m]. */
  cableM: number;
  /** Přístroje a vývody v kusovníku [ks]. */
  devices: number;
  /** Montáž, zapojení a revize podle normohodin × výchozí sazba [Kč bez DPH] – bez materiálu. */
  laborCzk: number;
  laborHours: number;
}

/** Ukazatel varianty: metráž kabelů, kusy přístrojů a orientační cena práce (generátor nabídky, fáze 105). */
export function variantMetrics(draft: FloorplanDraft): VariantMetrics {
  const analysis = analyzeDraft(draft);
  const byCable = analysis.summary.byCable;
  const bom = compileFloorplanBom(draft, { installation: draft.installation, cables: byCable });
  const work = floorplanQuoteWork({ elements: allElements(draft), bom, byCable, circuits: analysis.circuits.circuits });
  const quote = buildQuote([], work, {
    scope: "floorplan",
    hourlyRate: DEFAULT_HOURLY_RATE,
    construction: "aac",
    discountPct: 0,
    vatRate: 21,
    layout: "items",
    number: "",
    // Datum jen pro platnost nabídky (do srovnání variant nevstupuje)
    issuedAt: "2026-01-01",
    validityDays: 14,
    customer: { name: "" },
    supplier: { name: "" },
    title: "",
  });
  return {
    cableM: Math.round(byCable.reduce((sum, row) => sum + row.meters, 0)),
    devices: bom.filter((row) => row.unit === "ks").reduce((sum, row) => sum + row.quantity, 0),
    laborCzk: Math.round(quote.internal.labor.reduce((sum, row) => sum + row.priceCzk, 0)),
    laborHours: Math.round(quote.internal.laborHours * 10) / 10,
  };
}
