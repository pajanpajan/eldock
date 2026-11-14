// Fáze 112: propojovací hřebeny a fáze L1 / L2 / L3 na 2D plátně AI Panel Builderu. Hřeben = měděná hřebenová
// přípojnice pod spodními svorkami proudového chrániče a navazujících jističů na stejné liště; řada jističochráničů se
// společným napájením dostane hřeben na vstupu. Nastavení lišty je v uspořádání projektu (`railLayoutJson.combs`).
// Fáze přístroje z přiřazení (`phaseAssignment`), jinak z pozice na 3f hřebenu (L1, L2, L3, L1 …). Čisté funkce.
//
// Fáze 115: elektrotechnicky přesné úseky – každý chránič se svými jističi (na liště hned za ním) je samostatný izolovaný
// úsek, hřeben končí před stykačem, relé, elektroměrem, svorkovnicí, zdrojem i aktorem chytré domácnosti (zapojují se jen
// vodiči). Pod 4P chráničem s 1P / 3P jističi je hřeben 3P (L1 L2 L3) bez vidličky na N – N chrániče vede vodič na
// nulový můstek N-FIx; hřeben 3P+N jen pod řadou jističochráničů s pólem N. Volba lišty Auto / 3P / 3P+N / 1P / Bez
// hřebenu, díly ABB PS a koncové krytky PS-END do kusovníku a nářezového listu (`combParts`). Hřeben nikdy není modul
// na DIN liště.

export type CombSetting = "AUTO" | "3P" | "3PN" | "1P" | "OFF";
export const COMB_SETTINGS: readonly CombSetting[] = ["AUTO", "3P", "3PN", "1P", "OFF"];
export const isCombSetting = (value: unknown): value is CombSetting => COMB_SETTINGS.includes(value as CombSetting);
/** Fáze 115: volby uložené ve fázi 112 („3F“ / „1F“) platí dál jako 3P / 1P. */
const LEGACY_SETTINGS: Record<string, CombSetting> = { "3F": "3P", "1F": "1P" };
export const toCombSetting = (value: unknown): CombSetting | null => (isCombSetting(value) ? value : typeof value === "string" && LEGACY_SETTINGS[value] ? LEGACY_SETTINGS[value] : null);

/** Volby tlačítka „Hřeben: …“ v záhlaví lišty. */
export const COMB_SETTING_LABEL: Record<CombSetting, string> = {
  AUTO: "Hřeben: Auto",
  "3P": "3P (L1·L2·L3)",
  "3PN": "3P+N (L1·L2·L3·N)",
  "1P": "1P (L1)",
  OFF: "Bez hřebenu (drátováno vodiči)",
};
export const COMB_SETTING_HINT: Record<CombSetting, string> = {
  AUTO: "chytrá detekce podle skupin na liště",
  "3P": "4P chránič + 1P / 3P jističe",
  "3PN": "řada jističochráničů 1P+N / 3P+N",
  "1P": "jednofázová skupina",
  OFF: "jističe napojené vodiči",
};

export type PhaseBadge = "L1" | "L2" | "L3" | "L1+L2+L3";

export interface CombDevice {
  id: string;
  designation: string;
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
  category: string | null;
  poles: string | null;
  phaseAssignment?: string | null;
  /** Fáze 115: výrobce přístroje – hřeben ABB PS jen pod přístroji ABB (jinak podle výrobce jističů bez čísla). */
  manufacturer?: string | null;
}

export interface CombNode {
  id: string;
  parentItemId: string | null;
}

/** Druh hřebenu: 3P (L1 L2 L3), 3P+N, 1P (L) a 1P+N (dvoupólový L + N pod jističochrániči v 1f soustavě). */
export type CombKind = "3P" | "3PN" | "1P" | "1PN";

