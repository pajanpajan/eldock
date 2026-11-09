// Fáze 71: klient synchronizačního API v1 (docs/SYNC_API.md) – jen `fetch` (Electron, WebView, Node, testy
// s podvrženým `fetch`). Chyby ve tvaru protokolu převede na `SyncApiError` s českou hláškou pro uživatele.

import { SYNC_API, SYNC_API_VERSION } from "@/lib/sync";

import type { ApiErrorBody, ChangesPage, FileInfo, MutationResult, PairResponse, SyncInfo, SyncPlatformName, SyncSession, UploadedFile, WireMutation } from "./protocol";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class SyncApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Server nedostupný (bez sítě, DNS, odmítnuté spojení). */
    readonly network = false,
  ) {
    super(message);
    this.name = "SyncApiError";
  }

  /** Token neplatí – zařízení spárovat znovu (frontu úprav ponechat). */
  get unauthorized() {
    return this.status === 401;
  }

  /** Zkusit později beze změny (výpadek sítě, chyba serveru, omezení počtu pokusů). */
  get retryable() {
    return this.network || this.status >= 500 || this.status === 429;
  }
}

export const OFFLINE_MESSAGE = "Server je nedostupný – aplikace pracuje offline a úpravy odešle po připojení.";

/** Adresa serveru z toho, co uživatel zadal: doplní https://, odstraní koncová lomítka a cestu API. */
export function normalizeServerUrl(input: string): string {
  let value = input.trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    const pathname = url.pathname.replace(/\/+$/, "").replace(/\/api\/sync\/v1$/i, "").replace(/\/+$/, "");
    return `${url.protocol}//${url.host}${pathname}`;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

interface RequestOptions {
  query?: Record<string, string | number | null | undefined>;
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
}

export class SyncApi {
  constructor(
    readonly server: string,
    private readonly token: string | null,
    private readonly fetcher: FetchLike = (input, init) => fetch(input, init),
  ) {}

  private url(path: string, query?: RequestOptions["query"]) {
    const url = new URL(`${this.server}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    return url.toString();
  }

  private async send(method: string, path: string, options: RequestOptions = {}): Promise<Response> {
    const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    let body = options.body;
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    }
    let response: Response;
    try {
      response = await this.fetcher(this.url(path, options.query), { method, headers, body, cache: "no-store" });
    } catch {
      throw new SyncApiError(0, "NETWORK", OFFLINE_MESSAGE, true);
    }
    if (response.ok || response.status === 304) return response;
    let code = response.status === 401 ? "UNAUTHORIZED" : response.status >= 500 ? "SERVER_ERROR" : "BAD_REQUEST";
    let message = response.status >= 500 ? "Server požadavek nezpracoval – aplikace to zkusí znovu." : `Server odmítl požadavek (HTTP ${response.status}).`;
    try {
      const data = (await response.json()) as ApiErrorBody;
      if (data.error?.code) code = data.error.code;
      if (data.error?.message) message = data.error.message;
    } catch {
      // Tělo bez JSON (např. 404 souboru) – stačí stav
    }
    throw new SyncApiError(response.status, code, message);
  }

  private async json<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.send(method, path, options);
    try {
      return (await response.json()) as T;
    } catch {
      throw new SyncApiError(response.status, "BAD_RESPONSE", "Server vrátil neočekávanou odpověď – je na adrese Eldock?");
    }
  }

  /** Ověří, že na adrese běží Eldock s podporovanou verzí API. */
  async info(): Promise<SyncInfo> {
    let info: SyncInfo;
    try {
      info = await this.json<SyncInfo>("GET", "/api/sync/v1");
    } catch (error) {
      if (error instanceof SyncApiError && !error.network && error.status === 404) throw new SyncApiError(404, "NOT_ELDOCK", "Na této adrese neběží server Eldock – zkontrolujte adresu.");
      throw error;
    }
    if (info.api !== SYNC_API) throw new SyncApiError(0, "NOT_ELDOCK", "Na této adrese neběží server Eldock – zkontrolujte adresu.");
    if (info.version !== SYNC_API_VERSION) throw new SyncApiError(0, "UNSUPPORTED", `Server používá jinou verzi API (${info.version}) – aktualizujte aplikaci.`);
    return info;
  }

  pair(input: { code: string; platform: SyncPlatformName; name: string; appVersion?: string }) {
    return this.json<PairResponse>("POST", "/api/sync/v1/pair", { json: input });
  }

  session() {
    return this.json<SyncSession>("GET", "/api/sync/v1/session");
  }

  changes(input: { cursor: number; scope?: string | null; limit?: number }) {
    return this.json<ChangesPage>("GET", "/api/sync/v1/changes", { query: { cursor: input.cursor, scope: input.scope, limit: input.limit } });
  }

  pushMutations(mutations: WireMutation[]) {
    return this.json<{ results: MutationResult[] }>("POST", "/api/sync/v1/mutations", { json: { mutations } });
  }

  uploadFile(input: { kind: string; name: string; data: Blob; sha256: string }) {
    return this.json<UploadedFile>("POST", "/api/sync/v1/files", {
      query: { kind: input.kind, name: input.name },
      body: input.data,
      headers: { "Content-Type": input.data.type || "application/octet-stream", "X-Content-SHA256": input.sha256 },
    });
  }

  /** Stažení souboru `/api/files/…` (304 = platná kopie podle ETagu). */
  async downloadFile(url: string, etag?: string | null): Promise<{ notModified: true } | { notModified: false; data: Blob; info: FileInfo; etag: string | null }> {
    const response = await this.send("GET", url, { headers: etag ? { "If-None-Match": etag } : {} });
    if (response.status === 304) return { notModified: true };
    const data = await response.blob();
    const mime = response.headers.get("content-type")?.split(";")[0]?.trim() || data.type || "application/octet-stream";
    return { notModified: false, data, etag: response.headers.get("etag"), info: { sha256: response.headers.get("x-content-sha256"), size: data.size, mime } };
  }

  disconnect() {
    return this.json<{ ok: boolean }>("DELETE", "/api/sync/v1/session");
  }
}
