// Fáze 111: nová ceníková a kreditní architektura ELDOCK – 1 testovací projekt zdarma (1 zkušební 2D půdorys +
// 1 zkušební rozváděč se zkušebním označením výstupů), ceny akcí v kreditech, balíčky kreditů (platnost 12 měsíců,
// bonus k prvnímu dobití) a předplatné pro pravidelné uživatele, budovy a průmysl. Čisté funkce a data.

export const VAT_RATE = 0.21;

/** Ceny akcí v kreditech po vyčerpání testovacího projektu. */
export const ACTION_PRICES = {
  /** Kompletní rozváděč (6listové PDF + oteplení IEC TR 60890 + štítky + kusovník). */
  switchboard: 15,
  /** Kompletní 2D půdorys (výkres PDF / DXF + výkaz kabeláže + krabičky KOPOS). */
  floorplan: 15,
  /** Výhodný balíček celá zakázka (2D půdorys + rozváděč + cenová nabídka pro zákazníka). */
  bundle: 25,
  /** Samostatná cenová nabídka nebo CNC výrobní balíček (.dxf + drátovací list). */
  quote: 8,
  cnc: 8,
} as const;

export type ChargeAction = keyof typeof ACTION_PRICES;

/** Rozváděč z už zaplaceného 2D půdorysu = doplatek do balíčku celé zakázky (25 − 15 = 10 kreditů). */
export const BUNDLE_SWITCHBOARD_PRICE = ACTION_PRICES.bundle - ACTION_PRICES.floorplan;

export const ACTION_PRICE_ROWS: { action: ChargeAction; title: string; credits: number; note?: string }[] = [
  { action: "switchboard", title: "Kompletní rozváděč (6listové PDF + oteplení IEC TR 60890 + štítky + kusovník)", credits: ACTION_PRICES.switchboard },
  { action: "floorplan", title: "Kompletní 2D půdorys (výkres PDF / DXF + výkaz kabeláže + krabičky KOPOS)", credits: ACTION_PRICES.floorplan },
  { action: "bundle", title: "Výhodný balíček celá zakázka (2D půdorys + rozváděč + cenová nabídka pro zákazníka)", credits: ACTION_PRICES.bundle, note: `ušetří ${ACTION_PRICES.switchboard + ACTION_PRICES.floorplan - ACTION_PRICES.bundle} kreditů` },
  { action: "quote", title: "Samostatná cenová nabídka nebo CNC výrobní balíček (.dxf + drátovací list)", credits: ACTION_PRICES.quote },
];

/** Hodnota jedné zakázky pro prodejní modal (úspora ~8 hodin práce). */
export const JOB_SAVING = { hours: 8, czk: 5200 } as const;
/** Titulek prodejního modalu (doslovně podle zadání fáze 111). */
export const PAYWALL_TITLE = "💎 Odemkněte plnou verzi ELDOCK – Tato zakázka vám ušetří ~8 hodin práce (5 200 Kč)";

/** Jemné označení výstupů zkušebního projektu (PDF elaborát, cenová nabídka, výkres, kusovník). */
export const TRIAL_WATERMARK = "ZKUŠEBNÍ VÝSTUP – ELDOCK TRIAL (1. testovací projekt zdarma)";

/** Platnost dobitých kreditů. */
export const CREDIT_VALIDITY_MONTHS = 12;
/** Bonus k prvnímu dobití kreditů. */
export const FIRST_TOP_UP_LABELS = 20;

export const CREDIT_PACKAGES = [
  { code: "START_30", name: "Balíček START", title: "Balíček START (1 kompletní zakázka domu / 2 rozváděče)", credits: 30, priceExclVat: 750, note: "25,00 Kč / kredit", highlight: false },
  { code: "MONTER_125", name: "Balíček MONTÉR", title: "Balíček MONTÉR (5 kompletních zakázek / 8 rozváděčů – Nejoblíbenější)", credits: 125, priceExclVat: 2490, note: "19,92 Kč / kredit – úspora 20 %", highlight: true },
  { code: "FIRMA_300", name: "Balíček PROJEKČNÍ & MONTÁŽNÍ FIRMA", title: "Balíček PROJEKČNÍ & MONTÁŽNÍ FIRMA (12 zakázek / 20 rozváděčů)", credits: 300, priceExclVat: 4990, note: "16,63 Kč / kredit – úspora 33 %", highlight: false },
] as const;

