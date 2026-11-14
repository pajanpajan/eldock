import type { PrismaClient } from "@/generated/prisma/client";
import { LABEL_KINDS, labelItemsOf, labelItemsText, labelSetCode, priceWithVat } from "@/lib/operator";
import { labelSetsOf, operatorProfileOf } from "./operator";
import { COMPANY_INFO } from "@/lib/company";
import {
  ACTION_PRICES,
  FIRST_TOP_UP_LABELS,
  creditsValidAfterTopUp,
  czAccountFromIban,
  floorplanCharge,
  isValidIban,
  licenseOf,
  nextVariableSymbol,
  normalizeBic,
  normalizeIban,
  orderProduct,
  subscriptionCreditDue,
  subscriptionOf,
  subscriptionUntilAfter,
  switchboardCharge,
  unlimitedPlan,
  type BankAccount,
  type ChargePlan,
  type PaywallInfo,
} from "@/lib/credits";
import { TESTER_COMPANY } from "@/lib/registered-company";
import { parseRailPhotos } from "@/lib/panel-builder/rails";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { createLabelBatch } from "./qr-labels";
import type { Tx } from "./workflow";

// Kredity, objednávky a hlášení chyb AI (fáze 50). Potvrzení úhrady a ruční úpravy kreditů volá jen
// velín /superadmin (kontrola přístupu v Server Actions), objednávku a hlášení zakládá přihlášená firma.

/** Vzorový IBAN z dokumentace SPD (dřívější demo účet) – jako skutečný účet se nepoužije, ani když zůstal v env. */
export const SPD_SAMPLE_IBAN = "CZ6508000000192000145399";

/**
 * Fáze 84: účet pro QR platbu a zálohovou fakturu kreditů – účet Eldock u Raiffeisenbank a.s. (`COMPANY_INFO.bank`).
 * Jiný účet jen z env `ELDOCK_BANK_IBAN` s platnou kontrolní číslicí (BIC z `ELDOCK_BANK_BIC`, banka z
 * `ELDOCK_BANK_NAME`, číslo účtu z českého IBAN).
 */
export function bankAccount(env: Partial<Record<string, string | undefined>> = process.env): BankAccount {
  const own = COMPANY_INFO.bank;
  const iban = normalizeIban(env.ELDOCK_BANK_IBAN);
  if (!iban || iban === own.iban || iban === SPD_SAMPLE_IBAN || !isValidIban(iban)) return { iban: own.iban, bic: own.bic, accountNumber: own.accountNumber, bankName: own.name };
  return { iban, bic: normalizeBic(env.ELDOCK_BANK_BIC), accountNumber: czAccountFromIban(iban), bankName: env.ELDOCK_BANK_NAME?.trim() || null };
}

/** Nová objednávka balíčku s variabilním symbolem roku (při souběhu se VS zkusí znovu). */
export async function createCreditOrder(prisma: PrismaClient, companyId: string, packageCode: string, now = new Date()) {
  // Fáze 112: sada QR štítků (cena a složení z velínu, fáze 113 výchozí sady) – objednávka bez kreditů, po úhradě série
  // štítků k odeslání
  const labels = labelItemsOf(packageCode);
  // Kód podle složení (fáze 112 „LABELS_50“ = „LABELS_A50“)
  const labelSet = labels ? (await labelSetsOf(prisma)).find((set) => set.code === labelSetCode(labels)) : null;
  if (labels && !labelSet) throw new WorkflowError("VALIDATION", "Tato sada QR štítků se teď neprodává.");
  const pkg = labelSet ? { code: labelSet.code, credits: 0, priceExclVat: labelSet.priceExclVat, kind: "LABELS" as const, subscription: undefined } : orderProduct(packageCode);
  // Fáze 111: balíčky nového ceníku a předplatné PRO (QR platba); tarify budov a průmyslu aktivuje obchod
  if (!pkg || pkg.kind === "LEGACY") throw new WorkflowError("VALIDATION", "Neznámý balíček kreditů.");
  // Fáze 112: cena s DPH podle plátcovství provozovatele (neplátce = cena bez DPH je konečná)
  const operator = await operatorProfileOf(prisma);
  if (pkg.kind === "SUBSCRIPTION" && !subscriptionOf(pkg.subscription?.plan)?.selfService) throw new WorkflowError("VALIDATION", "Tento tarif aktivuje obchod ELDOCK – napište nám přes Kontakt & Spolupráce.");
  const year = now.getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.creditOrder.findMany({ where: { variableSymbol: { startsWith: String(year) } }, select: { variableSymbol: true } });
    try {
      return await prisma.creditOrder.create({
        data: {
          companyId,
          variableSymbol: nextVariableSymbol(existing.map((row) => row.variableSymbol), year),
          packageCode: pkg.code,
          creditsCount: pkg.credits,
          priceCzkExclVat: pkg.priceExclVat,
          priceCzkInclVat: priceWithVat(pkg.priceExclVat, operator.vatPayer),
          createdAt: now,
        },
      });
    } catch (error) {
      // Unikátní VS obsadila souběžná objednávka – další pokus s novým číslem
      if (!(error instanceof Error && /Unique constraint/i.test(error.message)) || attempt === 4) throw error;
    }
  }
  throw new WorkflowError("CONFLICT", "Objednávku se nepodařilo založit, zkuste to znovu.");
}

