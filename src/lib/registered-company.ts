// Registrované firmy (fáze 41): sdílená validace formulářů (klient i server), znění podmínek
// a převod údajů firmy na výrobce rozváděče v dokumentaci. Čisté funkce bez I/O.
import { z } from "zod";

import { isValidIco, normalizeIco } from "./ares";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordIssues } from "./password-policy";
import type { ManufacturerInfo } from "./panel-builder/project";

export const TERMS_VERSION = "1.0-2026-11";

/** Povinný souhlas pod registrací (doslovně podle zadání). */
export const TERMS_CONSENT =
  "Souhlasím s Obchodními podmínkami a výslovně beru na vědomí, že nástroj ELDOCK AI Panel Builder slouží výhradně jako pomocný softwarový nástroj. Veškerou odbornou, technickou a právní odpovědnost za správnost návrhu, dimenzování přístrojů, výpočet oteplení, provedení kusové zkoušky a shodu rozváděče s ČSN EN 61439 a platnými bezpečnostními předpisy nese výhradně uživatel (výrobce rozváděče / projektant), nikoliv provozovatel platformy Eldock.";

/** Souhlas pro registraci výrobního závodu. */
export const PLANT_TERMS_CONSENT =
  "Souhlasím s Obchodními podmínkami platformy ELDOCK a beru na vědomí, že za správnost evidované dokumentace, plánování a provádění revizí vyhrazených technických zařízení a za bezpečnost provozu odpovídá provozovatel závodu, nikoliv provozovatel platformy Eldock.";

/** Celé znění obchodních podmínek a vyloučení odpovědnosti (modal u registrace). */
export const TERMS_SECTIONS: { title: string; text: string }[] = [
  { title: "1. Předmět", text: "Platforma ELDOCK (dále jen „platforma“) poskytuje registrovaným firmám softwarové nástroje pro tvorbu a evidenci elektrotechnické dokumentace: AI Panel Builder pro výrobní dokumentaci rozváděčů a Průmyslový dok pro správu výrobních závodů, dokumentace a revizí." },
  { title: "2. Pomocný nástroj", text: "Výstupy platformy (rozpoznání přístrojů z fotografie, návrh zapojení, výpočet oteplení dle IEC TR 60890, technické údaje, prohlášení o shodě a výrobní štítek) jsou podkladem pro odborně způsobilou osobu. Nenahrazují projekt, kusovou zkoušku ani odborné posouzení." },
  { title: "3. Odpovědnost výrobce rozváděče", text: "Výrobcem rozváděče ve smyslu ČSN EN IEC 61439 a nařízení vlády č. 118/2016 Sb. (elektrická zařízení nízkého napětí) a č. 117/2016 Sb. (elektromagnetická kompatibilita) je registrovaná firma. Ta odpovídá za správnost návrhu, dimenzování přístrojů, ověření oteplení, provedení kusové zkoušky, shodu s technickými normami a bezpečnostními předpisy i za vydání prohlášení o shodě a umístění označení CE." },
  { title: "4. Vyloučení odpovědnosti provozovatele", text: "Provozovatel platformy neodpovídá za škody vzniklé použitím výstupů platformy bez odborné kontroly, za chyby rozpoznání AI ani za nesprávně zadané údaje. Odpovědnost provozovatele je v nejvyšší míře připuštěné právními předpisy vyloučena." },
  { title: "5. Kredity a testovací provoz", text: "Testovací registrace obsahuje omezený počet kreditů (1 kredit = 1 nový projekt rozváděče). Provozovatel může testovací provoz kdykoli upravit nebo ukončit." },
  { title: "6. Osobní údaje", text: "Údaje firmy a odpovědné osoby se zpracovávají za účelem plnění smlouvy a propisují se do dokumentace, kterou firma vytvoří. Údaje firmy jsou předvyplněny z veřejného registru ARES. Podrobnosti jsou v Zásadách zpracování osobních údajů na eldock.cz/ochrana-osobnich-udaju." },
];

const text = (min: number, max: number, message: string) => z.string().trim().min(min, message).max(max);

