// Fáze 107: kontaktní a zpětnovazební systém ELDOCK – 7 kategorií zpráv (chyba, tip / chybějící prvek, schůzka, spolupráce,
// B2B poptávka, QR štítky, poradna k projektu), technická diagnostika z prohlížeče, printscreeny a číslo tiketu.

import { z } from "zod";

/** 7 kategorií (dlaždice formuláře): `tile` krátký popisek dlaždice, `short` rychlá akce plovoucího tlačítka, `filter` filtr velínu. */
export const CONTACT_CATEGORIES = [
  { id: "BUG", icon: "🐛", tile: "Hlášení chyby", label: "Hlášení chyby", short: "🐛 Nahlásit chybu (+ Printscreen)", filter: "bugs" },
  { id: "IDEA", icon: "💡", tile: "Tip / Chybí prvek", label: "Tip na zlepšení / Chybí mi prvek v katalogu", short: "💡 Tip na zlepšení / Chybí prvek", filter: "ideas" },
  { id: "MEETING", icon: "📅", tile: "Schůzka / Ukázka", label: "Zájem o osobní schůzku / Živou ukázku", short: "📅 Sjednat osobní schůzku / Demo", filter: "meetings" },
  { id: "PARTNER", icon: "🤝", tile: "Spolupráce", label: "Zájem o spolupráci (Partnerství)", short: "🤝 Spolupráce & B2B poptávka", filter: "partners" },
  { id: "B2B", icon: "🏢", tile: "Závod · OC · Nemocnice", label: "Poptávka pro závod, obchodní centrum nebo nemocnici (B2B)", short: "🏢 Poptávka pro závod / OC / nemocnici", filter: "meetings" },
  { id: "QR", icon: "🏷️", tile: "QR štítky", label: "Objednávka / Vzorky odolných QR štítků ELDOCK", short: "🏷️ QR štítky ELDOCK", filter: "qr" },
  { id: "ADVICE", icon: "⚡", tile: "Poradna k projektu", label: "Rychlá poradna k projektu / Normě ČSN", short: "⚡ Poradna k projektu / normě", filter: "bugs" },
] as const;
/** Rychlé akce plovoucího tlačítka (zadání: chyba, tip, schůzka, spolupráce). */
export const QUICK_ACTIONS = ["BUG", "IDEA", "MEETING", "PARTNER"] as const;
/** Kategorie se zónou pro printscreeny (Ctrl + V, přetažení, výběr souboru). */
export const IMAGE_CATEGORIES: readonly string[] = ["BUG", "IDEA", "ADVICE"];
/** Kategorie s jedním polem „e-mail nebo telefon“ (vyplnění do 20 vteřin). */
export const SINGLE_CONTACT_CATEGORIES: readonly string[] = ["BUG", "IDEA", "ADVICE"];
/** Kategorie s podtypem / formou na jeden klik a jeho výchozí hodnota. */
export const DEFAULT_SUBTYPE: Partial<Record<string, string>> = { IDEA: "feature", MEETING: "online", PARTNER: "manufacturer", QR: "samples" };
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]["id"];
export const contactCategory = (id: string) => CONTACT_CATEGORIES.find((category) => category.id === id) ?? CONTACT_CATEGORIES[0];

/** Filtry velínu „📬 Zprávy, Chyby & Schůzky“. */
export const CONTACT_FILTERS = [
  { id: "all", label: "Vše" },
  { id: "bugs", label: "🐛 Chyby" },
  { id: "ideas", label: "💡 Tipy na zlepšení" },
  { id: "meetings", label: "📅 Schůzky & B2B" },
  { id: "partners", label: "🤝 Spolupráce" },
  { id: "qr", label: "🏷️ QR Štítky" },
] as const;
export type ContactFilter = (typeof CONTACT_FILTERS)[number]["id"];
export const categoriesOf = (filter: string): ContactCategory[] => (filter === "all" ? CONTACT_CATEGORIES.map((category) => category.id) : CONTACT_CATEGORIES.filter((category) => category.filter === filter).map((category) => category.id));

