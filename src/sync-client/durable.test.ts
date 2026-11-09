// Fáze 73: zrcadlo fronty úprav v souborech mobilní aplikace – co se zrcadlí, obnova po ztrátě dat WebView,
// odpojení a výpadek zápisu zrcadla (bez serveru; odeslání obnovené úpravy na server testuje sync-client.test.ts).

import { describe, expect, it } from "vitest";

import { DurableStore, MemoryBackup, backupBlobName } from "./durable";
import { MemoryStore } from "./memory-store";
import type { OutboxItem } from "./store";

const SESSION = { scope: "s1", user: { id: "u1" } } as unknown as import("./protocol").SyncSession;

const item = (id: string, status: OutboxItem["status"], payload: Record<string, unknown> = {}): OutboxItem => ({
  id,
  type: "changeRequest.comment",
  payload,
  performedAt: "2026-11-09T08:00:00.000Z",
  baseUpdatedAt: null,
  userId: "u1",
  createdAt: `2026-11-09T08:00:0${id.length % 10}.000Z`,
  status,
  attempts: 0,
  label: `Úprava ${id}`,
  equipmentId: "e1",
});

const photo = (key: string, bytes = [0xff, 0xd8, 0xff, 0xd9]) => ({ key, sha256: key.replace("local:", ""), size: bytes.length, mime: "image/jpeg", name: "foto.jpg", kind: "photo", data: new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), storedAt: "2026-11-09T08:00:00.000Z" });
const LOCAL = `local:${"a".repeat(64)}`;

async function mirrored(backup: MemoryBackup) {
  return JSON.parse((await backup.readText("outbox.json")) ?? "[]") as OutboxItem[];
}

describe("DurableStore – zrcadlo fronty v souborech aplikace", () => {
  it("zrcadlí neodeslané, převzaté a odmítnuté úpravy; provedené ne", async () => {
    const backup = new MemoryBackup();
    const store = new DurableStore(new MemoryStore(), backup);
    await store.addOutbox(item("a", "pending"));
    await store.addOutbox(item("bb", "pending"));
    await store.addOutbox(item("ccc", "pending"));
    await store.updateOutbox("bb", { status: "accepted" });
    await store.updateOutbox("ccc", { status: "applied" });
    await store.flush();
    expect((await mirrored(backup)).map((entry) => [entry.id, entry.status])).toEqual([
      ["a", "pending"],
      ["bb", "accepted"],
    ]);
    await store.updateOutbox("a", { status: "rejected", message: "Záznam se mezitím změnil" });
    await store.removeOutbox("bb");
    await store.flush();
    expect(await mirrored(backup)).toMatchObject([{ id: "a", status: "rejected", message: "Záznam se mezitím změnil" }]);
  });

  it("fotka čekající na nahrání je v zrcadle, po úklidu zmizí; soubory ze serveru se nezrcadlí", async () => {
    const backup = new MemoryBackup();
    const store = new DurableStore(new MemoryStore(), backup);
    await store.putFile(photo(LOCAL));
    await store.putFile({ ...photo("/api/files/documents/navod.pdf"), sha256: "b".repeat(64) });
    await store.flush();
    expect(await backup.readBlob(backupBlobName(LOCAL))).toBeInstanceOf(Blob);
    expect(Object.keys(JSON.parse((await backup.readText("files.json")) ?? "{}"))).toEqual([LOCAL]);
    // Po nahrání se doplní jen adresa – data se znovu nezapisují, rejstřík ano
    await store.putFile({ ...photo(LOCAL), uploadedUrl: "/api/files/photos/x.jpg" });
    await store.flush();
    expect(JSON.parse((await backup.readText("files.json")) ?? "{}")[LOCAL]).toMatchObject({ uploadedUrl: "/api/files/photos/x.jpg" });
    await store.removeFile(LOCAL);
    await store.flush();
    expect(await backup.readBlob(backupBlobName(LOCAL))).toBeNull();
    expect(JSON.parse((await backup.readText("files.json")) ?? "{}")).toEqual({});
  });

  it("po ztrátě dat obnoví spárování (stažení od začátku), úpravy a fotky; podruhé nic", async () => {
    const backup = new MemoryBackup();
    const store = new DurableStore(new MemoryStore(), backup);
    await store.setMeta({ serverUrl: "https://eldock.cz", serverName: "Eldock", userId: "u1", deviceId: "d1", deviceName: "Android – Pixel", session: SESSION, cursor: 812, scope: "s1" });
    await store.addOutbox(item("a", "pending", { attachments: [{ url: LOCAL }] }));
    await store.putFile(photo(LOCAL));
    await store.flush();

    const inner = new MemoryStore();
    const restored = new DurableStore(inner, backup);
    expect(await restored.restore()).toEqual({ pairing: true, outbox: 1, files: 1 });
    expect(await inner.getMeta("serverUrl")).toBe("https://eldock.cz");
    expect(await inner.getMeta("userId")).toBe("u1");
    expect(await inner.getMeta("session")).toEqual(SESSION);
    expect(await inner.getMeta("cursor")).toBe(0);
    expect((await inner.listOutbox()).map((entry) => entry.id)).toEqual(["a"]);
    expect((await inner.getFile(LOCAL))?.data.size).toBe(4);
    // Úložiště v pořádku → obnova nic nemění
    expect(await restored.restore()).toEqual({ pairing: false, outbox: 0, files: 0 });
  });

  it("obnova nepřepíše data, která úložiště má", async () => {
    const backup = new MemoryBackup();
    const store = new DurableStore(new MemoryStore(), backup);
    await store.setMeta({ serverUrl: "https://eldock.cz", userId: "u1", cursor: 50 });
    await store.addOutbox(item("a", "pending"));
    await store.flush();
    await store.updateOutbox("a", { attempts: 3 });
    expect(await store.restore()).toEqual({ pairing: false, outbox: 0, files: 0 });
    expect(await store.getMeta("cursor")).toBe(50);
    expect((await store.listOutbox())[0]?.attempts).toBe(3);
  });

  it("odpojení smaže i zrcadlo – po startu se nic neobnoví", async () => {
    const backup = new MemoryBackup();
    const store = new DurableStore(new MemoryStore(), backup);
    await store.setMeta({ serverUrl: "https://eldock.cz", userId: "u1" });
    await store.addOutbox(item("a", "pending"));
    await store.putFile(photo(LOCAL));
    await store.clearAll();
    await store.flush();
    expect(backup.entries.size).toBe(0);
    expect(await new DurableStore(new MemoryStore(), backup).restore()).toEqual({ pairing: false, outbox: 0, files: 0 });
  });

  it("výpadek zápisu zrcadla úložiště nezastaví a ohlásí se", async () => {
    const backup = new MemoryBackup();
    const errors: unknown[] = [];
    const store = new DurableStore(new MemoryStore(), backup, (error) => errors.push(error));
    backup.failWrites = true;
    await store.addOutbox(item("a", "pending"));
    await store.flush();
    expect((await store.listOutbox()).length).toBe(1);
    expect(errors.length).toBe(1);
    // Další zápis po uvolnění místa zrcadlo dorovná
    backup.failWrites = false;
    await store.updateOutbox("a", { attempts: 1 });
    await store.flush();
    expect(await mirrored(backup)).toMatchObject([{ id: "a", attempts: 1 }]);
  });
});
