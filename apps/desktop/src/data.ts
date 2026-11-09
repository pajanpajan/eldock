// Fáze 71: čtení stažených dat závodu pro obrazovky (živé dotazy nad IndexedDB – po synchronizaci se překreslí).

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";

import type { EntityName, EntityRecords, OutboxItem } from "@/sync-client";

import { db } from "./db";
import { useSync } from "./sync";

/** Záznam podle id: `undefined` = načítá se, `null` = v zařízení není. */
export function useRecord<E extends EntityName>(entity: E, id: string | null | undefined): EntityRecords[E] | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const record = await db.records.get([entity, id]);
    return (record?.data as EntityRecords[E] | undefined) ?? null;
  }, [entity, id]);
}

/** Záznamy entity s daným rodičem (patra budovy, revize zařízení …). */
export function useChildren<E extends EntityName>(entity: E, parentId: string | null | undefined): EntityRecords[E][] | undefined {
  return useLiveQuery(async () => {
    if (!parentId) return [];
    const records = await db.records.where("[entity+parentId]").equals([entity, parentId]).toArray();
    return records.map((record) => record.data as unknown as EntityRecords[E]);
  }, [entity, parentId]);
}

/** Všechny záznamy entity. */
export function useAll<E extends EntityName>(entity: E): EntityRecords[E][] | undefined {
  return useLiveQuery(async () => {
    const records = await db.records.where("entity").equals(entity).toArray();
    return records.map((record) => record.data as unknown as EntityRecords[E]);
  }, [entity]);
}

/** Celá fronta úprav v pořadí zadání. */
export function useOutbox(): OutboxItem[] | undefined {
  return useLiveQuery(() => db.outbox.orderBy("createdAt").toArray(), []);
}

/** Adresa pro `<img>` ze souboru v mezipaměti (online soubor stáhne a ověří); offline bez kopie = `null`. */
export function useFileUrl(url: string | null | undefined): string | null {
  const { engine } = useSync();
  const [objectUrl, setObjectUrl] = useState<{ url: string; objectUrl: string } | null>(null);
  const cached = useLiveQuery(async () => (url ? ((await db.files.get(url))?.sha256 ?? "") : null), [url]);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    let created: string | null = null;
    void engine.fileBlob(url).then((blob) => {
      if (!alive || !blob) return;
      created = URL.createObjectURL(blob);
      setObjectUrl({ url, objectUrl: created });
    });
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url, cached, engine]);
  return url && objectUrl?.url === url ? objectUrl.objectUrl : null;
}