export const IDEA_SUBTYPES = [
  { id: "feature", label: "✨ Nápad na vylepšení funkce" },
  { id: "catalog", label: "📦 Chybí mi konkrétní přístroj / řada v katalogu" },
] as const;

export const MEETING_FORMS = [
  { id: "onsite", label: "🤝 Osobní schůzka (u vás ve firmě / v závodě)" },
  { id: "regional", label: "☕ Osobní setkání v regionu (Liberec / Jablonec / Praha)" },
  { id: "online", label: "💻 Rychlá online ukázka (Google Meet / Teams – 20 min)" },
] as const;

export const PARTNER_TYPES = [
  { id: "manufacturer", label: "🏭 Výrobce rozváděčů – chci vyrábět rozváděče na klíč z ELDOCKu" },
  { id: "designer", label: "📐 Externí projektant (Freelancer) – chci překreslovat schémata a Červenky" },
  { id: "inspector", label: "🔍 Revizní technik – spolupráce na revizích a kusových zkouškách" },
  { id: "wholesale", label: "📦 Velkoobchod / Výrobce elektro / Školitel" },
] as const;

export const B2B_TAGS = [
  { id: "plant", label: "🏭 Správa rozváděčů a strojů" },
  { id: "bim", label: "🏢 Převod BIM (.ifc) modelu" },
  { id: "mall", label: "🛍️ Obchodní centrum (BD4)" },
  { id: "hospital", label: "🏥 Nemocnice / Klinika" },
  { id: "book", label: "📋 Kniha revizí" },
] as const;

export const QR_REQUESTS = [
  { id: "samples", label: "🎁 Chci zaslat vzorkovou sadu stříbrných QR štítků" },
  { id: "series", label: "📦 Poptávám tisk série QR štítků pro naši firmu" },
] as const;
export const QR_SIZES = ["Spotřebiče 30 × 15 mm", "Rozváděče 50 × 25 mm", "Stroje 70 × 40 mm"] as const;

export const STATUS_LABEL = { NEW: "🔴 Nové", IN_PROGRESS: "🟡 V řešení", RESOLVED: "🟢 Vyřešeno" } as const;
export type ContactStatus = keyof typeof STATUS_LABEL;
export const CONTACT_STATUSES = Object.keys(STATUS_LABEL) as ContactStatus[];

/** Printscreeny / fotky: nejvýš 3, po zmenšení v prohlížeči (max. 1600 px, WebP / JPEG 0,82). */
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 3_000_000;
export const IMAGE_MAX_WIDTH = 1600;
export const IMAGE_QUALITY = 0.82;

/** Technická diagnostika z prohlížeče (bez vyplňování – přikládá se automaticky). */
export const diagnosticsSchema = z.object({
  currentUrl: z.string().max(500).optional(),
  module: z.string().max(80).optional(),
  wizardPhase: z.string().max(80).optional(),
  projectId: z.string().max(64).optional(),
  viewportSize: z.string().max(20).optional(),
  userAgent: z.string().max(400).optional(),
});
export type ContactDiagnostics = z.infer<typeof diagnosticsSchema>;

const text = (max: number) => z.string().trim().max(max).optional();

