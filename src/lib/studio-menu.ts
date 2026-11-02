import { z } from "zod";

import { EquipmentType } from "@/generated/prisma/enums";

import { EQUIPMENT_CATEGORIES, PRODUCT_TEMPLATES, categoryByKey, type EquipmentCategory, type EquipmentCategoryKey, type ProductTemplate } from "./equipment-categories";

// Vlastní nabídka kroku 3 Studia (fáze 39): přejmenované kategorie a upravené / vlastní produktové
// dlaždice. Ukládá se do nastavení tenantu (TenantSetting `studio.menu`) a do localStorage prohlížeče.
// Kategorie bez úprav používá výchozí dlaždice z `PRODUCT_TEMPLATES`.

export const STUDIO_MENU_KEY = "studio.menu";
export const STUDIO_MENU_STORAGE_KEY = "eldock.studio.menu";

export interface StudioMenu {
  /** Čas poslední úpravy (ms) – novější verze vyhrává mezi localStorage a databází. */
  updatedAt: number;
  labels: Partial<Record<EquipmentCategoryKey, string>>;
  templates: Partial<Record<EquipmentCategoryKey, ProductTemplate[]>>;
}

export const EMPTY_MENU: StudioMenu = { updatedAt: 0, labels: {}, templates: {} };

const CATEGORY_KEYS = EQUIPMENT_CATEGORIES.map((category) => category.key) as [EquipmentCategoryKey, ...EquipmentCategoryKey[]];
const text = (max: number) => z.string().trim().min(1).max(max);
const templateSchema = z.object({
  key: z.string().min(1).max(48),
  label: text(80),
  emoji: z.string().trim().min(1).max(8),
  type: z.enum(Object.values(EquipmentType) as [EquipmentType, ...EquipmentType[]]),
  name: text(80),
  prefix: z
    .string()
    .trim()
    .max(16)
    .regex(/^[A-Za-z0-9._-]*$/)
    .optional(),
  root: z.boolean().optional(),
});

export const studioMenuSchema = z.object({
  updatedAt: z.number().int().min(0),
  labels: z.partialRecord(z.enum(CATEGORY_KEYS), text(60)),
  templates: z.partialRecord(z.enum(CATEGORY_KEYS), z.array(templateSchema).max(40)),
});

/** Vyčistí nabídku: dlaždice jen s typem své kategorie, unikátní klíče, prefix velkými písmeny. */
export function normalizeMenu(menu: StudioMenu): StudioMenu {
  const templates: StudioMenu["templates"] = {};
  for (const [key, list] of Object.entries(menu.templates) as [EquipmentCategoryKey, ProductTemplate[]][]) {
    const category = categoryByKey(key);
    const seen = new Set<string>();
    templates[key] = list
      .filter((entry) => category.types.includes(entry.type) && !seen.has(entry.key) && seen.add(entry.key))
      .map((entry) => {
        const name = entry.name.trim() || entry.label.trim() || category.label;
        return { ...entry, label: entry.label.trim() || name, name, prefix: entry.prefix?.trim().toUpperCase() || undefined };
      });
  }
  // Rozepsané (prázdné) názvy kategorií = výchozí název
  const labels: StudioMenu["labels"] = {};
  for (const [key, label] of Object.entries(menu.labels) as [EquipmentCategoryKey, string][]) {
    if (label.trim() && label.trim() !== categoryByKey(key).label) labels[key] = label.trim();
  }
  return { updatedAt: menu.updatedAt, labels, templates };
}

/** Načte nabídku z JSON (databáze, localStorage); neplatná data = žádná úprava. */
export function parseStudioMenu(json: string | null | undefined): StudioMenu | null {
  if (!json) return null;
  try {
    const parsed = studioMenuSchema.safeParse(JSON.parse(json));
    return parsed.success ? normalizeMenu(parsed.data as StudioMenu) : null;
  } catch {
    return null;
  }
}

