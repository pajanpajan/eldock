// Fáze 116: doplnění pasportu rozváděče (ČSN EN IEC 61439) – protokol vygenerovaný v ELDOCKu z potvrzených parametrů,
// vlastní nahrané PDF a liniové schéma ze záložky Schéma; odpovědné osoby LOTO (ČSN EN 50110-1 ed. 4).
// Služby dostávají `prisma` (testy nad SQLite).

import type { PrismaClient } from "@/generated/prisma/client";
import type { ComplianceCategory } from "@/generated/prisma/enums";
import { serializeLotoPersons, type LotoPersons } from "@/lib/loto-persons";
import {
  PASSPORT_DOC_TITLES,
  passportDocNumber,
  passportPrintHref,
  routinePassed,
  thermalCheck,
  type PassportPayload,
} from "@/lib/passport-docs";
import { WorkflowError } from "@/lib/workflow/state-machine";

const fail = (message: string): never => {
  throw new WorkflowError("VALIDATION", message);
};

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));

/**
 * Uloží protokol vygenerovaný v ELDOCKu do pasportu (karta se přepne na „✅ V PASPORTU“). Liniové schéma se jen propojí
 * se schématem revize ze záložky Schéma; ostatní dokumenty mají tiskovou podobu (náhled / PDF) z potvrzených parametrů.
 */
export async function generatePassportDocument(prisma: PrismaClient, input: { equipmentId: string; payload: PassportPayload; author: string }) {
  const equipment = await prisma.equipment.findUnique({ where: { id: input.equipmentId }, select: { id: true, tag: true, type: true, manufacturer: true } });
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení neexistuje.");
  const payload = input.payload;
  const category: ComplianceCategory = payload.kind;
  let fileUrl: string | null = null;
  let issuer = input.author.trim() || "ELDOCK";
  let date = "date" in payload ? payload.date : new Date().toISOString().slice(0, 10);
  let notes: string | null = null;
  let stored: PassportPayload = payload;

  switch (payload.kind) {
    case "SINGLE_LINE_DIAGRAM": {
      const revision = await prisma.documentRevision.findFirst({ where: { id: payload.revisionId, equipmentId: equipment.id }, select: { id: true, version: true, schematicUrl: true, sheetCount: true, createdAt: true } });
      if (!revision) fail("Revize schématu nepatří k tomuto zařízení.");
      fileUrl = revision!.schematicUrl;
      date = revision!.createdAt.toISOString().slice(0, 10);
      stored = { ...payload, version: revision!.version, schematicUrl: revision!.schematicUrl, sheetCount: revision!.sheetCount };
      notes = `Propojeno se schématem revize ${revision!.version} ze záložky Schéma (${revision!.sheetCount} ${revision!.sheetCount === 1 ? "list" : "listy"}).`;
      break;
    }
    case "CONFORMITY_DECLARATION": {
      if (payload.manufacturer.trim().length < 2) fail("Vyplňte výrobce rozváděče.");
      if (!payload.directives.length || !payload.standards.length) fail("Vyberte aspoň jednu směrnici a normu.");
      if (payload.signatory.trim().length < 3) fail("Vyplňte jméno osoby, která prohlášení podepisuje.");
      issuer = payload.manufacturer.trim();
      notes = `Prohlášení vydává výrobce rozváděče na svou výhradní odpovědnost – podepisuje ${payload.signatory.trim()} (${payload.signatoryRole.trim() || "odpovědná osoba"}).`;
      break;
    }
    case "ROUTINE_VERIFICATION": {
      if (payload.items.length < 9) fail("Kusová zkouška musí obsahovat všechny body čl. 11.2–11.10.");
      if (payload.performedBy.trim().length < 3) fail("Vyplňte, kdo kusovou zkoušku provedl.");
      if (payload.insulationMOhm !== null && !(payload.insulationMOhm >= 0)) fail("Izolační odpor musí být kladné číslo.");
      notes = routinePassed(payload) ? "Kusové ověření VYHOVĚLO ve všech bodech." : "Kusové ověření NEVYHOVĚLO – rozváděč nelze uvést do provozu.";
      issuer = payload.performedBy.trim();
      break;
    }
    case "THERMAL_CALCULATION": {
      const { enclosure } = payload;
      if (![enclosure.heightMm, enclosure.widthMm, enclosure.depthMm].every((value) => value >= 100 && value <= 4000)) fail("Rozměry skříně musí být 100–4 000 mm.");
      if (payload.losses.some((line) => line.lossW === null || !(line.lossW >= 0))) fail("Doplňte ztrátový výkon u všech přístrojů (W).");
      if (!(payload.maxRiseK > 0 && payload.maxRiseK <= 70)) fail("Dovolené oteplení musí být 1–70 K.");
      const result = thermalCheck(payload);
      stored = { ...payload, result };
      notes = result.verdict;
      break;
    }
    case "EXTERNAL_INFLUENCES": {
      if (payload.codes.length < 5) fail("Určete kódy vnějších vlivů.");
      if (payload.chair.trim().length < 3) fail("Vyplňte předsedu komise.");
      notes = `Kódy: ${payload.codes.join(", ")}.`;
      issuer = payload.chair.trim();
      break;
    }
  }
  if (!isDate(date)) fail("Neplatné datum dokumentu.");

  const documentNumber = passportDocNumber(category, equipment.tag, date);
  const created = await prisma.complianceDocument.create({
    data: {
      equipmentId: equipment.id,
      category,
      title: PASSPORT_DOC_TITLES[category],
      documentNumber,
      fileUrl: fileUrl ?? "pending",
      issuedAt: new Date(`${date}T12:00:00Z`),
      issuer: issuer.slice(0, 160),
      notes: notes?.slice(0, 1000) ?? null,
      source: payload.kind === "SINGLE_LINE_DIAGRAM" ? "LINKED" : "GENERATED",
      generatedJson: JSON.stringify(stored),
    },
  });
  if (fileUrl) return created;
  return prisma.complianceDocument.update({ where: { id: created.id }, data: { fileUrl: passportPrintHref(equipment.id, created.id) } });
}

