// Fáze 68: vlastník nahraného souboru a pravidla čtení / převzetí – čisté funkce (testované bez databáze).
//
// Soubor firmy čtou jen její přihlášení (Správa závodů i AI Panel Builder), soubor obchodního dema jen demo účty,
// velín vše. Vzorové soubory ze složek `seed/` a sdílené soubory (starší data s více vlastníky) čte každé přihlášení.

export type FileOwnerKind = "DEMO" | "COMPANY" | "SHARED";

/** Vlastník, kterému může patřit nový soubor nebo záznam (sdílený vzniká jen doplněním registru). */
export type FileOwner = { kind: "DEMO" } | { kind: "COMPANY"; companyId: string };

export const DEMO_OWNER: FileOwner = { kind: "DEMO" };
export const companyOwner = (companyId: string): FileOwner => ({ kind: "COMPANY", companyId });

/** Kdo soubor čte: demo účet Správy závodů, firmy přihlášení (uživatel firmy, firma Panel Builderu) a velín. */
export interface FileViewer {
  demo: boolean;
  companyIds: readonly string[];
  superadmin: boolean;
}

/** Záznam registru, podle kterého se rozhoduje (bez registru = neznámý soubor). */
export interface RegisteredFile {
  ownerKind: FileOwnerKind;
  companyId: string | null;
  deletedAt: Date | null;
}

export const FILES_PREFIX = "/api/files/";

export const isSignedIn = (viewer: FileViewer) => viewer.demo || viewer.companyIds.length > 0 || viewer.superadmin;

/** Segmenty adresy `/api/files/<druh>/…` (bez prefixu), jinak null. */
export function uploadSegments(url: string): string[] | null {
  if (!url.startsWith(FILES_PREFIX)) return null;
  const segments = url.slice(FILES_PREFIX.length).split("/");
  return segments.length >= 2 && segments.every(Boolean) ? segments : null;
}

/** Vzorový soubor demo dat (`/api/files/<druh>/seed/…`) – v registru není, čte ho každé přihlášení. */
export function isSeedUpload(url: string): boolean {
  const segments = uploadSegments(url);
  return !!segments && segments.length >= 3 && segments[1] === "seed";
}

/** Nahraný soubor aplikace `/api/files/<druh>/<soubor>` (registr vede jen ty). */
export function isRegistrableUpload(url: string): boolean {
  const segments = uploadSegments(url);
  return !!segments && segments.length === 2 && segments[1] !== "seed" && !segments[1].startsWith(".");
}

/** Veřejné vzorové PDF projekty (`public/demo-docs`). */
export const isDemoDoc = (url: string) => /^\/demo-docs\/[\w.-]+\.pdf$/.test(url);

/** Smí přihlášení soubor přečíst? Neznámý soubor (bez registru) jen velín. */
export function canReadFile(viewer: FileViewer, url: string, file: RegisteredFile | null): boolean {
  if (!isSignedIn(viewer)) return false;
  if (isSeedUpload(url)) return true;
  if (viewer.superadmin) return true;
  if (!file || file.deletedAt) return false;
  if (file.ownerKind === "SHARED") return true;
  if (file.ownerKind === "DEMO") return viewer.demo;
  return !!file.companyId && viewer.companyIds.includes(file.companyId);
}

export type ClaimVerdict = "ok" | "foreign" | "unknown";

/**
 * Smí záznam vlastníka `owner` převzít soubor? Vzorové a sdílené soubory ano, cizí ne. Neznámý soubor
 * (bez registru nebo smazaný) jen v mírném režimu – průběžně ukládaný nákres se starším odkazem nesmí přestat ukládat.
 */
export function claimVerdict(owner: FileOwner, url: string, file: RegisteredFile | null, options: { strict?: boolean } = {}): ClaimVerdict {
  if (isSeedUpload(url) || isDemoDoc(url)) return "ok";
  if (!file || file.deletedAt) return options.strict === false ? "ok" : "unknown";
  if (file.ownerKind === "SHARED") return "ok";
  if (owner.kind === "DEMO") return file.ownerKind === "DEMO" ? "ok" : "foreign";
  return file.ownerKind === "COMPANY" && file.companyId === owner.companyId ? "ok" : "foreign";
}

export const CLAIM_MESSAGES: Record<Exclude<ClaimVerdict, "ok">, string> = {
  foreign: "Soubor patří jinému účtu – nahrajte ho prosím znovu.",
  unknown: "Soubor nebyl nalezen – nahrajte ho prosím znovu.",
};

/** Adresy nahraných souborů ve vstupu akce: řetězce `/api/files/…` v objektech a polích (i v nákresu půdorysu). */
export function collectFileUrls(value: unknown, found: string[] = [], depth = 0): string[] {
  if (value == null || depth > 12) return found;
  if (typeof value === "string") {
    if (value.startsWith(FILES_PREFIX)) found.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectFileUrls(item, found, depth + 1);
  } else if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) collectFileUrls(item, found, depth + 1);
  }
  return found;
}

/** Vlastník pro zápis do registru (`StoredFile.ownerKind` + `companyId`). */
export const ownerColumns = (owner: FileOwner) => (owner.kind === "COMPANY" ? { ownerKind: "COMPANY" as const, companyId: owner.companyId } : { ownerKind: "DEMO" as const, companyId: null });

/** Klíč vlastníka pro porovnání (doplnění registru): `demo`, `company:<id>`. */
export const ownerKey = (owner: FileOwner) => (owner.kind === "COMPANY" ? `company:${owner.companyId}` : "demo");
