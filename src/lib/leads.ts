import { z } from "zod";

import { isValidIco, normalizeIco } from "@/lib/ares";

// Fáze 102: zachycení kontaktu v trenažéru / ukázkové firmě („📩 Kam vám máme poslat hotový kusovník a PDF
// dokumentaci?“). E-mail slouží k poslání dokumentace a k dokončení registrace; obchodní sdělení e-mailem jen
// s výslovným, předem nezaškrtnutým souhlasem (§ 7 zákona č. 480/2004 Sb.). Čisté funkce.

export const LEAD_ROLES = [
  { id: "installer", label: "⚡ Jsem montážní elektrikář / revizák" },
  { id: "designer", label: "📐 Jsem projektant" },
  { id: "facility", label: "🏭 Řeším údržbu závodu / budovy" },
] as const;
export type LeadRole = (typeof LEAD_ROLES)[number]["id"];
export const leadRoleLabel = (role: string | null | undefined) => LEAD_ROLES.find((item) => item.id === role)?.label.replace(/^\S+\s/, "") ?? "–";

/**
 * Fáze 111: registrace z okna zachycení kontaktu = stejný nárok jako každá nová firma – 1 testovací projekt zdarma
 * (zkušební 2D půdorys + zkušební rozváděč). Dřívějších 45 kreditů zdarma (fáze 102) bylo příliš mnoho.
 */
export const LEAD_BONUS_TEXT = "1 testovací projekt zdarma";

export const LEAD_CONSENT_VERSION = "1.0-2026-11";
/** Informace o zpracování (čl. 13 GDPR) – zobrazená v okně, uložená ke kontaktu. */
export const LEAD_PROCESSING_TEXT =
  "E-mail (a IČO, pokud ho zadáte) použijeme k zaslání dokumentace, k dokončení registrace a k vyřízení vašeho dotazu; údaje firmy doplníme z veřejného registru ARES. Podrobnosti v zásadách ochrany osobních údajů.";
/** Samostatný souhlas s obchodními sděleními – nepovinný, výchozí nezaškrtnutý. */
export const LEAD_MARKETING_TEXT = "Chci dostávat novinky a nabídky ELDOCK e-mailem (souhlas můžete kdykoli odvolat odkazem v každém e-mailu).";

/** Co návštěvník právě vytvořil (kontext ke kontaktu). */
export const LEAD_TRIGGERS = ["csv", "xlsx", "pdf", "save"] as const;
export type LeadTrigger = (typeof LEAD_TRIGGERS)[number];
export const LEAD_TRIGGER_LABEL: Record<LeadTrigger, string> = { csv: "Export CSV kusovníku", xlsx: "Export XLSX kusovníku", pdf: "Tisk 6listového PDF elaborátu", save: "Uložení projektu" };

export const leadContextSchema = z.object({
  kind: z.enum(["floorplan", "panel", "plant"]),
  trigger: z.enum(LEAD_TRIGGERS),
  /** „2D půdorys RD 4+kk: 17 okruhů, 622 m kabelu“. */
  summary: z.string().trim().max(200),
  circuits: z.number().int().min(0).max(100_000).optional(),
  boards: z.number().int().min(0).max(1000).optional(),
  cableM: z.number().min(0).max(1_000_000).optional(),
});
export type LeadContext = z.infer<typeof leadContextSchema>;

export const leadSchema = z.object({
  email: z.string().trim().toLowerCase().max(120).email("Zadejte platný e-mail."),
  ico: z
    .string()
    .trim()
    .max(12)
    .optional()
    .transform((value) => (value ? normalizeIco(value) : undefined))
    .refine((value) => value === undefined || isValidIco(value), "IČO má 8 číslic s platnou kontrolní číslicí."),
  role: z.enum(LEAD_ROLES.map((role) => role.id) as [LeadRole, ...LeadRole[]]),
  marketing: z.boolean(),
  context: leadContextSchema,
  /** Zdroj návštěvy (UTM / doména odkazu) z prohlížeče. */
  source: z.object({ referrer: z.string().max(200).optional(), utmSource: z.string().max(80).optional(), utmMedium: z.string().max(80).optional(), utmCampaign: z.string().max(120).optional(), landing: z.string().max(300).optional() }).optional(),
});
export type LeadInput = z.input<typeof leadSchema>;

/** Buňka CSV se středníkem (Excel CZ). */
export const csvCell = (value: string | number | boolean | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export interface LeadRow {
  email: string;
  ico: string | null;
  companyName: string | null;
  segmentLabel: string;
  nace: string[];
  role: string;
  summary: string;
  trigger: string;
  circuits: number | null;
  boards: number | null;
  source: string;
  marketingConsent: boolean;
  registered: boolean;
  createdAt: Date;
}

/** Export kontaktů pro velín (UTF-8 s BOM, středník) – sloupec souhlasu s obchodními sděleními je povinný údaj pro oslovení. */
export function leadsCsv(rows: readonly LeadRow[]): string {
  const head = ["email", "ico", "firma_ares", "zamereni_nace", "kody_nace", "role", "co_testoval", "akce", "okruhy", "rozvadece", "zdroj", "souhlas_obchodni_sdeleni", "registrovan", "zachyceno"];
  const lines = rows.map((row) =>
    [row.email, row.ico, row.companyName, row.segmentLabel, row.nace.join(" "), leadRoleLabel(row.role), row.summary, row.trigger, row.circuits, row.boards, row.source, row.marketingConsent ? "ano" : "ne", row.registered ? "ano" : "ne", row.createdAt.toISOString()].map(csvCell).join(";"),
  );
  return `﻿${[head.join(";"), ...lines].join("\r\n")}\r\n`;
}
