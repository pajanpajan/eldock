// Fáze 72: HTTP server závodu (`node:http`) – převod požadavku na Fetch API pro `PlantServer.handle`.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import type { PlantServer } from "./server";

const MAX_BODY = 20 * 1024 * 1024;

async function readBody(request: IncomingMessage): Promise<Buffer | null> {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return null;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY) throw Object.assign(new Error("Požadavek je příliš velký."), { status: 413 });
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function toFetchRequest(request: IncomingMessage): Promise<Request> {
  const url = `http://${request.headers.host ?? "localhost"}${request.url ?? "/"}`;
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  const body = await readBody(request);
  return new Request(url, { method: request.method, headers, ...(body ? { body: new Uint8Array(body) } : {}) });
}

async function send(response: ServerResponse, fetched: Response) {
  const headers: Record<string, string | string[]> = {};
  fetched.headers.forEach((value, name) => {
    headers[name] = name === "set-cookie" ? [...((headers[name] as string[] | undefined) ?? []), value] : value;
  });
  response.writeHead(fetched.status, headers);
  response.end(fetched.body ? Buffer.from(await fetched.arrayBuffer()) : undefined);
}

/** Spustí HTTP server závodu na portu (0 = volný port). */
export function serveHttp(plant: PlantServer, { port, host }: { port: number; host: string }): Promise<Server> {
  const server = createServer((request, response) => {
    void (async () => {
      try {
        const fetched = await plant.handle(await toFetchRequest(request), { remoteAddress: request.socket.remoteAddress ?? "" });
        await send(response, fetched);
      } catch (error) {
        const status = (error as { status?: number }).status ?? 500;
        response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: { code: status === 413 ? "BAD_REQUEST" : "SERVER_ERROR", message: status === 413 ? "Požadavek je příliš velký." : "Server závodu požadavek nezpracoval." } }));
      }
    })();
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}
