// Fáze 71: čisté části jádra synchronizace – adresa serveru, kaskáda smazání, místní odkazy na fotky, otisk,
// oprávnění úprav a stav „nesynchronizováno déle než 24 h“.

import { describe, expect, it } from "vitest";

import { canMutate } from "@/lib/sync-mutations";

import { SyncApiError, normalizeServerUrl } from "./api";
import { MemoryTokenStore, SyncEngine } from "./engine";
import { collectLocalRefs, replaceLocalRefs, sha256Hex, withUploadPlaceholders, PENDING_UPLOAD_URL } from "./files";
import { MemoryStore } from "./memory-store";
import { applyChanges } from "./store";

const upsert = (entity: string, id: string, data: Record<string, unknown>, seq = 1) => ({ entity, id, op: "upsert" as const, seq, data: { id, ...data } });

describe("adresa serveru", () => {
  it("doplní https, odstraní lomítka a cestu API", () => {
    expect(normalizeServerUrl("eldock.cz")).toBe("https://eldock.cz");
    expect(normalizeServerUrl(" https://eldock.cz/ ")).toBe("https://eldock.cz");
    expect(normalizeServerUrl("http://192.168.1.10:3000/api/sync/v1/")).toBe("http://192.168.1.10:3000");
    expect(normalizeServerUrl("https://server.zavod.local/eldock/")).toBe("https://server.zavod.local/eldock");
    expect(normalizeServerUrl("   ")).toBe("");
  });
});

describe("zápis změn", () => {
  it("smazání rodiče smaže i potomky, přesunutý potomek ve stejné stránce zůstane", async () => {
    const store = new MemoryStore();
    await applyChanges(store, [
      upsert("Plant", "p", { name: "Závod" }),
      upsert("Building", "b1", { plantId: "p" }),
      upsert("Building", "b2", { plantId: "p" }),
      upsert("Floor", "f1", { buildingId: "b1" }),
      upsert("Floor", "f2", { buildingId: "b2" }),
      upsert("Equipment", "e1", { floorId: "f1" }),
      upsert("Equipment", "e2", { floorId: "f1" }),
      upsert("DocumentRevision", "r1", { equipmentId: "e1" }),
      upsert("BomItem", "bom1", { revisionId: "r1" }),
      upsert("InspectionDefect", "d1", { equipmentId: "e1" }),
    ]);
    expect(await store.countRecords()).toBe(10);
    // Budova b1 zmizí; zařízení e2 se ve stejné stránce přestěhovalo do patra f2
    const result = await applyChanges(store, [{ entity: "Building", id: "b1", op: "delete", seq: 2 }, upsert("Equipment", "e2", { floorId: "f2" }, 3)]);
    expect(result).toEqual({ upserted: 1, deleted: 6 });
    expect(store.list("Equipment").map((record) => record.id)).toEqual(["e2"]);
    expect(store.list("BomItem")).toEqual([]);
    expect(store.list("InspectionDefect")).toEqual([]);
    expect(store.list("Floor").map((record) => record.id)).toEqual(["f2"]);
    expect((await store.getRecord("Equipment", "e2"))?.parentId).toBe("f2");
  });

  it("neznámou entitu (novější server) přeskočí", async () => {
    const store = new MemoryStore();
    await applyChanges(store, [upsert("NovaTabulka", "x", {}), upsert("Plant", "p", {})]);
    expect(await store.countRecords()).toBe(1);
  });
});

describe("místní odkazy na fotky", () => {
  const ref = `local:${"a".repeat(64)}`;

  it("najde, nahradí a pro ověření dosadí zástupnou adresu", () => {
    const payload = { equipmentId: "e1", attachments: [{ url: ref, originalUrl: ref }, { url: "/api/files/photos/x.jpg" }], photoUrl: ref };
    expect(collectLocalRefs(payload)).toEqual([ref]);
    expect(replaceLocalRefs(payload, { [ref]: "/api/files/photos/nova.jpg" })).toEqual({ equipmentId: "e1", attachments: [{ url: "/api/files/photos/nova.jpg", originalUrl: "/api/files/photos/nova.jpg" }, { url: "/api/files/photos/x.jpg" }], photoUrl: "/api/files/photos/nova.jpg" });
    expect(withUploadPlaceholders(payload).photoUrl).toBe(PENDING_UPLOAD_URL);
    expect(collectLocalRefs({ text: "local:neni-otisk" })).toEqual([]);
  });

  it("SHA-256 jako hex", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await sha256Hex(new Blob(["abc"]))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("oprávnění a chyby", () => {
  it("úpravu smí zadat účet s jedním z potřebných oprávnění", () => {
    expect(canMutate("changeRequest.submit", ["submitChange"])).toBe(true);
    expect(canMutate("changeRequest.submit", ["resolveDefects"])).toBe(false);
    expect(canMutate("changeRequest.comment", [])).toBe(true);
    expect(canMutate("component.replace", ["recordInspection"])).toBe(true);
  });

  it("výpadek sítě a chyba serveru se opakují, 401 znamená spárovat znovu", () => {
    expect(new SyncApiError(0, "NETWORK", "", true).retryable).toBe(true);
    expect(new SyncApiError(503, "SERVER_ERROR", "").retryable).toBe(true);
    expect(new SyncApiError(409, "CONFLICT", "").retryable).toBe(false);
    expect(new SyncApiError(401, "UNAUTHORIZED", "").unauthorized).toBe(true);
  });
});

describe("stav synchronizace", () => {
  it("po 24 h bez úplné synchronizace je zařízení „nesynchronizované“", async () => {
    let now = new Date("2026-11-09T08:00:00Z");
    const store = new MemoryStore();
    const engine = new SyncEngine({ store, tokens: new MemoryTokenStore("eldk_x"), platform: "WINDOWS", appVersion: "1", now: () => now });
    await store.setMeta({ serverUrl: "https://eldock.cz", userId: "u1", lastSyncAt: "2026-11-09T07:00:00Z" });
    expect(await engine.status()).toMatchObject({ paired: true, stale: false });
    now = new Date("2026-11-10T07:30:00Z");
    expect(await engine.status()).toMatchObject({ stale: true });
  });
});
