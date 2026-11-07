// Fáze 61: normový hlídač 2D půdorysu – pravidla, která dávají smysl už při kreslení, se zdrojem normy a opravou
// jedním klikem, kde to jde. Koupelnové zóny dle ČSN 33 2000-7-701 ed. 2 (zásuvky a spínače mimo zóny 0–2, tj. dál
// než 0,6 m od vany / sprchy), krytí IP44 v koupelně a venku, doporučení ochrany před obloukovou poruchou (AFDD)
// v ložnicích a dětských pokojích dle ČSN 33 2000-4-42 (čl. 421.7). Čisté funkce.
// Fáze 63: zóny podle skutečného rozměru a natočení předmětu (`fixtures.ts`), umyvadla – zásuvky a spínače mimo svislý
// pás nad a pod umyvadlem (ČSN 33 2130 ed. 4), vzdálenost od hrany vany / sprchy / umyvadla v textu zjištění.

import { BASIN_MARGIN_MM, ZONE2_MM, distanceToFixture, fixtureGeometry, inBasinBand, type FixtureGeometry } from "./fixtures";
import { floorsOf, paletteItem, type EditorElement, type FloorplanDraft } from "./floorplan-editor";

export { ZONE2_MM };

export type NormLevel = "error" | "warning" | "info";

export interface NormIssue {
  id: string;
  rule: "bath-zone" | "basin-band" | "wet-room-ip" | "outdoor-ip" | "afdd" | "fixture-missing";
  level: NormLevel;
  text: string;
  source: string;
  /** Prvky, kterých se zjištění týká (i z jiných podlaží). */
  elementIds: string[];
  /** Oprava jedním klikem: záměna prvku za jiný z palety (zásuvka → IP44). */
  fix?: { label: string; replace: { from: string; to: string }[] };
}

const cm = (mm: number) => `${Math.round(mm / 10)} cm`;

const WET = /koupel|sprch|wellness|sauna/i;
const OUTDOOR = /terasa|venk|zahrad|balkon|lodžie|lodzie|garáž venku|dvůr/i;
const SLEEP = /ložnic|loznic|dětsk|detsk|pokoj pro hosty|spaní/i;

const isSocket = (element: EditorElement) => {
  const kind = paletteItem(element.item)?.kind;
  return kind === "single_socket" || kind === "double_socket";
};
const isSwitch = (element: EditorElement) => paletteItem(element.item)?.kind === "switch" && !paletteItem(element.item)?.wireless;

/** Oprava krytí: jednozásuvky → zásuvka IP44 (dvojzásuvku IP44 paleta nemá – zůstane k ruční záměně). */
const ipFix = (elements: EditorElement[]): Pick<NormIssue, "fix"> => {
  const singles = elements.filter((element) => paletteItem(element.item)?.kind === "single_socket");
  return singles.length ? { fix: { label: `Změnit ${singles.length}× na zásuvku IP44`, replace: singles.map((element) => ({ from: element.id, to: "ip44-socket" })) } } : {};
};

/** Zjištění normového hlídače pro celý dům (všechna podlaží). */
export function floorplanNorms(draft: FloorplanDraft): NormIssue[] {
  const issues: NormIssue[] = [];
  for (const floor of floorsOf(draft)) {
    const fixtures = floor.elements
      .map((element) => ({ element, geometry: fixtureGeometry(element) }))
      .filter((entry): entry is { element: EditorElement; geometry: FixtureGeometry } => entry.geometry !== null);
    const devices = floor.elements.filter((element) => isSocket(element) || isSwitch(element));
    // Zóny 0–2: zásuvka ani spínač blíž než 0,6 m od hrany vany / sprchy (ve stejné místnosti)
    const nearest = (element: EditorElement, zone: "bath" | "basin") =>
      Math.min(...fixtures.filter((fixture) => fixture.geometry.zone === zone && fixture.element.room === element.room).map((fixture) => distanceToFixture(fixture.geometry, element.x, element.y)));
    const inZone = devices.filter((element) => nearest(element, "bath") < ZONE2_MM);
    if (inZone.length) {
      const closest = Math.min(...inZone.map((element) => nearest(element, "bath")));
      issues.push({
        id: `bath-zone:${floor.id}`,
        rule: "bath-zone",
        level: "error",
        text: `${floor.name}: ${inZone.length}× zásuvka / spínač v zóně 0–2 koupelny (nejblíž ${cm(closest)} od hrany vany / sprchy, potřeba aspoň 60 cm) – přesuňte je dál.`,
        source: "ČSN 33 2000-7-701 ed. 2 – zásuvky a spínače jen mimo zóny 0, 1 a 2",
        elementIds: inZone.map((element) => element.id),
      });
    }
    // Fáze 63: umyvadlo – zásuvky a spínače ne ve svislém pásu nad a pod umyvadlem (šíře umyvadla + 0,2 m na každou stranu)
    const inBand = devices.filter((element) => fixtures.some((fixture) => fixture.geometry.zone === "basin" && fixture.element.room === element.room && inBasinBand(fixture.geometry, element.x, element.y)));
    if (inBand.length) {
      issues.push({
        id: `basin-band:${floor.id}`,
        rule: "basin-band",
        level: "error",
        text: `${floor.name}: ${inBand.length}× zásuvka / spínač nad nebo pod umyvadlem (pás v šíři umyvadla + ${cm(BASIN_MARGIN_MM)} na každou stranu) – posuňte je stranou od hrany umyvadla.`,
        source: "ČSN 33 2130 ed. 4 – zásuvky a spínače mimo prostor nad a pod umyvadlem; odstup 20 cm od hrany je projekční zásada Eldocku (ověřte v projektu)",
        elementIds: inBand.map((element) => element.id),
      });
    }
    // Koupelna bez vany / sprchy v nákresu: zóny nejdou ověřit
    const wetRooms = [...new Set(floor.elements.filter((element) => WET.test(element.room) && (isSocket(element) || isSwitch(element))).map((element) => element.room))];
    for (const room of wetRooms.filter((name) => !fixtures.some((fixture) => fixture.element.room === name))) {
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
  return issues;
}

/** Oprava jedním klikem: záměna prvků za jiný typ z palety (na všech podlažích), poloha a vazby zůstanou. */
export function applyNormFix(draft: FloorplanDraft, issue: NormIssue): FloorplanDraft {
  if (!issue.fix) return draft;
  const replace = new Map(issue.fix.replace.map((row) => [row.from, row.to]));
  const map = (element: EditorElement) => (replace.has(element.id) ? { ...element, item: replace.get(element.id)! } : element);
  return { ...draft, elements: draft.elements.map(map), otherFloors: draft.otherFloors.map((floor) => ({ ...floor, elements: floor.elements.map(map) })) };
}
