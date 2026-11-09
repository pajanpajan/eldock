// Fáze 71: hlavní proces a preload Electronu → dist-electron/*.cjs (CommonJS – preload v sandboxu ESM neumí).
import { build } from "esbuild";

const common = {
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  external: ["electron"],
  logLevel: "info",
  legalComments: "none",
};

await build({ ...common, entryPoints: ["electron/main.ts"], outfile: "dist-electron/main.cjs" });
await build({ ...common, entryPoints: ["electron/preload.ts"], outfile: "dist-electron/preload.cjs" });
// Fáze 72: server závodu bez okna (Eldock.exe s ELECTRON_RUN_AS_NODE=1 nebo node) – node:sqlite a node:http
await build({ ...common, entryPoints: ["electron/plant-server.ts"], outfile: "dist-electron/plant-server.cjs" });
