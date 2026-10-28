// Čistá databáze pro E2E: smaže e2e.db, aplikuje migrace a nahraje seed.
// Nepoužívá `prisma migrate reset` (to Prisma z AI nástrojů blokuje a mazalo by dev.db).
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const DB = "e2e.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(DB + suffix, { force: true });

const env = { ...process.env, DATABASE_URL: `file:./${DB}` };
execSync("npx prisma migrate deploy", { stdio: "inherit", env });
execSync("npx prisma db seed", { stdio: "inherit", env });
