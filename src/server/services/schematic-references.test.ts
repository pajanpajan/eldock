import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { createReference, deleteReference, normalizeDesignation, updateReference } from "./schematic-references";
import { createTestDb, seedMinimal } from "./test-db";
import { submitChangeRequest, uploadRevision } from "./workflow";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let revisionId: string;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
  revisionId = (await prisma.documentRevision.findFirstOrThrow({ where: { equipmentId: "eq-R-LIS-01" } })).id;
});
afterEach(async () => db.cleanup());

const input = (patch = {}) => ({ revisionId, page: 1, designation: "q1", title: "Hlavní vypínač", x: 12.8, y: 24.6, linkedEquipmentId: "eq-R-CNC-04", ...patch });

describe("interaktivní reference ve výkresu", () => {
  it("normalizuje značení dle ČSN EN 81346", () => {
    expect(normalizeDesignation("q1")).toBe("-Q1");
    expect(normalizeDesignation(" -x1.3 ")).toBe("-X1.3");
    expect(() => normalizeDesignation("Hlavní")).toThrow(WorkflowError);
  });

  it("založí, upraví a smaže referenci s vazbou na zařízení", async () => {
    const created = await createReference(prisma, input());
    expect(created).toMatchObject({ designation: "-Q1", linkedEquipmentId: "eq-R-CNC-04", page: 1 });
    const updated = await updateReference(prisma, created.id, input({ title: "Jistič ovládání", designation: "-F2", linkedEquipmentId: null }));
    expect(updated).toMatchObject({ designation: "-F2", title: "Jistič ovládání", linkedEquipmentId: null });
    await deleteReference(prisma, created.id);
    expect(await prisma.schematicReference.count()).toBe(0);
  });

  it("odmítne pozici mimo výkres, stránku navíc a neexistující zařízení", async () => {
    await expect(createReference(prisma, input({ x: 120 }))).rejects.toThrow("Pozice");
    await expect(createReference(prisma, input({ page: 2 }))).rejects.toThrow("Stránka");
    await expect(createReference(prisma, input({ linkedEquipmentId: "eq-neni" }))).rejects.toThrow("Propojené zařízení");
  });

  it("nová revize od CAE převezme reference z platné revize", async () => {
    await createReference(prisma, input());
    const cr = await submitChangeRequest(prisma, { id: "u-maint", role: "MAINTENANCE" }, { equipmentId: "eq-R-LIS-01", note: "Výměna Q1", attachments: [] });
    const revision = await uploadRevision(prisma, { id: "u-cae", role: "CAE_ENGINEER" }, { changeRequestId: cr.id, schematicUrl: "/api/files/revisions/y.svg", schematicFormat: "SVG", summary: "Nový Q1" });
    const copied = await prisma.schematicReference.findMany({ where: { revisionId: revision.id } });
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatchObject({ designation: "-Q1", linkedEquipmentId: "eq-R-CNC-04" });
  });
});