export interface CombRun {
  rail: number;
  /** Přístroje na hřebenu zleva (první = chránič, nebo první jističochránič řady). */
  ids: string[];
  kind: CombKind;
  /** Vodiče hřebenu = vidličky (u 4P chrániče s 1P / 3P jističi bez N). */
  conductors: string[];
  /** Hřeben na vstupu (řada jističochráničů) – jinak pod výstupy chrániče. */
  input: boolean;
  /** Počet pinů = moduly úseku od prvního po poslední přístroj. */
  modules: number;
  /** Volba lišty nešla použít (3P+N pod přístroji bez pólu N) – platí hřeben 3P. */
  note?: string;
}

const BREAKERS = new Set(["MCB", "RCBO"]);
const threePole = (poles: string | null | undefined) => /^(3P|4P|3P\+N)/.test(poles ?? "");
/** Přístroj má svorku N (1P+N, 2P, 3P+N, 4P). */
const withNeutral = (poles: string | null | undefined) => /\+N|^2P$|^4P$/.test(poles ?? "");

export const conductorsOf = (kind: CombKind, phase: string = "L1"): string[] => (kind === "3P" ? ["L1", "L2", "L3"] : kind === "3PN" ? ["L1", "L2", "L3", "N"] : kind === "1PN" ? [phase, "N"] : [phase]);

/** Nastavení hřebenů lišt z uspořádání projektu (jen platné hodnoty, klíč = číslo lišty; „3F“ / „1F“ z fáze 112). */
export function parseCombSettings(value: unknown): Record<number, CombSetting> {
  const result: Record<number, CombSetting> = {};
  if (!value || typeof value !== "object") return result;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const rail = Number(key);
    const setting = toCombSetting(raw);
    if (Number.isInteger(rail) && rail >= 1 && rail <= 64 && setting && setting !== "AUTO") result[rail] = setting;
  }
  return result;
}

/** Fáze přístroje z přiřazení („L2“, „L1,L2,L3,N“, „L1,N“). */
export function phaseFromAssignment(assignment: string | null | undefined): PhaseBadge | null {
  const phases = (assignment ?? "").split(",").map((part) => part.trim()).filter((part) => part === "L1" || part === "L2" || part === "L3");
  if (phases.length >= 3) return "L1+L2+L3";
  return (phases[0] as PhaseBadge | undefined) ?? null;
}

/** Fáze jednofázového hřebenu (přiřazení chrániče / prvního přístroje, jinak L1). */
const singlePhase = (device: CombDevice) => {
  const phase = phaseFromAssignment(device.phaseAssignment);
  return phase && phase !== "L1+L2+L3" ? phase : "L1";
};

/**
 * Hřebeny lišt (fáze 115): chránič a za ním souvislá řada jističů / jističochráničů, které z něj napájí (`parentId`),
 * nebo souvislá řada nejméně dvou jističochráničů se stejným napájením. Úsek končí u jiného chrániče a u každého jiného
 * přístroje (stykač, relé, elektroměr, svorkovnice, zdroj, aktor). Auto: 4P / 3P chránič ve 3f soustavě = 3P (L1 L2 L3),
 * 2P chránič = 1P; řada jističochráničů s pólem N = 3P+N (1f soustava 1P+N), bez N = 3P / 1P. Volba lišty přebije druh
 * (3P+N jen tam, kde mají všechny přístroje pól N), „Bez hřebenu“ hřeben lišty zruší.
 */