/** Novější ze dvou verzí nabídky (databáze tenantu × localStorage prohlížeče). */
export const newerMenu = (a: StudioMenu | null, b: StudioMenu | null): StudioMenu => {
  if (!a) return b ?? EMPTY_MENU;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
};

export const categoryLabel = (menu: StudioMenu, category: EquipmentCategory) => menu.labels[category.key]?.trim() || category.label;

/** Dlaždice kategorie: upravené tenantem, jinak výchozí. */
export const menuTemplates = (menu: StudioMenu, key: EquipmentCategoryKey): readonly ProductTemplate[] => menu.templates[key] ?? PRODUCT_TEMPLATES[key];

/** Všechny dlaždice nabídky (pro ikony seskupených štítků místností). */
export const allMenuTemplates = (menu: StudioMenu): ProductTemplate[] => EQUIPMENT_CATEGORIES.flatMap((category) => [...menuTemplates(menu, category.key)]);

const touch = (menu: StudioMenu, patch: Partial<StudioMenu>, now: number): StudioMenu => ({ ...menu, ...patch, updatedAt: Math.max(now, menu.updatedAt + 1) });

export function setCategoryLabel(menu: StudioMenu, key: EquipmentCategoryKey, label: string, now = Date.now()): StudioMenu {
  // Rozepsaný název (i prázdný) se drží, než se nabídka uloží – `normalizeMenu` ho pak uklidí
  const labels = { ...menu.labels };
  if (label.trim() === categoryByKey(key).label) delete labels[key];
  else labels[key] = label.slice(0, 60);
  return touch(menu, { labels }, now);
}

export function updateTemplate(menu: StudioMenu, key: EquipmentCategoryKey, templateKey: string, patch: Partial<Pick<ProductTemplate, "label" | "emoji" | "prefix">>, now = Date.now()): StudioMenu {
  const list = menuTemplates(menu, key).map((entry) => {
    if (entry.key !== templateKey) return entry;
    const label = patch.label !== undefined ? patch.label.slice(0, 80) : entry.label;
    // Přejmenovaná dlaždice = nový základ názvu zařízení („Kávovar“ → „Kávovar – Kancelář 1“)
    const name = patch.label !== undefined ? label.trim() || entry.name : entry.name;
    const prefix = patch.prefix !== undefined ? patch.prefix.toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 16) || undefined : entry.prefix;
    return { ...entry, label, name, emoji: patch.emoji !== undefined ? [...patch.emoji].slice(0, 2).join("") || entry.emoji : entry.emoji, prefix };
  });
  return touch(menu, { templates: { ...menu.templates, [key]: list } }, now);
}

export function removeTemplate(menu: StudioMenu, key: EquipmentCategoryKey, templateKey: string, now = Date.now()): StudioMenu {
  return touch(menu, { templates: { ...menu.templates, [key]: menuTemplates(menu, key).filter((entry) => entry.key !== templateKey) } }, now);
}

export function addTemplate(menu: StudioMenu, key: EquipmentCategoryKey, input: { label: string; emoji?: string; prefix?: string }, now = Date.now()): { menu: StudioMenu; template: ProductTemplate } {
  const category = categoryByKey(key);
  const label = input.label.trim().slice(0, 80) || category.label;
  const template: ProductTemplate = {
    key: `user-${now.toString(36)}`,
    label,
    name: label,
    emoji: [...(input.emoji?.trim() || "🏷️")].slice(0, 2).join(""),
    type: category.types[0],
    prefix: input.prefix?.toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 16) || undefined,
  };
  return { menu: touch(menu, { templates: { ...menu.templates, [key]: [...menuTemplates(menu, key), template] } }, now), template };
}

/** Vrátí kategorii k výchozím dlaždicím a názvu. */
export function resetCategory(menu: StudioMenu, key: EquipmentCategoryKey, now = Date.now()): StudioMenu {
  const labels = { ...menu.labels };
  const templates = { ...menu.templates };
  delete labels[key];
  delete templates[key];
  return touch(menu, { labels, templates }, now);
}