/**
 * ✅ Potvrdit úhradu: v jedné transakci PENDING → PAID a připsání kreditů (opakované potvrzení nic nepřičte). Fáze 111:
 * platnost kreditů 12 měsíců od dobití, předplatné (konec období, kredity PRO hned), objednávka dřívějšího ceníku
 * v nových jednotkách (1 původní kredit = 15 kr.) a k prvnímu dobití bonus 20 stříbrných QR štítků (série v registru).
 */
export async function confirmCreditOrder(prisma: PrismaClient, orderId: string, now = new Date()) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.creditOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new WorkflowError("NOT_FOUND", "Objednávka neexistuje.");
    const { count } = await tx.creditOrder.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "PAID", paidAt: now } });
    if (!count) throw new WorkflowError("INVALID_STATE", `Objednávka VS ${order.variableSymbol} už není čekající (${order.status === "PAID" ? "uhrazena" : "stornována"}).`);
    const product = orderProduct(order.packageCode);
    const current = await tx.registeredCompany.findUniqueOrThrow({ where: { id: order.companyId }, select: { creditsValidUntil: true, subscriptionUntil: true, firstTopUpBonusAt: true } });
    // Fáze 112: sada QR štítků – bez kreditů a bez bonusu k prvnímu dobití (fáze 113: složení spotřebič / rozváděč / stroj)
    const labels = labelItemsOf(order.packageCode);
    const credits = labels ? 0 : product?.kind === "LEGACY" ? order.creditsCount * ACTION_PRICES.switchboard : order.creditsCount;
    const subscription = product?.kind === "SUBSCRIPTION" && product.subscription ? product.subscription : null;
    const bonus = !labels && !current.firstTopUpBonusAt && product?.kind !== "SUBSCRIPTION";
    await tx.registeredCompany.update({
      where: { id: order.companyId },
      data: {
        ...(credits ? { creditsValidUntil: creditsValidAfterTopUp(current.creditsValidUntil, now) } : {}),
        ...(subscription ? { subscriptionPlan: subscription.plan, subscriptionUntil: subscriptionUntilAfter(current.subscriptionUntil, now, subscription.months), ...(credits ? { subscriptionCreditedAt: now } : {}) } : {}),
        ...(bonus ? { firstTopUpBonusAt: now } : {}),
      },
    });
    if (credits) await grantCredits(tx, order.companyId, credits, { reason: subscription ? "SUBSCRIPTION" : "TOP_UP", refType: "CREDIT_ORDER", refId: order.id, note: `${product?.title ?? order.packageCode} – VS ${order.variableSymbol}` });
    const company = await tx.registeredCompany.findUniqueOrThrow({ where: { id: order.companyId }, select: { id: true, companyName: true, creditsRemaining: true, ico: true, email: true } });
    return { order: { ...order, status: "PAID" as const, paidAt: now }, company, bonus, labels };
  });
  // Fáze 112: uhrazená sada QR štítků = série v registru štítků pro firmu (k vytištění a odeslání poštou); fáze 113:
  // série pro každý druh štítku sady (spotřebič 30 × 15 mm, rozváděč 50 × 25 mm, stroj 70 × 40 mm)
  if (result.labels) {
    for (const item of result.labels) {
      const kind = LABEL_KINDS[item.kind];
      await createLabelBatch(prisma, {
        companyName: result.company.companyName,
        ico: result.company.ico,
        email: result.company.email,
        purpose: kind.purpose,
        count: item.count,
        note: `Objednávka sady QR štítků ELDOCK (VS ${result.order.variableSymbol}: ${labelItemsText(result.labels)}) – ${item.count}× ${kind.label} ${kind.size}, ${kind.material} – vytisknout a odeslat poštou`.slice(0, 500),
      });
    }
  }
  // Bonus k prvnímu dobití: série 20 stříbrných QR štítků pro firmu (vlastní transakce registru štítků)
  if (result.bonus) {
    await createLabelBatch(prisma, { companyName: result.company.companyName, ico: result.company.ico, email: result.company.email, purpose: "SWITCHBOARD", count: FIRST_TOP_UP_LABELS, note: `Bonus k prvnímu dobití kreditů (VS ${result.order.variableSymbol}) – ${FIRST_TOP_UP_LABELS} ks stříbrných QR štítků ELDOCK, odeslat poštou` }).catch((error: unknown) => console.error("Bonus QR štítků se nepodařilo založit", error));
  }
  return { order: result.order, company: { id: result.company.id, companyName: result.company.companyName, creditsRemaining: result.company.creditsRemaining }, bonusLabels: result.bonus ? FIRST_TOP_UP_LABELS : 0, orderedLabels: result.labels?.reduce((sum, item) => sum + item.count, 0) ?? 0 };
}

