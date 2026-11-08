// Fáze 70: žurnál změn pro synchronizaci aplikací – triggery SQLite nad synchronizovanými tabulkami zapisují do
// `SyncChange` (jeden řádek na záznam: rozsah + pořadí poslední změny z čítače `SyncCounter`).
//
// Závazné: tělo triggeru sahá JEN do tabulek žurnálu (`SyncChange`, `SyncCounter`) a na sloupce svého řádku
// (NEW / OLD). Trigger s odkazem na jinou tabulku rozbije přestavbu té tabulky v migraci Prismy
// (`DROP TABLE` + `ALTER TABLE … RENAME` skončí chybou „error in trigger …: no such table“). Rozsah záznamu
// (závod, zařízení) se proto dědí ze žurnálu rodiče, který vznikl dřív (cizí klíč).
//
// Triggery zakládá `ensureSyncTriggers` (start aplikace, `npm run sync:setup` po migracích v kontejneru, testy).
// Migrace, která tabulku přestaví, její triggery smaže – při dalším startu se doplní a tabulka se přežurnáluje.
// Změna tabulek `SyncChange` / `SyncCounter` = migrace nejdřív smaže všechny triggery `sync…` (jinak selže RENAME).
// Záměrně bez `server-only` (testy nad SQLite).

import type { PrismaClient } from "@/generated/prisma/client";

/** Synchronizované tabulky (= názvy modelů Prismy). Pořadí = rodič před potomkem (doplnění žurnálu). */
export const SYNC_ENTITIES = [
  "Plant",
  "Building",
  "Floor",
  "Equipment",
  "ComplianceDocument",
  "InspectionRecord",
  "InspectionDefect",
  "DocumentRevision",
  "BomItem",
  "SchematicReference",
  "ChangeRequest",
  "Attachment",
  "ChangeRequestEvent",
  "TemporaryModification",
  "EquipmentDocument",
  "SoftwareBackup",
  "MonitoredComponent",
  "User",
] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

type Scope =
  /** Závod sám (plantId = id). */
  | { kind: "plant-self" }
  /** Sloupec se závodem (Building.plantId). */
  | { kind: "plant-column"; column: string }
  /** Rozsah (závod + zařízení) z žurnálu rodiče podle cizího klíče. */
  | { kind: "parent"; table: SyncEntity; column: string }
  /** Záznam firmy (User.companyId) – vidí ho všechna zařízení firmy. */
  | { kind: "company-column"; column: string };

export interface SyncTableDefinition {
  table: SyncEntity;
  scope: Scope;
  /** Záznam je zařízení – `equipmentId` = vlastní id (výřez kategorií účtu). */
  equipmentSelf?: boolean;
  /** Trigger změny jen při změně těchto sloupců (uživatel: jméno a role, ne čas přihlášení). */
  updateOf?: readonly string[];
}

const viaEquipment = { kind: "parent", table: "Equipment", column: "equipmentId" } as const;
const viaRevision = { kind: "parent", table: "DocumentRevision", column: "revisionId" } as const;
const viaChangeRequest = { kind: "parent", table: "ChangeRequest", column: "changeRequestId" } as const;

export const SYNC_TABLES: readonly SyncTableDefinition[] = [
  { table: "Plant", scope: { kind: "plant-self" } },
  { table: "Building", scope: { kind: "plant-column", column: "plantId" } },
  { table: "Floor", scope: { kind: "parent", table: "Building", column: "buildingId" } },
  { table: "Equipment", scope: { kind: "parent", table: "Floor", column: "floorId" }, equipmentSelf: true },
  { table: "ComplianceDocument", scope: viaEquipment },
  { table: "InspectionRecord", scope: viaEquipment },
  { table: "InspectionDefect", scope: viaEquipment },
  { table: "DocumentRevision", scope: viaEquipment },
  { table: "BomItem", scope: viaRevision },
  { table: "SchematicReference", scope: viaRevision },
  { table: "ChangeRequest", scope: viaEquipment },
  { table: "Attachment", scope: viaChangeRequest },
  { table: "ChangeRequestEvent", scope: viaChangeRequest },
  { table: "TemporaryModification", scope: viaEquipment },
  { table: "EquipmentDocument", scope: viaEquipment },
  { table: "SoftwareBackup", scope: viaEquipment },
  { table: "MonitoredComponent", scope: viaEquipment },
  { table: "User", scope: { kind: "company-column", column: "companyId" }, updateOf: ["name", "role", "accountType", "title", "companyId", "homePlantId", "disabledAt"] },
];

