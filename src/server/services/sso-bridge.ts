// Fáze 114: jednotné přihlášení (SSO přemostění) mezi AI Panel Builderem (firma `RegisteredCompany` PANEL_BUILDER,
// cookie `eldock-pb`) a Hlídačem revizí / Správou závodů (firma PLANT_MANAGEMENT, uživatel s relací `UserSession`).
//
// Bezpečnost: přemostění automaticky používá jen účty spárované přes `linkedCompanyId` (obě strany navzájem), nebo
// spárovaný účet nově založí se stejným e-mailem a heslem jako přihlášený účet. Když už druhý produkt účet se stejným
// e-mailem má a spárovaný není, přemostění ho NEPŘEVEZME (e-mail při registraci nikdo neověřoval – převzetí cizího účtu)
// – uživatel se do něj jednou přihlásí heslem a účty propojí (`linkCompanies`, obě relace platné). Účet s dvoufázovým
// ověřením se přihlásí vždy kódem. Záměrně bez `server-only` (testy nad SQLite).

import type { PrismaClient } from "@/generated/prisma/client";
import { TERMS_VERSION, plantCodeFor } from "@/lib/registered-company";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { preparePlant } from "./plants";

export type PanelToPlant =
  | { kind: "session"; userId: string; companyId: string; plantId: string | null; created: boolean }
  | { kind: "login"; reason: "exists" | "two-factor"; email: string; message: string };

export type PlantToPanel = { kind: "company"; companyId: string; created: boolean } | { kind: "login"; reason: "exists"; email: string; message: string };

const companyDetails = {
  id: true,
  productScope: true,
  ico: true,
  dic: true,
  companyName: true,
  street: true,
  city: true,
  zip: true,
  contactName: true,
  email: true,
  phone: true,
  passwordHash: true,
  authorizationNumber: true,
  linkedCompanyId: true,
  plantId: true,
} as const;

/** Uživatel spárované firmy Správy závodů, pod kterým se pokračuje: zakladatel (stejný e-mail jako firma), jinak správce. */
async function plantOwner(db: PrismaClient, company: { id: string; email: string }) {
  const users = await db.user.findMany({
    where: { companyId: company.id, disabledAt: null, accountType: { not: null } },
    select: { id: true, email: true, accountType: true, totpEnabledAt: true, homePlantId: true },
    orderBy: { createdAt: "asc" },
  });
  return users.find((user) => user.email === company.email) ?? users.find((user) => user.accountType === "PLANT_ADMIN") ?? null;
}

/** Zrušení spárování, jehož druhá strana už neexistuje nebo je zrušená. */
async function dropStaleLink(db: PrismaClient, companyId: string) {
  await db.registeredCompany.update({ where: { id: companyId }, data: { linkedCompanyId: null } });
}

/**
 * „🔄 Pokračovat pod mým účtem z Panel Builderu“: přihlášená firma AI Panel Builderu → spárovaný účet budovy / závodu.
 * Bez spárování založí firmu Správy závodů se závodem a technickým ředitelem (stejný e-mail i heslo) a účty spáruje.
 */
