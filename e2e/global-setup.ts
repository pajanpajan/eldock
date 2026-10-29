import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { AUTH_COOKIE, signAuthToken } from "../src/lib/auth";
import { E2E_AUTH_SECRET, E2E_AUTH_STATE } from "./auth";

const UPLOAD_DIRS = ["photos", "revisions", "markups", "voice", "documents"].map((dir) => path.join("storage", "uploads", dir));

/**
 * Databázi připravuje už příkaz webServeru (`e2e/prepare-db.ts`). Tady podepíšeme přihlašovací cookie
 * pro všechny testy (`storageState`; test přihlášení ji vynuluje), zapamatujeme si čas
 * a po testech smažeme soubory, které testy nahrály (seedové složky `seed/` zůstanou).
 */
export default async function globalSetup() {
  const token = await signAuthToken("acc-novotny", { secret: E2E_AUTH_SECRET, ttl: 60 * 60 * 6 });
  mkdirSync(path.dirname(E2E_AUTH_STATE), { recursive: true });
  writeFileSync(
    E2E_AUTH_STATE,
    JSON.stringify({ cookies: [{ name: AUTH_COOKIE, value: token, domain: "localhost", path: "/", expires: -1, httpOnly: true, secure: false, sameSite: "Lax" }], origins: [] }),
  );
  const startedAt = Date.now();
  return function globalTeardown() {
    for (const dir of UPLOAD_DIRS) {
      let names: string[] = [];
      try {
        names = readdirSync(dir);
      } catch {
        continue;
      }
      for (const name of names) {
        const file = path.join(dir, name);
        const stat = statSync(file);
        if (stat.isFile() && stat.mtimeMs >= startedAt) rmSync(file, { force: true });
      }
    }
  };
}
