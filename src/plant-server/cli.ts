// Fáze 72: spuštění serveru závodu z příkazové řádky – `Eldock.exe` jako Node (naplánovaná úloha přes
// resources/plant-server.cmd), `node dist-electron/plant-server.cjs` nebo `npm run plant-server`.
// Volby: --data <složka dat> --port <port> --host <adresa>. Záznam provozu do <data>/server-zavodu.log.

import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { DEFAULT_PLANT_SERVER_PORT, startPlantServer } from "./index";

const LOG_MAX_BYTES = 5 * 1024 * 1024;

export async function runPlantServerCli(argv: string[] = process.argv) {
  const arg = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const dataDir = path.resolve(arg("--data") ?? path.join(process.env.ProgramData ?? os.homedir(), "Eldock", "Server zavodu"));
  const port = Number(arg("--port") ?? DEFAULT_PLANT_SERVER_PORT);
  const host = arg("--host") ?? "0.0.0.0";
  mkdirSync(dataDir, { recursive: true });
  const logFile = path.join(dataDir, "server-zavodu.log");
  const log = (message: string) => {
    const line = `${new Date().toISOString()} ${message}`;
    console.log(line);
    try {
      if ((statSync(logFile, { throwIfNoEntry: false })?.size ?? 0) > LOG_MAX_BYTES) renameSync(logFile, `${logFile}.1`);
      appendFileSync(logFile, `${line}\n`);
    } catch {
      // Záznam do souboru je jen pomocný
    }
  };
  try {
    const running = await startPlantServer({ dataDir, port, host, log });
    log(`[server závodu] běží na ${running.url} (síť ${host}:${port}) – správa v prohlížeči, data ${dataDir}`);
    const stop = () => void running.close().then(() => process.exit(0));
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    return running;
  } catch (error) {
    log(`[server závodu] start selhal: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
