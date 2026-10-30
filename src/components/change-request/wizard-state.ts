import type { ChangeRequestPriority } from "@/generated/prisma/enums";
import type { MarkupStroke } from "@/lib/markup";

// Stav průvodce „Zadat změnu“ (useReducer) + koncept v sessionStorage. Čisté funkce (testy).

export type WizardStep = "markup" | "photos" | "note" | "summary";

export const STEP_LABELS: Record<WizardStep, string> = {
  markup: "Zákres",
  photos: "Fotky",
  note: "Poznámka",
  summary: "Souhrn",
};

/** Nová změna: 4 kroky; doplnění k otevřené změně: bez zákresu. */
export const stepsFor = (mode: "new" | "comment"): WizardStep[] =>
  mode === "new" ? ["markup", "photos", "note", "summary"] : ["photos", "note", "summary"];

export interface WizardPhoto {
  /** Lokální id (klíč v seznamu). */
  key: string;
  fileName: string;
  caption: string;
  /** Náhled (object URL během nahrávání, potom URL ze serveru). */
  previewUrl: string;
  /** URL po nahrání (`/api/files/photos/...`). */
  url: string | null;
  sizeBytes: number;
  /** 0–100 během nahrávání. */
  progress: number;
  error: string | null;
  /** Fotka nese zákres (kreslení do fotky) – nahraná je už složená verze. */
  annotated?: boolean;
}

export interface WizardState {
  stepIndex: number;
  sheet: number;
  strokes: MarkupStroke[];
  photos: WizardPhoto[];
  text: string;
  /** Text vznikl (i částečně) diktováním → ukládá se jako přepis hlasové poznámky. */
  dictated: boolean;
  priority: ChangeRequestPriority;
}

export const initialWizardState: WizardState = {
  stepIndex: 0,
  sheet: 1,
  strokes: [],
  photos: [],
  text: "",
  dictated: false,
  priority: "NORMAL",
};

export type WizardAction =
  | { type: "goto"; index: number }
  | { type: "setStrokes"; strokes: MarkupStroke[] }
  | { type: "setSheet"; sheet: number }
  | { type: "addPhoto"; photo: WizardPhoto }
  | { type: "updatePhoto"; key: string; patch: Partial<WizardPhoto> }
  | { type: "removePhoto"; key: string }
  | { type: "setText"; text: string; dictated?: boolean }
  | { type: "setPriority"; priority: ChangeRequestPriority }
  | { type: "restore"; state: Partial<WizardState> }
  | { type: "reset" };

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "goto":
      return { ...state, stepIndex: Math.max(0, action.index) };
    case "setStrokes":
      return { ...state, strokes: action.strokes };
    case "setSheet":
      // Zákres patří k jednomu listu – při změně listu se tahy zahodí.
      return action.sheet === state.sheet ? state : { ...state, sheet: action.sheet, strokes: [] };
    case "addPhoto":
      return { ...state, photos: [...state.photos, action.photo] };
    case "updatePhoto":
      return { ...state, photos: state.photos.map((photo) => (photo.key === action.key ? { ...photo, ...action.patch } : photo)) };
    case "removePhoto":
      return { ...state, photos: state.photos.filter((photo) => photo.key !== action.key) };
    case "setText":
      return { ...state, text: action.text, dictated: state.dictated || !!action.dictated || false };
    case "setPriority":
      return { ...state, priority: action.priority };
    case "restore":
      return { ...state, ...action.state };
    case "reset":
      return initialWizardState;
  }
}

export const uploadedPhotos = (state: WizardState) => state.photos.filter((photo) => photo.url && !photo.error);
export const isUploading = (state: WizardState) => state.photos.some((photo) => !photo.url && !photo.error);

/** Validace odeslání: alespoň zákres, fotka nebo poznámka. */
export function canSubmit(state: WizardState, mode: "new" | "comment"): { ok: true } | { ok: false; reason: string } {
  if (isUploading(state)) return { ok: false, reason: "Počkejte, než se dokončí nahrávání fotek." };
  const hasContent =
    (mode === "new" && state.strokes.length > 0) || uploadedPhotos(state).length > 0 || state.text.trim().length > 0;
  if (!hasContent) {
    return {
      ok: false,
      reason: mode === "new" ? "Přidejte alespoň zákres, fotku nebo poznámku." : "Přidejte alespoň fotku nebo poznámku.",
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
//  Koncept v sessionStorage (přežije reload, ne zavření karty)
// ---------------------------------------------------------------------------

export const draftKey = (equipmentId: string, mode: "new" | "comment") => `digitry-cr-draft:${mode}:${equipmentId}`;

/** Do konceptu jdou jen nahrané fotky (object URL po reloadu neplatí). */
export function serializeDraft(state: WizardState): string {
  const photos = uploadedPhotos(state).map((photo) => ({ ...photo, previewUrl: photo.url!, progress: 100 }));
  return JSON.stringify({ ...state, photos });
}

export function parseDraft(json: string | null): Partial<WizardState> | null {
  if (!json) return null;
  try {
    const data = JSON.parse(json) as Partial<WizardState>;
    if (typeof data !== "object" || data === null) return null;
    return {
      stepIndex: typeof data.stepIndex === "number" ? data.stepIndex : 0,
      sheet: typeof data.sheet === "number" ? data.sheet : 1,
      strokes: Array.isArray(data.strokes) ? data.strokes : [],
      photos: Array.isArray(data.photos) ? data.photos.filter((photo) => typeof photo?.url === "string") : [],
      text: typeof data.text === "string" ? data.text : "",
      dictated: data.dictated === true,
      priority: data.priority ?? "NORMAL",
    };
  } catch {
    return null;
  }
}

export const isEmptyDraft = (state: Partial<WizardState>) =>
  !state.strokes?.length && !state.photos?.length && !state.text?.trim();