/** Verze triggerů v názvu – změna jejich logiky = nové číslo (staré se při startu smažou). */
export const SYNC_TRIGGER_VERSION = 1;
const PREFIX = `sync${SYNC_TRIGGER_VERSION}_`;

const q = (name: string) => `"${name}"`;
/** Čas ve formátu, který zapisuje Prisma (ISO 8601 s milisekundami a +00:00). */
export const SQL_NOW = "strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now')";
/** Další pořadí čítače – řádek čítače se při chybějícím záznamu založí (zápis do tabulky nikdy neselže). */
const BUMP = `INSERT INTO "SyncCounter" ("id", "value", "prunedSeq") VALUES (1, 1, 0) ON CONFLICT ("id") DO UPDATE SET "value" = "value" + 1;`;
const SEQ = `(SELECT "value" FROM "SyncCounter" WHERE "id" = 1)`;

const parentField = (scope: { table: SyncEntity; column: string }, row: string, field: "plantId" | "equipmentId") =>
  `(SELECT "${field}" FROM "SyncChange" WHERE "entity" = '${scope.table}' AND "entityId" = ${row}.${q(scope.column)})`;

/** Výrazy rozsahu záznamu pro řádek `row` (NEW v triggeru, alias v doplnění žurnálu). */
export function scopeExpressions(definition: SyncTableDefinition, row: string): { plant: string; company: string; equipment: string } {
  const self = `${row}."id"`;
  switch (definition.scope.kind) {
    case "plant-self":
      return { plant: self, company: "NULL", equipment: "NULL" };
    case "plant-column":
      return { plant: `${row}.${q(definition.scope.column)}`, company: "NULL", equipment: "NULL" };
    case "parent":
      return {
        plant: parentField(definition.scope, row, "plantId"),
        company: "NULL",
        equipment: definition.equipmentSelf ? self : parentField(definition.scope, row, "equipmentId"),
      };
    case "company-column":
      return { plant: "NULL", company: `${row}.${q(definition.scope.column)}`, equipment: "NULL" };
  }
}

function upsertStatement(definition: SyncTableDefinition) {
  const scope = scopeExpressions(definition, "NEW");
  return [
    `INSERT INTO "SyncChange" ("entity", "entityId", "plantId", "companyId", "equipmentId", "seq", "deleted", "changedAt")`,
    `  VALUES ('${definition.table}', NEW."id", ${scope.plant}, ${scope.company}, ${scope.equipment}, ${SEQ}, 0, ${SQL_NOW})`,
    `  ON CONFLICT ("entity", "entityId") DO UPDATE SET`,
    `    "plantId" = COALESCE(excluded."plantId", "SyncChange"."plantId"),`,
    `    "companyId" = COALESCE(excluded."companyId", "SyncChange"."companyId"),`,
    `    "equipmentId" = COALESCE(excluded."equipmentId", "SyncChange"."equipmentId"),`,
    `    "seq" = excluded."seq", "deleted" = 0, "changedAt" = excluded."changedAt";`,
  ].join("\n");
}

export interface SyncTrigger {
  name: string;
  table: SyncEntity;
  sql: string;
}

