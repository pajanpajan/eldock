// Přihlašovací brána: podepsaný token v httpOnly cookie `digitry-auth`.
// Jen Web Crypto (žádné Node API) – modul používá `src/proxy.ts` i Server Actions.

// Název cookie zůstává z doby před rebrandingem (zpětná kompatibilita přihlášení).
export const AUTH_COOKIE = "digitry-auth";
/** Platnost přihlášení (12 h = jedna dlouhá směna + rezerva). */
export const AUTH_TTL_SECONDS = 60 * 60 * 12;
/** Výchozí přístupové heslo dema, pokud `ELDOCK_ACCESS_PASSWORD` není nastavené. */
export const DEFAULT_ACCESS_PASSWORD = "eldock2026";

/** Proměnná prostředí `ELDOCK_<name>`, se zpětnou kompatibilitou na `DIGITRY_<name>`. */
export function brandEnv(name: string): string | undefined {
  return process.env[`ELDOCK_${name}`] || process.env[`DIGITRY_${name}`] || undefined;
}

export function accessPassword(): string {
  return brandEnv("ACCESS_PASSWORD") || DEFAULT_ACCESS_PASSWORD;
}

/** Tajemství podpisu; bez `ELDOCK_AUTH_SECRET` se odvodí z hesla (změna hesla = odhlášení všech). */
export function authSecret(): string {
  return brandEnv("AUTH_SECRET") || `digitry-auth:${accessPassword()}`;
}

/** `ELDOCK_BYPASS_AUTH=1` vypne bránu (jen lokální vývoj). */
export function isAuthBypassed(): boolean {
  return brandEnv("BYPASS_AUTH") === "1";
}

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export interface AuthSession {
  userId: string;
  /** Konec platnosti (unix s). */
  expires: number;
}

/** Token `<userId>.<expires>.<podpis>` (HMAC-SHA256, base64url). */
export async function signAuthToken(userId: string, options: { now?: number; ttl?: number; secret?: string } = {}): Promise<string> {
  const expires = Math.floor((options.now ?? Date.now()) / 1000) + (options.ttl ?? AUTH_TTL_SECONDS);
  const payload = `${userId}.${expires}`;
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(options.secret ?? authSecret()), encoder.encode(payload));
  return `${payload}.${toBase64Url(signature)}`;
}

/** Ověří podpis a platnost tokenu; neplatný / prošlý token → `null`. */
export async function verifyAuthToken(token: string | undefined, options: { now?: number; secret?: string } = {}): Promise<AuthSession | null> {
  if (!token || token.length > 512) return null;
  const parts = token.split(".");
  if (parts.length < 3) return null;
  const signature = fromBase64Url(parts.pop()!);
  const expires = Number(parts.pop());
  const userId = parts.join(".");
  if (!signature || !userId || !Number.isInteger(expires)) return null;
  if (expires <= Math.floor((options.now ?? Date.now()) / 1000)) return null;
  const valid = await crypto.subtle.verify("HMAC", await hmacKey(options.secret ?? authSecret()), signature, encoder.encode(`${userId}.${expires}`));
  return valid ? { userId, expires } : null;
}

/** Porovnání hesla v konstantním čase (přes HMAC obou hodnot). */
export async function checkAccessPassword(candidate: string, expected = accessPassword()): Promise<boolean> {
  const key = await hmacKey("digitry-password-check");
  const [a, b] = await Promise.all([crypto.subtle.sign("HMAC", key, encoder.encode(candidate)), crypto.subtle.sign("HMAC", key, encoder.encode(expected))]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

/** Bezpečný cíl přesměrování po přihlášení (jen interní cesta, ne `/login`). */
export function safeNextPath(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return undefined;
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/api/")) return undefined;
  return value;
}
