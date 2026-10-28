// Demo pomocník CAE: „Vygenerovat upravené schéma“ – vykreslí SVG další revize přes
// `renderSchematicSvg` s kusovníkem z formuláře a revizním obláčkem kolem změněných prvků
// (podle rozdílu kusovníku a místa, které technik zakroužkoval). Soubor neukládá.

import type { PrismaClient } from "@/generated/prisma/client";
import { markupCenter, parseMarkup } from "@/lib/markup";
import { overridesFromBom } from "@/lib/mock-graphics/parts";
import { SCHEMATIC_DESIGNATIONS, nearestSchematicElement, renderSchematicSvg } from "@/lib/mock-graphics/schematic";
import { WorkflowError, assertCanPerform, formatVersion, nextVersion, type VersionBump } from "@/lib/workflow/state-machine";

import type { Actor, BomItemInput } from "./workflow";

export interface GenerateSchematicInput {
  changeRequestId: string;
  bump?: VersionBump;
  /** Kusovník z formuláře; bez něj kusovník platné revize. */
  bom?: BomItemInput[];
  /** Text do tabulky změn v razítku (technické shrnutí). */
  summary?: string | null;
}

const czDate = (date: Date) => new Intl.DateTimeFormat("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date).replace(/\s/g, "");

const sameItem = (a: BomItemInput, b: BomItemInput) =>
  a.description === b.description &&
  (a.manufacturer ?? null) === (b.manufacturer ?? null) &&
  (a.partNumber ?? null) === (b.partNumber ?? null) &&
  a.quantity === b.quantity &&
  (a.note ?? null) === (b.note ?? null);

export async function generateRevisionSchematic(prisma: PrismaClient, actor: Actor, input: GenerateSchematicInput) {
  const changeRequest = await prisma.changeRequest.findUnique({
    where: { id: input.changeRequestId },
    include: {
      equipment: {
        select: {
          tag: true,
          name: true,
          ratedCurrent: true,
          revisions: { select: { major: true, minor: true, status: true, title: true, bomItems: { orderBy: { position: "asc" } } } },
        },
      },
    },
  });
  if (!changeRequest) throw new WorkflowError("NOT_FOUND", "Požadavek na změnu nebyl nalezen.");
  assertCanPerform("uploadRevision", actor.role, changeRequest.status);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { name: true } });

  const { equipment } = changeRequest;
  const active = equipment.revisions.find((revision) => revision.status === "ACTIVE");
  const activeBom: BomItemInput[] = active?.bomItems ?? [];
  const bom = input.bom ?? activeBom;
  const version = formatVersion(nextVersion(equipment.revisions, input.bump ?? "minor"));

  // Revizní obláček: prvky změněné nebo odebrané v kusovníku + prvek, který technik zakroužkoval.
  const known = new Set<string>(SCHEMATIC_DESIGNATIONS);
  const before = new Map(activeBom.map((item) => [item.designation, item]));
  const changed = new Set(
    bom.filter((item) => known.has(item.designation) && (!before.has(item.designation) || !sameItem(item, before.get(item.designation)!))).map((item) => item.designation),
  );
  const kept = new Set(bom.map((item) => item.designation));
  for (const item of activeBom) if (known.has(item.designation) && !kept.has(item.designation)) changed.add(item.designation);
  const center = markupCenter(parseMarkup(changeRequest.markupData));
  if (center) changed.add(nearestSchematicElement(...center));

  const note =
    input.summary?.trim() ||
    changeRequest.voiceTranscript?.trim() ||
    changeRequest.note?.trim() ||
    `Změna dle požadavku ${changeRequest.number}.`;

  const svg = renderSchematicSvg({
    equipment: { tag: equipment.tag, name: equipment.name, ratedCurrent: equipment.ratedCurrent },
    revision: { version, date: czDate(new Date()), author: user.name, title: active?.title ?? `Elektrické schéma ${equipment.tag}` },
    variant: {
      overrides: overridesFromBom(equipment.ratedCurrent, bom),
      changed: [...changed],
      changeNote: `${changeRequest.number}: ${note}`,
    },
  });
  return { svg, version, changed: [...changed] };
}
