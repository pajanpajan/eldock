import type { PrismaClient } from "@/generated/prisma/client";
import { czAccountFromIban, isValidIban, normalizeBic, normalizeIban, type BankAccount } from "@/lib/credits";
import { LABEL_SETS_KEY, OPERATOR_KEY, labelSetSchema, operatorSchema, parseLabelSets, parseOperator, type LabelSet, type OperatorProfile } from "@/lib/operator";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { bankAccount } from "./credits";

// Fáze 112: údaje provozovatele a sady QR štítků z velínu (`PlatformSetting`) – služby nad předaným klientem Prisma. Čtení nikdy nespadne – bez tabulky
// (např. před migrací) nebo bez záznamu platí výchozí údaje z `lib/operator.ts`.

async function readSetting(db: PrismaClient, key: string): Promise<string | null> {
  try {
    return (await db.platformSetting.findUnique({ where: { key }, select: { valueJson: true } }))?.valueJson ?? null;
  } catch {
    return null;
  }
}

export async function operatorProfileOf(db: PrismaClient): Promise<OperatorProfile> {
  return parseOperator(await readSetting(db, OPERATOR_KEY));
}

export async function labelSetsOf(db: PrismaClient): Promise<LabelSet[]> {
  return parseLabelSets(await readSetting(db, LABEL_SETS_KEY));
}

/** Uložení údajů provozovatele z velínu (kontrola IČO, DIČ, IBAN). */
export async function saveOperatorProfile(db: PrismaClient, input: unknown): Promise<OperatorProfile> {
  const parsed = operatorSchema.safeParse(input);
  if (!parsed.success) throw new WorkflowError("VALIDATION", parsed.error.issues[0]?.message ?? "Zkontrolujte údaje provozovatele.");
  const iban = normalizeIban(parsed.data.iban)!;
  const profile: OperatorProfile = {
    ...parsed.data,
    dic: parsed.data.dic.replace(/\s/g, "").toUpperCase(),
    iban,
    bic: normalizeBic(parsed.data.bic) ?? "",
    accountNumber: parsed.data.accountNumber || czAccountFromIban(iban) || "",
  };
  await db.platformSetting.upsert({ where: { key: OPERATOR_KEY }, create: { key: OPERATOR_KEY, valueJson: JSON.stringify(profile) }, update: { valueJson: JSON.stringify(profile) } });
  return profile;
}

/** Sady QR štítků k objednání (počet kusů a cena bez DPH); prázdný seznam = objednávka štítků vypnutá. */
export async function saveLabelSets(db: PrismaClient, input: unknown): Promise<LabelSet[]> {
  const parsed = labelSetSchema.array().max(8).safeParse(input);
  if (!parsed.success) throw new WorkflowError("VALIDATION", "Zkontrolujte sady štítků (název, počet kusů 1–5000, cena v Kč bez DPH).");
  const json = JSON.stringify(parsed.data);
  await db.platformSetting.upsert({ where: { key: LABEL_SETS_KEY }, create: { key: LABEL_SETS_KEY, valueJson: json }, update: { valueJson: json } });
  return parseLabelSets(json);
}

/**
 * Účet pro QR platbu (SPD) a zálohové faktury: IBAN z velínu, jinak účet z prostředí (`ELDOCK_BANK_IBAN`) nebo výchozí
 * účet Raiffeisenbank (fáze 84).
 */
export async function paymentAccount(db: PrismaClient): Promise<BankAccount> {
  const stored = await readSetting(db, OPERATOR_KEY);
  if (stored) {
    const profile = parseOperator(stored);
    const iban = normalizeIban(profile.iban);
    if (iban && isValidIban(iban)) return { iban, bic: normalizeBic(profile.bic), accountNumber: profile.accountNumber || czAccountFromIban(iban), bankName: profile.bankName || null };
  }
  return bankAccount();
}
