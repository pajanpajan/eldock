// Reálné projekty z PCSCHEMATIC (PDF v public/demo-docs) navázané na demo zařízení závodu Jablonec.
// Idempotentní: volá ho `seed.ts` a samostatně `npm run db:demo-docs` (i nad produkční databází –
// jen doplní chybějící zařízení, existující data nepřepisuje).
import type { EquipmentType } from "../src/generated/prisma/enums";
import type { PrismaClient } from "../src/generated/prisma/client";
import { buildParts } from "../src/lib/mock-graphics/parts";

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
  return created;
}