export async function cancelCreditOrder(prisma: PrismaClient, orderId: string) {
  const { count } = await prisma.creditOrder.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "CANCELLED" } });
  if (!count) throw new WorkflowError("INVALID_STATE", "Stornovat lze jen čekající objednávku.");
}

export const MAX_CREDITS = 100_000;

/** Ruční úprava kreditů ve velínu: přičíst (+5 / +10 / +50) nebo nastavit přesnou hodnotu. */
export async function adjustCredits(prisma: PrismaClient, companyId: string, change: { add: number } | { set: number }) {
  const company = await prisma.registeredCompany.findUnique({ where: { id: companyId }, select: { creditsRemaining: true } });
  if (!company) throw new WorkflowError("NOT_FOUND", "Firma neexistuje.");
  const target = "set" in change ? change.set : company.creditsRemaining + change.add;
  if (!Number.isInteger(target) || target < 0 || target > MAX_CREDITS) throw new WorkflowError("VALIDATION", `Počet kreditů musí být 0–${MAX_CREDITS}.`);
  const updated = await prisma.registeredCompany.update({ where: { id: companyId }, data: { creditsRemaining: target }, select: { id: true, creditsRemaining: true } });
  // Fáze 111: ruční úprava ve velínu je v pohybech kreditů firmy
  if (target !== company.creditsRemaining) await prisma.creditTransaction.create({ data: { companyId, amount: target - company.creditsRemaining, balanceAfter: target, reason: "ADJUST", note: "Úprava kreditů ve velínu" } });
  return updated;
}

// ---------------------------------------------------------------------------
//  Fáze 111: odečet kreditů za akce, zkušební projekt a pohyby kreditů
// ---------------------------------------------------------------------------

/** Nedostatek kreditů / prošlá platnost – akce vrátí data prodejního modalu (`💎 Odemkněte plnou verzi ELDOCK`). */
export class PaywallError extends WorkflowError {
  constructor(
    message: string,
    public readonly paywall: PaywallInfo,
  ) {
    super("FORBIDDEN", message);
    this.name = "PaywallError";
  }
}

type Db = PrismaClient | Tx;

