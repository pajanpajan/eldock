// Fáze 64: 2D půdorys v prohlížeči – starý jediný slot rozpracovaného nákresu (do fáze 63) a záloha neuložených změn
// uloženého půdorysu (přežije zavření okna nebo výpadek spojení, než se změny uloží na server).

import { parseApplianceList, type ApplianceSpec } from "./appliances";
import { emptyDraft, parseDraft, type FloorplanDraft } from "./floorplan-editor";

/** Do fáze 63 jediný rozpracovaný nákres v prohlížeči – při otevření seznamu se převezme na server. */
export const LEGACY_DRAFT_KEY = "eldock.pb.floorplan";

/** Záloha neuložených změn: `eldock.pb.floorplan:<id>`, nový neuložený půdorys `eldock.pb.floorplan:novy`. */
export const backupKey = (floorplanId: string | null) => `${LEGACY_DRAFT_KEY}:${floorplanId ?? "novy"}`;

export interface DraftBackup {
  /** Verze na serveru, ze které změny vycházejí (null = půdorys ještě není na serveru). */
  baseVersion: number | null;
  draft: FloorplanDraft;
  /** Čas zálohy [ms]. */
  at: number;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function remove(key: string) {
  try {
    storage()?.removeItem(key);
  } catch {
    // úložiště nedostupné – nevadí
  }
}

export function readBackup(floorplanId: string | null): DraftBackup | null {
  const value = readJson(backupKey(floorplanId)) as Partial<DraftBackup> | null;
  const draft = value ? parseDraft(value.draft) : null;
  if (!value || !draft) return null;
  return { baseVersion: typeof value.baseVersion === "number" ? value.baseVersion : null, draft, at: typeof value.at === "number" ? value.at : 0 };
}

/** Zápis zálohy; plné úložiště nevadí (změny se uloží na server). */
export function writeBackup(floorplanId: string | null, backup: DraftBackup): void {
  try {
    storage()?.setItem(backupKey(floorplanId), JSON.stringify(backup));
  } catch {
    // plné úložiště – záloha chybí, server zůstává hlavním úložištěm
  }
}

export const clearBackup = (floorplanId: string | null) => remove(backupKey(floorplanId));

/** Je v nákresu něco nakresleného (prvky, místnosti, poznámky, podklad – na kterémkoli podlaží)? */
export function hasContent(draft: FloorplanDraft): boolean {
  if (draft.elements.length || draft.rooms.length || draft.annotations.length || draft.background) return true;
  return draft.otherFloors.some((floor) => floor.elements.length || floor.rooms.length || floor.annotations.length || floor.background);
}

/** Starý rozpracovaný nákres z prohlížeče (do fáze 63); prázdný nebo poškozený = null. */
export function readLegacyDraft(): FloorplanDraft | null {
  const draft = parseDraft(readJson(LEGACY_DRAFT_KEY));
  return draft && hasContent(draft) ? draft : null;
}

export const clearLegacyDraft = () => remove(LEGACY_DRAFT_KEY);

/** Je v prohlížeči starý slot (i prázdný)? */
export function hasLegacySlot(): boolean {
  try {
    return storage()?.getItem(LEGACY_DRAFT_KEY) != null;
  } catch {
    return false;
  }
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export interface DraftBoot {
  /** Nákres, se kterým editor začne. */
  initial: FloorplanDraft;
  /** Nákres odpovídající serveru (stejný objekt jako `initial` = nic k uložení; null = uložit hned). */
  initialSaved: FloorplanDraft | null;
  /** Neuložené změny z tohoto prohlížeče převzaté do editoru. */
  restored: boolean;
  /** Záloha ze starší verze (půdorys se mezitím změnil jinde) – editor ji nabídne k obnovení. */
  staleBackup: DraftBackup | null;
  /** Uložený nákres je poškozený (editor začne prázdný a nic nepřepíše, dokud se nezačne kreslit). */
  corrupted: boolean;
}

/**
 * Start editoru: uložený nákres ze serveru, případně novější neuložené změny ze zálohy v prohlížeči (vycházejí ze stejné
 * verze) a knihovna spotřebičů firmy. Nový půdorys převezme zálohu nedokončeného prvního uložení.
 */
export function bootDraft(stored: { id: string; version: number; draftJson: string } | null, library: ApplianceSpec[] | null): DraftBoot {
  const server = stored ? parseDraft(parseJson(stored.draftJson)) : null;
  const backup = readBackup(stored?.id ?? null);
  const fresh = backup && hasContent(backup.draft) && (stored ? backup.baseVersion === stored.version : true) ? backup.draft : null;
  const restored = !!fresh && (!server || JSON.stringify(fresh) !== JSON.stringify(server));
  const base = restored && fresh ? fresh : (server ?? emptyDraft());
  const libraryDiffers = !!library && JSON.stringify(parseApplianceList(library)) !== JSON.stringify(base.appliances);
  const initial = libraryDiffers && library ? { ...base, appliances: library } : base;
  const initialSaved = restored ? server : stored && server ? server : initial;
  const staleBackup = stored && backup && backup.baseVersion !== stored.version && hasContent(backup.draft) ? backup : null;
  return { initial, initialSaved, restored, staleBackup, corrupted: !!stored && !server };
}

/** Výchozí název nového půdorysu „Půdorys 7. 11. 2026“. */
export const defaultFloorplanName = (date: Date = new Date()) => `Půdorys ${date.toLocaleDateString("cs-CZ")}`;