/** Všechny triggery žurnálu (vložení, změna, smazání; zařízení navíc změna kategorie → přežurnálovat podstrom). */
export function syncTriggers(): SyncTrigger[] {
  const triggers: SyncTrigger[] = [];
  for (const definition of SYNC_TABLES) {
    const table = q(definition.table);
    const upsert = upsertStatement(definition);
    const updateOf = definition.updateOf ? ` OF ${definition.updateOf.map(q).join(", ")}` : "";
    triggers.push(
      { name: `${PREFIX}${definition.table}_ins`, table: definition.table, sql: `CREATE TRIGGER "${PREFIX}${definition.table}_ins" AFTER INSERT ON ${table}\nBEGIN\n${BUMP}\n${upsert}\nEND` },
      { name: `${PREFIX}${definition.table}_upd`, table: definition.table, sql: `CREATE TRIGGER "${PREFIX}${definition.table}_upd" AFTER UPDATE${updateOf} ON ${table}\nBEGIN\n${BUMP}\n${upsert}\nEND` },
      {
        name: `${PREFIX}${definition.table}_del`,
        table: definition.table,
        sql: `CREATE TRIGGER "${PREFIX}${definition.table}_del" AFTER DELETE ON ${table}\nBEGIN\n${BUMP}\nUPDATE "SyncChange" SET "deleted" = 1, "seq" = ${SEQ}, "changedAt" = ${SQL_NOW} WHERE "entity" = '${definition.table}' AND "entityId" = OLD."id";\nEND`,
      },
    );
  }
  // Změna kategorie zařízení mění, kdo ho vidí (výřez účtu) – celý podstrom dostane nové pořadí (stejné pro všechny
  // jeho řádky; stahování stránku uvnitř stejného pořadí nikdy nerozdělí).
  triggers.push({
    name: `${PREFIX}Equipment_type`,
    table: "Equipment",
    sql: `CREATE TRIGGER "${PREFIX}Equipment_type" AFTER UPDATE OF "type" ON "Equipment" WHEN OLD."type" IS NOT NEW."type"\nBEGIN\n${BUMP}\nUPDATE "SyncChange" SET "seq" = ${SEQ}, "changedAt" = ${SQL_NOW} WHERE "equipmentId" = NEW."id" AND "entity" <> 'Equipment' AND "deleted" = 0;\nEND`,
  });
  return triggers;
}

const normalizeSql = (sql: string) => sql.replace(/\s+/g, " ").trim();

/** Doplnění žurnálu pro řádky bez záznamu (pořadí podle vložení řádku). */
function backfillStatement(definition: SyncTableDefinition) {
  const scope = scopeExpressions(definition, "t");
  return [
    `INSERT INTO "SyncChange" ("entity", "entityId", "plantId", "companyId", "equipmentId", "seq", "deleted", "changedAt")`,
    `SELECT '${definition.table}', t."id", ${scope.plant}, ${scope.company}, ${scope.equipment}, ${SEQ} + ROW_NUMBER() OVER (ORDER BY t.rowid), 0, ${SQL_NOW}`,
    `FROM ${q(definition.table)} t WHERE NOT EXISTS (SELECT 1 FROM "SyncChange" s WHERE s."entity" = '${definition.table}' AND s."entityId" = t."id")`,
  ].join("\n");
}

/** Čítač nikdy pod nejvyšším pořadím v žurnálu. */
const SYNC_COUNTER_CATCH_UP = `UPDATE "SyncCounter" SET "value" = (SELECT MAX("seq") FROM "SyncChange") WHERE "id" = 1 AND "value" < (SELECT COALESCE(MAX("seq"), 0) FROM "SyncChange")`;

export interface EnsureSyncReport {
  created: string[];
  dropped: string[];
  /** Tabulky, kterým triggery chyběly, ačkoli už byly v žurnálu (přestavba migrací) – přežurnálované. */
  repaired: SyncEntity[];
  /** Nově zapsané řádky žurnálu (první spuštění nebo řádky vzniklé bez triggerů). */
  backfilled: number;
  /** Řádky s doplněným rozsahem (rodič se do žurnálu dostal až dodatečně). */
  rescoped: number;
}

/**
 * Založí chybějící a smaže zastaralé triggery žurnálu, doplní žurnál o řádky bez záznamu a opraví tabulky,
 * kterým triggery chyběly (záznamy smazané bez triggeru → značka smazání, ostatní nové pořadí). Idempotentní.
 */
