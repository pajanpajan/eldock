// Fronta spojení SQLite (oprava souběhu zápisů 2026-11-08): dotazy mimo transakci nesmí běžet uprostřed cizí
// otevřené interaktivní transakce – adaptér better-sqlite3 má pro celý proces jediné spojení.

import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";

import { createSqlitePrisma, serializedSqliteAdapter } from "./sqlite-adapter";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let dir: string;
let url: string;
let prisma: PrismaClient;

beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), "eldock-fronta-"));
  url = `file:${path.join(dir, "fronta.db")}`;
  prisma = createSqlitePrisma({ url, strict: true });
  await prisma.$executeRawUnsafe('CREATE TABLE "Note" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "text" TEXT NOT NULL)');
});

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('DELETE FROM "Note"');
});

type Client = PrismaClient | Prisma.TransactionClient;
const insert = (client: Client, text: string) => client.$executeRawUnsafe('INSERT INTO "Note" ("text") VALUES (?)', text);
const texts = async (client: Client = prisma) => (await client.$queryRawUnsafe<{ text: string }[]>('SELECT "text" FROM "Note" ORDER BY "id"')).map((row) => row.text);

/** Transakce, která po prvním zápisu „visí“ `ms` milisekund; `ready` = zápis je uvnitř, `done` = výsledek. */
function holdTransaction(client: PrismaClient, text: string, ms: number, fail = false) {
  let started!: () => void;
  const ready = new Promise<void>((resolve) => (started = resolve));
  const done = client
    .$transaction(async (tx) => {
      await insert(tx, text);
      started();
      await sleep(ms);
      if (fail) throw new Error("vráceno");
    })
    .then(
      () => "potvrzeno",
      (error: Error) => error.message,
    );
  return { ready, done };
}

describe("fronta spojení SQLite", () => {
  it("čtení mimo transakci čeká, dokud otevřená transakce neskončí, a nevidí její nepotvrzené zápisy", async () => {
    const open = holdTransaction(prisma, "nepotvrzeno", 150, true);
    await open.ready;
    let settled = false;
    const read = texts().finally(() => (settled = true));
    await sleep(60);
    expect(settled).toBe(false);
    expect(await open.done).toBe("vráceno");
    expect(await read).toEqual([]);
  });

  it("zápis mimo transakci se neztratí, když se cizí transakce vrátí", async () => {
    const open = holdTransaction(prisma, "vráceno", 100, true);
    await open.ready;
    // then() dotaz spustí hned – během otevřené transakce (await by ho pustil až po ní)
    const write = insert(prisma, "zůstane").then((count) => count);
    expect(await open.done).toBe("vráceno");
    expect(await write).toBe(1);
    expect(await texts()).toEqual(["zůstane"]);
  });

  it("transakce, dávky i dotazy mimo ně dostanou spojení v pořadí příchodu", async () => {
    const open = holdTransaction(prisma, "první", 100);
    await open.ready;
    // Dotaz Prismy se spustí až při then/await – každý pustíme zvlášť a necháme ho dojít do fronty
    const second = insert(prisma, "druhý").then((count) => count);
    await sleep(5);
    const third = prisma.$transaction(async (tx) => insert(tx, "třetí"));
    await sleep(5);
    const batch = prisma.$transaction([insert(prisma, "dávka 1"), insert(prisma, "dávka 2")]);
    await sleep(5);
    const last = insert(prisma, "poslední").then((count) => count);
    await Promise.all([open.done, second, third, batch, last]);
    expect(await texts()).toEqual(["první", "druhý", "třetí", "dávka 1", "dávka 2", "poslední"]);
  });

  it("dávka dotazů ($transaction s polem) se při vrácení cizí transakce neztratí ani nerozdělí", async () => {
    const open = holdTransaction(prisma, "vráceno", 100, true);
    await open.ready;
    const batch = prisma.$transaction([insert(prisma, "dávka 1"), insert(prisma, "dávka 2")]);
    expect(await open.done).toBe("vráceno");
    expect(await batch).toEqual([1, 1]);
    expect(await texts()).toEqual(["dávka 1", "dávka 2"]);
  });

  it("vnořená transakce přes tx (savepoint) dál funguje – vrácená vnořená zahodí jen svou část", async () => {
    await prisma.$transaction(async (tx) => {
      await insert(tx, "venku");
      await tx.$transaction(async (inner) => insert(inner, "uvnitř"));
      await tx
        .$transaction(async (inner) => {
          await insert(inner, "vráceno");
          throw new Error("vnořená chyba");
        })
        .catch(() => undefined);
    });
    expect(await texts()).toEqual(["venku", "uvnitř"]);
  });

  it("transakce, která se nedočká spojení (maxWait), frontu nezablokuje", async () => {
    const open = holdTransaction(prisma, "dlouhá", 150);
    await open.ready;
    await expect(prisma.$transaction(async (tx) => insert(tx, "pozdě"), { maxWait: 20 })).rejects.toThrow();
    expect(await open.done).toBe("potvrzeno");
    await insert(prisma, "potom");
    await prisma.$transaction(async (tx) => insert(tx, "další transakce"));
    expect(await texts()).toEqual(["dlouhá", "potom", "další transakce"]);
  });

  it("snímek zálohy (VACUUM INTO) počká na konec otevřené transakce místo chyby a obsahuje potvrzená data", async () => {
    const open = holdTransaction(prisma, "v záloze", 80);
    await open.ready;
    const target = path.join(dir, `snimek-${Date.now()}.db`);
    const snapshot = prisma.$executeRawUnsafe("VACUUM INTO ?", target).then((count) => count);
    expect(await open.done).toBe("potvrzeno");
    await snapshot;
    const copy = createSqlitePrisma({ url: `file:${target}`, strict: true });
    try {
      expect(await texts(copy)).toEqual(["v záloze"]);
    } finally {
      await copy.$disconnect();
    }
  });

  it("spojení se nepředá dál s neukončenou transakcí (rollback adaptéru bez příkazu ROLLBACK)", async () => {
    const adapter = await serializedSqliteAdapter({ url, strict: true }).connect();
    try {
      const tx = await adapter.startTransaction();
      await tx.executeRaw({ sql: `INSERT INTO "Note" ("text") VALUES ('visí')`, args: [], argTypes: [] });
      // Jako Prisma po chybě COMMIT: zavolá jen rollback() adaptéru, který sám ROLLBACK nespustí
      await tx.rollback();
      const result = await adapter.queryRaw({ sql: 'SELECT COUNT(*) AS "n" FROM "Note"', args: [], argTypes: [] });
      expect(Number(result.rows[0]?.[0])).toBe(0);
    } finally {
      await adapter.dispose();
    }
  });
});

