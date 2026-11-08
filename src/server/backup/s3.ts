import { createHash, createHmac } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { pipeline } from "node:stream/promises";

// Minimální klient úložiště kompatibilního s S3 (fáze 68): Hetzner Object Storage, AWS S3, MinIO v závodě.
// Podpis AWS Signature Version 4 bez SDK – nahrání souboru (s otiskem SHA-256), stažení, smazání a výpis.

export interface S3Config {
  /** Adresa služby, např. `https://fsn1.your-objectstorage.com` (Hetzner), `https://s3.eu-central-1.amazonaws.com`. */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Adresa `https://služba/bucket/klíč` místo `https://bucket.služba/klíč` (MinIO, starší služby). */
  pathStyle: boolean;
}

export const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const sha256Hex = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data, "utf8").digest();

/** Kódování podle RFC 3986 (AWS SigV4): vše kromě A–Z a–z 0–9 - _ . ~ jako %XX. */
export const encodeRfc3986 = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

/** Čas ve formátu SigV4 `20130524T000000Z`. */
export const amzDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export interface SignInput {
  method: string;
  host: string;
  /** Cesta už zakódovaná (každý segment klíče přes `encodeRfc3986`). */
  path: string;
  /** Parametry dotazu (nezakódované). */
  query?: Record<string, string>;
  headers?: Record<string, string>;
  payloadHash: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  now: Date;
}

/** Kanonický dotaz SigV4: parametry seřazené podle klíče, klíče i hodnoty v RFC 3986. */
export const canonicalQuery = (query: Record<string, string> = {}) =>
  Object.entries(query)
    .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)] as const)
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : x > y ? 1 : 0) : a < b ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

/** Podepíše požadavek (AWS Signature Version 4, služba s3) – vrací hlavičky včetně `authorization`. */
export function signRequest(input: SignInput): Record<string, string> {
  const date = amzDate(input.now);
  const day = date.slice(0, 8);
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(input.headers ?? {})) headers[name.toLowerCase()] = value;
  headers.host = input.host;
  headers["x-amz-content-sha256"] = input.payloadHash;
  headers["x-amz-date"] = date;
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name].trim().replace(/\s+/g, " ")}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [input.method, input.path, canonicalQuery(input.query), canonicalHeaders, signedHeaders, input.payloadHash].join("\n");
  const scope = `${day}/${input.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", date, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, day), input.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  return { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` };
}

export interface S3Object {
  key: string;
  size: number;
}

export class S3Error extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "S3Error";
  }
}

const XML_ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
const unescapeXml = (value: string) => value.replace(/&(amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity]);
const xmlValue = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1];

/** Klient jednoho bucketu. Chyby sítě a 5xx zkusí ještě dvakrát. */
export class S3Client {
  constructor(
    private readonly config: S3Config,
    private readonly options: { timeoutMs?: number; now?: () => Date } = {},
  ) {}

  private target(key: string | null) {
    const base = new URL(this.config.endpoint);
    const encodedKey = key ? key.split("/").map(encodeRfc3986).join("/") : "";
    if (this.config.pathStyle) return { base, host: base.host, path: `${base.pathname.replace(/\/+$/, "")}/${encodeRfc3986(this.config.bucket)}/${encodedKey}` };
    return { base, host: `${this.config.bucket}.${base.host}`, path: `/${encodedKey}` };
  }

  private async send(method: string, key: string | null, init: { query?: Record<string, string>; body?: { filePath: string; size: number }; payloadHash?: string; headers?: Record<string, string>; download?: string }) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.sendOnce(method, key, init);
      } catch (error) {
        lastError = error;
        if (error instanceof S3Error && error.status < 500) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
    throw lastError;
  }

  private sendOnce(method: string, key: string | null, init: { query?: Record<string, string>; body?: { filePath: string; size: number }; payloadHash?: string; headers?: Record<string, string>; download?: string }): Promise<{ status: number; body: Buffer }> {
    const { base, host, path } = this.target(key);
    const query = canonicalQuery(init.query);
    const headers = signRequest({
      method,
      host,
      path,
      query: init.query,
      headers: { ...(init.headers ?? {}), ...(init.body ? { "content-length": String(init.body.size) } : {}) },
      payloadHash: init.payloadHash ?? EMPTY_SHA256,
      region: this.config.region,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      now: this.options.now?.() ?? new Date(),
    });
    delete headers.host;
    const send = base.protocol === "http:" ? httpRequest : httpsRequest;
    return new Promise((resolve, reject) => {
      const req = send(
        { method, protocol: base.protocol, hostname: this.config.pathStyle ? base.hostname : `${this.config.bucket}.${base.hostname}`, port: base.port || undefined, path: query ? `${path}?${query}` : path, headers: { ...headers, host }, timeout: this.options.timeoutMs ?? 120_000 },
        (response: IncomingMessage) => {
          const status = response.statusCode ?? 0;
          if (init.download && status >= 200 && status < 300) {
            pipeline(response, createWriteStream(init.download))
              .then(() => resolve({ status, body: Buffer.alloc(0) }))
              .catch(reject);
            return;
          }
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("error", reject);
          response.on("end", () => {
            const body = Buffer.concat(chunks);
            if (status >= 200 && status < 300) return resolve({ status, body });
            const text = body.toString("utf8");
            const code = xmlValue(text, "Code") ?? `HTTP ${status}`;
            const message = xmlValue(text, "Message");
            reject(new S3Error(`Úložiště záloh odmítlo požadavek (${code}${message ? `: ${message}` : ""}).`, status));
          });
        },
      );
      req.on("timeout", () => req.destroy(new Error("Úložiště záloh neodpovídá (vypršel časový limit).")));
      req.on("error", reject);
      if (init.body) {
        createReadStream(init.body.filePath).on("error", reject).pipe(req);
      } else {
        req.end();
      }
    });
  }

  /** Nahraje soubor pod klíč (s otiskem SHA-256 obsahu – úložiště ověří, že dorazil celý). */
  async putFile(key: string, filePath: string, sha256?: string): Promise<void> {
    const size = (await stat(filePath)).size;
    const payloadHash = sha256 ?? (await hashFile(filePath));
    await this.send("PUT", key, { body: { filePath, size }, payloadHash, headers: { "content-type": "application/octet-stream" } });
  }

  /** Stáhne objekt do souboru. */
  async getFile(key: string, filePath: string): Promise<void> {
    await this.send("GET", key, { download: filePath });
  }

  async deleteObject(key: string): Promise<void> {
    await this.send("DELETE", key, {});
  }

  /** Všechny objekty s prefixem (ListObjectsV2, po stránkách). */
  async list(prefix: string): Promise<S3Object[]> {
    const objects: S3Object[] = [];
    let token: string | undefined;
    do {
      const query: Record<string, string> = { "list-type": "2", prefix, ...(token ? { "continuation-token": token } : {}) };
      const { body } = await this.send("GET", null, { query });
      const xml = body.toString("utf8");
      for (const [, content] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const key = xmlValue(content, "Key");
        if (key) objects.push({ key: unescapeXml(key), size: Number(xmlValue(content, "Size") ?? 0) });
      }
      token = xmlValue(xml, "IsTruncated") === "true" ? unescapeXml(xmlValue(xml, "NextContinuationToken") ?? "") || undefined : undefined;
    } while (token);
    return objects;
  }
}

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}