/** Ukázková firma (trenažér, demo scénáře, okno kontaktu) – vše zkušební se zkušebním označením, bez kreditů. */
export const isDemoCompany = (companyId: string | null | undefined) => companyId === TESTER_COMPANY.id;

/** Fáze 113: ⭐ neomezený přístup firmy (účet provozovatele, ukázková firma – přepíná velín). */
export async function hasUnlimitedAccess(db: Db, companyId: string | null | undefined): Promise<boolean> {
  if (!companyId) return false;
  const row = await db.registeredCompany.findUnique({ where: { id: companyId }, select: { unlimitedAccess: true } });
  return Boolean(row?.unlimitedAccess);
}

export interface SpendInput {
  reason: string;
  action: string;
  refType?: string | null;
  refId?: string | null;
  note?: string | null;
  unlock?: PaywallInfo["unlock"];
}

/** Odečet kreditů – atomicky jen při dostatečném zůstatku a platnosti; záznam pohybu s novým zůstatkem. */
export async function spendCredits(db: Db, companyId: string, amount: number, input: SpendInput, now = new Date()): Promise<{ transactionId: string | null; balance: number }> {
  const company = await db.registeredCompany.findUnique({ where: { id: companyId }, select: { creditsRemaining: true, creditsValidUntil: true } });
  if (!company) throw new WorkflowError("NOT_FOUND", "Firma neexistuje.");
  if (amount <= 0) return { transactionId: null, balance: company.creditsRemaining };
  if (company.creditsValidUntil && company.creditsValidUntil < now && company.creditsRemaining > 0) {
    throw new PaywallError("Platnost kreditů vypršela (12 měsíců od posledního dobití) – dobijte kredity.", { reason: "EXPIRED", action: input.action, cost: amount, balance: 0, unlock: input.unlock ?? null });
  }
  const { count } = await db.registeredCompany.updateMany({ where: { id: companyId, creditsRemaining: { gte: amount } }, data: { creditsRemaining: { decrement: amount } } });
  if (!count) throw new PaywallError(`${input.action}: potřebujete ${amount} kreditů, zbývá ${company.creditsRemaining}.`, { reason: "NO_CREDITS", action: input.action, cost: amount, balance: company.creditsRemaining, unlock: input.unlock ?? null });
  const after = await db.registeredCompany.findUniqueOrThrow({ where: { id: companyId }, select: { creditsRemaining: true } });
  const row = await db.creditTransaction.create({ data: { companyId, amount: -amount, balanceAfter: after.creditsRemaining, reason: input.reason, refType: input.refType ?? null, refId: input.refId ?? null, note: input.note ?? null } });
  return { transactionId: row.id, balance: after.creditsRemaining };
}

/** Připsání kreditů se záznamem pohybu. */
export async function grantCredits(db: Db, companyId: string, amount: number, input: Omit<SpendInput, "action" | "unlock">): Promise<number> {
  const company = await db.registeredCompany.update({ where: { id: companyId }, data: { creditsRemaining: { increment: amount } }, select: { creditsRemaining: true } });
  await db.creditTransaction.create({ data: { companyId, amount, balanceAfter: company.creditsRemaining, reason: input.reason, refType: input.refType ?? null, refId: input.refId ?? null, note: input.note ?? null } });
  return company.creditsRemaining;
}

export interface Charge {
  kind: "switchboard" | "floorplan";
  companyId: string;
  plan: ChargePlan;
  transactionId: string | null;
}

const demoPlan = (kind: "switchboard" | "floorplan"): ChargePlan => ({ license: "TRIAL", cost: 0, reason: "TRIAL", label: `Ukázková firma – zkušební ${kind === "switchboard" ? "rozváděč" : "2D půdorys"} se zkušebním označením` });

/**
 * Nový rozváděč (z fotky, od nuly, ze soupisu, z půdorysu, z BIMu): zkušební rozváděč (první, zdarma), doplatek do
 * balíčku celá zakázka u zaplaceného půdorysu, jinak 15 kr. Odečet proběhne před založením – nepovedené založení vrátí
 * `refundCharge`, povedené propojí `settleSwitchboardCharge`.
 */
