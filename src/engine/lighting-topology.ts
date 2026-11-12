import type { CircuitRoute, RouteMetric, RouteNode, RoutePoint, RouteSegment } from "./cable-routing";
import type { CableRoutingMode, ElevationProfile, InstallMode } from "./floorplan-bridge";

// Fáze 105: přesná topologie světelných okruhů 2D půdorysu.
//
// Klasická instalace 230 V (i retrofit s modulem pod vypínačem): přívod okruhu z rozváděče do krabice prvního vypínače
// každé skupiny světel (smyčka mezi krabicemi hlavních vypínačů), z krabice vypínače vzhůru ke stropu a ke světlům
// skupiny (smyčka mezi svítidly). Řazení: 1 = CYKY-J 3×1,5 ke světlům, 5 = CYKY-J 5×1,5, 6 = přívod do přepínače A,
// mezi A a B korespondenční CYKY-O 3×1,5 se dvěma svislými svody, z B CYKY-J 3×1,5 ke světlům, 7 = řetěz 6 – 7 … – 6
// kabelem CYKY-J 5×1,5 se svodem u každého vypínače, 6+6 = korespondence CYKY-O 5×1,5 a CYKY-J 5×1,5 ke světlům.
// Ke každému konci kabelu v krabici vypínače svislý svod ze stropu (H_strop − H_vyp) a rezerva 0,30 m na zapojení.
//
// Sběrnicová chytrá instalace (Loxone / KNX / free@home / TapHome): každá spínaná nebo stmívaná větev (skupina světel se
// stejným ovládáním) vede hvězdicově z rozváděče CYKY-J 3×1,5 (5×1,5 u DALI / RGBW / dvojitého svítidla) a smyčkuje se
// mezi svítidly skupiny; tlačítka a čidla jsou na sběrnicové lince (počítá `summarizeCabling`).

/** Řazení domovního spínače podle značení výrobců. */
export type SwitchNo = "1" | "5" | "6" | "6+6" | "7";

/** Rezerva na zapojení v krabičce vypínače – na každý konec kabelu v krabici [mm]. */
export const SWITCH_BOX_RESERVE_MM = 300;
export const LIGHT_CABLE_3 = "CYKY-J 3×1,5";
export const LIGHT_CABLE_5 = "CYKY-J 5×1,5";
/** Korespondenční vodiče mezi přepínači č. 6 (L′ a L″ + ochranný vodič se nepoužívá – kabel bez zeleno-žluté). */
export const TRAVELLER_CABLE = "CYKY-O 3×1,5";
/** Dvojitý střídavý přepínač č. 6+6 – dva páry korespondenčních vodičů. */
export const DOUBLE_TRAVELLER_CABLE = "CYKY-O 5×1,5";
/** Křížové řazení 6 – 7 – … – 6 (4 korespondenční vodiče + ochranný). */
export const CROSS_CABLE = "CYKY-J 5×1,5";

export type LightingRole = "supply" | "traveller" | "switch-leg" | "branch";

/** Úsek kabelu světelného okruhu (pro rozpis délek a výkres). */
export interface LightingPart {
  role: LightingRole;
  cable: string;
  /** Uzel nebo výchozí bod rozváděče („panel“). */
  from: string;
  to: string;
  horizontalMm: number;
  verticalMm: number;
  /** Rezerva % na ohyby + přídavky v krabicích a rozváděči [mm]. */
  reserveMm: number;
  totalMm: number;
}

/** Průhledný rozpad délky okruhu: vodorovně + svislé svody + rezerva = celkem [m]. */
export interface LightingBreakdown {
  horizontalM: number;
  verticalM: number;
  reserveM: number;
  totalM: number;
}

export interface LightingGroup {
  /** Ovládací místa skupiny v pořadí kabelu (první = krabice s přívodem okruhu). */
  switches: RouteNode[];
  lights: RouteNode[];
  switchNos: SwitchNo[];
}

export interface LightingTopology {
  /** Celý okruh v každém režimu: přívod podle režimu (spodem / vrchem) + svody a propoje přes strop ve všech stejně. */
  routes: Record<CableRoutingMode, CircuitRoute>;
  /** Úseky nezávislé na režimu (korespondence, svody vypínač → světla, větve hvězdy u sběrnice podle režimu zvlášť). */
  legs: LightingPart[];
  /** Kabel přívodu okruhu (klasika) / hlavní kabel větví (sběrnice). */
  supplyCable: string;
  /** Metry podle kabelu v daném režimu (rozpis k nákupu). */
  cableMm: Record<CableRoutingMode, Map<string, number>>;
  groups: LightingGroup[];
  /** Světla a zásuvky okruhu bez vypínače (smyčka přívodu / samostatná větev). */
  loose: RouteNode[];
  star: boolean;
}