export function combRuns(devices: readonly CombDevice[], nodes: readonly CombNode[], settings: Record<number, CombSetting> = {}, supplyPhases: 1 | 3 = 3): CombRun[] {
  const parentOf = new Map(nodes.map((node) => [node.id, node.parentItemId]));
  const runs: CombRun[] = [];
  const rails = [...new Set(devices.map((device) => device.dinRailIndex))].sort((a, b) => a - b);
  const modulesOf = (members: readonly CombDevice[]) => Math.round(members.reduce((sum, member) => sum + Math.max(0.5, member.modulesWidth || 1), 0) * 10) / 10;
  for (const rail of rails) {
    const setting = settings[rail] ?? "AUTO";
    if (setting === "OFF") continue;
    const row = devices.filter((device) => device.dinRailIndex === rail).sort((a, b) => a.positionOnRail - b.positionOnRail);
    let index = 0;
    while (index < row.length) {
      const head = row[index];
      if (head.category === "RCD") {
        // Chránič + jeho jističe hned za ním (bez cizího přístroje mezi nimi)
        const members = [head];
        let next = index + 1;
        while (next < row.length && BREAKERS.has(row[next].category ?? "") && parentOf.get(row[next].id) === head.id) members.push(row[next++]);
        if (members.length > 1) {
          const breakers = members.slice(1);
          const auto: CombKind = threePole(head.poles) && supplyPhases === 3 ? "3P" : "1P";
          let kind: CombKind = setting === "AUTO" ? auto : setting === "1P" ? "1P" : setting === "3P" ? "3P" : "3PN";
          let note: string | undefined;
          if (kind === "3PN" && !(withNeutral(head.poles) && breakers.every((member) => withNeutral(member.poles)))) {
            kind = "3P";
            note = "3P+N nelze – jističe bez pólu N (N chrániče na nulový můstek), použit hřeben 3P";
          }
          runs.push({ rail, ids: members.map((member) => member.id), kind, conductors: conductorsOf(kind, singlePhase(head)), input: false, modules: modulesOf(members), ...(note ? { note } : {}) });
          index = next;
          continue;
        }
      }
      if (head.category === "RCBO") {
        // Řada jističochráničů se společným napájením – hřeben na vstupu
        const members = [head];
        let next = index + 1;
        while (next < row.length && row[next].category === "RCBO" && parentOf.get(row[next].id) === parentOf.get(head.id)) members.push(row[next++]);
        if (members.length > 1) {
          const neutral = members.every((member) => withNeutral(member.poles));
          const auto: CombKind = supplyPhases === 3 ? (neutral ? "3PN" : "3P") : neutral ? "1PN" : "1P";
          let kind: CombKind = setting === "AUTO" ? auto : setting;
          let note: string | undefined;
          if (kind === "3PN" && !neutral) {
            kind = "3P";
            note = "3P+N nelze – jističochrániče bez pólu N, použit hřeben 3P";
          }
          runs.push({ rail, ids: members.map((member) => member.id), kind, conductors: conductorsOf(kind, singlePhase(head)), input: true, modules: modulesOf(members), ...(note ? { note } : {}) });
          index = next;
          continue;
        }
      }
      index++;
    }
  }
  return runs;
}

/**
 * Fáze 115: přístroje napojené hřebenem místo vodiče – u chrániče jeho jističe (napájí je hřeben pod výstupy), u řady
 * jističochráničů všechny kromě prvního (přívod vede jen do prvního, dál hřeben na vstupu).
 */
export function combFedIds(runs: readonly CombRun[]): Set<string> {
  return new Set(runs.flatMap((run) => run.ids.slice(1)));
}

/**
 * Odznaky fází jističů a jističochráničů: přiřazená fáze, 3P / 4P přístroj = L1+L2+L3, jinak pozice na 3f hřebenu
 * (L1, L2, L3, L1 …); jednofázový hřeben = jeho fáze, jednofázová soustava = L1.
 */
