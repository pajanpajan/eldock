// Reálné projekty z PCSCHEMATIC (PDF v public/demo-docs) navázané na demo zařízení závodu Jablonec,
// fotografie zařízení a spotřebiče k revizím. Idempotentní: volá ho `seed.ts` a samostatně
// `npm run db:demo-docs` (i nad produkční databází – jen doplní chybějící, existující data nepřepisuje).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { EquipmentType } from "../src/generated/prisma/enums";
import type { PrismaClient } from "../src/generated/prisma/client";
import { inspectionRuleFor } from "../src/lib/inspection-rules";
import { renderInspectionReportSvg } from "../src/lib/mock-graphics/compliance";
import { renderEquipmentPhotoSvg, type EquipmentPhotoKind } from "../src/lib/mock-graphics/equipment-photo";
import { buildParts } from "../src/lib/mock-graphics/parts";
import { newQrToken } from "../src/lib/qr-label";

const UPLOADS = fileURLToPath(new URL("../storage/uploads", import.meta.url));

const pin = (x: number, y: number) => ({ pinX: Math.round((x / 1200) * 1000) / 10, pinY: Math.round((y / 800) * 1000) / 10 });
const at = (iso: string, hour = 10) => new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00Z`);

interface DemoDocRevision {
  major: number;
  minor: number;
  status: "ACTIVE" | "ARCHIVED";
  file: string;
  sheetCount: number;
  title: string;
  summary: string;
  date: string;
}

interface DemoDocEquipment {
  tag: string;
  name: string;
  type: EquipmentType;
  floorId: string;
  at: [number, number];
  description: string;
  manufacturer: string;
  model: string;
  yearInstalled: number;
  ratedVoltage: string;
  ratedCurrent: string;
  ipRating: string;
  /** Nadřazený rozváděč (tag) a vývod – strom napájení pro LOTO a studio. */
  fedFrom: { tag: string; circuit: string };
  revisions: DemoDocRevision[];
  /** Uzavřený požadavek na změnu: z první revize na druhou (historie v CAE ticketingu). */
  changeRequest?: { number: string; note: string; summary: string; submitted: string; assigned: string; resolved: string; closed: string };
}

export const DEMO_DOCS_DIR = "/demo-docs";

export const DEMO_DOC_EQUIPMENT: DemoDocEquipment[] = [
  {
    tag: "RH1",
    name: "RH1 - Hlavní areálový rozváděč",
    type: "SWITCHBOARD",
    floorId: "floor-jbc-e-1np",
    at: [560, 600],
    description: "Areálový rozváděč venkovních okruhů, osvětlení a vrátnice. Projekt PCSCHEMATIC: 1P schéma, výkres rozváděče, výpočet oteplení a EU prohlášení o shodě.",
    manufacturer: "Hager",
    model: "Volta / FW",
    yearInstalled: 2020,
    ratedVoltage: "400 V AC / 50 Hz",
    ratedCurrent: "63 A",
    ipRating: "IP41",
    fedFrom: { tag: "RM1", circuit: "Pole 6 / QF9" },
    revisions: [
      { major: 1, minor: 0, status: "ACTIVE", file: "domovni-rozvadec-rh1.pdf", sheetCount: 16, title: "Projektová dokumentace RH1 (PCSCHEMATIC)", summary: "Výchozí digitalizace: 1P schéma, výkres rozváděče, výpočet oteplení, prohlášení o shodě a CE štítek.", date: "2026-10-29" },
    ],
  },
  {
    tag: "R-PLC-ML1",
    name: "R-PLC-ML1 - Řídicí skříň PLC linky ML-01",
    type: "SWITCHBOARD",
    floorId: "floor-jbc-b-1np",
    at: [760, 640],
    description: "Řídicí skříň montážní linky ML-01: PLC, vstupně-výstupní karty a jejich adresace.",
    manufacturer: "Rittal",
    model: "AX 1060",
    yearInstalled: 2022,
    ratedVoltage: "400 V AC / 24 V DC",
    ratedCurrent: "32 A",
    ipRating: "IP55",
    fedFrom: { tag: "R-ML-01", circuit: "QF4" },
    revisions: [
      { major: 1, minor: 0, status: "ACTIVE", file: "plc-rozvadec-linka.pdf", sheetCount: 21, title: "Projektová dokumentace R-PLC-ML1 (PCSCHEMATIC)", summary: "Výchozí digitalizace: PLC automatizace, I/O karty, adresace, rozmístění a seznamy komponent.", date: "2026-10-29" },
    ],
  },
  {
    tag: "PV-M1",
    name: "PV-M1 - Pohon sekčních vrat, Motor 1",
    type: "MACHINE",
    floorId: "floor-jbc-s-1np",
    at: [640, 690],
    description: "Pohony sekčních vrat expedice (rampa 2): motorové vývody s reverzací, koncové spínače, svorkovnice a kabely.",
    manufacturer: "Hörmann",
    model: "SupraMatic HT",
    yearInstalled: 2022,
    ratedVoltage: "400 V AC / 50 Hz",
    ratedCurrent: "16 A",
    ipRating: "IP65",
    fedFrom: { tag: "R-SKL", circuit: "QF7" },
    revisions: [
      { major: 1, minor: 0, status: "ARCHIVED", file: "pohon-vrat-v2.pdf", sheetCount: 29, title: "Projektová dokumentace pohonu vrat (PCSCHEMATIC)", summary: "Výchozí digitalizace: motorové vývody, ovládání a seznamy.", date: "2026-02-21" },
      { major: 1, minor: 1, status: "ACTIVE", file: "pohon-vrat-motor.pdf", sheetCount: 52, title: "Projektová dokumentace pohonu vrat (PCSCHEMATIC)", summary: "Rozšířená dokumentace: reverzace motorů, koncové spínače, svorkovnice, kabelové seznamy a grafické plány.", date: "2026-10-29" },
    ],
    changeRequest: {
      number: "ZM-2026-0040",
      note: "Po výměně koncových spínačů a doplnění reverzace nesedí svorkovnice s výkresem.",
      summary: "Doplněna reverzace motorů, koncové spínače, svorkovnice a kabelové seznamy (52 listů).",
      submitted: "2026-10-20",
      assigned: "2026-10-21",
      resolved: "2026-10-28",
      closed: "2026-10-29",
    },
  },
];

const AUTHOR = "user-markova";
const APPROVER = "user-novak";

/** Doplní demo zařízení s reálnými PDF. Vrací počet nově založených zařízení. */
export async function seedDemoDocs(prisma: PrismaClient): Promise<number> {
  let created = 0;
  for (const eq of DEMO_DOC_EQUIPMENT) {
    const id = `eq-${eq.tag.toLowerCase()}`;
    const [exists, floor, parent] = await Promise.all([
      prisma.equipment.findUnique({ where: { id }, select: { id: true } }),
      prisma.floor.findUnique({ where: { id: eq.floorId }, select: { id: true } }),
      prisma.equipment.findFirst({ where: { tag: eq.fedFrom.tag, floor: { building: { plantId: "plant-jbc" } } }, select: { id: true } }),
    ]);
    if (exists || !floor) continue;
    const users = await prisma.user.count({ where: { id: { in: [AUTHOR, APPROVER] } } });
    if (users < 2) continue;

    await prisma.$transaction(async (tx) => {
      await tx.equipment.create({
        data: {
          id,
          floorId: eq.floorId,
          tag: eq.tag,
          name: eq.name,
          type: eq.type,
          status: "ACTIVE",
          description: eq.description,
          manufacturer: eq.manufacturer,
          model: eq.model,
          yearInstalled: eq.yearInstalled,
          ratedVoltage: eq.ratedVoltage,
          ratedCurrent: eq.ratedCurrent,
          ipRating: eq.ipRating,
          serialNumber: `SN-${eq.yearInstalled}-${eq.tag.replace(/[^A-Z0-9]/gi, "")}`,
          qrToken: newQrToken(),
          fedFromEquipmentId: parent?.id ?? null,
          fedFromCircuit: parent ? eq.fedFrom.circuit : null,
          inspectionIntervalMonths: eq.type === "SWITCHBOARD" ? 48 : 36,
          ...pin(...eq.at),
        },
      });

      const revisionIds: string[] = [];
      for (const rev of eq.revisions) {
        const url = `${DEMO_DOCS_DIR}/${rev.file}`;
        const revision = await tx.documentRevision.create({
          data: {
            equipmentId: id,
            version: `v${rev.major}.${rev.minor}`,
            major: rev.major,
            minor: rev.minor,
            status: rev.status,
            title: rev.title,
            summary: rev.summary,
            schematicUrl: url,
            schematicFormat: "PDF",
            sheetCount: rev.sheetCount,
            authorId: AUTHOR,
            approverId: APPROVER,
            approvedAt: at(rev.date, 14),
            createdAt: at(rev.date),
            bomItems: {
              create: buildParts(eq.ratedCurrent, {}).map((part, position) => ({
                position: position + 1,
                designation: part.designation,
                description: part.description,
                manufacturer: part.manufacturer,
                partNumber: part.partNumber,
                quantity: part.quantity,
                unit: part.unit,
                note: part.note ?? null,
              })),
            },
          },
        });
        revisionIds.push(revision.id);
      }

      const cr = eq.changeRequest;
      if (cr && revisionIds.length >= 2 && !(await tx.changeRequest.findUnique({ where: { number: cr.number } }))) {
        const [baseId, resultId] = revisionIds;
        const ticket = await tx.changeRequest.create({
          data: {
            number: cr.number,
            equipmentId: id,
            status: "APPROVED",
            priority: "NORMAL",
            baseRevisionId: baseId,
            note: cr.note,
            reporterId: APPROVER,
            assigneeId: AUTHOR,
            engineerSummary: cr.summary,
            submittedAt: at(cr.submitted, 7),
            assignedAt: at(cr.assigned, 9),
            resolvedAt: at(cr.resolved, 14),
            closedAt: at(cr.closed, 9),
            events: {
              create: [
                { type: "SUBMITTED", actorId: APPROVER, toStatus: "SUBMITTED", createdAt: at(cr.submitted, 7) },
                { type: "ASSIGNED", actorId: AUTHOR, fromStatus: "SUBMITTED", toStatus: "IN_PROGRESS", createdAt: at(cr.assigned, 9) },
                { type: "REVISION_UPLOADED", actorId: AUTHOR, revisionId: resultId, fromStatus: "IN_PROGRESS", toStatus: "WAITING_APPROVAL", comment: cr.summary, createdAt: at(cr.resolved, 14) },
                { type: "APPROVED", actorId: APPROVER, revisionId: resultId, fromStatus: "WAITING_APPROVAL", toStatus: "APPROVED", comment: "Zkontrolováno u vrat, dokumentace odpovídá skutečnosti.", createdAt: at(cr.closed, 9) },
              ],
            },
          },
        });
        await tx.documentRevision.update({ where: { id: resultId }, data: { changeRequestId: ticket.id } });
      }
    });
    created += 1;
  }
  created += await seedDemoAppliances(prisma);
  await seedDemoInspections(prisma);
  await seedDemoPhotos(prisma);
  return created;
}

// Spotřebiče a nářadí k revizím dle ČSN 33 1600 (doplněk k seed-appliances).
const DEMO_APPLIANCES = [
  {
    tag: "PP-0050",
    name: "PP-0050 - Prodlužovací přívod 230 V / 25 m na bubnu",
    type: "EXTENSION_CORD" as const,
    floorId: "floor-jbc-a-1np",
    at: [760, 630] as [number, number],
    description: "Kabelový buben H05RR-F 3G1,5, 25 m, 4 zásuvky 230 V/16 A s tepelnou pojistkou.",
    manufacturer: "Brennenstuhl",
    model: "Garant IP44",
    usageGroup: "C",
    protectionClass: "I",
    inventoryNumber: "INV-2024-0412",
    assignedZone: "Dílna údržby – Hala A",
    measurements: { rpe: 0.18, riso: 210, leakage: 0.35 },
  },
  {
    tag: "SP-0330",
    name: "SP-0330 - Rychlovarná konvice Bosch",
    type: "APPLIANCE" as const,
    floorId: "floor-jbc-k-2np",
    at: [700, 230] as [number, number],
    description: "Rychlovarná konvice 1,7 l v kuchyňce kanceláří projekce.",
    manufacturer: "Bosch",
    model: "TWK3A011",
    usageGroup: "E",
    protectionClass: "I",
    inventoryNumber: "INV-2023-0188",
    assignedZone: "Kanceláře – 2. NP",
    measurements: { rpe: 0.07, riso: 150, leakage: 0.22 },
  },
];

const czDate = (date: Date) => date.toLocaleDateString("cs-CZ", { timeZone: "UTC" });
const DAY = 86_400_000;

const INSPECTOR_APPLIANCES = { name: "Milan Černý", license: "Technik revizí spotřebičů – ČSN 33 1600 ed. 2" };
const INSPECTOR_VTZ = { name: "Ing. Jiří Kovář", license: "TIČR č. E-2210/2019 (E2A)" };

/** Pravidelná revize se zprávou (SVG v documents/seed) – před `daysAgo` dny, lhůta podle zařízení. */
async function addInspection(
  prisma: PrismaClient,
  equipmentId: string,
  options: { daysAgo: number; inspector: { name: string; license: string }; measurements?: { rpe: number; riso: number; leakage: number } },
) {
  const eq = await prisma.equipment.findUniqueOrThrow({
    where: { id: equipmentId },
    select: { tag: true, name: true, type: true, usageGroup: true, ratedVoltage: true, ratedCurrent: true, inspectionIntervalMonths: true, floor: { select: { name: true, building: { select: { name: true } } } } },
  });
  const rule = inspectionRuleFor(eq);
  const inspectionDate = new Date(Date.now() - options.daysAgo * DAY);
  inspectionDate.setUTCHours(9, 0, 0, 0);
  const validUntil = new Date(inspectionDate);
  validUntil.setUTCMonth(validUntil.getUTCMonth() + eq.inspectionIntervalMonths);
  const reportNumber = `RS-${inspectionDate.getUTCFullYear()}-${eq.tag}`;
  const fileName = `${reportNumber}.svg`;
  const measurements = options.measurements ? { instrument: "Metrel MI 3309 BT", ...options.measurements } : null;

  const dir = path.join(UPLOADS, "documents", "seed");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, fileName),
    renderInspectionReportSvg({
      tag: eq.tag,
      name: eq.name,
      location: `${eq.floor.building.name} › ${eq.floor.name}`,
      ratedVoltage: eq.ratedVoltage,
      ratedCurrent: eq.ratedCurrent,
      type: "PERIODIC",
      reportNumber,
      inspectionDate: czDate(inspectionDate),
      validUntil: czDate(validUntil),
      inspectorName: options.inspector.name,
      inspectorLicense: options.inspector.license,
      result: "CAPABLE",
      defectsSummary: null,
      standard: rule.standard,
      measurements: measurements ? { instrument: measurements.instrument, rpe: measurements.rpe, riso: measurements.riso } : null,
    }),
  );
  await prisma.inspectionRecord.create({
    data: {
      equipmentId,
      type: "PERIODIC",
      inspectionDate,
      validUntil,
      reportNumber,
      inspectorName: options.inspector.name,
      inspectorLicense: options.inspector.license,
      result: "CAPABLE",
      reportUrl: `/api/files/documents/seed/${fileName}`,
      measuringInstrument: measurements?.instrument ?? null,
      protectiveConductorResistance: measurements?.rpe ?? null,
      insulationResistance: measurements?.riso ?? null,
      leakageCurrent: options.measurements?.leakage ?? null,
      functionalTest: true,
    },
  });
}

async function seedDemoAppliances(prisma: PrismaClient): Promise<number> {
  let created = 0;
  for (const [index, item] of DEMO_APPLIANCES.entries()) {
    const id = `eq-${item.tag.toLowerCase()}`;
    const [exists, floor] = await Promise.all([
      prisma.equipment.findUnique({ where: { id }, select: { id: true } }),
      prisma.floor.findUnique({ where: { id: item.floorId }, select: { id: true } }),
    ]);
    if (exists || !floor) continue;
    await prisma.equipment.create({
      data: {
        id,
        floorId: item.floorId,
        tag: item.tag,
        name: item.name,
        type: item.type,
        status: "ACTIVE",
        description: item.description,
        manufacturer: item.manufacturer,
        model: item.model,
        yearInstalled: 2023,
        ratedVoltage: "230 V AC / 50 Hz",
        ratedCurrent: "16 A",
        ipRating: "IP44",
        serialNumber: `SN-2023-${item.tag.replace(/[^A-Z0-9]/gi, "")}`,
        usageGroup: item.usageGroup,
        protectionClass: item.protectionClass,
        inventoryNumber: item.inventoryNumber,
        assignedZone: item.assignedZone,
        inspectionIntervalMonths: inspectionRuleFor({ type: item.type, usageGroup: item.usageGroup }).months,
        qrToken: newQrToken(),
        ...pin(...item.at),
      },
    });
    await addInspection(prisma, id, { daysAgo: 40 + index * 25, inspector: INSPECTOR_APPLIANCES, measurements: item.measurements });
    created += 1;
  }
  return created;
}

/**
 * Revize VTZ zařízení s PDF projekty – tři různé stavy pro indikátor na kartě:
 * RH1 platná, R-PLC-ML1 těsně před koncem lhůty (48 měsíců), PV-M1 po termínu (36 měsíců).
 */
const DEMO_DOC_INSPECTIONS: { tag: string; daysAgo: number }[] = [
  { tag: "RH1", daysAgo: 210 },
  { tag: "R-PLC-ML1", daysAgo: 48 * 30 + 6 },
  { tag: "PV-M1", daysAgo: 36 * 31 + 45 },
];

async function seedDemoInspections(prisma: PrismaClient) {
  for (const { tag, daysAgo } of DEMO_DOC_INSPECTIONS) {
    const id = `eq-${tag.toLowerCase()}`;
    const equipment = await prisma.equipment.findUnique({ where: { id }, select: { _count: { select: { inspections: true } } } });
    if (!equipment || equipment._count.inspections > 0) continue;
    await addInspection(prisma, id, { daysAgo, inspector: INSPECTOR_VTZ });
  }
}

/** Fotografie demo zařízení – jen tam, kde ještě žádná není (vlastní fotky z haly se nepřepisují). */
export const DEMO_PHOTOS: { tag: string; kind: EquipmentPhotoKind }[] = [
  { tag: "RH1", kind: "switchboard" },
  { tag: "PV-M1", kind: "motor" },
  { tag: "R-PLC-ML1", kind: "plc" },
  { tag: "SP-0202", kind: "microwave" },
  { tag: "PP-0050", kind: "cable-drum" },
  { tag: "SP-0330", kind: "kettle" },
];

async function seedDemoPhotos(prisma: PrismaClient) {
  const dir = path.join(UPLOADS, "photos", "seed");
  await mkdir(dir, { recursive: true });
  for (const { tag, kind } of DEMO_PHOTOS) {
    const id = `eq-${tag.toLowerCase()}`;
    const equipment = await prisma.equipment.findUnique({ where: { id }, select: { photoUrl: true } });
    if (!equipment || equipment.photoUrl) continue;
    const fileName = `equipment-${tag}.svg`;
    await writeFile(path.join(dir, fileName), renderEquipmentPhotoSvg(kind, tag));
    await prisma.equipment.update({ where: { id }, data: { photoUrl: `/api/files/photos/seed/${fileName}` } });
  }
}