/** „📤 Nahrát vlastní PDF“ – sken nebo PDF od výrobce rozváděče (soubor už je v úložišti závodu). */
export async function uploadPassportDocument(
  prisma: PrismaClient,
  input: { equipmentId: string; category: ComplianceCategory; fileUrl: string; documentNumber: string; issuer: string; issuedAt: string; title?: string | null },
) {
  if (!/^\/api\/files\/documents\/[\w./-]+$/.test(input.fileUrl)) fail("Nahrajte PDF přes formulář pasportu.");
  if (!isDate(input.issuedAt)) fail("Neplatné datum vydání.");
  const equipment = await prisma.equipment.findUnique({ where: { id: input.equipmentId }, select: { id: true, tag: true } });
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení neexistuje.");
  return prisma.complianceDocument.create({
    data: {
      equipmentId: equipment.id,
      category: input.category,
      title: input.title?.trim() || PASSPORT_DOC_TITLES[input.category],
      documentNumber: input.documentNumber.trim() || passportDocNumber(input.category, equipment.tag, input.issuedAt),
      fileUrl: input.fileUrl,
      issuedAt: new Date(`${input.issuedAt}T12:00:00Z`),
      issuer: input.issuer.trim().slice(0, 160) || "Výrobce rozváděče",
      source: "UPLOAD",
    },
  });
}

/** Odpovědné osoby dle ČSN EN 50110-1 ed. 4 (OOEZ a OPŘPČ) na kartě LOTO. */
export async function updateLotoResponsible(prisma: PrismaClient, input: { equipmentId: string; persons: LotoPersons }) {
  const json = serializeLotoPersons(input.persons);
  return prisma.equipment.update({ where: { id: input.equipmentId }, data: { lotoResponsibleJson: json }, select: { id: true, lotoResponsibleJson: true } });
}
