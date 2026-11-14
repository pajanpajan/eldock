// Fáze 112: provozovatel ELDOCK – jediné místo údajů pro patičku webu, zálohové faktury s QR platbou, VOP a zásady
// ochrany osobních údajů. Výchozí údaje (ELDOCK.cz · Pavel Janoušek · Jablonec nad Nisou · info@eldock.cz) a účet
// Raiffeisenbank z fáze 84; IČO, DIČ, IBAN, spisovou značku a plátcovství DPH upraví velín (/superadmin) jedním klikem –
// uloží se do `PlatformSetting` a propíšou se všude. Sady QR štítků k objednání (cena nastavená ve velínu). Čisté funkce.

import { z } from "zod";

import { isValidIco } from "./ares";
import { COMPANY_INFO } from "./company";
import { isValidIban, normalizeBic, normalizeIban } from "./credits";

export const OPERATOR_KEY = "operator";
export const LABEL_SETS_KEY = "label-sets";

export interface OperatorProfile {
  /** Značka webu v patičce. */
  brand: string;
  /** Jméno podnikatele / obchodní firma. */
  name: string;
  street: string;
  zip: string;
  city: string;
  email: string;
  /** Prázdné = zatím nevyplněno (v patičce a na faktuře se nezobrazí). */
  ico: string;
  dic: string;
  /** Spisová značka (OR) nebo zápis v živnostenském rejstříku. */
  registry: string;
  /** Plátce DPH – faktura s DPH 21 %, jinak „Neplátce DPH“ a cena bez DPH je konečná. */
  vatPayer: boolean;
  iban: string;
  bic: string;
  bankName: string;
  accountNumber: string;
}

export const DEFAULT_OPERATOR: OperatorProfile = {
  brand: "ELDOCK.cz",
  name: "Pavel Janoušek",
  street: "",
  zip: "466 01",
  city: "Jablonec nad Nisou",
  email: "info@eldock.cz",
  ico: "",
  dic: "",
  registry: "",
  // Fáze 113: režim před založením s.r.o. – neplátce DPH (cena bez DPH je konečná); plátcovství přepne velín
  vatPayer: false,
  iban: COMPANY_INFO.bank.iban,
  bic: COMPANY_INFO.bank.bic,
  bankName: COMPANY_INFO.bank.name,
  accountNumber: COMPANY_INFO.bank.accountNumber,
};

const text = (max: number) => z.string().trim().max(max);

export const operatorSchema = z.object({
  brand: text(60).min(1, "Vyplňte značku webu."),
  name: text(120).min(1, "Vyplňte jméno nebo obchodní firmu provozovatele."),
  street: text(120),
  zip: text(10),
  city: text(80).min(1, "Vyplňte obec."),
  email: z.string().trim().email("Neplatný e-mail.").max(120),
  ico: text(8).refine((value) => !value || isValidIco(value), "Neplatné IČO (8 číslic s kontrolní číslicí)."),
  dic: text(14).refine((value) => !value || /^CZ\d{8,10}$/.test(value.replace(/\s/g, "").toUpperCase()), "DIČ ve tvaru CZ12345678."),
  registry: text(160),
  vatPayer: z.boolean(),
  iban: text(40).refine((value) => isValidIban(normalizeIban(value) ?? ""), "Neplatný IBAN (kontrolní číslice nesedí)."),
  bic: text(11).refine((value) => !value || Boolean(normalizeBic(value)), "Neplatný BIC / SWIFT."),
  bankName: text(80),
  accountNumber: text(30),
});

/** Uložený JSON → profil (chybějící / poškozené údaje = výchozí hodnoty). */
export function parseOperator(json: string | null | undefined): OperatorProfile {
  if (!json) return { ...DEFAULT_OPERATOR };
  try {
    const raw = JSON.parse(json) as Partial<Record<keyof OperatorProfile, unknown>>;
    const merged = { ...DEFAULT_OPERATOR };
    for (const key of Object.keys(DEFAULT_OPERATOR) as (keyof OperatorProfile)[]) {
      const value = raw[key];
      if (key === "vatPayer") merged.vatPayer = typeof value === "boolean" ? value : DEFAULT_OPERATOR.vatPayer;
      else if (typeof value === "string") (merged as Record<string, unknown>)[key] = value.trim();
    }
    if (!isValidIban(normalizeIban(merged.iban) ?? "")) {
      merged.iban = DEFAULT_OPERATOR.iban;
      merged.bic = DEFAULT_OPERATOR.bic;
    }
    return merged;
  } catch {
    return { ...DEFAULT_OPERATOR };
  }
}