export async function chargeNewSwitchboard(prisma: PrismaClient, companyId: string, options: { floorplanId?: string | null } = {}): Promise<Charge> {
  // Fáze 113: ⭐ neomezený přístup – plná verze bez kreditů; ukázková firma bez něj zůstává u zkušebního označení
  if (await hasUnlimitedAccess(prisma, companyId)) return { kind: "switchboard", companyId, plan: unlimitedPlan("switchboard"), transactionId: null };
  if (isDemoCompany(companyId)) return { kind: "switchboard", companyId, plan: demoPlan("switchboard"), transactionId: null };
  return prisma.$transaction(async (tx) => {
    const company = await tx.registeredCompany.findUnique({ where: { id: companyId }, select: { trialFloorplanUsed: true, trialSwitchboardUsed: true } });
    if (!company) throw new WorkflowError("NOT_FOUND", "Firma neexistuje.");
    const floorplan = options.floorplanId ? await tx.floorplan.findFirst({ where: { id: options.floorplanId, companyId }, select: { license: true } }) : null;
    const plan = switchboardCharge(company, { floorplanLicense: floorplan ? licenseOf(floorplan.license) : null });
    if (plan.license === "TRIAL") {
      // Zkušební rozváděč jen jednou i při souběhu (podmíněná změna)
      const { count } = await tx.registeredCompany.updateMany({ where: { id: companyId, trialSwitchboardUsed: false }, data: { trialSwitchboardUsed: true } });
      if (count) return { kind: "switchboard" as const, companyId, plan, transactionId: null };
      const paid = switchboardCharge({ ...company, trialSwitchboardUsed: true }, { floorplanLicense: floorplan ? licenseOf(floorplan.license) : null });
      const spent = await spendCredits(tx, companyId, paid.cost, { reason: paid.reason, action: "Nový rozváděč", refType: "PANEL_PROJECT", note: paid.label });
      return { kind: "switchboard" as const, companyId, plan: paid, transactionId: spent.transactionId };
    }
    const spent = await spendCredits(tx, companyId, plan.cost, { reason: plan.reason, action: "Nový rozváděč", refType: "PANEL_PROJECT", note: plan.label });
    return { kind: "switchboard" as const, companyId, plan, transactionId: spent.transactionId };
  });
}

/** Nový 2D půdorys (první uložení na server): zkušební zdarma, jinak 15 kr. */
export async function chargeNewFloorplan(prisma: PrismaClient, companyId: string): Promise<Charge> {
  if (await hasUnlimitedAccess(prisma, companyId)) return { kind: "floorplan", companyId, plan: unlimitedPlan("floorplan"), transactionId: null };
  if (isDemoCompany(companyId)) return { kind: "floorplan", companyId, plan: demoPlan("floorplan"), transactionId: null };
  return prisma.$transaction(async (tx) => {
    const company = await tx.registeredCompany.findUnique({ where: { id: companyId }, select: { trialFloorplanUsed: true, trialSwitchboardUsed: true } });
    if (!company) throw new WorkflowError("NOT_FOUND", "Firma neexistuje.");
    const plan = floorplanCharge(company);
    if (plan.license === "TRIAL") {
      const { count } = await tx.registeredCompany.updateMany({ where: { id: companyId, trialFloorplanUsed: false }, data: { trialFloorplanUsed: true } });
      if (count) return { kind: "floorplan" as const, companyId, plan, transactionId: null };
    }
    const paid = floorplanCharge({ ...company, trialFloorplanUsed: true });
    const spent = await spendCredits(tx, companyId, paid.cost, { reason: paid.reason, action: "Nový 2D půdorys", refType: "FLOORPLAN", note: paid.label });
    return { kind: "floorplan" as const, companyId, plan: paid, transactionId: spent.transactionId };
  });
}

