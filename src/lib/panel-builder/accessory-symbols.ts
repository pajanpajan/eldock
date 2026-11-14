// Fáze 114: věrné vektorové symboly příslušenství na DIN liště (krok 1 „Přiřazený přístroj k osazení“ i plátno) – podtyp
// příslušenství z konfigurace, katalogu nebo typového označení, komory rozbočovací svorkovnice HLAK (L1 / L2 / L3 / N / PE
// v barvách vodičů podle ČSN 33 0165), řadová svorka podle druhu vodiče, póly hřebene, LED signálky a typická šířka
// podtypu při volbě v kaskádě. Čisté funkce – sdílí symbol, konfigurátor a testy.

/** Podtypy příslušenství (stejné klíče jako `ACCESSORY_SUBTYPES` konfigurátoru – hlídá test fáze 114). */
export const ACCESSORY_KINDS = ["TERMINAL_BLOCK", "BUSBAR", "BUSBAR_END_CAP", "AUX_CONTACT", "SHUNT_TRIP", "UNDERVOLTAGE_TRIP", "FUSE_LINK", "DIN_SOCKET", "INDICATOR", "BLANK_COVER"] as const;
export type AccessoryKind = (typeof ACCESSORY_KINDS)[number];

export const isAccessoryKind = (value: string | null | undefined): value is AccessoryKind => !!value && (ACCESSORY_KINDS as readonly string[]).includes(value);

/** Typická šířka podtypu [M] při volbě v kaskádě (HLAK 4M, pomocný kontakt 0,5M, zásuvka na DIN 3M …). */
export const ACCESSORY_DEFAULT_MODULES: Record<AccessoryKind, number> = {
  TERMINAL_BLOCK: 4,
  BUSBAR: 4,
  BUSBAR_END_CAP: 0.5,
  AUX_CONTACT: 0.5,
  SHUNT_TRIP: 1,
  UNDERVOLTAGE_TRIP: 1,
  FUSE_LINK: 1,
  DIN_SOCKET: 3,
  INDICATOR: 1,
  BLANK_COVER: 1,
};

/** Podtyp modulu z katalogu (fáze 43 „Zdroj / Měření / Jiné“) → příslušenství se stejnou kresbou. */
const MODULE_SUBTYPE_KIND: Record<string, AccessoryKind> = { MAIN_TERMINAL: "TERMINAL_BLOCK", FUSE_DISCONNECTOR: "FUSE_LINK" };

