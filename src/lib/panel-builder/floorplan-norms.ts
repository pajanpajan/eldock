// Fáze 61: normový hlídač 2D půdorysu – pravidla, která dávají smysl už při kreslení, se zdrojem normy a opravou
// jedním klikem, kde to jde. Koupelnové zóny dle ČSN 33 2000-7-701 ed. 2 (zásuvky a spínače mimo zóny 0–2, tj. dál
// než 0,6 m od vany / sprchy), krytí IP44 v koupelně a venku, doporučení ochrany před obloukovou poruchou (AFDD)
// v ložnicích a dětských pokojích dle ČSN 33 2000-4-42 (čl. 421.7). Čisté funkce.
// Fáze 63: zóny podle skutečného rozměru a natočení předmětu (`fixtures.ts`), umyvadla – zásuvky a spínače mimo svislý
// pás nad a pod umyvadlem (ČSN 33 2130 ed. 4), vzdálenost od hrany vany / sprchy / umyvadla v textu zjištění.
// Fáze 82: zásuvky na světelném okruhu – jištění okruhu 10 / 13 A (nikdy 16 A); zásuvka u kuchyňské linky na světelném
// okruhu = varování s opravou jedním klikem (zpět na zásuvkový okruh).
// Fáze 90: zóny 1 a 2 sahají do výšky 2,25 m (čl. 701.32) – prvek výš (vývod motoru žaluzie v překladu 2,45 m) leží nad
// zónami; čidla na binární vstup (okenní kontakt MAG, čidlo vody) a hlavice nejsou spínače 230 V; hláška jmenuje prvek,
// jeho výšku a vzdálenost od vany / sprchy. U umyvadla hlídá pás 0,2 m pod 1,2 m jen přístroje bez krytí IP44.
// Fáze 91: víceramček, který zvolená řada nevyrábí (Decento, nástěnné řady, Time Arbo / solo carat nad 4R …) – varování
// s rozdělením jedním klikem; ručně zvolená instalační krabice mělčí, než přístroj a svorkování potřebují – varování
// s opravou na doporučenou (hlubokou / s prostorem pro elektroniku) krabici.

import { mountHeight } from "@/engine/floorplan-bridge";

