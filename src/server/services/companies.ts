// Registrované firmy (fáze 41): registrace do AI Panel Builderu a do Správy závodů, přihlášení heslem,
// úprava firemních údajů a testovací kredity. Záměrně bez `server-only` (testy nad SQLite).

import type { PrismaClient } from "@/generated/prisma/client";
import type { ProductScope } from "@/generated/prisma/enums";
import { TERMS_VERSION, plantCodeFor, type CompanyDetails, type PanelRegistration, type PlantRegistration } from "@/lib/registered-company";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { hashPassword, verifyPassword } from "../password";
import { preparePlant } from "./plants";
import type { Tx } from "./workflow";

const details = (input: CompanyDetails) => ({
  ico: input.ico,
  dic: input.dic || null,
  companyName: input.companyName,
  street: input.street,
  city: input.city,
  zip: input.zip,
  contactName: input.contactName,
  phone: input.phone,
  authorizationNumber: input.authorizationNumber || null,
});

async function assertEmailFree(prisma: PrismaClient | Tx, email: string, checkUsers = false) {
  if (await prisma.registeredCompany.findUnique({ where: { email }, select: { id: true } })) {
    throw new WorkflowError("CONFLICT", "Firma s tímto e-mailem už je registrovaná – přihlaste se.");
  }
  if (checkUsers && (await prisma.user.findUnique({ where: { email }, select: { id: true } }))) {
    throw new WorkflowError("CONFLICT", "Uživatel s tímto e-mailem už existuje – zvolte jiný e-mail.");
  }
}

/** Registrace firmy (Tester) do AI Panel Builderu: souhlas s VOP a přenesením odpovědnosti je povinný. */
export async function registerPanelCompany(prisma: PrismaClient, input: PanelRegistration, now = new Date()) {
  if (input.termsAccepted !== true) throw new WorkflowError("VALIDATION", "Bez souhlasu s podmínkami nelze registraci odeslat.");
  await assertEmailFree(prisma, input.email);
  return prisma.registeredCompany.create({
    data: { ...details(input), productScope: "PANEL_BUILDER", email: input.email, passwordHash: await hashPassword(input.password), termsAcceptedAt: now, termsVersion: TERMS_VERSION },
    select: { id: true, companyName: true, creditsRemaining: true },
  });
}

/** Přihlášení firmy e-mailem a heslem v daném produktu; špatné údaje → `null` (bez rozlišení důvodu). */
export async function authenticateCompany(prisma: PrismaClient, email: string, password: string, scope: ProductScope) {
  const company = await prisma.registeredCompany.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, productScope: true, passwordHash: true, plantId: true, closedAt: true } });
  const ok = company ? await verifyPassword(password, company.passwordHash) : false;
  // Fáze 69: zrušená firma (zůstaly jen fakturační údaje) se nepřihlásí
  return company && ok && !company.closedAt && company.productScope === scope ? { id: company.id, plantId: company.plantId } : null;
}

/** „Firemní údaje do razítka“: IČO, sídlo, odpovědná osoba (propisují se do dokumentace). */
export async function updateCompanyDetails(prisma: PrismaClient, companyId: string, input: CompanyDetails) {
  return prisma.registeredCompany.update({ where: { id: companyId }, data: details(input), select: { id: true, companyName: true } });
}

// Fáze 111: odečet kreditů za nový rozváděč / půdorys je v `credits.ts` (`chargeNewSwitchboard`, `chargeNewFloorplan`).

/**
 * Registrace výrobního závodu (Správa závodů, dokumentace a revizí) v JEDNÉ transakci: firma (PLANT_MANAGEMENT),
 * nový závod s čistou mapou areálu a uživatel – Technický ředitel, který vidí jen svůj závod.
 */
export async function registerPlantCompany(prisma: PrismaClient, input: PlantRegistration, now = new Date()) {
  if (input.termsAccepted !== true) throw new WorkflowError("VALIDATION", "Bez souhlasu s podmínkami nelze registraci odeslat.");
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    await assertEmailFree(tx, input.email, true);
    const codes = (await tx.plant.findMany({ select: { code: true } })).map((plant) => plant.code);
    const plantData = await preparePlant(tx, { name: input.plantName, code: plantCodeFor(input.companyName, codes), location: `${input.street}, ${input.city}`, customerName: input.companyName });
    const plant = await tx.plant.create({ data: plantData, select: { id: true, code: true, name: true } });
    const company = await tx.registeredCompany.create({
      data: { ...details(input), productScope: "PLANT_MANAGEMENT", email: input.email, passwordHash, termsAcceptedAt: now, termsVersion: TERMS_VERSION, plantId: plant.id },
      select: { id: true },
    });
    const user = await tx.user.create({
      data: {
        name: input.contactName,
        email: input.email,
        phone: input.phone,
        role: "MAINTENANCE",
        accountType: "PLANT_ADMIN",
        title: "Technický ředitel",
        company: input.companyName,
        homePlantId: plant.id,
        companyId: company.id,
        // Fáze 67: zakladatel má vlastní heslo (zaměstnanci dostanou pozvánku od správce firmy)
        passwordHash,
        passwordChangedAt: now,
      },
      select: { id: true },
    });
    return { companyId: company.id, plant, userId: user.id };
  });
}