/** Po založení: licence projektů (hlavní, podružné, RH2), vazba pohybu kreditů a u balíčku licence půdorysu. */
export async function settleSwitchboardCharge(prisma: PrismaClient, charge: Charge, projectIds: readonly string[], options: { floorplanId?: string | null } = {}) {
  if (!projectIds.length) return;
  await prisma.panelBoardProject.updateMany({ where: { id: { in: [...projectIds] } }, data: { license: charge.plan.license } });
  if (charge.transactionId) await prisma.creditTransaction.update({ where: { id: charge.transactionId }, data: { refId: projectIds[0] } });
  if (charge.plan.license === "BUNDLE" && options.floorplanId) await prisma.floorplan.updateMany({ where: { id: options.floorplanId, companyId: charge.companyId }, data: { license: "BUNDLE" } });
}

/** Nepovedené založení: vrátit kredity, případně zkušební rozváděč / půdorys. */
export async function refundCharge(prisma: PrismaClient, charge: Charge) {
  if (isDemoCompany(charge.companyId) || charge.plan.reason === "UNLIMITED") return;
  if (charge.plan.reason === "TRIAL") {
    await prisma.registeredCompany.update({ where: { id: charge.companyId }, data: charge.kind === "switchboard" ? { trialSwitchboardUsed: false } : { trialFloorplanUsed: false } });
    return;
  }
  if (charge.plan.cost > 0) await grantCredits(prisma, charge.companyId, charge.plan.cost, { reason: "REFUND", refType: charge.kind === "switchboard" ? "PANEL_PROJECT" : "FLOORPLAN", note: "Vrácení – založení se nepovedlo" });
}

/**
 * Kredity za smazané nedokončené projekty: co se za projekt odečetlo (pohyby kreditů); projekt z doby před fází 111
 * (licence PAID bez pohybu, ne podružný) = 1 původní kredit = 15 kr.
 */
export async function projectRefunds(db: Db, projects: readonly { id: string; license: string; parentBoardId: string | null }[]): Promise<number> {
  if (!projects.length) return 0;
  const rows = await db.creditTransaction.findMany({ where: { refType: "PANEL_PROJECT", refId: { in: projects.map((project) => project.id) } }, select: { refId: true, amount: true } });
  let total = 0;
  for (const project of projects) {
    if (project.parentBoardId) continue;
    const own = rows.filter((row) => row.refId === project.id);
    if (own.length) total += Math.max(0, -own.reduce((sum, row) => sum + row.amount, 0));
    else if (licenseOf(project.license) === "PAID") total += ACTION_PRICES.switchboard;
  }
  return total;
}

export type UnlockKind = "switchboard" | "floorplan" | "quote" | "cnc";

/**
 * Odemčení výstupu z prodejního modalu: plná verze zkušebního rozváděče / půdorysu (bez zkušebního označení, 15 kr.),
 * cenová nabídka nebo CNC balíček (8 kr.; nabídka v balíčku celá zakázka a už odemčené výstupy zdarma).
 */