export interface LightingTopologyInput {
  installation: InstallMode | undefined;
  /** Kabel okruhu z návrhu (CYKY-J 3×1,5, u DALI 5×1,5). */
  circuitCable: string;
  /** Uzly okruhu v pořadí kreslení (světla, zásuvky na světelném okruhu). */
  nodes: readonly RouteNode[];
  byId: ReadonlyMap<string, RouteNode>;
  switchLinks: readonly { switchId: string; lightId: string }[];
  switchNoOf: (switchId: string) => SwitchNo;
  /** Světla s pětižilovým přívodem (DALI, RGBW, dvojité svítidlo) – u sběrnice větev 5×1,5. */
  fiveCore?: ReadonlySet<string>;
  origin: RoutePoint;
  profile: ElevationProfile;
  metric: RouteMetric;
  /** Trasa řetězu / stromu z rozváděče přes dané uzly ve všech režimech (bez ručních úprav). */
  chainRoutes: (nodes: readonly RouteNode[]) => Record<CableRoutingMode, CircuitRoute>;
}

const MODES: readonly CableRoutingMode[] = ["BOTTOM", "TOP", "OPTIMIZED"];
const isFive = (cable: string) => /5\s*[x×]\s*1,5/.test(cable);
const round = (mm: number) => Math.round(mm);

/** Pořadí od výchozího uzlu vždy k nejbližšímu dalšímu (stabilní – při shodě pořadí kreslení). */
function nearestOrder(start: RoutePoint, nodes: readonly RouteNode[], metric: RouteMetric): RouteNode[] {
  const rest = [...nodes];
  const order: RouteNode[] = [];
  let at = start;
  while (rest.length) {
    let best = 0;
    for (let index = 1; index < rest.length; index += 1) if (metric.distance(at, rest[index]) < metric.distance(at, rest[best])) best = index;
    const [next] = rest.splice(best, 1);
    order.push(next);
    at = next;
  }
  return order;
}

/** Skupiny světel podle ovládání: stejná sada vypínačů = jedna skupina (jedna větev / jeden svod od vypínačů). */
export function lightingGroups(nodes: readonly RouteNode[], byId: ReadonlyMap<string, RouteNode>, switchLinks: readonly { switchId: string; lightId: string }[], switchNoOf: (switchId: string) => SwitchNo, origin: RoutePoint, metric: RouteMetric) {
  const inCircuit = new Set(nodes.map((node) => node.id));
  const controllers = new Map<string, Set<string>>();
  for (const link of switchLinks) {
    if (!inCircuit.has(link.lightId) || !byId.has(link.switchId) || link.switchId === link.lightId) continue;
    const own = controllers.get(link.lightId) ?? new Set<string>();
    own.add(link.switchId);
    controllers.set(link.lightId, own);
  }
  const byKey = new Map<string, { switchIds: string[]; lights: RouteNode[] }>();
  const loose: RouteNode[] = [];
  for (const node of nodes) {
    const ids = [...(controllers.get(node.id) ?? [])].sort();
    if (!ids.length) {
      loose.push(node);
      continue;
    }
    const key = ids.join("|");
    const group = byKey.get(key) ?? { switchIds: ids, lights: [] };
    group.lights.push(node);
    byKey.set(key, group);
  }
  const groups: LightingGroup[] = [...byKey.values()].map(({ switchIds, lights }) => {
    const switches = switchIds.map((id) => byId.get(id)!).filter(Boolean);
    // Přívod do krabice vypínače nejblíž rozváděči, dál k nejbližšímu dalšímu ovládacímu místu (6 – 7 … – 6)
    const entry = switches.reduce((best, node) => (metric.distance(origin, node) < metric.distance(origin, best) ? node : best), switches[0]);
    const ordered = [entry, ...nearestOrder(entry, switches.filter((node) => node !== entry), metric)];
    return { switches: ordered, lights, switchNos: ordered.map((node) => switchNoOf(node.id)) };
  });
  return { groups, loose };
}

function emptyRoute(mode: "BOTTOM" | "TOP"): CircuitRoute {
  return { mode, segments: [], rawMm: 0, totalMm: 0, longestMm: 0, orderSavingMm: 0 };
}

/** Délky dosažené po úsecích trasy od rozváděče (strom i řetěz – rodič před potomkem) [mm, bez rezervy]. */
function reachOf(segments: readonly RouteSegment[]): Map<string, number> {
  const reach = new Map<string, number>();
  for (const segment of segments) reach.set(segment.to, (reach.get(segment.from) ?? 0) + segment.horizontalMm + segment.verticalMm);
  return reach;
}

