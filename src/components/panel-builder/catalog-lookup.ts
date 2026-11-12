"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { EtimFrame } from "@/lib/panel-builder/abb-etim.generated";
import type { WiringBomRow } from "@/lib/panel-builder/wiring-bom";
import { catalogEansAction, etimFramesAction } from "@/server/actions/catalog-data";

// Fáze 104: katalogová data ze serveru po kouscích (celé importy ETIM a index fotek jsou `server-only`) – sdílená
// mezipaměť v prohlížeči, dotazy z jednoho vykreslení se sloučí do jednoho požadavku. Bez přihlášení server nic nevrátí
// a komponenty zůstanou u vektorových náhledů / bez EAN.

type ImageLite = { src: string; source: string; license: string };
export type CatalogImageKind = "enclosure" | "box" | "product";

const listeners = new Set<() => void>();
let version = 0;
const notify = () => {
  version += 1;
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const useVersion = () => useSyncExternalStore(subscribe, () => version, () => 0);

// ---------------------------------------------------------------------------
//  Fotky konkrétních výrobků (rozvodnice, krabice, chytrá domácnost)
// ---------------------------------------------------------------------------

const images = new Map<string, ImageLite | null>();
const imagesInFlight = new Set<string>();
const imageQueue: { id: string; kind: CatalogImageKind; key: string }[] = [];
let imageTimer: ReturnType<typeof setTimeout> | null = null;

function flushImages() {
  imageTimer = null;
  const batch = imageQueue.splice(0, 200);
  if (imageQueue.length) imageTimer = setTimeout(flushImages, 0);
  if (!batch.length) return;
  fetch("/api/catalog-images/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: batch.map(({ kind, key }) => ({ kind, key })) }) })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
    .then((data: { results?: (ImageLite | null)[] } | null) => {
      batch.forEach((item, index) => {
        images.set(item.id, data?.results?.[index] ?? null);
        imagesInFlight.delete(item.id);
      });
      notify();
    });
}

function requestImage(kind: CatalogImageKind, key: string) {
  const id = `${kind}:${key}`;
  if (images.has(id) || imagesInFlight.has(id)) return;
  imagesInFlight.add(id);
  imageQueue.push({ id, kind, key });
  if (!imageTimer) imageTimer = setTimeout(flushImages, 0);
}

/** Fotka výrobku z indexu katalogových fotek (ze serveru, sdílená mezipaměť); null = bez fotky / zatím se načítá. */
export function useCatalogImage(kind: CatalogImageKind, key: string | null | undefined): ImageLite | null {
  useEffect(() => {
    if (key) requestImage(kind, key);
  }, [kind, key]);
  useVersion();
  return key ? (images.get(`${kind}:${key}`) ?? null) : null;
}

// ---------------------------------------------------------------------------
//  EAN položek kusovníku
// ---------------------------------------------------------------------------

const eans = new Map<string, string | null>();
const eansInFlight = new Set<string>();
const eanId = (row: Pick<WiringBomRow, "mpn" | "box">) => (row.mpn ? `${row.box ? "box" : "dev"}:${row.mpn}` : null);

function requestEans(ids: readonly string[]) {
  const missing = ids.filter((id) => !eans.has(id) && !eansInFlight.has(id));
  if (!missing.length) return;
  for (const id of missing) eansInFlight.add(id);
  void catalogEansAction(missing.map((id) => ({ code: id.slice(4), box: id.startsWith("box:") }))).then((result) => {
    for (const id of missing) {
      eans.set(id, result.ok ? (result.data[id] ?? null) : null);
      eansInFlight.delete(id);
    }
    notify();
  });
}

/** EAN jedné položky (přístroj / krabice) ze serveru; null = výrobce neuvádí / zatím se načítá. */
export function useCatalogEan(code: string | null | undefined, box: boolean): string | null {
  const id = code ? `${box ? "box" : "dev"}:${code}` : null;
  useEffect(() => {
    if (id) requestEans([id]);
  }, [id]);
  useVersion();
  return id ? (eans.get(id) ?? null) : null;
}

/**
 * Kusovník doplněný o EAN ze serveru: přístroj s číslem v oficiálních datech výrobce (ABB ETIM 9.0) je ověřený, krabice
 * KOPOS dostane EAN ze stránky výrobku. Do načtení se kusovník ukáže bez EAN.
 */
export function useCatalogEans<T extends WiringBomRow>(rows: readonly T[]): readonly T[] {
  const ids = [...new Set(rows.map(eanId).filter((id): id is string => id !== null))].sort();
  const key = ids.join("\n");
  useEffect(() => {
    if (key) requestEans(key.split("\n"));
  }, [key]);
  useVersion();
  return rows.map((row) => {
    const id = eanId(row);
    const ean = id ? eans.get(id) : null;
    return ean ? { ...row, ean, ...(row.box ? {} : { verified: true }) } : row;
  });
}

// ---------------------------------------------------------------------------
//  Rámečky 1R–5R řady (ABB ETIM 9.0)
// ---------------------------------------------------------------------------

const frames = new Map<string, EtimFrame[] | null>();
const framesInFlight = new Set<string>();

/** Rámečky barvy řady z oficiálních dat ABB ETIM 9.0; null = data je neuvádějí / zatím se načítají. */
export function useEtimFrames(key: string | null): EtimFrame[] | null {
  useEffect(() => {
    if (!key || frames.has(key) || framesInFlight.has(key)) return;
    framesInFlight.add(key);
    void etimFramesAction(key).then((result) => {
      frames.set(key, result.ok ? result.data : null);
      framesInFlight.delete(key);
      notify();
    });
  }, [key]);
  useVersion();
  return key ? (frames.get(key) ?? null) : null;
}
