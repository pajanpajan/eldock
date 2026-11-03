import { createHash } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { standardEnclosureMatrix } from "@/lib/panel-builder/enclosures";
import { EXTERNAL_SOURCE, deriveRelations, mapExternalProduct, type ExternalProduct, type MappedComponent, type MappedEnclosure } from "@/lib/panel-builder/external-catalog";

// Import externí databáze prvků „ai-panel-builder“ do katalogu Eldocku (fáze 43): dávkový upsert
// přístrojů (CatalogComponent), skříní (PanelEnclosure) a vazeb příslušenství (CatalogRelation).
// Nic nemaže; vlastní katalog Eldocku (externalSource = null) se stejným objednacím číslem nepřepíše.

export const EXTERNAL_SYNC_MARKER = "catalog.external-sync";
const BATCH = 150;

export interface SyncResult {
  skipped: boolean;
  products: number;
  components: { created: number; updated: number; kept: number };
  enclosures: { created: number; updated: number };
  relations: number;
  skippedProducts: { key: string; reason: string }[];
}

async function inBatches<T>(rows: readonly T[], run: (batch: readonly T[]) => Promise<unknown>) {
  for (let index = 0; index < rows.length; index += BATCH) await run(rows.slice(index, index + BATCH));
}

/** Otisk exportu – stejná data se při startu kontejneru znovu neimportují. */
export const catalogHash = (products: readonly ExternalProduct[]) => createHash("sha1").update(JSON.stringify(products)).digest("hex");

export async function importExternalCatalog(prisma: PrismaClient, products: readonly ExternalProduct[], options: { force?: boolean } = {}): Promise<SyncResult> {
  const hash = catalogHash(products);
  const result: SyncResult = { skipped: false, products: products.length, components: { created: 0, updated: 0, kept: 0 }, enclosures: { created: 0, updated: 0 }, relations: 0, skippedProducts: [] };
  const marker = await prisma.tenantSetting.findUnique({ where: { key: EXTERNAL_SYNC_MARKER }, select: { value: true } });
  if (!options.force && marker?.value === hash) return { ...result, skipped: true };

  const components = new Map<string, MappedComponent>();
  const enclosures = new Map<string, MappedEnclosure>();
  const keyToArticle = new Map<string, string>();
  for (const product of products) {
    const mapped = mapExternalProduct(product);
    if (mapped.kind === "skip") result.skippedProducts.push({ key: mapped.key, reason: mapped.reason });
    else if (mapped.kind === "component") {
      components.set(mapped.data.articleNumber, mapped.data);
      keyToArticle.set(mapped.key, mapped.data.articleNumber);
    } else enclosures.set(mapped.data.articleNumber, mapped.data);
  }

  // Přístroje: vlastní katalog Eldocku má přednost (seed ho při každém startu aktualizuje)
  const existing = new Map(
    (await prisma.catalogComponent.findMany({ where: { articleNumber: { in: [...components.keys()] } }, select: { articleNumber: true, externalSource: true } })).map((row) => [row.articleNumber, row.externalSource]),
  );
  const writable = [...components.values()].filter((component) => {
    if (existing.has(component.articleNumber) && existing.get(component.articleNumber) !== EXTERNAL_SOURCE) {
      result.components.kept++;
      return false;
    }
    if (existing.has(component.articleNumber)) result.components.updated++;
    else result.components.created++;
    return true;
  });
  await inBatches(writable, (batch) =>
    prisma.$transaction(batch.map((data) => prisma.catalogComponent.upsert({ where: { articleNumber: data.articleNumber }, create: data, update: data }))),
  );

  // Skříně rozváděčů
  const knownEnclosures = new Set((await prisma.panelEnclosure.findMany({ where: { articleNumber: { in: [...enclosures.keys()] } }, select: { articleNumber: true } })).map((row) => row.articleNumber));
  for (const article of enclosures.keys()) {
    if (knownEnclosures.has(article)) result.enclosures.updated++;
    else result.enclosures.created++;
  }
  await inBatches([...enclosures.values()], (batch) =>
    prisma.$transaction(batch.map((data) => prisma.panelEnclosure.upsert({ where: { articleNumber: data.articleNumber }, create: data, update: data }))),
  );

  // Vazby příslušenství (podle výrobce + MPN → objednací číslo → id)
  const ids = new Map(
    (await prisma.catalogComponent.findMany({ where: { articleNumber: { in: [...keyToArticle.values()] } }, select: { id: true, articleNumber: true } })).map((row) => [row.articleNumber, row.id]),
  );
  const relations = deriveRelations(products)
    .map((relation) => ({ relation, parentId: ids.get(keyToArticle.get(relation.parent) ?? ""), childId: ids.get(keyToArticle.get(relation.child) ?? "") }))
    .filter((row): row is typeof row & { parentId: string; childId: string } => !!row.parentId && !!row.childId);
  await inBatches(relations, (batch) =>
    prisma.$transaction(
      batch.map(({ relation, parentId, childId }) => {
        const data = { relationType: relation.relationType, basis: relation.basis, verified: relation.verified, note: relation.note || null };
        return prisma.catalogRelation.upsert({
          where: { parentId_childId_relationType: { parentId, childId, relationType: relation.relationType } },
          create: { parentId, childId, ...data },
          update: data,
        });
      }),
    ),
  );
  result.relations = relations.length;

  await prisma.tenantSetting.upsert({ where: { key: EXTERNAL_SYNC_MARKER }, create: { key: EXTERNAL_SYNC_MARKER, value: hash }, update: { value: hash } });
  return result;
}

/** Matice standardních rozvodnic 12–144M (8 výrobců) – upsert, nic nemaže. */
export async function seedStandardEnclosures(prisma: PrismaClient) {
  const matrix = standardEnclosureMatrix();
  await inBatches(matrix, (batch) => prisma.$transaction(batch.map((data) => prisma.panelEnclosure.upsert({ where: { articleNumber: data.articleNumber }, create: data, update: data }))));
  return matrix.length;
}
