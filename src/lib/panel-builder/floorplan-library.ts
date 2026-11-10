// Fáze 78: knihovna firmy pro 2D půdorys – uložené šablony sestav ve víceramečku a oblíbené položky levého panelu (⭐).
// Ukládá se do prohlížeče (localStorage) i do profilu firmy (`RegisteredCompany.floorplanLibraryJson`); platí novější
// podle `updatedAt` (stejně jako knihovna spotřebičů). Čisté funkce bez Reactu – sdílí je editor, server i testy.

import { assemblyError, assemblyLabel } from "./floorplan-frames";
import { paletteItem } from "./floorplan-editor";

/** Uložená sestava ve víceramečku (pořadí pozic zleva = pořadí přístrojů v rámečku). */
export interface AssemblyTemplate {
  id: string;
  label: string;
  members: string[];
  createdAt: number;
}

export interface FloorplanLibrary {
  templates: AssemblyTemplate[];
  /** Klíče oblíbených položek: `item:<id palety>`, `assembly:<id sestavy>`, `template:<id šablony>`, `appliance:<id>`. */
  favorites: string[];
  updatedAt: number;
}

export const FLOORPLAN_LIBRARY_KEY = "eldock-floorplan-library";
/** Nejvýš šablon a oblíbených ve firmě (rozumná mez pro JSON v profilu firmy). */
export const MAX_TEMPLATES = 60;
export const MAX_FAVORITES = 200;
export const TEMPLATE_LABEL_MAX = 60;

export const emptyLibrary = (): FloorplanLibrary => ({ templates: [], favorites: [], updatedAt: 0 });

const FAVORITE_KEY = /^(item|assembly|template|appliance):[\w-]{1,80}$/;

/** Ověření a vyčištění uložené knihovny (neznámé přístroje a neplatné sestavy se zahodí). */
export function parseFloorplanLibrary(value: unknown): FloorplanLibrary | null {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<Record<keyof FloorplanLibrary, unknown>>;
  const templates: AssemblyTemplate[] = [];
  const ids = new Set<string>();
  for (const entry of Array.isArray(input.templates) ? input.templates : []) {
    if (!entry || typeof entry !== "object") continue;
    const template = entry as Partial<AssemblyTemplate>;
    const members = Array.isArray(template.members) ? template.members.filter((id): id is string => typeof id === "string" && Boolean(paletteItem(id))) : [];
    const id = typeof template.id === "string" && /^[\w-]{1,40}$/.test(template.id) ? template.id : null;
    if (!id || ids.has(id) || members.length < 2 || assemblyError(members)) continue;
    ids.add(id);
    const label = typeof template.label === "string" && template.label.trim() ? template.label.trim().slice(0, TEMPLATE_LABEL_MAX) : assemblyLabel(members);
    templates.push({ id, label, members, createdAt: typeof template.createdAt === "number" && Number.isFinite(template.createdAt) ? template.createdAt : 0 });
    if (templates.length >= MAX_TEMPLATES) break;
  }
  const favorites = [...new Set((Array.isArray(input.favorites) ? input.favorites : []).filter((key): key is string => typeof key === "string" && FAVORITE_KEY.test(key)))].slice(0, MAX_FAVORITES);
  const updatedAt = typeof input.updatedAt === "number" && Number.isFinite(input.updatedAt) ? input.updatedAt : 0;
  return { templates, favorites, updatedAt };
}

/** Novější knihovna vyhrává (prohlížeč vs. profil firmy); bez obou prázdná. */
export function newestLibrary(...libraries: (FloorplanLibrary | null)[]): FloorplanLibrary {
  return libraries.filter((library): library is FloorplanLibrary => library !== null).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? emptyLibrary();
}

/** Uložení sestavy jako šablony; stejné složení se stejným názvem se nezdvojí. */
export function addTemplate(library: FloorplanLibrary, members: readonly string[], label: string, now = Date.now()): { library: FloorplanLibrary; template: AssemblyTemplate } | { error: string } {
  const error = assemblyError([...members]);
  if (error) return { error };
  if (members.length < 2) return { error: "Šablona potřebuje aspoň 2 přístroje v rámečku." };
  const name = label.trim().slice(0, TEMPLATE_LABEL_MAX) || assemblyLabel([...members]);
  const same = library.templates.find((template) => template.label === name && template.members.join() === members.join());
  if (same) return { library, template: same };
  if (library.templates.length >= MAX_TEMPLATES) return { error: `Firma má už ${MAX_TEMPLATES} šablon – nejdřív nějakou smažte.` };
  const template: AssemblyTemplate = { id: `t${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`, label: name, members: [...members], createdAt: now };
  return { library: { ...library, templates: [...library.templates, template], updatedAt: now }, template };
}

export function removeTemplate(library: FloorplanLibrary, id: string, now = Date.now()): FloorplanLibrary {
  return { ...library, templates: library.templates.filter((template) => template.id !== id), favorites: library.favorites.filter((key) => key !== `template:${id}`), updatedAt: now };
}

export function renameTemplate(library: FloorplanLibrary, id: string, label: string, now = Date.now()): FloorplanLibrary {
  const name = label.trim().slice(0, TEMPLATE_LABEL_MAX);
  if (!name) return library;
  return { ...library, templates: library.templates.map((template) => (template.id === id ? { ...template, label: name } : template)), updatedAt: now };
}

export function toggleFavorite(library: FloorplanLibrary, key: string, now = Date.now()): FloorplanLibrary {
  if (!FAVORITE_KEY.test(key)) return library;
  const on = library.favorites.includes(key);
  return { ...library, favorites: on ? library.favorites.filter((entry) => entry !== key) : [...library.favorites, key].slice(-MAX_FAVORITES), updatedAt: now };
}

/**
 * Oblíbené nahoru: oblíbené položky na začátek seznamu v pořadí katalogu, ostatní za nimi v původním pořadí
 * (`originalSortIndex`) – po odebrání hvězdičky se položka vrátí přesně na své místo.
 */
export function favoritesFirst<T>(entries: readonly T[], keyOf: (entry: T) => string, favorites: readonly string[]): T[] {
  const set = new Set(favorites);
  return entries
    .map((entry, originalSortIndex) => ({ entry, originalSortIndex, favorite: set.has(keyOf(entry)) }))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.originalSortIndex - b.originalSortIndex)
    .map((row) => row.entry);
}

/** Šablony použitelné na úrovni instalace (všechny přístroje dostupné v paletě úrovně). */
export function templatesFor<T extends { members: readonly string[] }>(templates: readonly T[], allowed: ReadonlySet<string>): T[] {
  return templates.filter((template) => template.members.every((id) => allowed.has(id)));
}

