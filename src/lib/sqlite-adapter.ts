// Serializovaný adaptér SQLite pro Prismu – oprava souběhu zápisů (2026-11-08).
//
// @prisma/adapter-better-sqlite3 drží jediné spojení a zámek má jen mezi transakcemi. Dotaz jiného požadavku mimo
// transakci (findMany, update…) se proto provedl uprostřed cizí otevřené interaktivní transakce: viděl její
// nepotvrzené zápisy a jeho vlastní zápis zmizel, když se ta transakce vrátila (ověřeno sondou ve fázi 70).
// Obal staví transakce i dotazy mimo ně do jedné fronty – dotaz mimo transakci počká, až otevřená transakce skončí
// (COMMIT/ROLLBACK). Dotazy transakce jdou přes její `tx` rovnou. better-sqlite3 je synchronní, takže dotaz mimo
// transakci se při volném spojení provede hned a fronta nic nezdrží.
//
// Bez `server-only`: používají ho i integrační testy (test-db).

import { AsyncLocalStorage } from "node:async_hooks";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/prisma/client";

type Adapter = Awaited<ReturnType<PrismaBetterSqlite3["connect"]>>;
type Transaction = Awaited<ReturnType<Adapter["startTransaction"]>>;

export interface SqliteClientOptions {
  url: string;
  /** Čekání na zámek souboru jiným procesem (záloha, skript) v ms – `busy_timeout`. */
  timeout?: number;
  /**
   * Přísný režim (vývoj, testy, E2E): dotaz přes vnější klient uvnitř callbacku `$transaction` skončí chybou.
   * V produkci se provede uvnitř té transakce jako před opravou (jinak by čekal sám na sebe až do vypršení
   * transakce) a zapíše se varování do logu.
   */
  strict: boolean;
}

/** Chybné použití klienta uvnitř interaktivní transakce. */
export class TransactionMisuseError extends Error {
  override name = "TransactionMisuseError";
}

export const OUTER_QUERY_MESSAGE = "Dotaz přes vnější klient Prismy uvnitř otevřené transakce – v callbacku `$transaction(async (tx) => …)` používejte jen `tx`.";
export const NESTED_TRANSACTION_MESSAGE = "Nová transakce přes vnější klient Prismy uvnitř otevřené transakce – použijte `tx` (vnořená transakce: `tx.$transaction`).";

/** Fronta FIFO na jedno spojení: transakce a dotazy mimo ni dostanou spojení v pořadí příchodu. */
class ConnectionQueue {
  #busy = false;
  #waiting: Array<() => void> = [];

  get idle() {
    return !this.#busy && this.#waiting.length === 0;
  }

  acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const grant = () => {
        this.#busy = true;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          const next = this.#waiting.shift();
          if (next) next();
          else this.#busy = false;
        });
      };
      if (this.idle) grant();
      else this.#waiting.push(grant);
    });
  }
}

/**
 * Callback jedné interaktivní transakce. `holders` = spojení (fronty), na kterých má otevřenou transakci – dotaz
 * na stejné spojení přes vnější klient by čekal sám na sebe.
 */
interface TransactionScope {
  holders: Set<ConnectionQueue>;
}

const scopes = new AsyncLocalStorage<TransactionScope>();
const warnedSites = new Set<string>();

type Connection = { inTransaction: boolean; exec(sql: string): unknown };

/** Spojení better-sqlite3 uvnitř adaptéru (vlastnost `client`) – pojistka proti předání otevřené transakce dál. */
function connectionOf(adapter: Adapter): Connection | null {
  const client = (adapter as unknown as { client?: { inTransaction?: unknown; exec?: unknown } }).client;
  return client && typeof client.inTransaction === "boolean" && typeof client.exec === "function" ? (client as Connection) : null;
}

function warnOnce(error: Error) {
  const site = error.stack?.split("\n").slice(1, 8).join("\n") ?? error.message;
  if (warnedSites.has(site) || warnedSites.size >= 50) return;
  warnedSites.add(site);
  console.error(`[prisma] ${error.message} Dotaz proběhl uvnitř té transakce.`, error.stack);
}