/** Patička: „ELDOCK.cz · Pavel Janoušek · Jablonec nad Nisou · info@eldock.cz“. */
export const footerLine = (profile: OperatorProfile) => [profile.brand, profile.name, profile.city, profile.email].filter(Boolean).join(" · ");

/** Vyplněné registrační údaje („IČO 12345678“, „DIČ CZ12345678“, „Spisová značka …“). */
export function registryLines(profile: OperatorProfile): string[] {
  return [profile.ico ? `IČO ${profile.ico}` : null, profile.dic ? `DIČ ${profile.dic.replace(/\s/g, "").toUpperCase()}` : profile.vatPayer ? null : "Neplátce DPH", profile.registry || null].filter((line): line is string => Boolean(line));
}

/** Adresa jedním řádkem. */
export const operatorAddress = (profile: OperatorProfile) => [profile.street, [profile.zip, profile.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

/** Identita provozovatele do VOP a zásad („Pavel Janoušek, Jablonec nad Nisou, IČO …, provozovatel webu ELDOCK.cz“). */
export function operatorIdentity(profile: OperatorProfile): string {
  return [profile.name, operatorAddress(profile) || profile.city, ...registryLines(profile).filter((line) => line !== "Neplátce DPH"), `provozovatel webu ${profile.brand}`].filter(Boolean).join(", ");
}

/** Cena s DPH podle plátcovství provozovatele (neplátce = cena bez DPH je konečná). */
export const priceWithVat = (priceExclVat: number, vatPayer: boolean, rate = 0.21) => (vatPayer ? Math.round(priceExclVat * (1 + rate)) : priceExclVat);

/** Text v právních dokumentech nahradí značku „{{PROVOZOVATEL}}“ identitou provozovatele. */
export const withOperator = (text: string, profile: OperatorProfile) => text.replaceAll("{{PROVOZOVATEL}}", operatorIdentity(profile)).replaceAll("{{EMAIL}}", profile.email);

// -----------------------------------------------------------------------------
//  Sady QR štítků k objednání (ceník z velínu; fáze 113: výchozí sady jsou rovnou v prodeji)
// -----------------------------------------------------------------------------

/** Druh štítku v sadě: A = spotřebič (30 × 15 mm), S = rozváděč (50 × 25 mm), M = stroj (70 × 40 mm). */
export type LabelKind = "A" | "S" | "M";
export const LABEL_KINDS: Record<LabelKind, { purpose: "APPLIANCE" | "SWITCHBOARD" | "MACHINE"; label: string; size: string; material: string }> = {
  A: { purpose: "APPLIANCE", label: "Spotřebič", size: "30 × 15 mm", material: "PET + resin, termotransfer 300 DPI" },
  S: { purpose: "SWITCHBOARD", label: "Rozváděč", size: "50 × 25 mm", material: "stříbrný Datapol PET (−40 až +150 °C)" },
  M: { purpose: "MACHINE", label: "Stroj", size: "70 × 40 mm", material: "stříbrný 3M / Datapol PET" },
};
const KIND_ORDER: readonly LabelKind[] = ["A", "S", "M"];

export interface LabelSetItem {
  kind: LabelKind;
  count: number;
}

export interface LabelSet {
  /** Kód objednávky podle složení sady („LABELS_A100“, „LABELS_A60S30M10“). */
  code: string;
  title: string;
  description: string;
  items: LabelSetItem[];
  /** Kusů celkem. */
  count: number;
  /** Cena sady bez DPH (neplátce DPH = konečná cena). */
  priceExclVat: number;
}

const itemSchema = z.object({ kind: z.enum(["A", "S", "M"]), count: z.number().int().min(1).max(5000) });

/** Sada z velínu – fáze 112 ukládala jen `count` (= štítky spotřebičů). */
export const labelSetSchema = z.preprocess(
  (value) => (value && typeof value === "object" && !("items" in value) && "count" in value ? { ...value, items: [{ kind: "A", count: (value as { count: unknown }).count }] } : value),
  z.object({
    title: text(120).min(1, "Vyplňte název sady."),
    description: text(400).default(""),
    items: z.array(itemSchema).min(1).max(3),
    priceExclVat: z.number().int().min(1, "Vyplňte cenu sady.").max(500_000),
  }),
);

/** Složení sady (sečtené podle druhu, pořadí A → S → M). */
export function normalizeItems(items: readonly LabelSetItem[]): LabelSetItem[] {
  return KIND_ORDER.map((kind) => ({ kind, count: items.filter((item) => item.kind === kind).reduce((sum, item) => sum + item.count, 0) })).filter((item) => item.count > 0);
}

/** Kód objednávky sady podle složení. */
export const labelSetCode = (items: readonly LabelSetItem[]) => `LABELS_${normalizeItems(items).map((item) => `${item.kind}${item.count}`).join("")}`;

/** Kód objednávky → složení sady (fáze 112 „LABELS_50“ = 50 štítků spotřebičů); jiný kód = null. */
export function labelItemsOf(code: string): LabelSetItem[] | null {
  const legacy = /^LABELS_(\d{1,4})$/.exec(code);
  if (legacy) return [{ kind: "A", count: Number(legacy[1]) }];
  const match = /^LABELS_((?:[ASM]\d{1,4}){1,3})$/.exec(code);
  if (!match) return null;
  const items = [...match[1].matchAll(/([ASM])(\d{1,4})/g)].map((part) => ({ kind: part[1] as LabelKind, count: Number(part[2]) }));
  return items.every((item) => item.count > 0) ? normalizeItems(items) : null;
}

/** Kód objednávky sady štítků → počet kusů celkem (null = není sada štítků). */
export const labelCountOf = (code: string) => labelItemsOf(code)?.reduce((sum, item) => sum + item.count, 0) ?? null;

/** Složení sady textem („60× Spotřebič 30 × 15 mm + 30× Rozváděč 50 × 25 mm …“). */
export const labelItemsText = (items: readonly LabelSetItem[]) => normalizeItems(items).map((item) => `${item.count}× ${LABEL_KINDS[item.kind].label} ${LABEL_KINDS[item.kind].size}`).join(" + ");

/** Cena za kus („4,90 Kč/ks“). */
export const pricePerPiece = (set: Pick<LabelSet, "priceExclVat" | "count">, vatPayer: boolean) =>
  `${(priceWithVat(set.priceExclVat, vatPayer) / Math.max(1, set.count)).toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč/ks`;

function labelSet(input: { title: string; description: string; items: LabelSetItem[]; priceExclVat: number }): LabelSet {
  const items = normalizeItems(input.items);
  return { ...input, items, code: labelSetCode(items), count: items.reduce((sum, item) => sum + item.count, 0) };
}

/**
 * Fáze 113: výchozí prodejní sady odolných QR štítků ELDOCK (300 DPI termotransfer PET + resin) – objednávka štítků je
 * zapnutá hned po nasazení; ceny a složení upraví velín (uložené sady mají přednost, prázdný seznam = vypnuto).
 */
export const DEFAULT_LABEL_SETS: readonly LabelSet[] = [
  labelSet({
    title: "Sada SPOTŘEBIČ & KANCELÁŘ (100 ks · 30×15 mm)",
    description: "Pro monitory, PC, prodlužovačky a nářadí dle ČSN 33 1600 ed. 2.",
    items: [{ kind: "A", count: 100 }],
    priceExclVat: 490,
  }),
  labelSet({
    title: "Sada SPOTŘEBIČ & KANCELÁŘ – VELKÁ (500 ks · 30×15 mm)",
    description: "Zvýhodněný kotouč pro revizní techniky a administrativní budovy.",
    items: [{ kind: "A", count: 500 }],
    priceExclVat: 1750,
  }),
  labelSet({
    title: "Sada ROZVÁDĚČ PROFI (50 ks · 50×25 mm · Stříbrný Datapol PET)",
    description: "Pro domovní a komerční rozváděče dle ČSN EN IEC 61439 (−40 až +150 °C).",
    items: [{ kind: "S", count: 50 }],
    priceExclVat: 745,
  }),
  labelSet({
    title: "Sada PRŮMYSL & STROJE (50 ks · 70×40 mm · Stříbrný 3M/Datapol PET)",
    description: "Pro výrobní stroje, linky a rozvodny dle Nařízení EU 2023/1230.",
    items: [{ kind: "M", count: 50 }],
    priceExclVat: 1450,
  }),
  labelSet({
    title: "STARTOVACÍ MIX SADA ELDOCK (100 ks celkem: 60× Spotřebič + 30× Rozváděč + 10× Stroj)",
    description: "Vyzkoušejte všechny druhy štítků – spotřebiče, rozváděče i stroje v jedné zásilce.",
    items: [
      { kind: "A", count: 60 },
      { kind: "S", count: 30 },
      { kind: "M", count: 10 },
    ],
    priceExclVat: 890,
  }),
];

/** Uložené sady z velínu; bez záznamu výchozí sady (fáze 113), prázdný seznam = objednávka štítků vypnutá. */
export function parseLabelSets(json: string | null | undefined): LabelSet[] {
  const defaults = () => DEFAULT_LABEL_SETS.map((set) => ({ ...set, items: set.items.map((item) => ({ ...item })) }));
  if (json == null) return defaults();
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return defaults();
    const sets = raw.map((row) => labelSetSchema.safeParse(row)).filter((row) => row.success).map((row) => labelSet(row.data));
    // Fáze 114: prázdný seznam = výchozích 5 sad (objednávání štítků je aktivní hned po nasazení)
    return sets.length ? [...new Map(sets.map((set) => [set.code, set])).values()] : defaults();
  } catch {
    return defaults();
  }
}

/**
 * Fáze 114: dodavatel jedním řádkem na výzvách k platbě a v ceníku – „Pavel Janoušek · ELDOCK.cz · Jablonec nad Nisou ·
 * Neplátce DPH“ (IČO, DIČ a spisová značka jen když jsou ve velínu vyplněné, bez upozornění na chybějící údaje).
 */
export function operatorSummary(profile: OperatorProfile): string {
  const vat = profile.vatPayer ? (profile.dic ? `DIČ ${profile.dic.replace(/\s/g, "").toUpperCase()}` : "Plátce DPH") : "Neplátce DPH";
  return [profile.name, profile.brand, profile.city, profile.ico ? `IČO ${profile.ico}` : null, vat].filter(Boolean).join(" · ");
}

/** Fáze 114: bankovní spojení jedním řádkem („Raiffeisenbank a.s. · č. ú. 918118002/5500 · IBAN CZ…“). */
export function bankLine(profile: Pick<OperatorProfile, "bankName" | "accountNumber" | "iban">): string {
  return [profile.bankName || null, profile.accountNumber ? `č. ú. ${profile.accountNumber}` : null, profile.iban ? `IBAN ${formatIban(profile.iban)}` : null].filter(Boolean).join(" · ");
}

/** Název objednávky sady štítků (název sady z ceníku, jinak složení); jiný kód = null. */
export function labelOrderTitle(code: string, sets: readonly LabelSet[] = DEFAULT_LABEL_SETS): string | null {
  const items = labelItemsOf(code);
  if (!items) return null;
  return sets.find((set) => set.code === code)?.title ?? `Sada QR štítků ELDOCK (${labelItemsText(items)})`;
}

/** IBAN po čtveřicích („CZ17 5500 0000 …“). */
export const formatIban = (iban: string) => iban.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();

/**
 * Fáze 113: druhý řádek patičky – adresa (je-li ulice), IČO / DIČ / spisová značka jen když jsou vyplněné, jinak
 * „Neplátce DPH“, a bankovní spojení (číslo účtu, jinak IBAN).
 */
export function footerDetails(profile: OperatorProfile): string[] {
  const account = profile.accountNumber ? `Č. ú. ${profile.accountNumber}` : profile.iban ? `IBAN ${formatIban(profile.iban)}` : null;
  return [profile.street ? operatorAddress(profile) : null, ...registryLines(profile), account].filter((line): line is string => Boolean(line));
}
