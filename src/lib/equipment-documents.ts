// Knihovna návodů, datasheetů a technických příloh zařízení (fáze 46). Čisté funkce.

import type { AttachmentCategory } from "@/generated/prisma/enums";

export const ATTACHMENT_CATEGORIES: { value: AttachmentCategory; label: string; filter: string; icon: string }[] = [
  { value: "MANUAL", label: "Návod k obsluze a údržbě", filter: "Návody k obsluze", icon: "📘" },
  { value: "DATASHEET", label: "Katalogový list / datasheet dílu", filter: "Datasheety komponent", icon: "📄" },
  { value: "DRIVE_PARAMS", label: "Manuál a chybové kódy měniče / pohonu", filter: "Chybové kódy a měniče", icon: "⚙️" },
  { value: "FLUID_SCHEMA", label: "Schéma hydrauliky / pneumatiky", filter: "Hydraulika / Pneumatika", icon: "💧" },
  { value: "CERTIFICATE", label: "Certifikát / ATEX / prohlášení o shodě", filter: "Certifikáty", icon: "🏅" },
  { value: "OTHER", label: "Ostatní", filter: "Ostatní", icon: "📎" },
];

export const categoryLabel = (category: AttachmentCategory) => ATTACHMENT_CATEGORIES.find((entry) => entry.value === category)?.label ?? category;

/** Označení prvku ve schématu bez ohledu na zápis: „-K4“ = „K4“ = „ -k4 “; vnořené „=A1-K4“ → „-K4“. */
export function normalizeComponentTag(tag: string | null | undefined): string | null {
  const value = tag?.trim().toUpperCase();
  if (!value) return null;
  const last = /-?([A-Z]{1,3}\d{1,4}(?:\.\d+)?)$/.exec(value.replace(/\s+/g, ""));
  return last ? `-${last[1]}` : value;
}

/** Datasheety a návody navázané na prvek schématu se shodným označením (nejnovější první). */
export function documentsForComponent<T extends { componentTag: string | null; createdAt: Date | string }>(documents: readonly T[], tag: string | null | undefined): T[] {
  const wanted = normalizeComponentTag(tag);
  if (!wanted) return [];
  return documents.filter((document) => normalizeComponentTag(document.componentTag) === wanted).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Velikost souboru česky („1,2 MB“, „340 kB“). */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024).toLocaleString("cs-CZ")} kB`;
  return `${bytes} B`;
}

/** Náhled v prohlížeči: PDF v iframu, obrázky přes <img>, ostatní jen stažení. */
export function previewKind(fileName: string): "pdf" | "image" | null {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  if (extension === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp", "svg"].includes(extension)) return "image";
  return null;
}