export const contactSchema = z
  .object({
    category: z.enum(["BUG", "IDEA", "MEETING", "PARTNER", "B2B", "QR", "ADVICE"]),
    subtype: text(40),
    message: z.string().trim().max(5000).default(""),
    name: text(120),
    company: text(160),
    ico: z.string().trim().regex(/^\d{8}$/, "IČO má 8 číslic.").optional().or(z.literal("")),
    email: z.string().trim().email("Zadejte platný e-mail.").max(160).optional().or(z.literal("")),
    phone: text(40),
    /** Podrobnosti kategorie (forma schůzky, typ partnera, štítky zájmu, velikosti a počet štítků, MPN …). */
    details: z.record(z.string(), z.union([z.string().max(500), z.array(z.string().max(80)).max(10), z.number()])).default({}),
    diagnostics: diagnosticsSchema.default({}),
    /** Past na roboty – skryté pole, člověk ho nevyplní (vyplněné API odpoví jako úspěch, ale nic neuloží). */
    website: z.string().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    const needsMessage = value.category === "BUG" || value.category === "IDEA" || value.category === "ADVICE";
    if (needsMessage && value.message.length < 5) ctx.addIssue({ code: "custom", path: ["message"], message: "Popište prosím, co se stalo (aspoň pár slov)." });
    const contact = Boolean(value.email || value.phone);
    const needsContact = value.category !== "BUG" && value.category !== "IDEA";
    if (needsContact && !contact) ctx.addIssue({ code: "custom", path: ["email"], message: "Zadejte e-mail nebo telefon, ať se vám můžeme ozvat." });
    if ((value.category === "MEETING" || value.category === "PARTNER" || value.category === "B2B" || value.category === "QR") && !(value.name || value.company)) ctx.addIssue({ code: "custom", path: ["name"], message: "Zadejte jméno nebo firmu." });
  });
export type ContactInput = z.input<typeof contactSchema>;
export type ContactPayload = z.output<typeof contactSchema>;

/** Číslo tiketu „#EL-1042“ (pořadí zprávy od 1001). */
export const ticketLabel = (ticket: number) => `#EL-${ticket}`;
export const FIRST_TICKET = 1001;

/** Předmět notifikace majiteli. */
export function notificationSubject(input: Pick<ContactPayload, "category" | "name" | "company">, ticket: number) {
  const category = contactCategory(input.category);
  return `${ticketLabel(ticket)} ${category.icon} ${category.label}${input.company || input.name ? ` – ${input.company || input.name}` : ""}`;
}

/** Moduly aplikace v diagnostice (odkud zpráva přišla). */
export const MODULE_LABEL: Record<string, string> = {
  "panel-builder": "⚡ AI Panel Builder (rozváděč)",
  floorplan: "📐 2D Půdorys & Kabeláž",
  catalog: "📦 Katalog prvků",
  plant: "🏭 Správa závodů",
  public: "🌐 Veřejný web",
  manufacturing: "🏭 Portál výrobců",
  pool: "🌐 Portál projektantů",
};

const PANEL_STEPS: Record<string, string> = {
  "": "1a. Osazení DIN lišt",
  enclosure: "1b. Skříň rozváděče",
  tree: "2. Strom zapojení a fáze",
  thermal: "3. Výpočet oteplení IEC 60890",
  documentation: "4a. Dokumentace a kusovník (PDF)",
  labels: "4b. Štítky rozváděče",
};
const PANEL_RESERVED = new Set(["auth", "catalog", "company", "credits", "floorplan"]);

/**
 * Modul, projekt a krok průvodce z adresy stránky (diagnostika bez vyplňování): `/panel-builder/<id>/thermal` →
 * AI Panel Builder, projekt `<id>`, „3. Výpočet oteplení“; `/panel-builder/floorplan/<id>` → 2D půdorys `<id>`.
 */
export function contextFromPath(pathname: string): Pick<ContactDiagnostics, "module" | "projectId" | "wizardPhase"> {
  const parts = pathname.split("?")[0].split("/").filter(Boolean);
  if (parts[0] === "panel-builder") {
    if (parts[1] === "floorplan") {
      const id = parts[2] && parts[2] !== "novy" && parts[2] !== "trenazer" ? parts[2] : undefined;
      return { module: "floorplan", projectId: id };
    }
    if (parts[1] === "catalog") return { module: "catalog" };
    if (parts[1] && !PANEL_RESERVED.has(parts[1])) {
      const step = parts[2] ?? "";
      return { module: "panel-builder", projectId: parts[1], wizardPhase: PANEL_STEPS[step] ?? step };
    }
    return { module: "panel-builder" };
  }
  if (parts[0] === "vyroba-rozvadecu") return { module: "manufacturing" };
  if (parts[0] === "portal-projektantu") return { module: "pool" };
  if (["plants", "equipment", "inspections", "dashboard", "revisions", "change-requests"].includes(parts[0] ?? "")) return { module: "plant" };
  return { module: "public" };
}