export function phaseBadges(devices: readonly CombDevice[], runs: readonly CombRun[], supplyPhases: 1 | 3 = 3): Map<string, PhaseBadge> {
  const result = new Map<string, PhaseBadge>();
  const byId = new Map(devices.map((device) => [device.id, device]));
  for (const run of runs) {
    let cursor = 0;
    for (const id of run.ids) {
      const device = byId.get(id);
      if (!device || !BREAKERS.has(device.category ?? "") || threePole(device.poles)) continue;
      if (run.kind === "3P" || run.kind === "3PN") result.set(id, (["L1", "L2", "L3"] as const)[cursor++ % 3]);
      else result.set(id, run.conductors[0] as PhaseBadge);
    }
  }
  for (const device of devices) {
    if (!BREAKERS.has(device.category ?? "")) continue;
    const assigned = phaseFromAssignment(device.phaseAssignment);
    if (threePole(device.poles)) result.set(device.id, "L1+L2+L3");
    else if (assigned && assigned !== "L1+L2+L3") result.set(device.id, assigned);
    else if (!result.has(device.id) && supplyPhases === 1) result.set(device.id, "L1");
  }
  return result;
}

/**
 * Fáze 115: póly přístroje s vidličkou hřebenu – index pólu (0 = vlevo) pro každý vodič hřebenu. 4P chránič pod 3P
 * hřebenem: L1 L2 L3 ano, N (4. pól) ne; 1P jistič jen svůj pól; 1P+N u 3P+N / 1P+N hřebenu i N.
 */
export function combForks(device: Pick<CombDevice, "poles" | "category">, run: Pick<CombRun, "kind" | "input">): number[] {
  const poles = device.poles ?? "1P";
  const count = Math.max(1, Math.min(4, Number(poles.match(/\d/)?.[0] ?? 1) + (/\+N/.test(poles) ? 1 : 0)));
  const neutralPole = withNeutral(poles) ? count - 1 : null;
  const phases = Array.from({ length: count }, (_, index) => index).filter((index) => index !== neutralPole);
  const wantsNeutral = run.kind === "3PN" || run.kind === "1PN";
  const phasePoles = run.kind === "1P" || run.kind === "1PN" ? phases.slice(0, 1) : phases.slice(0, 3);
  return neutralPole !== null && wantsNeutral ? [...phasePoles, neutralPole] : phasePoles;
}

/** Počet pólů přístroje na čele (1P = 1, 1P+N = 2, 3P+N / 4P = 4). */
export const poleCount = (poles: string | null | undefined) => Math.max(1, Math.min(4, Number((poles ?? "1").match(/\d/)?.[0] ?? 1) + (/\+N/.test(poles ?? "") ? 1 : 0)));

/** Barvy fází podle ČSN 33 0165 (L1 hnědá, L2 černá, L3 šedá) – kontrastní text a obrys pro tmavé i světlé plátno. */
export const PHASE_STYLE: Record<"L1" | "L2" | "L3", { fill: string; text: string; stroke: string; color: string }> = {
  L1: { fill: "#8b4513", text: "#ffffff", stroke: "#d6a77a", color: "hnědá" },
  L2: { fill: "#111111", text: "#ffffff", stroke: "#a1a1aa", color: "černá" },
  L3: { fill: "#9ca3af", text: "#111111", stroke: "#e5e7eb", color: "šedá" },
};

const KIND_SHORT: Record<CombKind, string> = { "3P": "3f", "3PN": "3P+N", "1P": "1f", "1PN": "1P+N" };

/** Popisek hřebenu („Hřeben 3f · L1 L2 L3“, „Hřeben 3P+N · L1 L2 L3 N“). */
export const combLabel = (run: Pick<CombRun, "kind" | "conductors">) => `Hřeben ${KIND_SHORT[run.kind]} · ${run.conductors.join(" ")}`;
/** Kratší popisek pro krátký úsek („3f · L1 L2 L3“, „3f“). */
export const combShortLabel = (run: Pick<CombRun, "kind" | "conductors">, width: "medium" | "short") => (width === "medium" ? `${KIND_SHORT[run.kind]} · ${run.conductors.join(" ")}` : KIND_SHORT[run.kind]);

// ---------------------------------------------------------------------------------------------------------------------
//  Díly hřebenů do kusovníku a nářezového listu (fáze 115)
// ---------------------------------------------------------------------------------------------------------------------

