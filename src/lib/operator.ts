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
  /** Plátce DPH – faktura s DPH 21 %, jinak „Není plátce DPH“ a cena bez DPH je konečná. */
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
  vatPayer: true,
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
  return [profile.ico ? `IČO ${profile.ico}` : null, profile.dic ? `DIČ ${profile.dic.replace(/\s/g, "").toUpperCase()}` : profile.vatPayer ? null : "Není plátce DPH", profile.registry || null].filter((line): line is string => Boolean(line));
}

/** Adresa jedním řádkem. */
export const operatorAddress = (profile: OperatorProfile) => [profile.street, [profile.zip, profile.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

/** Identita provozovatele do VOP a zásad („Pavel Janoušek, Jablonec nad Nisou, IČO …, provozovatel webu ELDOCK.cz“). */
export function operatorIdentity(profile: OperatorProfile): string {
  return [profile.name, operatorAddress(profile) || profile.city, ...registryLines(profile).filter((line) => line !== "Není plátce DPH"), `provozovatel webu ${profile.brand}`].filter(Boolean).join(", ");
}

/** Cena s DPH podle plátcovství provozovatele (neplátce = cena bez DPH je konečná). */
export const priceWithVat = (priceExclVat: number, vatPayer: boolean, rate = 0.21) => (vatPayer ? Math.round(priceExclVat * (1 + rate)) : priceExclVat);

/** Text v právních dokumentech nahradí značku „{{PROVOZOVATEL}}“ identitou provozovatele. */
export const withOperator = (text: string, profile: OperatorProfile) => text.replaceAll("{{PROVOZOVATEL}}", operatorIdentity(profile)).replaceAll("{{EMAIL}}", profile.email);

// -----------------------------------------------------------------------------
//  Sady QR štítků k objednání (cena a počet nastavuje velín)
// -----------------------------------------------------------------------------

export interface LabelSet {
  /** Kód objednávky „LABELS_50“. */
  code: string;
  title: string;
  count: number;
  priceExclVat: number;
}

export const labelSetSchema = z.object({ title: text(120).min(1), count: z.number().int().min(1).max(5000), priceExclVat: z.number().int().min(1).max(500_000) });

export const labelSetCode = (count: number) => `LABELS_${count}`;

export function parseLabelSets(json: string | null | undefined): LabelSet[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    const sets = raw.map((row) => labelSetSchema.safeParse(row)).filter((row) => row.success).map((row) => ({ ...row.data, code: labelSetCode(row.data.count) }));
    return [...new Map(sets.map((set) => [set.code, set])).values()].sort((a, b) => a.count - b.count);
  } catch {
    return [];
  }
}

/** Kód objednávky sady štítků → počet kusů (null = není sada štítků). */
export const labelCountOf = (code: string) => {
  const match = /^LABELS_(\d{1,4})$/.exec(code);
  return match ? Number(match[1]) : null;
};