/**
 * Topologie světelného okruhu (klasika s vypínači, nebo hvězda větví u sběrnice). Null = klasický okruh bez vypínačů
 * (zůstává řetěz přes světla z `summarizeCabling`).
 */
export function lightingTopology(input: LightingTopologyInput): LightingTopology | null {
  const { profile, metric } = input;
  const slack = 1 + profile.slackPercent / 100;
  const drop = (node: RouteNode) => Math.max(0, profile.ceilingHeightMm - node.heightMm);
  const star = input.installation === "bus_loxone";
  const { groups, loose } = lightingGroups(input.nodes, input.byId, input.switchLinks, input.switchNoOf, input.origin, metric);
  if (!star && !groups.length) return null;
  const legs: LightingPart[] = [];
  const cableMm = Object.fromEntries(MODES.map((mode) => [mode, new Map<string, number>()])) as Record<CableRoutingMode, Map<string, number>>;
  const addMm = (mode: CableRoutingMode, cable: string, mm: number) => cableMm[mode].set(cable, (cableMm[mode].get(cable) ?? 0) + mm);

  if (star) {
    // Hvězda: každá skupina světel = jedna větev z rozváděče, světla bez ovládání každé samostatnou větví
    const branches = [...groups.map((group) => group.lights), ...loose.map((node) => [node])];
    const routes = Object.fromEntries(MODES.map((mode) => [mode, emptyRoute(mode === "BOTTOM" ? "BOTTOM" : "TOP")])) as Record<CableRoutingMode, CircuitRoute>;
    let topVotes = 0;
    for (const lights of branches) {
      const branch = input.chainRoutes(lights);
      const cable = isFive(input.circuitCable) || lights.some((node) => input.fiveCore?.has(node.id)) ? LIGHT_CABLE_5 : LIGHT_CABLE_3;
      if (branch.OPTIMIZED.mode === "TOP") topVotes += 1;
      for (const mode of MODES) {
        const route = branch[mode];
        routes[mode] = { ...routes[mode], segments: [...routes[mode].segments, ...route.segments], rawMm: routes[mode].rawMm + route.rawMm, totalMm: routes[mode].totalMm + route.totalMm, longestMm: Math.max(routes[mode].longestMm, route.longestMm), orderSavingMm: (routes[mode].orderSavingMm ?? 0) + (route.orderSavingMm ?? 0) };
        addMm(mode, cable, route.totalMm);
      }
      const route = branch.OPTIMIZED;
      const horizontalMm = route.segments.reduce((sum, segment) => sum + segment.horizontalMm, 0);
      const verticalMm = route.segments.reduce((sum, segment) => sum + segment.verticalMm, 0);
      legs.push({ role: "branch", cable, from: "panel", to: lights[0].id, horizontalMm: round(horizontalMm), verticalMm: round(verticalMm), reserveMm: round(route.totalMm - horizontalMm - verticalMm), totalMm: route.totalMm });
    }
    routes.OPTIMIZED = { ...routes.OPTIMIZED, mode: topVotes > branches.length / 2 ? "TOP" : "BOTTOM" };
    return { routes, legs, supplyCable: input.circuitCable.includes("5") ? LIGHT_CABLE_5 : LIGHT_CABLE_3, cableMm, groups, loose, star };
  }

  // Klasika: přívod okruhu přes krabice prvních vypínačů skupin (a světla / zásuvky bez vypínače)
  // Označení s „×“ jako ve výkazu („CYKY-J 3x1,5“ → „CYKY-J 3×1,5“)
  const supplyCable = input.circuitCable.replace(/(\d)x(\d)/g, "$1×$2");
  const retrofit = input.installation === "smart_retrofit";
  const entries = [...new Map(groups.map((group) => [group.switches[0].id, group.switches[0]])).values()];
  const supply = input.chainRoutes([...entries, ...loose]);
  const legSegments: RouteSegment[] = [];
  const groupTail = new Map<LightingGroup, number>();
  for (const group of groups) {
    let tail = 0;
    // Korespondence mezi ovládacími místy (6 ↔ 6, 6 – 7 – … – 6, 6+6 ↔ 6+6) se svody u obou krabic
    for (let index = 0; index + 1 < group.switches.length; index += 1) {
      const [a, b] = [group.switches[index], group.switches[index + 1]];
      const double = group.switchNos[index] === "6+6" || group.switchNos[index + 1] === "6+6";
      let cable = group.switches.length > 2 ? CROSS_CABLE : double ? DOUBLE_TRAVELLER_CABLE : TRAVELLER_CABLE;
      // Retrofit: modul pod vypínačem potřebuje N – místo CYKY-O vždy CYKY-J
      if (retrofit) cable = cable.replace("CYKY-O", "CYKY-J");
      const horizontalMm = round(metric.distance(a, b));
      const verticalMm = round(drop(a) + drop(b));
      const totalMm = round((horizontalMm + verticalMm) * slack + 2 * SWITCH_BOX_RESERVE_MM);
      legs.push({ role: "traveller", cable, from: a.id, to: b.id, horizontalMm, verticalMm, reserveMm: totalMm - horizontalMm - verticalMm, totalMm });
      legSegments.push({ from: a.id, to: b.id, horizontalMm, verticalMm, wall: false });
      tail += totalMm;
    }
    // Svod z krabice posledního vypínače ke stropu a smyčka mezi svítidly skupiny
    const last = group.switches[group.switches.length - 1];
    const five = isFive(supplyCable) || group.switchNos.some((no) => no === "5" || no === "6+6");
    const cable = five ? LIGHT_CABLE_5 : LIGHT_CABLE_3;
    const lights = nearestOrder(last, group.lights, metric);
    let horizontalMm = 0;
    let verticalMm = 0;
    let previous: RouteNode = last;
    lights.forEach((light, index) => {
      const horizontal = round(metric.distance(previous, light));
      // Nástěnné svítidlo pod stropem: kabel dolů ke svítidlu (a u dalšího ve smyčce zase nahoru)
      const vertical = round((index === 0 ? drop(last) : drop(previous)) + drop(light));
      legSegments.push({ from: previous.id, to: light.id, horizontalMm: horizontal, verticalMm: vertical, wall: false });
      horizontalMm += horizontal;
      verticalMm += vertical;
      previous = light;
    });
    const boxes = new Set(lights.map((node) => node.frame ?? node.id)).size;
    const totalMm = round((horizontalMm + verticalMm) * slack + SWITCH_BOX_RESERVE_MM + boxes * profile.boxAllowanceMm);
    legs.push({ role: "switch-leg", cable, from: last.id, to: lights[0]?.id ?? last.id, horizontalMm, verticalMm, reserveMm: totalMm - horizontalMm - verticalMm, totalMm });
    groupTail.set(group, tail + totalMm);
  }
  // Rezerva přívodu v krabicích vypínačů (na rozdíl od přídavku krabice KU68 0,15 m u řetězu): + 0,30 − 0,15 na krabici
  const switchBoxExtra = entries.length * (SWITCH_BOX_RESERVE_MM - profile.boxAllowanceMm);
  const legsRaw = legSegments.reduce((sum, segment) => sum + segment.horizontalMm + segment.verticalMm, 0);
  const legsTotal = legs.reduce((sum, part) => sum + part.totalMm, 0);
  const routes = Object.fromEntries(
    MODES.map((mode) => {
      const base = supply[mode];
      const reach = reachOf(base.segments);
      const allowance = base.segments.length ? profile.panelAllowanceMm : 0;
      const longest = Math.max(base.longestMm, ...groups.map((group) => round((reach.get(group.switches[0].id) ?? 0) * slack + allowance + (groupTail.get(group) ?? 0))));
      const supplyTotal = base.totalMm + switchBoxExtra;
      addMm(mode, supplyCable, supplyTotal);
      for (const part of legs) addMm(mode, part.cable, part.totalMm);
      return [mode, { ...base, segments: [...base.segments, ...legSegments], rawMm: base.rawMm + legsRaw, totalMm: supplyTotal + legsTotal, longestMm: longest } satisfies CircuitRoute];
    }),
  ) as Record<CableRoutingMode, CircuitRoute>;
  return { routes, legs, supplyCable, cableMm, groups, loose, star };
}

/** Rozpad délky trasy: vodorovné úseky, svislé svody (stropy, vypínače, rozváděč) a rezerva do celkové délky [m]. */
export function routeBreakdown(route: CircuitRoute): LightingBreakdown {
  const horizontal = route.segments.reduce((sum, segment) => sum + segment.horizontalMm, 0);
  const vertical = route.segments.reduce((sum, segment) => sum + segment.verticalMm, 0);
  const m = (mm: number) => Math.round(mm / 100) / 10;
  const totalM = m(route.totalMm);
  const horizontalM = m(horizontal);
  const verticalM = m(vertical);
  return { horizontalM, verticalM, reserveM: Math.max(0, Math.round((totalM - horizontalM - verticalM) * 10) / 10), totalM };
}

/** „Vodorovně 12,4 m + svislé svody 6,8 m + rezerva 2,9 m = celkem 22,1 m“. */
export function breakdownText(breakdown: LightingBreakdown): string {
  const n = (value: number) => value.toLocaleString("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `Vodorovně po stěnách / stropu ${n(breakdown.horizontalM)} m + svislé svody k vypínačům a rozváděči ${n(breakdown.verticalM)} m + rezerva ${n(breakdown.reserveM)} m = celkem ${n(breakdown.totalM)} m`;
}