function wrapTransaction(tx: Transaction, close: () => void): Transaction {
  const wrapped: Transaction = {
    provider: tx.provider,
    adapterName: tx.adapterName,
    options: tx.options,
    queryRaw: (query) => tx.queryRaw(query),
    executeRaw: (query) => tx.executeRaw(query),
    async commit() {
      try {
        await tx.commit();
      } finally {
        close();
      }
    },
    async rollback() {
      try {
        await tx.rollback();
      } finally {
        close();
      }
    },
  };
  const { createSavepoint, rollbackToSavepoint, releaseSavepoint } = tx;
  if (createSavepoint) wrapped.createSavepoint = (name) => createSavepoint.call(tx, name);
  if (rollbackToSavepoint) wrapped.rollbackToSavepoint = (name) => rollbackToSavepoint.call(tx, name);
  if (releaseSavepoint) wrapped.releaseSavepoint = (name) => releaseSavepoint.call(tx, name);
  return wrapped;
}

function serialize(inner: Adapter, strict: boolean): Adapter {
  const queue = new ConnectionQueue();
  const connection = connectionOf(inner);

  async function outside<T>(run: () => Promise<T>): Promise<T> {
    if (scopes.getStore()?.holders.has(queue)) {
      const error = new TransactionMisuseError(OUTER_QUERY_MESSAGE);
      if (strict) throw error;
      warnOnce(error);
      return run();
    }
    if (queue.idle) return run();
    const release = await queue.acquire();
    try {
      return await run();
    } finally {
      release();
    }
  }

  const adapter: Adapter = {
    provider: inner.provider,
    adapterName: inner.adapterName,
    queryRaw: (query) => outside(() => inner.queryRaw(query)),
    executeRaw: (query) => outside(() => inner.executeRaw(query)),
    executeScript: (script) => outside(() => inner.executeScript(script)),
    async startTransaction(isolationLevel) {
      const scope = scopes.getStore();
      if (scope?.holders.has(queue)) throw new TransactionMisuseError(NESTED_TRANSACTION_MESSAGE);
      const release = await queue.acquire();
      let tx: Transaction;
      try {
        tx = await inner.startTransaction(isolationLevel);
      } catch (error) {
        release();
        throw error;
      }
      scope?.holders.add(queue);
      let closed = false;
      return wrapTransaction(tx, () => {
        if (closed) return;
        closed = true;
        scope?.holders.delete(queue);
        // Spojení nesmí jít dál s otevřenou transakcí – Prisma po chybě COMMIT volá jen `rollback()` adaptéru,
        // který sám ROLLBACK nespustí, a další dotazy by běžely uvnitř visící transakce.
        if (connection?.inTransaction) {
          try {
            connection.exec("ROLLBACK");
          } catch (error) {
            console.error("[prisma] ROLLBACK neukončené transakce selhal:", error);
          }
        }
        release();
      });
    },
    dispose: () => inner.dispose(),
  };
  const { getConnectionInfo } = inner;
  if (getConnectionInfo) adapter.getConnectionInfo = () => getConnectionInfo.call(inner);
  return adapter;
}

/** Továrna adaptéru pro `new PrismaClient({ adapter })` – better-sqlite3 se serializovaným spojením. */
export function serializedSqliteAdapter(options: SqliteClientOptions) {
  const factory = new PrismaBetterSqlite3({ url: options.url, ...(options.timeout === undefined ? {} : { timeout: options.timeout }) });
  const provider: "sqlite" = factory.provider;
  return {
    provider,
    adapterName: factory.adapterName,
    connect: async () => serialize(await factory.connect(), options.strict),
    connectToShadowDb: async () => serialize(await factory.connectToShadowDb(), options.strict),
  };
}

type TransactionMethod = (this: unknown, ...args: unknown[]) => unknown;

/**
 * `$transaction(callback)` spustí callback ve vlastním rozsahu, aby adaptér poznal dotaz přes vnější klient uvnitř
 * něj. Vnořené `tx.$transaction` (savepoint), pole dotazů i transakce uvnitř otevřené transakce projdou beze změny.
 */
function trackTransactions(client: PrismaClient): PrismaClient {
  const target = client as unknown as { $transaction: TransactionMethod };
  const original = target.$transaction;
  target.$transaction = function (this: unknown, ...args: unknown[]) {
    const scope = scopes.getStore();
    if (typeof args[0] !== "function" || (scope && scope.holders.size > 0)) return original.apply(this, args);
    return scopes.run({ holders: new Set() }, () => original.apply(this, args));
  };
  return client;
}

/** Klient Prismy nad SQLite se serializovaným spojením (aplikace i integrační testy). */
export function createSqlitePrisma(options: SqliteClientOptions): PrismaClient {
  return trackTransactions(new PrismaClient({ adapter: serializedSqliteAdapter(options) }));
}