describe("vnější klient uvnitř transakce", () => {
  it("v přísném režimu dotaz hned selže a transakce se vrátí", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await insert(tx, "vráceno");
        await texts(prisma);
      }),
    ).rejects.toThrow(/vnější klient Prismy uvnitř otevřené transakce/);
    expect(await texts()).toEqual([]);
  });

  it("v přísném režimu selže i nová transakce přes vnější klient (interaktivní i dávka dotazů)", async () => {
    await expect(prisma.$transaction(async () => prisma.$transaction(async (tx) => insert(tx, "nikdy")))).rejects.toThrow(/Nová transakce přes vnější klient/);
    await expect(prisma.$transaction(async () => prisma.$transaction([insert(prisma, "nikdy"), insert(prisma, "nikdy 2")]))).rejects.toThrow(/Nová transakce přes vnější klient/);
    // Pole s jediným dotazem Prisma provede bez transakce – zachytí ho kontrola dotazu
    await expect(prisma.$transaction(async () => prisma.$transaction([insert(prisma, "nikdy")]))).rejects.toThrow(/Dotaz přes vnější klient/);
    expect(await texts()).toEqual([]);
  });

  it("mimo přísný režim (produkce) se dotaz provede uvnitř vlastní transakce a zapíše varování", async () => {
    const lenient = createSqlitePrisma({ url, strict: false });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const seen = await lenient.$transaction(async (tx) => {
        await insert(tx, "vlastní");
        return texts(lenient);
      });
      expect(seen).toEqual(["vlastní"]);
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0]?.[0])).toContain("vnější klient Prismy");
    } finally {
      log.mockRestore();
      await lenient.$disconnect();
    }
    expect(await texts()).toEqual(["vlastní"]);
  });

  it("práce spuštěná z transakce, která doběhne po jejím konci, se chová jako běžný dotaz", async () => {
    let later: Promise<string[]> | undefined;
    await prisma.$transaction(async (tx) => {
      await insert(tx, "potvrzeno");
      later = sleep(30).then(() => texts(prisma));
    });
    expect(await later).toEqual(["potvrzeno"]);
  });
});
