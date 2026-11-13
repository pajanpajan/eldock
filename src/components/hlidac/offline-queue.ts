"use client";

import { useSyncExternalStore } from "react";

import { OfflineSyncQueue, indexedDbBlobs, localStorageQueue, type QueueEntry, type SendResult } from "@/lib/offline-sync-queue";

// Fáze 112: jedna offline fronta na prohlížeč (Hlídač revizí, rychlá revize) – odesílání cyklů sekvenčního sběru na
// `/api/hlidac/snap`, počet čekajících záznamů pro indikátor a automatická synchronizace po obnovení připojení.

export interface SnapPayload {
  floorId: string;
  room: string;
  labelCode: string | null;
  passed: boolean;
  rpe: number | null;
  riso: number | null;
  inspectorName: string;
  inspectorLicense: string;
  text: string | null;
}

export interface SnapResponse {
  result: { equipmentId: string; tag: string; name: string; label: string; inspection: "CAPABLE" | "INCAPABLE" | null; warning: string | null };
  duplicate: boolean;
}

let queue: OfflineSyncQueue | null = null;

export function offlineQueue(): OfflineSyncQueue {
  queue ??= new OfflineSyncQueue({ storage: localStorageQueue(), blobs: indexedDbBlobs() });
  return queue;
}

/** Trvalé odmítnutí serverem (4xx kromě 401 / 408 / 429) – záznam se z fronty zahodí. */
export class SnapRejected extends Error {}

/** Jeden cyklus sekvenčního sběru na server (stejné id = server ho přijme jednou). */
export async function postSnap(entry: Pick<QueueEntry<SnapPayload>, "id" | "payload">, blobs: Record<string, Blob>): Promise<SnapResponse> {
  const form = new FormData();
  form.set("id", entry.id);
  const payload = entry.payload;
  form.set("floorId", payload.floorId);
  form.set("room", payload.room);
  if (payload.labelCode) form.set("labelCode", payload.labelCode);
  form.set("passed", payload.passed ? "1" : "0");
  if (payload.rpe !== null) form.set("rpe", String(payload.rpe));
  if (payload.riso !== null) form.set("riso", String(payload.riso));
  form.set("inspectorName", payload.inspectorName);
  form.set("inspectorLicense", payload.inspectorLicense);
  if (payload.text) form.set("text", payload.text);
  if (blobs.photo) form.set("file", blobs.photo, "vyrobni-stitek.jpg");
  const response = await fetch("/api/hlidac/snap", { method: "POST", body: form });
  const data = (await response.json().catch(() => ({}))) as Partial<SnapResponse> & { error?: string };
  if (response.ok && data.result) return data as SnapResponse;
  if (response.status === 401 || response.status === 408 || response.status === 429 || response.status >= 500) throw new Error(`${data.error ?? "Server teď nepřijímá"} (bez připojení)`);
  throw new SnapRejected(data.error ?? "Záznam odmítnut.");
}

/** Odesílač fronty: hotovo / znovu (síť, přihlášení) / zahodit (server záznam natrvalo odmítl). */
export async function sendQueued(entry: QueueEntry, blobs: Record<string, Blob>): Promise<SendResult> {
  if (entry.kind !== "snap") return "drop";
  try {
    await postSnap(entry as QueueEntry<SnapPayload>, blobs);
    return "done";
  } catch (error) {
    if (error instanceof SnapRejected) return "drop";
    return "retry";
  }
}

function subscribe(listener: () => void) {
  return offlineQueue().subscribe(() => listener());
}

/** Počet záznamů čekajících ve frontě (0 na serveru). */
export function useOfflineCount(): number {
  return useSyncExternalStore(subscribe, () => offlineQueue().count(), () => 0);
}