export async function ensureSyncTriggers(prisma: PrismaClient): Promise<EnsureSyncReport> {
  const report: EnsureSyncReport = { created: [], dropped: [], repaired: [], backfilled: 0, rescoped: 0 };
  const expected = syncTriggers();
  await prisma.$transaction(
    async (tx) => {
      const existing = await tx.$queryRawUnsafe<{ name: string; sql: string | null }[]>(`SELECT "name", "sql" FROM "sqlite_master" WHERE "type" = 'trigger' AND "name" LIKE 'sync%'`);
      const journaled = new Set(
        (await tx.$queryRawUnsafe<{ entity: string }[]>(`SELECT DISTINCT "entity" FROM "SyncChange"`)).map((row) => row.entity),
      );
      const current = new Map(existing.map((trigger) => [trigger.name, trigger.sql ?? ""]));
      const expectedNames = new Set(expected.map((trigger) => trigger.name));
      await tx.$executeRawUnsafe(`INSERT OR IGNORE INTO "SyncCounter" ("id", "value", "prunedSeq") VALUES (1, 0, 0)`);
      for (const trigger of existing) {
        if (expectedNames.has(trigger.name)) continue;
        await tx.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger.name}"`);
        report.dropped.push(trigger.name);
      }
      const missing = new Set<SyncEntity>();
      for (const trigger of expected) {
        const sql = current.get(trigger.name);
        if (sql !== undefined && normalizeSql(sql) === normalizeSql(trigger.sql)) continue;
        if (sql !== undefined) await tx.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger.name}"`);
        else missing.add(trigger.table);
        await tx.$executeRawUnsafe(trigger.sql);
        report.created.push(trigger.name);
      }
      for (const definition of SYNC_TABLES) {
        report.backfilled += await tx.$executeRawUnsafe(backfillStatement(definition));
        await tx.$executeRawUnsafe(SYNC_COUNTER_CATCH_UP);
        if (definition.scope.kind === "parent") report.rescoped += await rescope(tx, definition, definition.scope);
        if (missing.has(definition.table) && journaled.has(definition.table)) {
          await rejournal(tx, definition.table);
          report.repaired.push(definition.table);
        }
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
  return report;
}

type RawClient = Pick<PrismaClient, "$executeRawUnsafe" | "$queryRawUnsafe">;

/** Řádky bez závodu, jejichž rodič už rozsah má (rodič se do žurnálu dostal později) – doplnit a znovu poslat. */
async function rescope(tx: RawClient, definition: SyncTableDefinition, scope: { table: SyncEntity; column: string }) {
  const parent = `FROM ${q(definition.table)} t JOIN "SyncChange" p ON p."entity" = '${scope.table}' AND p."entityId" = t.${q(scope.column)} WHERE t."id" = "SyncChange"."entityId"`;
  const where = `"entity" = '${definition.table}' AND "deleted" = 0 AND "plantId" IS NULL AND EXISTS (SELECT 1 ${parent} AND p."plantId" IS NOT NULL)`;
  const [{ count }] = await tx.$queryRawUnsafe<{ count: number | bigint }[]>(`SELECT COUNT(*) AS "count" FROM "SyncChange" WHERE ${where}`);
  if (!Number(count)) return 0;
  await tx.$executeRawUnsafe(`UPDATE "SyncCounter" SET "value" = "value" + 1 WHERE "id" = 1`);
  const equipment = definition.equipmentSelf ? `"entityId"` : `COALESCE("equipmentId", (SELECT p."equipmentId" ${parent}))`;
  return tx.$executeRawUnsafe(`UPDATE "SyncChange" SET "plantId" = (SELECT p."plantId" ${parent}), "equipmentId" = ${equipment}, "seq" = ${SEQ}, "changedAt" = ${SQL_NOW} WHERE ${where}`);
}

/** Tabulka bez triggerů (přestavba migrací): smazané řádky → značka, živé řádky → nové pořadí po jednom. */
async function rejournal(tx: RawClient, table: SyncEntity) {
  await tx.$executeRawUnsafe(`UPDATE "SyncCounter" SET "value" = "value" + 1 WHERE "id" = 1`);
  await tx.$executeRawUnsafe(
    `UPDATE "SyncChange" SET "deleted" = 1, "seq" = ${SEQ}, "changedAt" = ${SQL_NOW} WHERE "entity" = '${table}' AND "deleted" = 0 AND NOT EXISTS (SELECT 1 FROM ${q(table)} t WHERE t."id" = "SyncChange"."entityId")`,
  );
  await tx.$executeRawUnsafe(
    `UPDATE "SyncChange" SET "seq" = c."base" + r."n", "changedAt" = ${SQL_NOW} FROM (SELECT "entityId", ROW_NUMBER() OVER (ORDER BY "seq") AS "n" FROM "SyncChange" WHERE "entity" = '${table}' AND "deleted" = 0) r, (SELECT "value" AS "base" FROM "SyncCounter" WHERE "id" = 1) c WHERE "SyncChange"."entity" = '${table}' AND "SyncChange"."entityId" = r."entityId"`,
  );
  await tx.$executeRawUnsafe(SYNC_COUNTER_CATCH_UP);
}

/** Názvy tabulek, na které tělo triggeru odkazuje (kontrola mantinelu v testech). */
export function referencedTables(sql: string): string[] {
  const names = new Set<string>();
  for (const match of sql.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+"([A-Za-z_]+)"/g)) names.add(match[1]);
  return [...names];
}
