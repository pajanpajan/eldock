// Fáze 78: soubor projektu půdorysu do počítače `<název>.eldock.json` – kompletní nákres (všechna podlaží, podklady,
// kalibrace, místnosti, prvky, volby svítidel, ručně upravené trasy, řady a barvy), údaje zakázky, šablony sestav firmy
// a podkladové obrázky jako data URL (soubor jde otevřít v jiném účtu i bez přístupu k úložišti původní firmy).
// Čisté funkce – sestavení a čtení souboru; stahování a nahrávání podkladů dělá klient.

import { floorsOf, parseDraft, type FloorplanDraft } from "./floorplan-editor";
import { parseFloorplanLibrary, type AssemblyTemplate } from "./floorplan-library";

export const ELDOCK_FILE_FORMAT = "eldock-floorplan";
export const ELDOCK_FILE_VERSION = 1;
export const ELDOCK_FILE_EXTENSION = ".eldock.json";
/** Největší soubor projektu ke čtení [B] (podklady jako data URL). */
export const MAX_ELDOCK_FILE_BYTES = 40 * 1024 * 1024;

export interface EldockFileMeta {
  code: string | null;
  name: string;
  customerName: string | null;
  installationSite: string | null;
}

export interface EldockFile {
  format: typeof ELDOCK_FILE_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  meta: EldockFileMeta;
  draft: FloorplanDraft;
  templates: AssemblyTemplate[];
  /** Podklady podlaží: původní adresa → data URL (obrázek). */
  assets: Record<string, string>;
}

/** Adresy podkladů všech podlaží (bez duplicit). */
export function backgroundUrls(draft: FloorplanDraft): string[] {
  return [...new Set(floorsOf(draft).map((floor) => floor.background?.url).filter((url): url is string => Boolean(url)))];
}

/** Fáze 79: soubory geometrie podkladu CAD (DXF) všech podlaží. */
export function cadUrls(draft: FloorplanDraft): string[] {
  return [...new Set(floorsOf(draft).map((floor) => floor.cad?.url).filter((url): url is string => Boolean(url)))];
}

/** Všechny soubory, které soubor projektu nese jako data URL (obrázky podkladů a geometrie CAD). */
export const assetUrls = (draft: FloorplanDraft) => [...backgroundUrls(draft), ...cadUrls(draft)];

/** Data URL geometrie CAD (JSON) – jinak obrázek. */
export const isCadAsset = (data: string) => data.startsWith("data:application/json;base64,");

/** Bezpečný název souboru z názvu projektu (diakritika zůstane, zakázané znaky pryč). */
export function eldockFileName(name: string): string {
  const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "pudorys";
  return `${base}${ELDOCK_FILE_EXTENSION}`;
}

export function buildEldockFile(input: { meta: EldockFileMeta; draft: FloorplanDraft; templates: readonly AssemblyTemplate[]; assets: Record<string, string>; now?: Date }): EldockFile {
  return {
    format: ELDOCK_FILE_FORMAT,
    schemaVersion: ELDOCK_FILE_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    meta: input.meta,
    draft: input.draft,
    templates: [...input.templates],
    assets: input.assets,
  };
}

const DATA_URL = /^data:(image\/(png|jpeg|webp|svg\+xml)|application\/json);base64,[A-Za-z0-9+/=]+$/;

/** Čtení souboru projektu: ověří formát a verzi, nákres projde stejnou kontrolou jako ze serveru. */
export function parseEldockFile(text: string): { file: EldockFile } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "Soubor není platný projekt Eldock (.eldock.json)." };
  }
  if (!raw || typeof raw !== "object" || (raw as { format?: unknown }).format !== ELDOCK_FILE_FORMAT) return { error: "Soubor není projekt 2D půdorysu Eldock." };
  const input = raw as Partial<EldockFile> & { schemaVersion?: unknown };
  if (typeof input.schemaVersion !== "number" || input.schemaVersion > ELDOCK_FILE_VERSION) return { error: "Soubor je z novější verze Eldocku – aktualizujte stránku a zkuste to znovu." };
  const draft = parseDraft(input.draft);
  if (!draft) return { error: "Nákres v souboru se nepodařilo načíst." };
  const metaRaw = (input.meta && typeof input.meta === "object" ? input.meta : {}) as Partial<EldockFileMeta>;
  const text80 = (value: unknown, max = 120) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);
  const meta: EldockFileMeta = { code: text80(metaRaw.code, 20), name: text80(metaRaw.name) ?? "Půdorys ze souboru", customerName: text80(metaRaw.customerName), installationSite: text80(metaRaw.installationSite) };
  const templates = parseFloorplanLibrary({ templates: input.templates ?? [], favorites: [], updatedAt: 0 })?.templates ?? [];
  const assets: Record<string, string> = {};
  for (const [url, data] of Object.entries(input.assets && typeof input.assets === "object" ? input.assets : {})) if (typeof data === "string" && DATA_URL.test(data)) assets[url] = data;
  return { file: { format: ELDOCK_FILE_FORMAT, schemaVersion: input.schemaVersion, exportedAt: typeof input.exportedAt === "string" ? input.exportedAt : "", meta, draft, templates, assets } };
}

/** Nahrazení adres podkladů ve všech podlažích (po nahrání podkladů ze souboru do úložiště firmy); fáze 79 i podklady CAD. */
export function replaceBackgroundUrls(draft: FloorplanDraft, map: ReadonlyMap<string, string>): FloorplanDraft {
  const swap = <T extends Pick<FloorplanDraft, "background" | "cad">>(sheet: T): T => ({
    ...sheet,
    ...(sheet.background && map.has(sheet.background.url) ? { background: { ...sheet.background, url: map.get(sheet.background.url)! } } : {}),
    ...(sheet.cad && map.has(sheet.cad.url) ? { cad: { ...sheet.cad, url: map.get(sheet.cad.url)! } } : {}),
  });
  return { ...swap(draft), otherFloors: draft.otherFloors.map(swap) };
}

/** Podklady, které soubor neobsahoval (export bez přístupu k souboru), se zahodí – žádný odkaz do cizího úložiště. */
export function stripMissingAssets(draft: FloorplanDraft, missing: ReadonlySet<string>): FloorplanDraft {
  const strip = <T extends Pick<FloorplanDraft, "background" | "cad">>(sheet: T): T => ({
    ...sheet,
    ...(sheet.background && missing.has(sheet.background.url) ? { background: null } : {}),
    ...(sheet.cad && missing.has(sheet.cad.url) ? { cad: null } : {}),
  });
  return { ...strip(draft), otherFloors: draft.otherFloors.map(strip) };
}
