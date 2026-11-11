import { createHash } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { standardEnclosureMatrix } from "@/lib/panel-builder/enclosures";
import { EXTERNAL_SOURCE, deriveRelations, mapExternalProduct, type ExternalProduct, type MappedComponent, type MappedEnclosure } from "@/lib/panel-builder/external-catalog";
import { ABB_ETIM_COMPONENTS, type EtimComponentData } from "@/lib/panel-builder/abb-etim-components.generated";
import { etimEnclosures } from "@/lib/panel-builder/etim-enclosures";
import { VERIFIED_ENCLOSURES, VERIFIED_ENCLOSURE_SOURCE, verifiedEnclosureData } from "@/lib/panel-builder/verified-enclosures";
import { mapWiringDevice, type ExternalWiringDevice } from "@/lib/panel-builder/wiring-devices";

// Import externí databáze prvků „ai-panel-builder“ do katalogu Eldocku (fáze 43): dávkový upsert
// přístrojů (CatalogComponent), skříní (PanelEnclosure) a vazeb příslušenství (CatalogRelation).
// Nic nemaže; vlastní katalog Eldocku (externalSource = null) se stejným objednacím číslem nepřepíše,
// stejně tak ověřené rozvodnice z katalogů výrobců (fáze 86, dataSource MANUFACTURER_CATALOG).

export const EXTERNAL_SYNC_MARKER = "catalog.external-sync";
const BATCH = 150;

export interface SyncResult {
  skipped: boolean;
  products: number;
  components: { created: number; updated: number; kept: number };
  /** `kept` = ověřená rozvodnice z katalogu výrobce (fáze 86) se stejným objednacím číslem – import ji nepřepíše. */
  enclosures: { created: number; updated: number; kept: number };
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
  const result: SyncResult = { skipped: false, products: products.length, components: { created: 0, updated: 0, kept: 0 }, enclosures: { created: 0, updated: 0, kept: 0 }, relations: 0, skippedProducts: [] };
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

  // Skříně rozváděčů – ověřené rozvodnice z katalogů výrobců (fáze 86) má Eldock vlastní, ty import nepřepíše
  const knownEnclosures = new Map(
    (await prisma.panelEnclosure.findMany({ where: { articleNumber: { in: [...enclosures.keys()] } }, select: { articleNumber: true, dataSource: true } })).map((row) => [row.articleNumber, row.dataSource]),
  );
  const writableEnclosures = [...enclosures.values()].filter((enclosure) => {
    const source = knownEnclosures.get(enclosure.articleNumber);
    if (source === VERIFIED_ENCLOSURE_SOURCE) {
      result.enclosures.kept++;
      return false;
    }
    if (source) result.enclosures.updated++;
    else result.enclosures.created++;
    return true;
  });
  await inBatches(writableEnclosures, (batch) =>
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

/**
 * Fáze 86: ověřené rozvodnice z katalogů výrobců (ABB ComfortLine CA, Hager vector II a univers FWU, Schrack TOPO) –
 * přírůstkový upsert podle objednacího čísla, nic nemaže. Orientační matice má jen klíče `STD-…`, import externí
 * databáze řádky s `MANUFACTURER_CATALOG` přeskočí – data výrobce tak nic nepřebije.
 */
export async function seedVerifiedEnclosures(prisma: PrismaClient) {
  // Fáze 94: + rozvodnice ABB z oficiálních dat ETIM 9.0, které ověřený seznam ještě nemá
  const rows = [...VERIFIED_ENCLOSURES, ...etimEnclosures()].map(verifiedEnclosureData);
  await inBatches(rows, (batch) => prisma.$transaction(batch.map((data) => prisma.panelEnclosure.upsert({ where: { articleNumber: data.articleNumber }, create: data, update: data }))));
  return rows.length;
}

/**
 * Fáze 94: oficiální data ABB ETIM 9.0 ke kusům katalogu podle objednacího čísla – EAN, ztrátový výkon Pv [W] (už ne odhad
 * IEC), vestavná hloubka [mm] a technický list (jen kde kus žádný nemá). Běží až po importu externí databáze, aby ho
 * nepřepsal. Vrací počet upravených kusů.
 */
export async function applyEtimComponents(prisma: PrismaClient, data: Readonly<Record<string, EtimComponentData>> = ABB_ETIM_COMPONENTS) {
  const rows = await prisma.catalogComponent.findMany({ where: { articleNumber: { in: Object.keys(data) } }, select: { id: true, articleNumber: true, datasheetUrl: true } });
  const updates = rows.map((row) => {
    const etim = data[row.articleNumber];
    return prisma.catalogComponent.update({
      where: { id: row.id },
      data: {
        ...(etim.ean ? { ean: etim.ean } : {}),
        ...(etim.powerLossWatts ? { powerLossWatts: etim.powerLossWatts, dataSource: "SEED_CATALOG" as const } : {}),
        ...(etim.depthMm ? { depthMm: etim.depthMm } : {}),
        ...(etim.datasheetUrl && !row.datasheetUrl ? { datasheetUrl: etim.datasheetUrl } : {}),
      },
    });
  });
  await inBatches(updates, (batch) => prisma.$transaction([...batch]));
  return rows.length;
}

export const WIRING_SYNC_MARKER = "catalog.wiring-sync";

/** Domovní vypínače, zásuvky a rámečky (fáze 47): dávkový upsert, stejný otisk se přeskočí. */
export async function importWiringDevices(prisma: PrismaClient, rows: readonly ExternalWiringDevice[], options: { force?: boolean } = {}) {
  const hash = catalogHash(rows as unknown as ExternalProduct[]);
  const marker = await prisma.tenantSetting.findUnique({ where: { key: WIRING_SYNC_MARKER }, select: { value: true } });
  if (!options.force && marker?.value === hash) return { skipped: true, imported: 0 };
  const mapped = [...new Map(rows.map(mapWiringDevice).filter((row) => row !== null).map((row) => [row.articleNumber, row])).values()];
  await inBatches(mapped, (batch) => prisma.$transaction(batch.map((data) => prisma.wiringDevice.upsert({ where: { articleNumber: data.articleNumber }, create: data, update: data }))));
  await prisma.tenantSetting.upsert({ where: { key: WIRING_SYNC_MARKER }, create: { key: WIRING_SYNC_MARKER, value: hash }, update: { value: hash } });
  return { skipped: false, imported: mapped.length };
}
