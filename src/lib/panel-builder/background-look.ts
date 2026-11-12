// Fáze 100: čitelnost výkresu nad bílým podkladem (PDF / obrázek stavaře) – rychlý přepínač „🌗 Podklad“ v horní liště
// plátna: 100 % (originál), 60 % (doporučeno – výchozí po nahrání, jemně potlačený kontrast), 35 % a invertovaný tmavý
// CAD (CSS filtr `invert(0.92) hue-rotate(180deg) contrast(0.85)`). Barevné okruhy, trasy a značky nad podkladem pak
// vyniknou. Vzhled je součástí podkladu podlaží (ukládá se s půdorysem). Čisté funkce.

export type BackgroundLook = "full" | "dim60" | "dim35" | "dark";

/** Výchozí vzhled po nahrání podkladu (i u starších půdorysů bez uloženého vzhledu). */
export const DEFAULT_BACKGROUND_LOOK: BackgroundLook = "dim60";

/** CSS filtr tmavého CADu – bílý výkres → tmavý architektonický podklad ladící s tmavým rozhraním. */
export const DARK_CAD_FILTER = "invert(0.92) hue-rotate(180deg) contrast(0.85)";
/** Jemné potlačení kontrastu ztlumeného podkladu (60 % / 35 %). */
export const DIM_FILTER = "contrast(0.85)";

export const BACKGROUND_LOOKS: readonly { id: BackgroundLook; label: string; title: string }[] = [
  { id: "full", label: "100 %", title: "Podklad 100 % – originál výkresu" },
  { id: "dim60", label: "60 %", title: "Podklad 60 % (Doporučeno) – jemně potlačený kontrast, okruhy, trasy a značky vyniknou" },
  { id: "dim35", label: "35 %", title: "Podklad 35 % – výkres jen jako jemná orientace" },
  { id: "dark", label: "🌑 Tmavý CAD", title: "Invertovat do tmavého CADu – bílý výkres jako tmavý architektonický podklad" },
];

export const isBackgroundLook = (value: unknown): value is BackgroundLook => value === "full" || value === "dim60" || value === "dim35" || value === "dark";

/** Vzhled podkladu podlaží (bez uloženého vzhledu = doporučených 60 %). */
export const backgroundLookOf = (background: { look?: unknown } | null | undefined): BackgroundLook => (isBackgroundLook(background?.look) ? background.look : DEFAULT_BACKGROUND_LOOK);

export interface BackgroundStyle {
  /** Krytí obrázku podkladu. */
  opacity: number;
  /** CSS filtr (stejný výsledek kreslí SVG filtr `backgroundFilterId`), null = bez filtru. */
  filter: string | null;
  /** Plocha pod obrázkem (bílý papír, u tmavého CADu tmavě šedá = invertovaná bílá). */
  backdrop: string;
  /** Kresba nad podkladem jako na papíře (tmavé značky) – u tmavého CADu světlé jako na čistém rastru. */
  paper: boolean;
}

/** Tmavě šedá plocha tmavého CADu = bílá po invert(0.92) a contrast(0.85) → 0,08 × 0,85 + 0,075 ≈ 14 % (#242424). */
export const DARK_CAD_BACKDROP = "#242424";

export function backgroundStyle(look: BackgroundLook): BackgroundStyle {
  if (look === "full") return { opacity: 1, filter: null, backdrop: "#ffffff", paper: true };
  if (look === "dim60") return { opacity: 0.6, filter: DIM_FILTER, backdrop: "#ffffff", paper: true };
  if (look === "dim35") return { opacity: 0.35, filter: DIM_FILTER, backdrop: "#ffffff", paper: true };
  return { opacity: 1, filter: DARK_CAD_FILTER, backdrop: DARK_CAD_BACKDROP, paper: false };
}

/** Kresba nad podkladem „na papíře“ (bílý podklad) – bez podkladu tmavý rastr, u tmavého CADu světlá kresba. */
export const drawsOnPaper = (background: { look?: unknown } | null | undefined) => Boolean(background) && backgroundStyle(backgroundLookOf(background)).paper;

/** Id SVG filtru vzhledu (null = bez filtru). */
export const backgroundFilterId = (look: BackgroundLook): string | null => (look === "dark" ? "fp-bg-dark" : look === "full" ? null : "fp-bg-dim");

/**
 * Primitiva SVG filtru se stejným výsledkem jako CSS funkce (Filter Effects Level 1 – invert = tabulka [a, 1 − a],
 * hue-rotate = feColorMatrix hueRotate, contrast = lineární přenos slope c, intercept 0,5 − c / 2) v prostoru sRGB.
 * SVG filtr kreslí stejně všechny prohlížeče (CSS filtr na prvku uvnitř SVG Chromium dlouho neuměl).
 */
export interface FilterStep {
  kind: "table" | "hueRotate" | "linear";
  /** table: hodnoty tabulky; hueRotate: úhel; linear: [slope, intercept]. */
  values: number[];
}

const round = (value: number) => Math.round(value * 1e4) / 1e4;

export function filterSteps(css: string): FilterStep[] {
  const steps: FilterStep[] = [];
  for (const match of css.matchAll(/([a-z-]+)\(([-\d.]+)(deg)?\)/g)) {
    const value = Number(match[2]);
    if (match[1] === "invert") steps.push({ kind: "table", values: [round(value), round(1 - value)] });
    else if (match[1] === "hue-rotate") steps.push({ kind: "hueRotate", values: [value] });
    else if (match[1] === "contrast") steps.push({ kind: "linear", values: [round(value), round(0.5 - value / 2)] });
  }
  return steps;
}

/** Barva kanálu (0–1) po krocích filtru – stejný výpočet jako prohlížeč (šedá se otočením odstínu nemění). */
export function applyGray(steps: readonly FilterStep[], value: number): number {
  let channel = value;
  for (const step of steps) {
    if (step.kind === "table") channel = step.values[0] + (step.values[1] - step.values[0]) * channel;
    else if (step.kind === "linear") channel = step.values[0] * channel + step.values[1];
    channel = Math.min(1, Math.max(0, channel));
  }
  return round(channel);
}