export async function unlockOutput(prisma: PrismaClient, companyId: string, kind: UnlockKind, id: string, now = new Date()): Promise<{ cost: number; license: string; balance: number }> {
  return prisma.$transaction(async (tx) => {
    const company = await tx.registeredCompany.findUniqueOrThrow({ where: { id: companyId }, select: { creditsRemaining: true, unlimitedAccess: true } });
    const done = (cost: number, license: string, balance = company.creditsRemaining) => ({ cost, license, balance });
    // Fáze 113: ⭐ neomezený přístup – zkušební rozváděč / půdorys se převede na plnou verzi, nabídka a CNC zdarma
    if (company.unlimitedAccess) {
      if (kind === "floorplan") await tx.floorplan.updateMany({ where: { id, companyId, license: "TRIAL" }, data: { license: "UNLIMITED" } });
      if (kind === "switchboard") await tx.panelBoardProject.updateMany({ where: { id, companyId, license: "TRIAL" }, data: { license: "UNLIMITED" } });
      return done(0, "UNLIMITED");
    }
    if (kind === "floorplan" || (kind === "quote" && (await tx.floorplan.count({ where: { id, companyId } })) > 0)) {
      const floorplan = await tx.floorplan.findFirst({ where: { id, companyId }, select: { id: true, license: true, quoteUnlockedAt: true } });
      if (!floorplan) throw new WorkflowError("NOT_FOUND", "Půdorys nebyl nalezen.");
      const license = licenseOf(floorplan.license);
      if (kind === "floorplan") {
        if (license !== "TRIAL") return done(0, license);
        if (isDemoCompany(companyId)) throw new WorkflowError("FORBIDDEN", "Ukázková firma má jen zkušební výstupy – zaregistrujte vlastní firmu.");
        const spent = await spendCredits(tx, companyId, ACTION_PRICES.floorplan, { reason: "UNLOCK", action: "Plná verze 2D půdorysu", refType: "FLOORPLAN", refId: id, note: "Odemčení zkušebního půdorysu", unlock: { kind, id } }, now);
        await tx.floorplan.update({ where: { id }, data: { license: "PAID" } });
        return done(ACTION_PRICES.floorplan, "PAID", spent.balance);
      }
      if (license === "BUNDLE" || license === "TRIAL" || floorplan.quoteUnlockedAt) return done(0, license);
      const spent = await spendCredits(tx, companyId, ACTION_PRICES.quote, { reason: "QUOTE", action: "Cenová nabídka pro zákazníka", refType: "FLOORPLAN", refId: id, note: "Samostatná cenová nabídka", unlock: { kind, id } }, now);
      await tx.floorplan.update({ where: { id }, data: { quoteUnlockedAt: now } });
      return done(ACTION_PRICES.quote, license, spent.balance);
    }
    const project = await tx.panelBoardProject.findFirst({ where: { id, companyId }, select: { id: true, license: true, quoteUnlockedAt: true, cncUnlockedAt: true } });
    if (!project) throw new WorkflowError("NOT_FOUND", "Projekt nebyl nalezen.");
    const license = licenseOf(project.license);
    if (kind === "switchboard") {
      if (license !== "TRIAL") return done(0, license);
      if (isDemoCompany(companyId)) throw new WorkflowError("FORBIDDEN", "Ukázková firma má jen zkušební výstupy – zaregistrujte vlastní firmu.");
      const spent = await spendCredits(tx, companyId, ACTION_PRICES.switchboard, { reason: "UNLOCK", action: "Plná verze rozváděče", refType: "PANEL_PROJECT", refId: id, note: "Odemčení zkušebního rozváděče", unlock: { kind, id } }, now);
      await tx.panelBoardProject.update({ where: { id }, data: { license: "PAID" } });
      return done(ACTION_PRICES.switchboard, "PAID", spent.balance);
    }
    if (license === "TRIAL" || license === "SAMPLE") return done(0, license);
    if (kind === "quote") {
      if (license === "BUNDLE" || project.quoteUnlockedAt) return done(0, license);
      const spent = await spendCredits(tx, companyId, ACTION_PRICES.quote, { reason: "QUOTE", action: "Cenová nabídka pro zákazníka", refType: "PANEL_PROJECT", refId: id, note: "Samostatná cenová nabídka", unlock: { kind, id } }, now);
      await tx.panelBoardProject.update({ where: { id }, data: { quoteUnlockedAt: now } });
      return done(ACTION_PRICES.quote, license, spent.balance);
    }
    if (project.cncUnlockedAt) return done(0, license);
    const spent = await spendCredits(tx, companyId, ACTION_PRICES.cnc, { reason: "CNC", action: "CNC výrobní balíček", refType: "PANEL_PROJECT", refId: id, note: "CNC výrobní balíček (.dxf + drátovací list)", unlock: { kind, id } }, now);
    await tx.panelBoardProject.update({ where: { id }, data: { cncUnlockedAt: now } });
    return done(ACTION_PRICES.cnc, license, spent.balance);
  });
}

/** Stav kreditů firmy pro lištu, ceník a prodejní modal. */
export async function creditStatus(prisma: PrismaClient, companyId: string) {
  const company = await prisma.registeredCompany.findUnique({
    where: { id: companyId },
    select: { creditsRemaining: true, creditsValidUntil: true, trialFloorplanUsed: true, trialSwitchboardUsed: true, subscriptionPlan: true, subscriptionUntil: true, firstTopUpBonusAt: true },
  });
  if (!company) throw new WorkflowError("NOT_FOUND", "Firma neexistuje.");
  const transactions = await prisma.creditTransaction.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 30 });
  return { ...company, demo: isDemoCompany(companyId), transactions };
}