/** Balíčky dřívějšího ceníku (fáze 50) – jen pro zobrazení starých objednávek a faktur. */
export const LEGACY_PACKAGES = [
  { code: "START_10", name: "START 10", title: "Balíček 10 rozváděčů", credits: 10, priceExclVat: 990, note: "99 Kč / rozváděč", highlight: false },
  { code: "PROFI_30", name: "PROFI 30", title: "Balíček 30 rozváděčů", credits: 30, priceExclVat: 2490, note: "83 Kč / rozváděč", highlight: false },
  { code: "UNLIMITED_YEAR", name: "PROJEKTANT ROK", title: "Roční neomezený tarif", credits: 200, priceExclVat: 5900, note: "200 kreditů na 12 měsíců", highlight: false },
] as const;

export type SubscriptionPlan = "PRO" | "BUILDINGS" | "ENTERPRISE";
export type SubscriptionPeriod = "MONTH" | "YEAR";

export interface Subscription {
  plan: SubscriptionPlan;
  name: string;
  audience: string;
  monthExclVat: number;
  yearExclVat: number;
  /** Kredity připsané každý měsíc (PRO). */
  monthlyCredits: number;
  /** Limit zařízení Hlídače revizí (null = bez modulu). */
  deviceLimit: number | null;
  features: string[];
  /** Objednávka QR platbou v AI Panel Builderu (firma), nebo aktivace obchodem (Správa závodů). */
  selfService: boolean;
}

/** Fáze 113: zkušební limit zařízení Hlídače revizí bez tarifu (REVIZE & BUDOVY 500, PRŮMYSL & ENTERPRISE 5 000). */
export const HLIDAC_TRIAL_DEVICES = 50;

export const SUBSCRIPTIONS: readonly Subscription[] = [
  {
    plan: "PRO",
    name: "ELDOCK PRO (Elektrikář & Projektant)",
    audience: "Pro pravidelné zakázky elektrikářů a projektantů",
    monthExclVat: 1490,
    yearExclVat: 14900,
    monthlyCredits: 100,
    deviceLimit: null,
    features: ["100 kreditů měsíčně", "Neomezený cloud archiv verzí v1.0 → v1.1", "Normohodinové cenové nabídky", "3D náhled a kontrola výšek"],
    selfService: true,
  },
  {
    plan: "BUILDINGS",
    name: "ELDOCK REVIZE & BUDOVY (Kanceláře, Administrativní budovy, Školy, Kliniky, Revizní technici)",
    audience: "Samostatný modul Hlídač revizí",
    monthExclVat: 1990,
    yearExclVat: 19900,
    monthlyCredits: 0,
    deviceLimit: 500,
    features: ["Hlídač revizí až pro 500 spotřebičů, monitorů, prodlužovaček a rozváděčů", "AI čtečka výrobních štítků (OCR)", "Chytrá revize", "Měsíční TIČR report"],
    selfService: false,
  },
  {
    plan: "ENTERPRISE",
    name: "ELDOCK PRŮMYSL & ENTERPRISE (Výrobní závody, OC, Nemocnice)",
    audience: "Pro výrobní závody, obchodní centra a nemocnice",
    monthExclVat: 6900,
    yearExclVat: 69000,
    monthlyCredits: 0,
    deviceLimit: 5000,
    features: ["Až 5 000 zařízení, strojů a spotřebičů", "Živá mapa areálu", "BIM (.ifc) import", "Červenka + burza projektantů a zálohy PLC"],
    selfService: false,
  },
];

export const subscriptionOf = (plan: string | null | undefined) => SUBSCRIPTIONS.find((row) => row.plan === plan) ?? null;

/** Kód objednávky předplatného („SUB_PRO_MONTH“). */
export const subscriptionCode = (plan: SubscriptionPlan, period: SubscriptionPeriod) => `SUB_${plan}_${period}`;