export async function bridgePanelToPlant(db: PrismaClient, panelCompanyId: string, now: Date = new Date()): Promise<PanelToPlant> {
  const panel = await db.registeredCompany.findFirst({ where: { id: panelCompanyId, productScope: "PANEL_BUILDER", closedAt: null }, select: companyDetails });
  if (!panel) throw new WorkflowError("NOT_FOUND", "Firma AI Panel Builderu neexistuje.");
  if (panel.linkedCompanyId) {
    const plant = await db.registeredCompany.findFirst({ where: { id: panel.linkedCompanyId, productScope: "PLANT_MANAGEMENT", closedAt: null }, select: { id: true, email: true, plantId: true } });
    const owner = plant ? await plantOwner(db, plant) : null;
    if (plant && owner) {
      if (owner.totpEnabledAt) return { kind: "login", reason: "two-factor", email: owner.email ?? plant.email, message: "Účet Správy závodů má dvoufázové ověření – přihlaste se e-mailem, heslem a kódem z aplikace." };
      return { kind: "session", userId: owner.id, companyId: plant.id, plantId: owner.homePlantId ?? plant.plantId, created: false };
    }
    if (!plant) await dropStaleLink(db, panel.id);
  }
  // Cizí (nespárovaný) účet se stejným e-mailem se nepřebírá – jen běžné přihlášení a propojení
  const taken = await db.registeredCompany.findUnique({ where: { email_productScope: { email: panel.email, productScope: "PLANT_MANAGEMENT" } }, select: { id: true } });
  const takenUser = await db.user.findUnique({ where: { email: panel.email }, select: { id: true } });
  if (taken || takenUser) {
    return {
      kind: "login",
      reason: "exists",
      email: panel.email,
      message: `Účet Hlídače revizí / Správy závodů s e-mailem ${panel.email} už existuje – přihlaste se do něj jednou heslem a účty pak propojíte jedním klikem.`,
    };
  }
  const created = await db.$transaction(async (tx) => {
    const codes = (await tx.plant.findMany({ select: { code: true } })).map((plant) => plant.code);
    const name = (panel.companyName.trim().length >= 3 ? panel.companyName.trim() : `Objekty ${panel.companyName.trim()}`).slice(0, 80);
    const plantData = await preparePlant(tx, { name, code: plantCodeFor(panel.companyName, codes), location: `${panel.street}, ${panel.city}`, customerName: panel.companyName });
    const plant = await tx.plant.create({ data: plantData, select: { id: true } });
    const company = await tx.registeredCompany.create({
      data: {
        productScope: "PLANT_MANAGEMENT",
        ico: panel.ico,
        dic: panel.dic,
        companyName: panel.companyName,
        street: panel.street,
        city: panel.city,
        zip: panel.zip,
        contactName: panel.contactName,
        email: panel.email,
        phone: panel.phone,
        passwordHash: panel.passwordHash,
        authorizationNumber: panel.authorizationNumber,
        termsAcceptedAt: now,
        termsVersion: TERMS_VERSION,
        plantId: plant.id,
        linkedCompanyId: panel.id,
      },
      select: { id: true },
    });
    const user = await tx.user.create({
      data: {
        name: panel.contactName,
        email: panel.email,
        phone: panel.phone,
        role: "MAINTENANCE",
        accountType: "PLANT_ADMIN",
        title: "Technický ředitel",
        company: panel.companyName,
        homePlantId: plant.id,
        companyId: company.id,
        // Stejné heslo jako v AI Panel Builderu – na /login se přihlásí i bez přemostění
        passwordHash: panel.passwordHash,
        passwordChangedAt: now,
      },
      select: { id: true },
    });
    await tx.registeredCompany.update({ where: { id: panel.id }, data: { linkedCompanyId: company.id } });
    return { userId: user.id, companyId: company.id, plantId: plant.id };
  });
  return { kind: "session", ...created, created: true };
}

/**
 * „⚡ Otevřít AI Panel Builder“ pod účtem Správy závodů / Hlídače revizí (uživatel s oprávněním Panel Builderu): spárovaná
 * firma AI Panel Builderu, jinak nová se stejným e-mailem a heslem firmy (1 testovací projekt zdarma) – i pro přenos
 * rozváděče z BIMu bez druhého přihlášení.
 */
