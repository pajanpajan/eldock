// Seed demo dat. Spouští se ručně: `npm run db:seed` (nebo `npm run db:reset`).
// Záměrně nepoužívá src/lib/prisma.ts (ten importuje "server-only").
import "dotenv/config";

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { inspectionRuleFor } from "../src/lib/inspection-rules";
import { renderComplianceDocumentSvg, renderInspectionReportSvg } from "../src/lib/mock-graphics/compliance";
import { renderFloorplanSvg } from "../src/lib/mock-graphics/floorplan";
import { buildParts, type PartOverrides } from "../src/lib/mock-graphics/parts";
import { renderPhotoSvg } from "../src/lib/mock-graphics/photo";
import { renderSchematicSvg, schematicElementCenter } from "../src/lib/mock-graphics/schematic";
import {
  BUILDINGS,
  CHANGE_REQUESTS,
  day,
  EQUIPMENT,
  FLOORS,
  PLANTS,
  SEED_PHOTOS,
  USERS,
  revisionsFor,
  type UserKey,
} from "./seed-data";
import { LIGHT_EQUIPMENT } from "./seed-appliances";
import { FEEDS, INSPECTORS, complianceFor, externalInfluencesFor, inspectionsFor, intervalFor } from "./seed-compliance";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

const UPLOADS = fileURLToPath(new URL("../storage/uploads", import.meta.url));
const SEED_DIRS = ["photos", "revisions", "markups", "voice", "documents"].map((kind) => path.join(UPLOADS, kind, "seed"));
const FLOOR_VIEWBOX = { w: 1200, h: 800 };

const czDate = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;

const userId = (key: UserKey) => `user-${key}`;

/** Zákres: jedno červené pero – mírně nepřesný kroužek kolem prvku schématu (souřadnice 0–1). */
function circleMarkup(designation: string): string {
  const [cx, cy] = schematicElementCenter(designation);
  const rx = 0.055;
  const ry = 0.075;
  const points: [number, number, number][] = [];
  const steps = 32;
  for (let i = 0; i <= steps + 3; i++) {
    const t = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const wobble = 1 + 0.04 * Math.sin(i * 1.7);
    points.push([
      Math.round((cx + Math.cos(t) * rx * wobble) * 10000) / 10000,
      Math.round((cy + Math.sin(t) * ry * wobble) * 10000) / 10000,
      0.6,
    ]);
  }
  return JSON.stringify({ version: 1, sheet: 1, strokes: [{ tool: "pen", color: "#ef4444", width: 0.004, points }] });
}

async function wipe() {
  // Pořadí podle cizích klíčů (děti před rodiči).
  await prisma.changeRequestEvent.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.bomItem.deleteMany();
  await prisma.documentRevision.deleteMany();
  await prisma.changeRequest.deleteMany();
  await prisma.complianceDocument.deleteMany();
  await prisma.inspectionRecord.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.building.deleteMany();
  await prisma.plant.deleteMany();
  await prisma.user.deleteMany();
  for (const dir of SEED_DIRS) await rm(dir, { recursive: true, force: true });
  for (const dir of SEED_DIRS) await mkdir(dir, { recursive: true });
}