export interface OrderProduct {
  code: string;
  name: string;
  title: string;
  credits: number;
  priceExclVat: number;
  note: string;
  highlight: boolean;
  kind: "PACKAGE" | "SUBSCRIPTION" | "LEGACY";
  subscription?: { plan: SubscriptionPlan; period: SubscriptionPeriod; months: number };
}

/** Produkt objednávky podle kódu: balíček kreditů, předplatné nebo dřívější balíček (jen zobrazení). */
export function orderProduct(code: string): OrderProduct | null {
  const pkg = CREDIT_PACKAGES.find((row) => row.code === code);
  if (pkg) return { ...pkg, kind: "PACKAGE" };
  const legacy = LEGACY_PACKAGES.find((row) => row.code === code);
  if (legacy) return { ...legacy, kind: "LEGACY" };
  const match = /^SUB_(PRO|BUILDINGS|ENTERPRISE)_(MONTH|YEAR)$/.exec(code);
  if (!match) return null;
  const subscription = subscriptionOf(match[1])!;
  const period = match[2] as SubscriptionPeriod;
  const months = period === "YEAR" ? 12 : 1;
  return {
    code,
    name: subscription.name.replace(/\s*\(.*\)$/, ""),
    title: `${subscription.name} – ${period === "YEAR" ? "roční" : "měsíční"} předplatné`,
    credits: subscription.monthlyCredits,
    priceExclVat: period === "YEAR" ? subscription.yearExclVat : subscription.monthExclVat,
    note: period === "YEAR" ? `${(subscription.yearExclVat / 12).toLocaleString("cs-CZ", { maximumFractionDigits: 0 })} Kč / měsíc při roční platbě` : "měsíční platba",
    highlight: false,
    kind: "SUBSCRIPTION",
    subscription: { plan: subscription.plan, period, months },
  };
}

/** Cena za kredit (Kč bez DPH, 2 desetinná místa). */
export const pricePerCredit = (pkg: { credits: number; priceExclVat: number }) => Math.round((pkg.priceExclVat / pkg.credits) * 100) / 100;

/** Úspora oproti balíčku START (v %). */
export const savingPercent = (pkg: { credits: number; priceExclVat: number }) => {
  const base = pricePerCredit(CREDIT_PACKAGES[0]);
  return Math.max(0, Math.round((1 - pricePerCredit(pkg) / base) * 100));
};

/** Konec platnosti kreditů po dobití: 12 měsíců od dobití (dřívější delší platnost zůstává). */
export function creditsValidAfterTopUp(current: Date | null | undefined, paidAt: Date): Date {
  const next = new Date(paidAt);
  next.setMonth(next.getMonth() + CREDIT_VALIDITY_MONTHS);
  return current && current > next ? current : next;
}

/** Konec období předplatného po úhradě (navazuje na běžící období). */
export function subscriptionUntilAfter(current: Date | null | undefined, paidAt: Date, months: number): Date {
  const start = current && current > paidAt ? new Date(current) : new Date(paidAt);
  start.setMonth(start.getMonth() + months);
  return start;
}

/** Aktivní předplatné k datu. */
export const subscriptionActive = (company: { subscriptionPlan?: string | null; subscriptionUntil?: Date | null }, now = new Date()) => Boolean(company.subscriptionPlan && company.subscriptionUntil && company.subscriptionUntil > now);

/** Měsíční připsání kreditů PRO: poprvé hned, pak každý měsíc od posledního připsání, dokud předplatné běží. */
export function subscriptionCreditDue(company: { subscriptionPlan?: string | null; subscriptionUntil?: Date | null; subscriptionCreditedAt?: Date | null }, now = new Date()): boolean {
  const plan = subscriptionOf(company.subscriptionPlan);
  if (!plan?.monthlyCredits || !subscriptionActive(company, now)) return false;
  if (!company.subscriptionCreditedAt) return true;
  const next = new Date(company.subscriptionCreditedAt);
  next.setMonth(next.getMonth() + 1);
  return next <= now;
}
