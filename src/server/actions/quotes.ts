"use server";

import { z } from "zod";

import { parseQuoteSettings, type QuoteSettings } from "@/lib/quoting/quote-settings";
import type { QuoteParty } from "@/lib/quoting/quote-engine";

import type { ActionResult } from "./workflow";

// Fáze 105: cenová nabídka – ceníkové ceny položek vlastního kusovníku (jen přihlášeným, ceníky jsou na serveru),
// nastavení nabídek firmy (hodinová sazba, konstrukce, velkoobchod, kalibrace normohodin, číslování) a údaje dodavatele.
// Sezení a databáze se načtou až při volání – modul importují klientské komponenty (i v testech bez databáze).

const priceItems = z
  .array(z.object({ key: z.string().min(1).max(200), kind: z.enum(["cable", "box", "device"]), code: z.string().max(80).nullish(), name: z.string().max(300) }))
  .max(800);

const companyOf = async () => (await import("@/server/panel-session")).getPanelCompany();

export interface QuoteContext {
  prices: Record<string, { priceCzk: number; source: string }>;
  settings: QuoteSettings;
  supplier: QuoteParty;
  /** Číslo, které dostane příští nabídka (rezervuje se až při vytvoření). */
  nextNumber: string;
}

/** Ceníkové ceny + nastavení a dodavatel přihlášené firmy AI Panel Builderu. */
export async function quoteContextAction(items: z.input<typeof priceItems>): Promise<ActionResult<QuoteContext>> {
  const parsed = priceItems.safeParse(items);
  if (!parsed.success) return { ok: false, error: "Neplatný seznam položek." };
  const company = await companyOf();
  if (!company) return { ok: false, error: "Cenová nabídka je jen pro přihlášenou firmu." };
  const [{ listPrices }, { prisma }] = await Promise.all([import("@/server/quote-data"), import("@/lib/prisma")]);
  const [prices, row] = await Promise.all([listPrices(parsed.data), prisma.registeredCompany.findUnique({ where: { id: company.id }, select: { quoteSettingsJson: true } })]);
  const settings = parseQuoteSettings(row?.quoteSettingsJson);
  const supplier: QuoteParty = { name: company.companyName, ico: company.ico, dic: company.dic, address: [company.street, `${company.zip} ${company.city}`.trim()].filter(Boolean).join(", "), contact: company.contactName, email: company.email, phone: company.phone };
  return { ok: true, data: { prices, settings, supplier, nextNumber: quoteNumber(settings.lastNumber + 1) } };
}

const settingsPatch = z.object({
  hourlyRate: z.number().min(0).max(100_000).optional(),
  construction: z.enum(["aac", "drywall", "brick", "concrete"]).optional(),
  wholesaler: z.enum(["sonepar", "elkov", "kv", "dek", "universal"]).optional(),
  vatRate: z.union([z.literal(12), z.literal(21)]).optional(),
  calibration: z.object({ version: z.string().max(20), overrides: z.record(z.string(), z.number().min(0).max(50)), factor: z.number().min(0.5).max(2), samples: z.number().int().min(0).max(10_000) }).optional(),
});

/** Uloží nastavení nabídek do profilu firmy (sloučí se s uloženým). */
export async function saveQuoteSettingsAction(patch: z.input<typeof settingsPatch>): Promise<ActionResult<QuoteSettings>> {
  const parsed = settingsPatch.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Neplatné nastavení nabídky." };
  const company = await companyOf();
  if (!company) return { ok: false, error: "Nastavení se ukládá jen přihlášené firmě." };
  const { prisma } = await import("@/lib/prisma");
  const row = await prisma.registeredCompany.findUnique({ where: { id: company.id }, select: { quoteSettingsJson: true } });
  const next = parseQuoteSettings(JSON.stringify({ ...parseQuoteSettings(row?.quoteSettingsJson), ...parsed.data }));
  await prisma.registeredCompany.update({ where: { id: company.id }, data: { quoteSettingsJson: JSON.stringify(next) } });
  return { ok: true, data: next };
}

/** Číslo nabídky „NAB-2026-0007“ (pořadí firmy v roce vystavení). */
function quoteNumber(sequence: number, year = new Date().getFullYear()) {
  return `NAB-${year}-${String(sequence).padStart(4, "0")}`;
}

/** Rezervuje další číslo nabídky firmy (při vytvoření nabídky – tisk / stažení). */
export async function reserveQuoteNumberAction(): Promise<ActionResult<string>> {
  const company = await companyOf();
  if (!company) return { ok: false, error: "Číslo nabídky má jen přihlášená firma." };
  const { prisma } = await import("@/lib/prisma");
  const number = await prisma.$transaction(async (tx) => {
    const row = await tx.registeredCompany.findUnique({ where: { id: company.id }, select: { quoteSettingsJson: true } });
    const settings = parseQuoteSettings(row?.quoteSettingsJson);
    const year = new Date().getFullYear();
    const sequence = settings.numberYear === year ? settings.lastNumber + 1 : 1;
    await tx.registeredCompany.update({ where: { id: company.id }, data: { quoteSettingsJson: JSON.stringify({ ...settings, lastNumber: sequence, numberYear: year }) } });
    return quoteNumber(sequence, year);
  });
  return { ok: true, data: number };
}