/** Rozteč pinů hřebenové přípojnice ABB PS [mm]. */
export const COMB_PIN_PITCH_MM = 17.6;

interface PsPiece {
  typeCode: string;
  articleNumber: string;
  pins: number;
}

/**
 * ABB PS (63 A, rozteč 17,6 mm) z katalogu ABB CZ (seed `seed-abb-cz.ts`): krátké 12pinové kusy, dlouhé 60pinové se
 * zkracují; 3P+N jen 12pinový PS4/12NA; koncová krytka PS-END (2, 3 a 4pólové), PS-END 0 (PS1).
 */
const ABB_PS: Record<CombKind, { short: PsPiece; long: PsPiece | null; end: PsPiece; poles: string }> = {
  "1P": { short: { typeCode: "PS1/12", articleNumber: "2CDL210001R1012", pins: 12 }, long: { typeCode: "PS1/60", articleNumber: "2CDL210001R1060", pins: 60 }, end: { typeCode: "PS-END 0", articleNumber: "2CDL200001R0004", pins: 0 }, poles: "1P" },
  "1PN": { short: { typeCode: "PS2/12", articleNumber: "2CDL220001R1012", pins: 12 }, long: null, end: { typeCode: "PS-END", articleNumber: "2CDL200001R0001", pins: 0 }, poles: "2P" },
  "3P": { short: { typeCode: "PS3/12", articleNumber: "2CDL230001R1012", pins: 12 }, long: { typeCode: "PS3/60", articleNumber: "2CDL230001R1060", pins: 60 }, end: { typeCode: "PS-END", articleNumber: "2CDL200001R0001", pins: 0 }, poles: "3P" },
  "3PN": { short: { typeCode: "PS4/12NA", articleNumber: "2CDL240213R1012", pins: 12 }, long: null, end: { typeCode: "PS-END", articleNumber: "2CDL200001R0001", pins: 0 }, poles: "3P+N" },
};

export interface CombPart {
  manufacturer: string;
  typeCode: string;
  /** Objednací číslo výrobce; „–“ = podle výrobce jističů (hřeben ABB PS jen pod přístroji ABB). */
  articleNumber: string;
  description: string;
  quantity: number;
  kind: "comb" | "end";
}

/** Nářez jednoho hřebenu (úsek lišty): díl, počet pinů a délka po zkrácení. */
export interface CombCut {
  rail: number;
  from: string;
  to: string;
  item: string;
  pins: number;
  lengthMm: number;
  kind: CombKind;
}

const isAbb = (manufacturer: string | null | undefined) => !manufacturer || /^abb\b/i.test(manufacturer.trim());
const runMaker = (run: CombRun, byId: Map<string, CombDevice>) => {
  const makers = run.ids.map((id) => byId.get(id)?.manufacturer).filter((maker): maker is string => Boolean(maker && maker.trim()));
  return makers.every(isAbb) ? "ABB" : (makers.find((maker) => !isAbb(maker)) ?? "ABB");
};

/** Díl hřebenu úseku: ABB PS podle počtu pinů (do 12 pinů 12pinový kus, delší zkrátit z 60pinového), jinak obecný. */
function pieceOf(run: CombRun, maker: string): { piece: PsPiece | null; generic: string } {
  const family = ABB_PS[run.kind];
  const pins = Math.ceil(run.modules);
  const generic = `Hřebenová přípojnice ${KIND_SHORT[run.kind]} (${run.conductors.join(" ")}) dle výrobce jističů ${maker}`;
  if (maker !== "ABB") return { piece: null, generic };
  return { piece: pins <= family.short.pins || !family.long ? family.short : family.long, generic };
}