/** Údaje firmy (IČO, sídlo, odpovědná osoba) – registrace i úprava „Firemní údaje do razítka“. */
export const companyDetailsSchema = z.object({
  ico: z
    .string()
    .trim()
    .transform(normalizeIco)
    .refine(isValidIco, "Neplatné IČO (8 číslic s kontrolní číslicí)."),
  dic: z
    .string()
    .trim()
    .max(14)
    .transform((value) => value.toUpperCase().replace(/\s+/g, ""))
    .refine((value) => !value || /^CZ\d{8,10}$/.test(value), "DIČ ve tvaru CZ12345678.")
    .optional()
    .nullable(),
  companyName: text(2, 160, "Zadejte obchodní název firmy."),
  street: text(2, 160, "Zadejte ulici a č. p."),
  city: text(2, 100, "Zadejte město."),
  zip: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, ""))
    .refine((value) => /^\d{5}$/.test(value), "PSČ má 5 číslic.")
    .transform((value) => `${value.slice(0, 3)} ${value.slice(3)}`),
  contactName: text(3, 120, "Zadejte jméno a příjmení odpovědné osoby."),
  phone: text(6, 40, "Zadejte kontaktní telefon."),
  authorizationNumber: z.string().trim().max(80).optional().nullable(),
});

const credentials = {
  email: z.string().trim().toLowerCase().email("Zadejte platný e-mail.").max(200),
  // Fáze 67: pravidla hesla jako u účtů zaměstnanců (src/lib/password-policy.ts)
  password: z.string().min(PASSWORD_MIN_LENGTH, `Heslo musí mít alespoň ${PASSWORD_MIN_LENGTH} znaků.`).max(PASSWORD_MAX_LENGTH),
  termsAccepted: z.literal(true, { error: "Bez souhlasu s podmínkami a přenesením odpovědnosti nelze registraci odeslat." }),
};

/** Heslo nesmí obsahovat e-mail ani jméno odpovědné osoby a nesmí být běžné. */
const strongPassword = (value: { password: string; email: string; contactName: string }, ctx: z.RefinementCtx) => {
  const issue = passwordIssues(value.password, { email: value.email, name: value.contactName })[0];
  if (issue) ctx.addIssue({ code: "custom", path: ["password"], message: issue });
};

export const panelRegistrationSchema = companyDetailsSchema.extend(credentials).superRefine(strongPassword);
export const plantRegistrationSchema = companyDetailsSchema.extend({ ...credentials, plantName: text(3, 120, "Zadejte název závodu.") }).superRefine(strongPassword);
export const companyLoginSchema = z.object({ email: z.string().trim().toLowerCase().max(200), password: z.string().max(200) });

export type CompanyDetails = z.output<typeof companyDetailsSchema>;
export type PanelRegistration = z.output<typeof panelRegistrationSchema>;
export type PlantRegistration = z.output<typeof plantRegistrationSchema>;

/** Demo účet „Tester“ AI Panel Builderu (předvyplněné přihlášení na /panel-builder/auth). */
export const TESTER_COMPANY = { id: "company-tester", email: "tester@eldock.cz", password: "Tester2026!" } as const;

export interface CompanyProfile {
  companyName: string;
  ico: string;
  dic: string | null;
  street: string;
  city: string;
  zip: string;
  contactName: string;
  phone: string;
  email: string;
  authorizationNumber: string | null;
}

/** Údaje registrované firmy jako výrobce rozváděče (titulní list, razítko, prohlášení o shodě, štítek CE). */
export function companyManufacturer(company: CompanyProfile): ManufacturerInfo {
  return {
    name: company.companyName,
    address: company.street,
    city: [company.zip, company.city].filter(Boolean).join(" "),
    phone: company.phone,
    ico: company.ico,
    dic: company.dic ?? "",
    email: company.email,
    contactName: company.contactName,
    authorizationNumber: company.authorizationNumber ?? "",
  };
}

/** Kód závodu z názvu firmy („Elektro Novák s.r.o.“ → „ELN“), volný vůči existujícím kódům. */
export function plantCodeFor(name: string, taken: readonly string[]): string {
  const letters = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !["SRO", "AS", "S", "R", "O", "A", "SPOL", "VOS", "KS"].includes(word));
  const base = (letters.length > 1 ? letters.map((word) => word[0]).join("") : (letters[0] ?? "ZAV")).slice(0, 3).padEnd(2, "X");
  const used = new Set(taken.map((code) => code.toUpperCase()));
  if (!used.has(base)) return base;
  for (let n = 2; n < 1000; n++) if (!used.has(`${base}${n}`)) return `${base}${n}`;
  return `${base}${Date.now() % 10000}`;
}