/** Měsíční kredity předplatného PRO (denní úloha): 100 kr. každý měsíc od posledního připsání, dokud předplatné běží. */
export async function creditSubscriptions(prisma: PrismaClient, now = new Date()) {
  const companies = await prisma.registeredCompany.findMany({ where: { subscriptionPlan: { not: null }, subscriptionUntil: { gt: now }, closedAt: null }, select: { id: true, subscriptionPlan: true, subscriptionUntil: true, subscriptionCreditedAt: true, creditsValidUntil: true } });
  let credited = 0;
  for (const company of companies) {
    if (!subscriptionCreditDue(company, now)) continue;
    const plan = subscriptionOf(company.subscriptionPlan)!;
    await prisma.$transaction(async (tx) => {
      await tx.registeredCompany.update({ where: { id: company.id }, data: { subscriptionCreditedAt: now, creditsValidUntil: creditsValidAfterTopUp(company.creditsValidUntil, now) } });
      await grantCredits(tx, company.id, plan.monthlyCredits, { reason: "SUBSCRIPTION", note: `${plan.name} – měsíční kredity` });
    });
    credited++;
  }
  return { credited };
}

// ---------------------------------------------------------------------------
//  🐛 Hlášení chyb AI rozpoznání
// ---------------------------------------------------------------------------

export interface FeedbackSnapshot {
  code: string;
  name: string;
  designMode: string;
  analysisMode: string | null;
  railPhotos: Record<string, string>;
  items: { designation: string; rail: number; position: number; modules: number; status: string; category: string | null; typeCode: string | null; manufacturer: string | null; label: string; ocr: string | null }[];
}

/** Uloží hlášení se snímkem lišt a prvků projektu firmy (cizí projekt = nenalezen). */
export async function createAiFeedback(prisma: PrismaClient, companyId: string, projectId: string, message: string) {
  const text = message.trim().slice(0, 2000);
  if (text.length < 3) throw new WorkflowError("VALIDATION", "Napište krátký popis chyby.");
  const project = await prisma.panelBoardProject.findFirst({
    where: { id: projectId, companyId },
    include: { items: { orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }], include: { catalogComponent: { select: { category: true, typeCode: true, manufacturer: true } } } } },
  });
  if (!project) throw new WorkflowError("NOT_FOUND", "Projekt nebyl nalezen.");
  const snapshot: FeedbackSnapshot = {
    code: project.code,
    name: project.name,
    designMode: project.designMode,
    analysisMode: project.analysisMode,
    railPhotos: parseRailPhotos(project.railPhotosJson),
    items: project.items.map((item) => ({
      designation: item.designation,
      rail: item.dinRailIndex,
      position: item.positionOnRail,
      modules: item.modulesWidth,
      status: item.recognitionStatus,
      category: item.catalogComponent?.category ?? null,
      typeCode: item.customTypeCode ?? item.catalogComponent?.typeCode ?? null,
      manufacturer: item.catalogComponent?.manufacturer ?? null,
      label: item.circuitLabel,
      ocr: item.rawOcrText || null,
    })),
  };
  return prisma.aiFeedbackReport.create({ data: { projectId, companyId, photoUrl: project.photoUrl, detectedSnapshotJson: JSON.stringify(snapshot), message: text } });
}

export function parseFeedbackSnapshot(json: string): FeedbackSnapshot | null {
  try {
    const value = JSON.parse(json) as FeedbackSnapshot;
    return value && Array.isArray(value.items) ? value : null;
  } catch {
    return null;
  }
}

export async function resolveAiFeedback(prisma: PrismaClient, reportId: string, adminNote: string | null) {
  return prisma.aiFeedbackReport.update({ where: { id: reportId }, data: { status: "RESOLVED", adminNote: adminNote?.trim().slice(0, 1000) || null } });
}