/** Nářezový list hřebenů: každý úsek zvlášť (díl, zkrácení na počet pinů, délka). */
export function combCuts(runs: readonly CombRun[], devices: readonly CombDevice[]): CombCut[] {
  const byId = new Map(devices.map((device) => [device.id, device]));
  return runs.map((run) => {
    const maker = runMaker(run, byId);
    const pins = Math.ceil(run.modules);
    const { piece, generic } = pieceOf(run, maker);
    const item = piece ? `Hřeben ABB ${piece.typeCode} (${piece.articleNumber}) – zkrátit na ${pins} pinů` : `${generic} – ${pins} pinů`;
    return { rail: run.rail, from: byId.get(run.ids[0])?.designation ?? run.ids[0], to: byId.get(run.ids[run.ids.length - 1])?.designation ?? run.ids[run.ids.length - 1], item, pins, lengthMm: Math.round(pins * COMB_PIN_PITCH_MM), kind: run.kind };
  });
}

/**
 * Kusovník hřebenů: ABB PS po úsecích (úseky nad 12 pinů z 60pinových kusů – součet pinů / 60, zbytky se zkrátí; 3P+N
 * a 1P+N jen 12pinové, delší úsek = víc kusů za sebou) a 2 koncové krytky na úsek. Pod přístroji jiného výrobce obecný
 * řádek bez objednacího čísla (číslo nevymýšlíme).
 */
export function combParts(runs: readonly CombRun[], devices: readonly CombDevice[]): CombPart[] {
  const byId = new Map(devices.map((device) => [device.id, device]));
  const parts = new Map<string, CombPart>();
  const longPins = new Map<string, { piece: PsPiece; pins: number; kind: CombKind }>();
  const add = (key: string, part: Omit<CombPart, "quantity">, quantity: number) => {
    const own = parts.get(key);
    if (own) own.quantity += quantity;
    else parts.set(key, { ...part, quantity });
  };
  for (const run of runs) {
    const maker = runMaker(run, byId);
    const pins = Math.ceil(run.modules);
    const family = ABB_PS[run.kind];
    const { piece, generic } = pieceOf(run, maker);
    if (!piece) {
      add(`generic|${run.kind}|${maker}`, { manufacturer: maker, typeCode: `Hřeben ${KIND_SHORT[run.kind]}`, articleNumber: "–", description: generic, kind: "comb" }, 1);
      add(`generic-end|${maker}`, { manufacturer: maker, typeCode: "Koncová krytka hřebenu", articleNumber: "–", description: `Koncová krytka hřebenové přípojnice dle výrobce jističů ${maker}`, kind: "end" }, 2);
      continue;
    }
    if (piece === family.long) {
      const own = longPins.get(piece.articleNumber);
      if (own) own.pins += pins;
      else longPins.set(piece.articleNumber, { piece, pins, kind: run.kind });
    } else {
      add(piece.articleNumber, { manufacturer: "ABB", typeCode: piece.typeCode, articleNumber: piece.articleNumber, description: `Hřebenová přípojnice ${family.poles} ${piece.pins} pinů, 63 A, rozteč 17,6 mm (${run.conductors.join(" ")})`, kind: "comb" }, Math.ceil(pins / piece.pins));
    }
    add(family.end.articleNumber, { manufacturer: "ABB", typeCode: family.end.typeCode, articleNumber: family.end.articleNumber, description: `Koncová krytka hřebenové přípojnice ${family.end.typeCode === "PS-END 0" ? "PS1" : "PS 2 / 3 / 4pólové"}`, kind: "end" }, 2);
  }
  for (const { piece, pins, kind } of longPins.values()) {
    add(piece.articleNumber, { manufacturer: "ABB", typeCode: piece.typeCode, articleNumber: piece.articleNumber, description: `Hřebenová přípojnice ${ABB_PS[kind].poles} ${piece.pins} pinů, 63 A – zkrátit na úseky (celkem ${pins} pinů)`, kind: "comb" }, Math.ceil(pins / piece.pins));
  }
  return [...parts.values()].sort((a, b) => (a.kind === b.kind ? a.typeCode.localeCompare(b.typeCode) : a.kind === "comb" ? -1 : 1));
}
