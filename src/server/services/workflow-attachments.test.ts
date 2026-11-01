import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import { createTestDb, seedMinimal } from "./test-db";
import { submitChangeRequest } from "./workflow";

// Fáze 36: zákres do fotky si drží odkaz na původní fotku (CAE přečte text pod červenou čarou).

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
});
afterEach(async () => db.cleanup());

describe("přílohy požadavku na změnu", () => {
  it("fotka se zákresem uloží i originál, běžná fotka originál nemá", async () => {
    const cr = await submitChangeRequest(
      prisma,
      { id: "u-maint", role: "MAINTENANCE" },
      {
        equipmentId: "eq-R-LIS-01",
        note: "Přepojena svorka A2",
        attachments: [
          { url: "/api/files/photos/zakres.jpg", caption: "Zákres do fotky", originalUrl: "/api/files/photos/original.jpg" },
          { url: "/api/files/photos/stitek.jpg", caption: "Štítek" },
        ],
      },
    );
    const attachments = await prisma.attachment.findMany({ where: { changeRequestId: cr.id }, orderBy: { url: "desc" } });
    expect(attachments.map((attachment) => [attachment.url, attachment.originalUrl])).toEqual([
      ["/api/files/photos/zakres.jpg", "/api/files/photos/original.jpg"],
      ["/api/files/photos/stitek.jpg", null],
    ]);
  });
});