async function main() {
  await wipe();

  await prisma.user.createMany({
    data: USERS.map(({ id, name, email, role, company, phone }) => ({ id, name, email, role, company, phone })),
  });
  await prisma.plant.createMany({ data: PLANTS });
  await prisma.building.createMany({ data: BUILDINGS });

  for (const floor of FLOORS) {
    const { rooms, gates } = floor;
    await prisma.floor.create({
      data: {
        id: floor.id,
        buildingId: floor.buildingId,
        level: floor.level,
        code: floor.code,
        name: floor.name,
        description: floor.description,
        viewBoxW: FLOOR_VIEWBOX.w,
        viewBoxH: FLOOR_VIEWBOX.h,
        floorplanSvg: renderFloorplanSvg({
          floor: { name: floor.name, viewBoxW: FLOOR_VIEWBOX.w, viewBoxH: FLOOR_VIEWBOX.h },
          rooms,
          gates,
        }),
      },
    });
  }

  // Zařízení + revize (+ soubory schémat a kusovníky)
  const equipmentId = new Map<string, string>();
  const revisionId = new Map<string, string>(); // "TAG@major.minor" → id
  const revisionsByCr = new Map<string, string[]>(); // číslo CR → id revizí

  for (const [index, eq] of EQUIPMENT.entries()) {
    const floor = FLOORS.find((f) => f.key === eq.floor)!;
    const id = `eq-${eq.tag.toLowerCase()}`;
    equipmentId.set(eq.tag, id);
    await prisma.equipment.create({
      data: {
        id,
        floorId: floor.id,
        tag: eq.tag,
        name: eq.name,
        type: eq.type,
        status: eq.status,
        description: eq.description,
        manufacturer: eq.manufacturer,
        model: eq.model,
        yearInstalled: eq.yearInstalled,
        ratedVoltage: eq.ratedVoltage,
        ratedCurrent: eq.ratedCurrent,
        ipRating: eq.ipRating,
        pinX: eq.pinX,
        pinY: eq.pinY,
        inspectionIntervalMonths: intervalFor(eq),
        externalInfluences: externalInfluencesFor(eq),
        serialNumber: `SN-${eq.yearInstalled}-${String(index + 1).padStart(4, "0")}` },
    });

    let cumulative: PartOverrides = {};
    for (const rev of revisionsFor(eq.tag, eq.yearInstalled, index)) {
      for (const [des, patch] of Object.entries(rev.overrides ?? {})) {
        cumulative = { ...cumulative, [des]: { ...cumulative[des], ...patch } };
      }
      const version = `v${rev.major}.${rev.minor}`;
      const fileName = `${eq.tag}-${version}.svg`;
      await writeFile(
        path.join(UPLOADS, "revisions", "seed", fileName),
        renderSchematicSvg({
          equipment: { tag: eq.tag, name: eq.name, ratedCurrent: eq.ratedCurrent },
          revision: { version, date: czDate(rev.date), author: USERS.find((u) => u.key === rev.author)!.name, title: `Elektrické schéma ${eq.tag}` },
          variant: { overrides: cumulative, changed: rev.changed, a2Terminal: rev.a2Terminal, changeNote: rev.summary },
        }),
      );
      const fileUrl = `/api/files/revisions/seed/${fileName}`;
      const created = await prisma.documentRevision.create({
        data: {
          equipmentId: id,
          version,
          major: rev.major,
          minor: rev.minor,
          status: rev.status,
          title: `Elektrické schéma ${eq.tag}`,
          summary: rev.summary,
          schematicUrl: fileUrl,
          schematicFormat: "SVG",
          sheetCount: 1,
          thumbnailUrl: fileUrl,
          authorId: userId(rev.author),
          approverId: rev.approver ? userId(rev.approver) : null,
          approvedAt: rev.approvedAt ?? null,
          rejectionComment: rev.rejectionComment ?? null,
          createdAt: rev.date,
          bomItems: {
            create: buildParts(eq.ratedCurrent, cumulative).map((part, position) => ({
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
      revisionId.set(`${eq.tag}@${rev.major}.${rev.minor}`, created.id);
      if (rev.crNumber) revisionsByCr.set(rev.crNumber, [...(revisionsByCr.get(rev.crNumber) ?? []), created.id]);
    }
  }

  // Spotřebiče, nářadí a bezpečnostní zařízení – lehká karta bez revizí dokumentace
  for (const [index, eq] of LIGHT_EQUIPMENT.entries()) {
    const floor = FLOORS.find((f) => f.key === eq.floor)!;
    const id = `eq-${eq.tag.toLowerCase()}`;
    equipmentId.set(eq.tag, id);
    await prisma.equipment.create({
      data: {
        id,
        floorId: floor.id,
        tag: eq.tag,
        name: eq.name,
        type: eq.type,
        status: eq.status,
        description: eq.description,
        manufacturer: eq.manufacturer,
        model: eq.model,
        yearInstalled: eq.yearInstalled,
        ratedVoltage: eq.ratedVoltage,
        ratedCurrent: eq.ratedCurrent,
        ipRating: eq.ipRating,
        pinX: eq.pinX,
        pinY: eq.pinY,
        serialNumber: `SN-${eq.yearInstalled}-${String(EQUIPMENT.length + index + 1).padStart(4, "0")}`,
        inspectionIntervalMonths: intervalFor(eq),
        usageGroup: eq.usageGroup ?? null,
        protectionClass: eq.protectionClass ?? null,
        inventoryNumber: eq.inventoryNumber ?? null,
        assignedZone: eq.assignedZone ?? null,
      },
    });
  }

  // Hierarchie napájení (až po vytvoření všech zařízení)
  for (const [tag, feed] of Object.entries(FEEDS)) {
    await prisma.equipment.update({
      where: { id: equipmentId.get(tag)! },
      data: { fedFromEquipmentId: equipmentId.get(feed.from)!, fedFromCircuit: feed.circuit },
    });
  }

  // Pasport rozváděčů (ČSN EN 61439) a revizní zprávy (ČSN 33 1500)
  const documentsDir = path.join(UPLOADS, "documents", "seed");
  for (const [index, eq] of [...EQUIPMENT, ...LIGHT_EQUIPMENT].entries()) {
    const id = equipmentId.get(eq.tag)!;
    const floor = FLOORS.find((f) => f.key === eq.floor)!;
    const building = BUILDINGS.find((b) => b.id === floor.buildingId)!;
    const plant = PLANTS.find((p) => p.id === building.plantId)!;
    const feed = FEEDS[eq.tag];
    const feeders = Object.entries(FEEDS)
      .filter(([, f]) => f.from === eq.tag)
      .map(([tag, f]) => ({ circuit: f.circuit, label: tag, rating: f.rating }));
    const issuedAt = day(`${eq.yearInstalled}-02-2${index % 8}`);

    for (const doc of complianceFor(eq)) {
      const fileName = `${doc.documentNumber}.svg`;
      await writeFile(
        path.join(documentsDir, fileName),
        renderComplianceDocumentSvg(doc.category, {
          ...eq,
          externalInfluences: externalInfluencesFor(eq),
          fedFrom: feed ? { tag: feed.from } : null,
          fedFromCircuit: feed?.circuit ?? null,
          issuer: doc.issuer,
          documentNumber: doc.documentNumber,
          date: czDate(issuedAt),
          author: doc.author,
          feeders,
        }),
      );
      await prisma.complianceDocument.create({
        data: {
          equipmentId: id,
          category: doc.category,
          title: doc.title,
          documentNumber: doc.documentNumber,
          fileUrl: `/api/files/documents/seed/${fileName}`,
          issuedAt,
          issuer: doc.issuer,
          notes: doc.notes,
        },
      });
    }

    for (const record of inspectionsFor(eq, index, plant.code)) {
      const inspector = INSPECTORS[record.inspector];
      const fileName = `${record.reportNumber.replace(/[^w-]/g, "_")}.svg`;
      await writeFile(
        path.join(documentsDir, fileName),
        renderInspectionReportSvg({
          tag: eq.tag,
          name: eq.name,
          location: `${building.name} › ${floor.name}`,
          ratedVoltage: eq.ratedVoltage,
          ratedCurrent: eq.ratedCurrent,
          type: record.type,
          reportNumber: record.reportNumber,
          inspectionDate: czDate(record.inspectionDate),
          validUntil: czDate(record.validUntil),
          inspectorName: inspector.name,
          inspectorLicense: inspector.license,
          result: record.result,
          defectsSummary: record.defectsSummary,
          standard: inspectionRuleFor(eq).standard,
          measurements: record.measuringInstrument
            ? { instrument: record.measuringInstrument, rpe: record.protectiveConductorResistance, riso: record.insulationResistance }
            : null,
        }),
      );
      await prisma.inspectionRecord.create({
        data: {
          equipmentId: id,
          type: record.type,
          inspectionDate: record.inspectionDate,
          validUntil: record.validUntil,
          reportNumber: record.reportNumber,
          inspectorName: inspector.name,
          inspectorLicense: inspector.license,
          result: record.result,
          defectsSummary: record.defectsSummary,
          reportUrl: `/api/files/documents/seed/${fileName}`,
          measuringInstrument: record.measuringInstrument,
          protectiveConductorResistance: record.protectiveConductorResistance,
          insulationResistance: record.insulationResistance,
          createdAt: record.inspectionDate,
        },
      });
    }
  }

  // „Fotky“ z haly
  const takenAt = new Map(CHANGE_REQUESTS.flatMap((cr) => cr.attachments.map((a) => [a.file, a.at] as const)));
  for (const [file, photo] of Object.entries(SEED_PHOTOS)) {
    const taken = takenAt.get(file);
    const stamp = taken ? `${taken.toISOString().slice(0, 10)} ${String(taken.getUTCHours()).padStart(2, "0")}:${String((taken.getUTCMinutes() + 17) % 60).padStart(2, "0")}` : "";
    const common = { tag: photo.tag, stamp, seed: file };
    const svg = photo.kind === "wiring" ? renderPhotoSvg({ kind: "wiring", ...common }) : renderPhotoSvg({ kind: "label", ...common, plate: photo.plate! });
    await writeFile(path.join(UPLOADS, "photos", "seed", file), svg);
  }

  // Požadavky na změnu, přílohy a události
  for (const cr of CHANGE_REQUESTS) {
    const eqId = equipmentId.get(cr.tag)!;
    const closedLike = cr.status === "APPROVED" || cr.status === "CANCELLED";
    const created = await prisma.changeRequest.create({
      data: {
        number: cr.number,
        equipmentId: eqId,
        status: cr.status,
        priority: cr.priority,
        baseRevisionId: revisionId.get(`${cr.tag}@${cr.baseRevision[0]}.${cr.baseRevision[1]}`)!,
        markupSheet: 1,
        markupData: cr.markupAround ? circleMarkup(cr.markupAround) : null,
        voiceTranscript: cr.voiceTranscript ?? null,
        note: cr.note ?? null,
        reporterId: userId(cr.reporter),
        assigneeId: userId(cr.assignee),
        engineerSummary: cr.engineerSummary ?? null,
        submittedAt: cr.submittedAt,
        assignedAt: cr.assignedAt,
        resolvedAt: cr.resolvedAt ?? null,
        closedAt: closedLike ? (cr.closedAt ?? null) : null,
        attachments: {
          create: cr.attachments.map((a) => ({
            type: a.type,
            url: `/api/files/photos/seed/${a.file}`,
            fileName: a.file,
            mimeType: "image/svg+xml",
            caption: a.caption,
            uploadedById: userId(a.uploadedBy),
            createdAt: a.at,
          })),
        },
        events: {
          create: cr.events.map((e) => ({
            type: e.type,
            actorId: userId(e.actor),
            revisionId: e.revision ? revisionId.get(`${cr.tag}@${e.revision[0]}.${e.revision[1]}`)! : null,
            fromStatus: e.from ?? null,
            toStatus: e.to ?? null,
            comment: e.comment ?? null,
            createdAt: e.at,
          })),
        },
      },
    });
    // Revize vzniklé z požadavku (cyklická vazba se doplňuje až teď).
    const ids = revisionsByCr.get(cr.number) ?? [];
    if (ids.length) {
      await prisma.documentRevision.updateMany({ where: { id: { in: ids } }, data: { changeRequestId: created.id } });
    }
  }

  // Souhrn
  const [plants, buildings, floors, equipment, revisions, bom, openCr, closedCr, events, documents, inspections] = await Promise.all([
    prisma.plant.count(),
    prisma.building.count(),
    prisma.floor.count(),
    prisma.equipment.count(),
    prisma.documentRevision.count(),
    prisma.bomItem.count(),
    prisma.changeRequest.count({ where: { status: { in: ["SUBMITTED", "IN_PROGRESS", "WAITING_APPROVAL"] } } }),
    prisma.changeRequest.count({ where: { status: { in: ["APPROVED", "CANCELLED"] } } }),
    prisma.changeRequestEvent.count(),
    prisma.complianceDocument.count(),
    prisma.inspectionRecord.count(),
  ]);
  console.log(
    [
      "Seed dokončen:",
      `  závody ${plants} · budovy ${buildings} · patra ${floors} · zařízení ${equipment}`,
      `  revize ${revisions} · položky kusovníku ${bom}`,
      `  požadavky otevřené ${openCr} · uzavřené ${closedCr} · události ${events}`,
      `  dokumenty pasportu ${documents} · revizní zprávy ${inspections}`,
      `  uživatelé ${USERS.length}`,
    ].join("\n"),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
