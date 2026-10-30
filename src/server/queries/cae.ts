import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { formatVersion, nextVersion } from "@/lib/workflow/state-machine";

const location = {
  select: {
    id: true,
    tag: true,
    name: true,
    type: true,
    status: true,
    floor: {
      select: {
        id: true,
        name: true,
        building: { select: { id: true, name: true, plant: { select: { id: true, code: true, name: true } } } },
      },
    },
  },
} as const;

/** Všechny tickety napříč závody pro CAE dashboard (filtry a KPI se počítají v `lib/cae-tickets`). */
export async function getCaeTickets() {
  const rows = await prisma.changeRequest.findMany({
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      number: true,
      status: true,
      priority: true,
      submittedAt: true,
      assignedAt: true,
      resolvedAt: true,
      closedAt: true,
      voiceTranscript: true,
      note: true,
      assigneeId: true,
      reporter: { select: { name: true } },
      assignee: { select: { name: true } },
      equipment: location,
      _count: { select: { attachments: true } },
    },
  });
  return rows.map((row) => ({ ...row, plantId: row.equipment.floor.building.plant.id }));
}

export type CaeTicketRow = Awaited<ReturnType<typeof getCaeTickets>>[number];

/** Detail ticketu: zákres nad základní revizí, fotky, přepis, revize k požadavku a timeline. */
async function loadTicketDetail(id: string) {
  return prisma.changeRequest.findUnique({
    where: { id },
    include: {
      equipment: location,
      reporter: { select: { id: true, name: true, company: true } },
      assignee: { select: { id: true, name: true } },
      baseRevision: { select: { id: true, version: true, schematicUrl: true, schematicFormat: true, status: true } },
      attachments: { orderBy: { createdAt: "asc" }, include: { uploadedBy: { select: { name: true } } } },
      resolvingRevisions: {
        orderBy: [{ major: "desc" }, { minor: "desc" }],
        select: {
          id: true,
          version: true,
          status: true,
          summary: true,
          schematicUrl: true,
          schematicFormat: true,
          rejectionComment: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true, role: true } }, revision: { select: { id: true, version: true } } },
      },
    },
  });
}

/** Deduplikace v rámci požadavku (generateMetadata + stránka). */
export const getTicketDetail = cache(loadTicketDetail);

export type TicketDetail = NonNullable<Awaited<ReturnType<typeof getTicketDetail>>>;
export type TicketEvent = TicketDetail["events"][number];

/** Podklady formuláře nové revize: další čísla verzí, název a kusovník platné revize. */
export async function getRevisionFormData(changeRequestId: string) {
  const changeRequest = await prisma.changeRequest.findUnique({
    where: { id: changeRequestId },
    select: {
      id: true,
      number: true,
      status: true,
      voiceTranscript: true,
      note: true,
      equipment: {
        select: {
          ...location.select,
          revisions: {
            select: {
              major: true,
              minor: true,
              version: true,
              status: true,
              title: true,
              rejectionComment: true,
              changeRequestId: true,
              bomItems: { orderBy: { position: "asc" } },
            },
            orderBy: [{ major: "desc" }, { minor: "desc" }],
          },
        },
      },
    },
  });
  if (!changeRequest) return null;
  const { revisions } = changeRequest.equipment;
  const active = revisions.find((revision) => revision.status === "ACTIVE") ?? null;
  const lastRejected = revisions.find((revision) => revision.status === "REJECTED" && revision.changeRequestId === changeRequestId) ?? null;
  return {
    changeRequest,
    active,
    lastRejected,
    versions: {
      current: active?.version ?? null,
      minor: formatVersion(nextVersion(revisions, "minor")),
      major: formatVersion(nextVersion(revisions, "major")),
    },
  };
}