export async function bridgePlantToPanel(db: PrismaClient, userId: string, now: Date = new Date()): Promise<PlantToPanel> {
  const user = await db.user.findFirst({ where: { id: userId, disabledAt: null, companyId: { not: null } }, select: { companyId: true } });
  const plant = user?.companyId ? await db.registeredCompany.findFirst({ where: { id: user.companyId, productScope: "PLANT_MANAGEMENT", closedAt: null }, select: companyDetails }) : null;
  if (!plant) throw new WorkflowError("FORBIDDEN", "Přemostění do AI Panel Builderu je jen pro účty registrovaných firem Správy závodů.");
  if (plant.linkedCompanyId) {
    const panel = await db.registeredCompany.findFirst({ where: { id: plant.linkedCompanyId, productScope: "PANEL_BUILDER", closedAt: null }, select: { id: true } });
    if (panel) return { kind: "company", companyId: panel.id, created: false };
    await dropStaleLink(db, plant.id);
  }
  const taken = await db.registeredCompany.findUnique({ where: { email_productScope: { email: plant.email, productScope: "PANEL_BUILDER" } }, select: { id: true } });
  if (taken) {
    return { kind: "login", reason: "exists", email: plant.email, message: `Účet AI Panel Builderu s e-mailem ${plant.email} už existuje – přihlaste se do něj jednou heslem a účty pak propojíte jedním klikem.` };
  }
  const companyId = await db.$transaction(async (tx) => {
    const panel = await tx.registeredCompany.create({
      data: {
        productScope: "PANEL_BUILDER",
        ico: plant.ico,
        dic: plant.dic,
        companyName: plant.companyName,
        street: plant.street,
        city: plant.city,
        zip: plant.zip,
        contactName: plant.contactName,
        email: plant.email,
        phone: plant.phone,
        passwordHash: plant.passwordHash,
        authorizationNumber: plant.authorizationNumber,
        termsAcceptedAt: now,
        termsVersion: TERMS_VERSION,
        linkedCompanyId: plant.id,
      },
      select: { id: true },
    });
    await tx.registeredCompany.update({ where: { id: plant.id }, data: { linkedCompanyId: panel.id } });
    return panel.id;
  });
  return { kind: "company", companyId, created: true };
}

/**
 * 🔗 Propojení dvou existujících účtů (uživatel je přihlášený v obou produktech – obě hesla prokázal). Účet už spárovaný
 * s jiným účtem se nepřepíše.
 */
export async function linkCompanies(db: PrismaClient, panelCompanyId: string, plantCompanyId: string): Promise<{ linked: boolean }> {
  const [panel, plant] = await Promise.all([
    db.registeredCompany.findFirst({ where: { id: panelCompanyId, productScope: "PANEL_BUILDER", closedAt: null }, select: { id: true, linkedCompanyId: true } }),
    db.registeredCompany.findFirst({ where: { id: plantCompanyId, productScope: "PLANT_MANAGEMENT", closedAt: null }, select: { id: true, linkedCompanyId: true } }),
  ]);
  if (!panel || !plant) throw new WorkflowError("NOT_FOUND", "Účty k propojení se nenašly.");
  if (panel.linkedCompanyId === plant.id && plant.linkedCompanyId === panel.id) return { linked: false };
  if ((panel.linkedCompanyId && panel.linkedCompanyId !== plant.id) || (plant.linkedCompanyId && plant.linkedCompanyId !== panel.id)) {
    throw new WorkflowError("CONFLICT", "Jeden z účtů je už propojený s jiným účtem – nejdřív zrušte jeho propojení.");
  }
  await db.$transaction([
    db.registeredCompany.update({ where: { id: panel.id }, data: { linkedCompanyId: plant.id } }),
    db.registeredCompany.update({ where: { id: plant.id }, data: { linkedCompanyId: panel.id } }),
  ]);
  return { linked: true };
}

/** Spárovaný účet druhého produktu (pro tlačítka „Pokračovat pod mým účtem …“), jinak null. */
export async function linkedCompanyOf(db: PrismaClient, companyId: string) {
  const company = await db.registeredCompany.findUnique({ where: { id: companyId }, select: { linkedCompanyId: true } });
  if (!company?.linkedCompanyId) return null;
  return db.registeredCompany.findFirst({ where: { id: company.linkedCompanyId, closedAt: null }, select: { id: true, productScope: true, companyName: true, email: true } });
}