import { BASIN_MARGIN_MM, BASIN_RECOMMENDED_MM, BASIN_STRICT_MM, WASH_AREA_TOP_MM, WASH_HIGH_MM, ZONE2_MM, basinPlacement, distanceToFixture, fixtureGeometry, type FixtureGeometry } from "./fixtures";
import type { BoxChoice } from "./box-options";
import { floorsOf, paletteItem, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { frameLimitOf, gangsOf } from "./floorplan-frames";
import { boxMakerLabel, pickBox, resolveBox, wallTypeOf, type BoxDepthClass } from "./mounting-boxes-catalog";
import { frameRulesOf, splitFrameGangs, splitLabel } from "./residential-series-catalog";

export { ZONE2_MM };

export type NormLevel = "error" | "warning" | "info";

export interface NormIssue {
  id: string;
  rule: "bath-zone" | "basin-area" | "basin-band" | "basin-strict" | "wet-room-ip" | "outdoor-ip" | "afdd" | "fixture-missing" | "lighting-socket" | "lighting-socket-worktop" | "frame-limit" | "box-depth";
  level: NormLevel;
  text: string;
  source: string;
  /** Prvky, kterých se zjištění týká (i z jiných podlaží). */
  elementIds: string[];
  /**
   * Oprava jedním klikem: záměna prvku za jiný z palety (zásuvka → IP44); fáze 82 – zásuvky zpět na zásuvkový okruh;
   * fáze 91 – krabice prvků (`boxes`, „auto“ = doporučená) a rozdělení víceramečků po nejvýš `max` pozicích.
   */
  fix?: { label: string; replace: { from: string; to: string }[]; offLighting?: string[]; boxes?: { id: string; box: BoxChoice }[]; splitFrames?: { id: string; max: number }[] };
}

const cm = (mm: number) => `${Math.round(mm / 10)} cm`;

/** Fáze 90: horní hranice zón 1 a 2 koupelny nad podlahou (ČSN 33 2000-7-701 ed. 2, čl. 701.32). */
export const BATH_ZONE_TOP_MM = 2250;

const WET = /koupel|sprch|wellness|sauna/i;
const OUTDOOR = /terasa|venk|zahrad|balkon|lodžie|lodzie|garáž venku|dvůr/i;
const SLEEP = /ložnic|loznic|dětsk|detsk|pokoj pro hosty|spaní/i;

const isSocket = (element: EditorElement) => {
  const kind = paletteItem(element.item)?.kind;
  return kind === "single_socket" || kind === "double_socket";
};
/**
 * Spínač 230 V pro zóny koupelny a umyvadlo – bez bezdrátových tlačítek, čidel na binární vstup (okenní / dveřní
 * kontakt MAG, čidlo úniku vody – SELV) a termostatických hlavic (fáze 90).
 */
const isSwitch = (element: EditorElement) => {
  const item = paletteItem(element.item);
  return item?.kind === "switch" && !item.wireless && !item.sensor && !item.heatingHead;
};
/** Fáze 90: přístroj v provedení IP44 (zásuvka IP44, vypínač IP44). */
const isIp44 = (element: EditorElement) => {
  const item = paletteItem(element.item);
  return item?.variant === "ip44" || item?.ip44 === true;
};
const FIXTURE_NAME = { bath: { of: "vany", over: "nad vanou" }, shower: { of: "sprchy", over: "nad sprchovým koutem" } } as const;

/** Oprava krytí: jednozásuvky → zásuvka IP44 (dvojzásuvku IP44 paleta nemá – zůstane k ruční záměně). */
const ipFix = (elements: EditorElement[]): Pick<NormIssue, "fix"> => {
  const singles = elements.filter((element) => paletteItem(element.item)?.kind === "single_socket");
  return singles.length ? { fix: { label: `Změnit ${singles.length}× na zásuvku IP44`, replace: singles.map((element) => ({ from: element.id, to: "ip44-socket" })) } } : {};
};

/** Zjištění normového hlídače pro celý dům (všechna podlaží); fáze 91 – `cableEnds` = kabely v krabici prvku (trasy). */
export function floorplanNorms(draft: FloorplanDraft, context: { cableEnds?: Readonly<Record<string, number>> } = {}): NormIssue[] {
  const issues: NormIssue[] = [];
  for (const floor of floorsOf(draft)) {
    const fixtures = floor.elements
      .map((element) => ({ element, geometry: fixtureGeometry(element) }))
      .filter((entry): entry is { element: EditorElement; geometry: FixtureGeometry } => entry.geometry !== null);
    const devices = floor.elements.filter((element) => isSocket(element) || isSwitch(element));
    // Fáze 74: výška krabice rozhoduje u umyvadla, fáze 90 i u zón koupelny (zóny 1 a 2 jen do 2,25 m)
    const heightOf = (element: EditorElement) => {
      const item = paletteItem(element.item);
      if (!item || item.kind === "panel" || item.kind === "riser" || item.kind === "fixture") return 0;
      return element.mountHeightMm ?? item.heightMm ?? mountHeight({ kind: item.kind, variant: item.variant, tag: item.tag }, draft.profile);
    };
    /** Přesný název prvku s výškou do hlášky („Jednozásuvka (výška 300 mm)“). */
    const describe = (element: EditorElement) => `${paletteItem(element.item)?.label ?? element.item} (výška ${Math.round(heightOf(element))} mm)`;
    // Zóny 0–2: zásuvka ani spínač blíž než 0,6 m od hrany vany / sprchy (ve stejné místnosti) a níž než 2,25 m
    const nearestBath = (element: EditorElement) => {
      let best: { distance: number; geometry: FixtureGeometry } | null = null;
      for (const fixture of fixtures) {
        if (fixture.geometry.zone !== "bath" || fixture.element.room !== element.room) continue;
        const distance = distanceToFixture(fixture.geometry, element.x, element.y);
        if (!best || distance < best.distance) best = { distance, geometry: fixture.geometry };
      }
      return best;
    };
    type ZoneHit = { element: EditorElement; hit: { distance: number; geometry: FixtureGeometry } };
    const inZone = devices
      .map((element) => ({ element, hit: nearestBath(element) }))
      .filter((entry): entry is ZoneHit => entry.hit !== null && entry.hit.distance < ZONE2_MM && heightOf(entry.element) <= BATH_ZONE_TOP_MM);
    if (inZone.length) {
      const name = (geometry: FixtureGeometry) => FIXTURE_NAME[geometry.type === "shower" ? "shower" : "bath"];
      const where = (entry: ZoneHit) => (entry.hit.distance > 0 ? `${cm(entry.hit.distance)} od ${name(entry.hit.geometry).of}` : name(entry.hit.geometry).over);
      const text =
        inZone.length === 1
          ? `${floor.name}: ${describe(inZone[0].element)} zasahuje do zóny ${inZone[0].hit.distance > 0 ? 2 : 1} koupelny (${where(inZone[0])}, min. 60 cm) – v zóně 0–2 nesmí být zásuvky ani spínače 230 V, přesuňte ji dál.`
          : `${floor.name}: ${inZone.length}× zásuvka / spínač v zóně 0–2 koupelny – ${inZone
              .slice(0, 4)
              .map((entry) => `${paletteItem(entry.element.item)?.label ?? entry.element.item} (výška ${Math.round(heightOf(entry.element))} mm, ${where(entry)})`)
              .join("; ")}${inZone.length > 4 ? " …" : ""} – min. 60 cm od hrany vany / sprchy do výšky 2,25 m, přesuňte je dál.`;
      issues.push({
        id: `bath-zone:${floor.id}`,
        rule: "bath-zone",
        level: "error",
        text,
        source: "ČSN 33 2000-7-701 ed. 2 – zásuvky a spínače jen mimo zóny 0, 1 a 2 (zóny 1 a 2 do výšky 2,25 m nad podlahou, čl. 701.32; výš, např. vývod motoru žaluzie v překladu, leží nad zónami)",
        elementIds: inZone.map((entry) => entry.element.id),
      });
    }
    // Fáze 74: umyvadlo – umývací prostor (svislý průmět ke stěně do 2,25 m) bez zásuvek a spínačů; níž než 1,2 m navíc
    // 0,2 m od hranice (fáze 90: jen přístroje bez krytí IP44); volitelně přísněji 0,6 m kolem umyvadla (jako zóna 2).
    const basinOf = (element: EditorElement) => {
      const placements = fixtures.filter((fixture) => fixture.geometry.zone === "basin" && fixture.element.room === element.room).map((fixture) => basinPlacement(fixture.geometry, element.x, element.y, heightOf(element), draft.basinZone ?? "norm"));
      return placements.includes("area") ? "area" : placements.includes("band") ? "band" : placements.includes("strict") ? "strict" : null;
    };
    const atBasin = devices.map((element) => ({ element, placement: basinOf(element) }));
    const inArea = atBasin.filter((entry) => entry.placement === "area").map((entry) => entry.element);
    const inBand = atBasin.filter((entry) => entry.placement === "band" && !isIp44(entry.element)).map((entry) => entry.element);
    const strict = atBasin.filter((entry) => entry.placement === "strict").map((entry) => entry.element);
    const basinSource = `ČSN 33 2130 ed. 4 – umyvadlový prostor: svislý průmět umyvadla do ${(WASH_AREA_TOP_MM / 1000).toLocaleString("cs-CZ")} m, zásuvky a spínače 230 V jen vně, níž než ${(WASH_HIGH_MM / 1000).toLocaleString("cs-CZ")} m bez krytí IP44 nejméně ${cm(BASIN_MARGIN_MM)} od hranice, doporučeno ${cm(BASIN_RECOMMENDED_MM)} (pás převzat z ed. 3 čl. 7.8 – v ed. 4 ověřte v plném znění); zóny 0–2 ČSN 33 2000-7-701 platí jen pro vanu a sprchu`;
    const list = (elements: EditorElement[]) => `${elements.slice(0, 4).map(describe).join("; ")}${elements.length > 4 ? " …" : ""}`;
    if (inArea.length) {
      issues.push({
        id: `basin-area:${floor.id}`,
        rule: "basin-area",
        level: "error",
        text:
          inArea.length === 1
            ? `${floor.name}: ${describe(inArea[0])} leží v umyvadlovém prostoru (nad nebo pod umyvadlem) – posuňte ji mimo průmět umyvadla.`
            : `${floor.name}: ${inArea.length}× zásuvka / spínač v umyvadlovém prostoru (nad nebo pod umyvadlem) – ${list(inArea)}; posuňte je mimo průmět umyvadla.`,
        source: basinSource,
        elementIds: inArea.map((element) => element.id),
      });
    }
    if (inBand.length) {
      issues.push({
        id: `basin-band:${floor.id}`,
        rule: "basin-band",
        level: "error",
        text: `${floor.name}: ${inBand.length === 1 ? describe(inBand[0]) : `${inBand.length}× zásuvka / spínač bez krytí IP44 (${list(inBand)})`} – níž než ${(WASH_HIGH_MM / 1000).toLocaleString("cs-CZ")} m blíž než ${cm(BASIN_MARGIN_MM)} od hrany umyvadlového prostoru; posuňte dál od umyvadla (doporučeno ${cm(BASIN_RECOMMENDED_MM)}), výš (od 1,2 m smí být těsně u hranice), nebo použijte provedení IP44.`,
        source: basinSource,
        elementIds: inBand.map((element) => element.id),
      });
    }
    if (strict.length) {
      issues.push({
        id: `basin-strict:${floor.id}`,
        rule: "basin-strict",
        level: "warning",
        text: `${floor.name}: ${strict.length}× zásuvka / spínač blíž než ${cm(BASIN_STRICT_MM)} od umyvadla – zvolená přísnější zásada (ochranná zóna jako zóna 2).`,
        source: "Přísnější projekční zásada Eldocku zvolená v půdorysu (norma u umyvadla vyžaduje jen umývací prostor + 0,2 m)",
        elementIds: strict.map((element) => element.id),
      });
    }
    // Koupelna bez vany / sprchy v nákresu: zóny nejdou ověřit
    const wetRooms = [...new Set(floor.elements.filter((element) => WET.test(element.room) && (isSocket(element) || isSwitch(element))).map((element) => element.room))];
    for (const room of wetRooms.filter((name) => !fixtures.some((fixture) => fixture.element.room === name && fixture.geometry.zone !== "none"))) {
      issues.push({ id: `fixture-missing:${floor.id}:${room}`, rule: "fixture-missing", level: "info", text: `${room}: vložte vanu, sprchový kout nebo umyvadlo (paleta Zařizovací předměty) – pak se ověří zóny 0–2 a pás u umyvadla.`, source: "ČSN 33 2000-7-701 ed. 2", elementIds: [] });
    }
    // Krytí: zásuvky v koupelně a venku IP44
    const wetSockets = floor.elements.filter((element) => isSocket(element) && WET.test(element.room) && paletteItem(element.item)?.variant !== "ip44");
    if (wetSockets.length) {
      issues.push({
        id: `wet-ip:${floor.id}`,
        rule: "wet-room-ip",
        level: "warning",
        text: `${floor.name}: ${wetSockets.length}× zásuvka v koupelně bez krytí IP44.`,
        source: "ČSN 33 2000-7-701 ed. 2 a ČSN 33 2000-5-51 ed. 3 (vnější vlivy AD) – doporučeno IP44, vždy s chráničem 30 mA",
        elementIds: wetSockets.map((element) => element.id),
        ...ipFix(wetSockets),
      });
    }
    const outdoor = floor.elements.filter((element) => isSocket(element) && OUTDOOR.test(element.room) && paletteItem(element.item)?.variant !== "ip44");
    if (outdoor.length) {
      issues.push({
        id: `outdoor-ip:${floor.id}`,
        rule: "outdoor-ip",
        level: "warning",
        text: `${floor.name}: ${outdoor.length}× zásuvka venku (terasa, zahrada, balkon) bez krytí IP44.`,
        source: "ČSN 33 2000-5-51 ed. 3 – vnější vlivy AD4 (stříkající voda), min. IP44",
        elementIds: outdoor.map((element) => element.id),
        ...ipFix(outdoor),
      });
    }
    // Fáze 82: zásuvky na světelném okruhu – jištění 10 / 13 A; zásuvka u kuchyňské linky tam nepatří (konvice, robot)
    const onLighting = floor.elements.filter((element) => isSocket(element) && element.onLighting);
    if (onLighting.length) {
      issues.push({
        id: `lighting-socket:${floor.id}`,
        rule: "lighting-socket",
        level: "info",
        text: `${floor.name}: ${onLighting.length}× zásuvka na světelném okruhu – okruh jistí jistič ${draft.lightingSocketA} A (nikdy 16 A); jen výjimečně, běžné spotřebiče patří na zásuvkové okruhy B16.`,
        source: "ČSN 33 2000-4-43 čl. 433.1 (IB ≤ In ≤ Iz) a ČSN 33 2130 ed. 4 tab. 9 – světelný okruh 1,5 mm² jistič 10 A, 13 A jen při vyhovující Iz (jinak 2,5 mm²)",
        elementIds: onLighting.map((element) => element.id),
      });
      const worktop = onLighting.filter((element) => paletteItem(element.item)?.variant === "worktop");
      if (worktop.length) {
        issues.push({
          id: `lighting-socket-worktop:${floor.id}`,
          rule: "lighting-socket-worktop",
          level: "warning",
          text: `${floor.name}: ${worktop.length}× zásuvka u kuchyňské linky na světelném okruhu – rychlovarná konvice nebo robot vybaví jistič ${draft.lightingSocketA} A a zhasne světla; patří na zásuvkový okruh linky (B16).`,
          source: "Projekční zásada Eldocku – spotřebiče s velkým příkonem na zásuvkový okruh",
          elementIds: worktop.map((element) => element.id),
          fix: { label: `Vrátit ${worktop.length}× zásuvku linky na zásuvkový okruh`, replace: [], offLighting: worktop.map((element) => element.id) },
        });
      }
    }
    // Ložnice a dětské pokoje: doporučení AFDD
    const sleeping = [...new Set(floor.elements.filter((element) => isSocket(element) && SLEEP.test(element.room)).map((element) => element.room))];
    if (sleeping.length) {
      issues.push({
        id: `afdd:${floor.id}`,
        rule: "afdd",
        level: "info",
        text: `${floor.name}: ${sleeping.join(", ")} – zvažte ochranu před obloukovou poruchou (AFDD) pro zásuvkové okruhy místností ke spaní.`,
        source: "ČSN 33 2000-4-42, čl. 421.7 (doporučení)",
        elementIds: [],
      });
    }
  }
  issues.push(...frameLimitIssues(draft), ...boxDepthIssues(draft, context.cableEnds ?? {}));
  return issues;
}

const labelOf = (element: EditorElement) => (paletteItem(element.item)?.label ?? element.item).replace(/\s*\(.*\)$/, "");

/**
 * Fáze 91: víceramček (nebo N kusů v jednom rámečku) nad limit řady podle katalogu výrobce – kusovník ho rozdělí na
 * skutečně vyráběné rámečky; oprava rozdělí víceramček i v nákresu.
 */
export function frameLimitIssues(draft: FloorplanDraft): NormIssue[] {
  const issues: NormIssue[] = [];
  for (const floor of floorsOf(draft)) {
    for (const frame of floor.frames) {
      const members = frame.members.map((id) => floor.elements.find((element) => element.id === id)).filter((element): element is EditorElement => Boolean(element));
      if (members.length < 2) continue;
      const gangs = members.reduce((sum, element) => sum + gangsOf(element), 0);
      const limit = frameLimitOf(draft, members[0]);
      if (gangs <= limit.max) continue;
      const rules = frameRulesOf(members[0].series ?? draft.series);
      const parts = splitFrameGangs(gangs, limit.max);
      const alone = rules.separateDevices || limit.max === 1;
      issues.push({
        id: `frame-limit:${frame.id}`,
        rule: "frame-limit",
        level: "warning",
        text: `${floor.name}: víceramček ${gangs}R v místnosti ${members[0].room} (${[...new Set(members.map(labelOf))].join(", ")}) – ${limit.text ?? `rámeček nejvýš ${limit.max}R`} V kusovníku ${alone ? `jako ${gangs} samostatných přístrojů` : `rozdělený na ${splitLabel(parts)}`}.`,
        source: rules.source,
        elementIds: members.map((element) => element.id),
        fix: { label: alone ? "Rozdělit na samostatné přístroje" : `Rozdělit na ${splitLabel(parts)}`, replace: [], splitFrames: [{ id: frame.id, max: limit.max }] },
      });
    }
    const framed = new Set(floor.frames.flatMap((frame) => frame.members));
    for (const element of floor.elements) {
      if (framed.has(element.id) || element.frameUnits < 2) continue;
      const limit = frameLimitOf(draft, element);
      if (element.frameUnits <= limit.max) continue;
      issues.push({
        id: `frame-limit:${element.id}`,
        rule: "frame-limit",
        level: "warning",
        text: `${floor.name}: ${labelOf(element)} v místnosti ${element.room} – ${element.frameUnits} kusů v jednom rámečku, ${limit.text ?? `rámeček nejvýš ${limit.max}R`} V kusovníku rozdělené na ${splitLabel(splitFrameGangs(element.frameUnits, limit.max))}.`,
        source: frameRulesOf(element.series ?? draft.series).source,
        elementIds: [element.id],
      });
    }
  }
  return issues;
}

const CLASS_LABEL: Record<BoxDepthClass, string> = { shallow: "mělkou krabici", deep: "hlubokou krabici", electronics: "krabici s prostorem pro elektroniku" };

/**
 * Fáze 91: ručně zvolená instalační krabice mělčí, než přístroj potřebuje (stmívač, termostat, datová zásuvka Cat7,
 * WAGO svorky pod vypínačem, aktor v krabici …) – varování s doporučenou krabicí výrobce a opravou jedním klikem.
 */
export function boxDepthIssues(draft: FloorplanDraft, cableEnds: Readonly<Record<string, number>> = {}): NormIssue[] {
  const issues: NormIssue[] = [];
  const maker = draft.boxMaker;
  for (const floor of floorsOf(draft)) {
    for (const element of floor.elements) {
      if (!element.box) continue;
      const resolved = resolveBox(draft, element, { cableEnds: cableEnds[element.id] });
      if (!resolved.tooShallow) continue;
      const need = resolved.need.kind as BoxDepthClass;
      const chosen = resolved.box;
      const recommended = pickBox(maker, resolved.wall, need);
      const other = resolved.wall === "masonry" ? pickBox(maker, "drywall", need) : resolved.wall === "drywall" ? pickBox(maker, "masonry", need) : null;
      const tip = recommended
        ? `Doporučujeme ${CLASS_LABEL[need]} ${boxMakerLabel(maker)} ${recommended.type} (${wallTypeOf(resolved.wall).short})${other ? ` nebo ${other.type} (${wallTypeOf(other.walls[0]).short})` : ""}.`
        : `${boxMakerLabel(maker)} vhodnou krabici ${wallTypeOf(resolved.wall).short} nevede – zvolte jiného výrobce krabic.`;
      issues.push({
        id: `box-depth:${element.id}`,
        rule: "box-depth",
        level: "warning",
        text: `⚠️ Nedostatečná hloubka krabičky u ${labelOf(element)} v místnosti ${element.room}: zvolena krabice ${chosen?.depthMm ?? "?"} mm (${chosen ? `${boxMakerLabel(chosen.maker)} ${chosen.type}` : "mělká"}), ale ${resolved.need.reasons.join(", ")} vyžaduje min. ${resolved.need.minDepthMm} mm! ${tip}`,
        source: "vestavná hloubka přístroje a svorkování (katalogy výrobců přístrojů a krabic)",
        elementIds: [element.id],
        fix: { label: need === "electronics" ? "Opravit na krabici s prostorem pro elektroniku (1 klik)" : "Opravit na hlubokou krabici (1 klik)", replace: [], boxes: [{ id: element.id, box: "auto" }] },
      });
    }
  }
  return issues;
}

/** Oprava jedním klikem: záměna prvků za jiný typ z palety (na všech podlažích), poloha a vazby zůstanou. */
export function applyNormFix(draft: FloorplanDraft, issue: NormIssue): FloorplanDraft {
  if (!issue.fix) return draft;
  const replace = new Map(issue.fix.replace.map((row) => [row.from, row.to]));
  // Fáze 82: zásuvky ze světelného okruhu zpět na automatický zásuvkový okruh
  const offLighting = new Set(issue.fix.offLighting ?? []);
  // Fáze 91: krabice prvku („auto“ = doporučená podle přístroje) a rozdělení víceramečků
  const boxes = new Map((issue.fix.boxes ?? []).map((row) => [row.id, row.box]));
  const map = (element: EditorElement) => {
    let next = replace.has(element.id) ? { ...element, item: replace.get(element.id)! } : element;
    if (boxes.has(element.id)) {
      const box = boxes.get(element.id)!;
      next = { ...next };
      if (box === "auto") delete next.box;
      else next.box = box;
    }
    if (!offLighting.has(element.id) || !next.onLighting) return next;
    const rest = { ...next };
    delete rest.onLighting;
    return rest;
  };
  const splits = new Map((issue.fix.splitFrames ?? []).map((row) => [row.id, row.max]));
  const frames = <F extends { frames: FloorplanDraft["frames"]; elements: EditorElement[] }>(sheet: F): F["frames"] => (splits.size ? splitFrames(sheet, splits) : sheet.frames);
  return {
    ...draft,
    elements: draft.elements.map(map),
    frames: frames(draft),
    otherFloors: draft.otherFloors.map((floor) => ({ ...floor, elements: floor.elements.map(map), frames: frames(floor) })),
  };
}

/** Fáze 91: víceramček po skupinách nejvýš `max` pozic (zbylý jednotlivý přístroj zůstane samostatně). */
function splitFrames(sheet: { frames: FloorplanDraft["frames"]; elements: EditorElement[] }, splits: ReadonlyMap<string, number>): FloorplanDraft["frames"] {
  return sheet.frames.flatMap((frame) => {
    const max = splits.get(frame.id);
    if (max === undefined) return [frame];
    const groups: string[][] = [];
    let current: string[] = [];
    let used = 0;
    for (const id of frame.members) {
      const element = sheet.elements.find((candidate) => candidate.id === id);
      const gangs = element ? gangsOf(element) : 1;
      if (current.length && used + gangs > max) {
        groups.push(current);
        current = [];
        used = 0;
      }
      current.push(id);
      used += gangs;
    }
    if (current.length) groups.push(current);
    return groups.filter((members) => members.length >= 2).map((members, index) => ({ id: index ? `${frame.id}-${index + 1}` : frame.id, members }));
  });
}
