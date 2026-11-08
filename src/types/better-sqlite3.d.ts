// Minimální typy better-sqlite3 (balík nemá vlastní a @types nepoužíváme) – jen to, co potřebují zálohy (fáze 68):
// kontrola integrity snímku databáze a čtení obnovené zálohy. Aplikace jinak k SQLite přistupuje jen přes Prismu.
declare module "better-sqlite3" {
  interface Statement {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }
  interface Database {
    prepare(sql: string): Statement;
    pragma(source: string, options?: { simple?: boolean }): unknown;
    close(): void;
  }
  interface DatabaseConstructor {
    new (filename: string, options?: { readonly?: boolean; fileMustExist?: boolean }): Database;
  }
  const Database: DatabaseConstructor;
  export default Database;
}
