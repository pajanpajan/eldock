// Fáze 72: server závodu – spuštění (Eldock.exe --plant-server, npm run plant-server) a veřejné API modulu.

import type { Server } from "node:http";

import { serveHttp } from "./http";
import { PlantServer, type PlantServerOptions } from "./server";

export { PlantServer, PLANT_SERVER_VERSION, type PlantServerOptions, type RequestInfo } from "./server";
export { PlantStore, PLANT_UPLOAD_PREFIX } from "./store";
export { LocalRejection, PROVISIONAL_NUMBER } from "./overlay";
export { serveHttp } from "./http";

export const DEFAULT_PLANT_SERVER_PORT = 8787;

export interface RunningPlantServer {
  plant: PlantServer;
  http: Server;
  /** Adresa, na které server poslouchá (port i při `port: 0`). */
  url: string;
  close(): Promise<void>;
}

/** Spustí server závodu: úložiště v `dataDir`, HTTP na `host:port`, plánovač synchronizace s cloudem. */
export async function startPlantServer(options: PlantServerOptions & { port?: number; host?: string }): Promise<RunningPlantServer> {
  const plant = new PlantServer(options);
  const http = await serveHttp(plant, { port: options.port ?? DEFAULT_PLANT_SERVER_PORT, host: options.host ?? "0.0.0.0" });
  plant.start();
  const address = http.address();
  const port = typeof address === "object" && address ? address.port : options.port ?? DEFAULT_PLANT_SERVER_PORT;
  // Po startu hned zkusit cloud (je-li spárováno) – úpravy z haly z doby výpadku odejdou
  void plant.syncIfPaired();
  return {
    plant,
    http,
    url: `http://localhost:${port}`,
    close: () =>
      new Promise((resolve) => {
        plant.close();
        http.close(() => resolve());
        http.closeAllConnections?.();
      }),
  };
}