/** Odkaz na projekt z diagnostiky (rozváděč AI Panel Builderu nebo 2D půdorys). */
export function projectHref(diagnostics: ContactDiagnostics): string | null {
  if (!diagnostics.projectId || !/^[\w-]{6,64}$/.test(diagnostics.projectId)) return null;
  if (diagnostics.module === "floorplan") return `/panel-builder/floorplan/${diagnostics.projectId}`;
  if (diagnostics.module === "panel-builder") return `/panel-builder/${diagnostics.projectId}`;
  return null;
}

/** Bezpečný relativní odkaz na stránku, odkud zpráva přišla (jen stejný web, jinak null). */
export function sameSitePath(currentUrl: string | undefined): string | null {
  if (!currentUrl) return null;
  try {
    const url = new URL(currentUrl, "https://eldock.cz");
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

const DETAIL_LABEL: Record<string, string> = {
  meetingForm: "Forma setkání",
  preferredDate: "Preferovaný termín",
  partnerType: "Typ partnera",
  tags: "Zájem",
  qrRequest: "Požadavek",
  qrSizes: "Velikosti štítků",
  quantity: "Odhad počtu ks",
  address: "Adresa doručení",
  mpn: "Objednací číslo / výrobce",
  region: "Region",
};

const OPTION_LABEL: Record<string, string> = Object.fromEntries(
  [...IDEA_SUBTYPES, ...MEETING_FORMS, ...PARTNER_TYPES, ...B2B_TAGS, ...QR_REQUESTS].map((option) => [option.id, option.label]),
);
export const optionLabel = (id: string) => OPTION_LABEL[id] ?? id;

/** Podrobnosti kategorie jako řádky „popisek: hodnota“ (velín, notifikace). */
export function detailRows(details: Record<string, unknown>): { label: string; value: string }[] {
  return Object.entries(details)
    .filter(([, value]) => value !== "" && value !== null && value !== undefined && !(Array.isArray(value) && !value.length))
    .map(([key, value]) => ({ label: DETAIL_LABEL[key] ?? key, value: Array.isArray(value) ? value.map((item) => optionLabel(String(item))).join(", ") : optionLabel(String(value)) }));
}

/** Text notifikace majiteli (e-mail / webhook) – bez obrázků, s odkazem do velínu. */
export function notificationText(message: { ticket: number; category: string; subtype?: string | null; name?: string | null; company?: string | null; ico?: string | null; email?: string | null; phone?: string | null; message: string; details: Record<string, unknown>; diagnostics: ContactDiagnostics; attachments: number }, adminUrl: string): string {
  const category = contactCategory(message.category);
  const lines = [
    `${ticketLabel(message.ticket)} · ${category.icon} ${category.label}${message.subtype ? ` · ${optionLabel(message.subtype)}` : ""}`,
    "",
    message.message || "(bez textu)",
    "",
    ...detailRows(message.details).map((row) => `${row.label}: ${row.value}`),
    message.name ? `Jméno: ${message.name}` : "",
    message.company ? `Firma: ${message.company}${message.ico ? ` (IČO ${message.ico})` : ""}` : message.ico ? `IČO: ${message.ico}` : "",
    message.email ? `E-mail: ${message.email}` : "",
    message.phone ? `Telefon: ${message.phone}` : "",
    message.diagnostics.currentUrl ? `Stránka: ${message.diagnostics.currentUrl}` : "",
    message.diagnostics.module ? `Modul: ${MODULE_LABEL[message.diagnostics.module] ?? message.diagnostics.module}${message.diagnostics.wizardPhase ? ` · ${message.diagnostics.wizardPhase}` : ""}` : "",
    message.diagnostics.projectId ? `Projekt: ${message.diagnostics.projectId}` : "",
    message.attachments ? `Printscreeny: ${message.attachments}` : "",
    "",
    `Velín: ${adminUrl}`,
  ];
  return lines
    .filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== ""))
    .join("\n")
    .trim();
}