/** Typové označení / popis → podtyp (kus z importu katalogu bez podtypu, prvek z rozpoznání fotky). */
const PATTERNS: { test: RegExp; kind: AccessoryKind }[] = [
  { test: /hlak|svorkovnic|rozbo[čc]ovac|terminal block|řadov[áa] svork|\bsvork/i, kind: "TERMINAL_BLOCK" },
  { test: /koncovk|ps-end|end ?cap|\bkzn|\bekc\b|\bz-\d+\/\d?f/i, kind: "BUSBAR_END_CAP" },
  { test: /hřeben|hreben|propojovac[íi] li[šs]t|busbar|\bps ?\d\/|\bkdn\d|\bgvk\b|\blms-|\biz\d+\//i, kind: "BUSBAR" },
  { test: /pomocn[ýy] kontakt|aux|s2c-h|\bhk\d|ihk|mz20[12]|ps-lt|\biof\b/i, kind: "AUX_CONTACT" },
  { test: /podp[ěe][ťt]ov|undervolt|s2c-ua|\busa\b|z-usa|mz206|\bimn\b/i, kind: "UNDERVOLTAGE_TRIP" },
  { test: /vyp[íi]nac[íi] spou[šs][ťt]|shunt|s2c-a|z-asa|zp-asa|mz203|\bimx\b/i, kind: "SHUNT_TRIP" },
  { test: /pojistk|fuse|\bopv|\bpv10|\be ?9[01]|\bch10|10 ?[x×] ?38|\bg[gp]v?\b/i, kind: "FUSE_LINK" },
  { test: /z[áa]suvk|socket|m117\d|zse-|sn216|z-sd/i, kind: "DIN_SOCKET" },
  { test: /sign[áa]lk|kontrolk|indicator|e219|z-bel|mka-s|led/i, kind: "INDICATOR" },
  { test: /z[áa]slepk|blank|kryc[íi] (pás|li[šs]t)|\bbs-\d/i, kind: "BLANK_COVER" },
];

/**
 * Podtyp příslušenství přístroje: z konfigurace / katalogu (`moduleSubtype`), u svorky z kategorie TERMINAL, jinak podle
 * typového označení – jen u kategorií svorka / jiné (jistič zůstane jističem, popis obvodu se nečte).
 */
export function accessoryKindOf(device: { accessory?: string | null; moduleSubtype?: string | null; category: string | null; typeCode?: string | null; label?: string | null; power?: string | null }): AccessoryKind | null {
  if (isAccessoryKind(device.accessory)) return device.accessory;
  if (isAccessoryKind(device.moduleSubtype)) return device.moduleSubtype;
  if (device.moduleSubtype && MODULE_SUBTYPE_KIND[device.moduleSubtype]) return MODULE_SUBTYPE_KIND[device.moduleSubtype];
  if (device.category !== "TERMINAL" && device.category !== "OTHER") return null;
  // Popis funkce obvodu („Zásuvky kuchyně“) o druhu přístroje nic neříká – jen typ a podtyp z konfigurace
  const text = [device.typeCode, device.power].filter(Boolean).join(" ");
  const hit = PATTERNS.find((pattern) => pattern.test.test(text));
  if (hit) return hit.kind;
  return device.category === "TERMINAL" ? "TERMINAL_BLOCK" : null;
}

/** Komora svorkovnice / řadová svorka – barva izolace podle vodiče (ČSN 33 0165). */
export interface TerminalChamber {
  conductor: "L1" | "L2" | "L3" | "L" | "N" | "PE";
  fill: string;
  /** Pruh zelenožluté izolace PE. */
  stripe: string | null;
  text: string;
}

export const CONDUCTOR_COLORS: Record<TerminalChamber["conductor"], { fill: string; stripe: string | null; text: string }> = {
  L1: { fill: "#7c4a2d", stripe: null, text: "#ffffff" },
  L2: { fill: "#1f1f1f", stripe: null, text: "#ffffff" },
  L3: { fill: "#6b7280", stripe: null, text: "#ffffff" },
  L: { fill: "#6b7280", stripe: null, text: "#ffffff" },
  N: { fill: "#1d4ed8", stripe: null, text: "#ffffff" },
  PE: { fill: "#15803d", stripe: "#eab308", text: "#ffffff" },
};

const chamber = (conductor: TerminalChamber["conductor"]): TerminalChamber => ({ conductor, ...CONDUCTOR_COLORS[conductor] });

/** Rozbočovací svorkovnice HLAK od 2M: 3f = L1 / L2 / L3 / N / PE, 1f (2M, 1P–2P) = L / N / PE. */
export function hlakChambers(modules: number, poles: string | null | undefined): TerminalChamber[] {
  const single = modules < 3 || poles === "1P" || poles === "1P+N" || poles === "2P";
  return (single ? (["L", "N", "PE"] as const) : (["L1", "L2", "L3", "N", "PE"] as const)).map(chamber);
}

/** Řadová svorka 0,5–1M: zelenožlutá PE, modrá N, jinak šedá fázová (podle typu / popisu). */
export function rowTerminalConductor(text: string | null | undefined): TerminalChamber {
  const value = text ?? "";
  if (/\bPE\b|zelenožlut|zeleno-žlut|ochrann|\bPEK/i.test(value)) return chamber("PE");
  if (/\bN\b|modr|neutr|\bNK\//i.test(value)) return chamber("N");
  return chamber("L");
}

/** Popis svorkovnice „HLAK 25/16 mm²“ (přívod / vývody) z typu („HLAK 35-4/5“ → 35/16 mm²). */
export function hlakText(typeCode: string | null | undefined): string {
  const inlet = /(?:hlak\D*)?(\d{2,3})\s*(?:mm|-|\/)/i.exec(typeCode ?? "")?.[1];
  const value = inlet && [16, 25, 35, 50, 70, 95].includes(Number(inlet)) ? Number(inlet) : 25;
  return `HLAK ${value}/16 mm²`;
}

/** Póly hřebenové lišty („1P“ … „4P“, jinak podle typu „3F“ / „3P“) → popisy fází na izolaci. */
export function busbarPhases(poles: string | null | undefined, typeCode?: string | null): string[] {
  const fromType = /(\d)\s*[FP]\b|\/(\d)P/i.exec(typeCode ?? "");
  const count = poles === "4P" || poles === "3P+N" ? 4 : poles === "3P" ? 3 : poles === "2P" || poles === "1P+N" ? 2 : fromType ? Number(fromType[1] ?? fromType[2]) : 1;
  return (["L1", "L2", "L3", "N"] as const).slice(0, Math.min(4, Math.max(1, count)));
}

/** LED signálky: 1–3 čočky (zelená / červená / žlutá pro L1 · L2 · L3) podle pólů nebo šířky. */
export function indicatorLeds(poles: string | null | undefined, modules: number, typeCode?: string | null): { fill: string; label: string }[] {
  const count = poles === "3P" || poles === "4P" || /3[CDE]|3x|3 ?led/i.test(typeCode ?? "") ? 3 : poles === "2P" || /2[CD]/i.test(typeCode ?? "") ? 2 : Math.max(1, Math.min(3, Math.round(modules)));
  const colors = ["#22c55e", "#ef4444", "#facc15"];
  const labels = count === 1 ? ["L"] : ["L1", "L2", "L3"];
  return Array.from({ length: count }, (_, index) => ({ fill: colors[index], label: labels[index] }));
}
