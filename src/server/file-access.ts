import "server-only";

import { isAuthBypassed } from "@/lib/auth";
import { DEMO_OWNER, claimVerdict, companyOwner, isRegistrableUpload, type FileOwner, type FileViewer } from "@/lib/file-ownership";
import { contentTypeFor, type UploadKind } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { getPanelCompany } from "@/server/panel-session";
import { assertFileClaims, markFilesDeleted, registerFile, sha256Hex } from "@/server/services/file-registry";
import { getAuthState, getCurrentUser } from "@/server/session";
import { removeStoredFile, saveUpload } from "@/server/storage";
import { isSuperadmin } from "@/server/superadmin-session";

// Fáze 68: vlastník souborů podle přihlášení – kdo čte (`GET /api/files`), komu patří nový soubor a kontrola,
// že serverová akce ukládá jen soubor svého vlastníka.

/** Kdo se ptá na soubor: demo účet / uživatel firmy (Správa závodů), firma Panel Builderu, velín. */
export async function fileViewer(): Promise<FileViewer> {
  const [state, company, superadmin] = await Promise.all([getAuthState(), getPanelCompany(), isSuperadmin()]);
  const companyIds: string[] = [];
  if (state.user?.companyId) companyIds.push(state.user.companyId);
  if (company) companyIds.push(company.id);
  return { demo: (!!state.user && !state.user.companyId) || (isAuthBypassed() && !state.revoked), companyIds, superadmin };
}

/** Vlastník souborů aktuálního účtu Správy závodů: uživatel registrované firmy = firma, jinak obchodní demo. */
export async function plantFileOwner(): Promise<{ owner: FileOwner; userId: string }> {
  const user = await getCurrentUser();
  return { owner: user.companyId ? companyOwner(user.companyId) : DEMO_OWNER, userId: user.id };
}

/** Vlastník souborů přihlášené firmy AI Panel Builderu (null = nepřihlášeno). */
export async function panelFileOwner(): Promise<FileOwner | null> {
  const company = await getPanelCompany();
  return company ? companyOwner(company.id) : null;
}

/**
 * Komu patří nahrávaný soubor: `scope=panel` (stránky Panel Builderu) = přihlášená firma Panel Builderu, jinak účet
 * Správy závodů; bez přihlášení do závodu firma Panel Builderu. null = nikdo přihlášený (401).
 */
export async function uploadOwner(scope: string | null): Promise<{ owner: FileOwner; uploadedById: string | null } | null> {
  if (scope !== "panel") {
    const state = await getAuthState();
    if (state.user || (isAuthBypassed() && !state.revoked)) {
      const { owner, userId } = await plantFileOwner();
      return { owner, uploadedById: userId };
    }
  }
  const owner = await panelFileOwner();
  return owner ? { owner, uploadedById: null } : null;
}

export interface StoreUploadInput {
  dir: UploadKind;
  extension: string;
  data: Buffer | string;
  owner: FileOwner;
  uploadedById?: string | null;
  originalName?: string | null;
  source?: "upload" | "server";
}

/** Uloží soubor do úložiště a zapíše ho do registru s vlastníkem, velikostí a otiskem SHA-256. */
export async function storeUpload(input: StoreUploadInput) {
  const data = typeof input.data === "string" ? Buffer.from(input.data) : input.data;
  const saved = await saveUpload(input.dir, input.extension, data);
  await registerFile(prisma, {
    url: saved.url,
    kind: input.dir,
    owner: input.owner,
    uploadedById: input.uploadedById,
    sizeBytes: data.byteLength,
    sha256: sha256Hex(data),
    mimeType: contentTypeFor(saved.storedName),
    originalName: input.originalName,
    source: input.source ?? "upload",
  });
  return saved;
}

/** Soubor vytvořený serverem pro aktuální účet Správy závodů (zpráva o revizi, revize schématu, protokol importu). */
export async function storePlantFile(dir: UploadKind, extension: string, data: Buffer | string) {
  const { owner, userId } = await plantFileOwner();
  return storeUpload({ dir, extension, data, owner, uploadedById: userId, source: "server" });
}

/**
 * Serverová akce smí do záznamu uložit jen soubor svého vlastníka (vzorové, veřejné a sdílené soubory kdokoli).
 * `strict: false` = neznámý soubor projde (průběžně ukládaný nákres se starším odkazem).
 */
export async function assertFilesOwnedBy(urls: Iterable<string | null | undefined>, owner: FileOwner, options: { strict?: boolean } = {}) {
  await assertFileClaims(prisma, urls, owner, options);
}

/** Soubory pro záznam aktuálního účtu Správy závodů. */
export async function assertPlantFiles(urls: Iterable<string | null | undefined>, options: { strict?: boolean } = {}) {
  const { owner } = await plantFileOwner();
  await assertFilesOwnedBy(urls, owner, options);
}

/** Soubory pro záznam přihlášené firmy Panel Builderu. */
export async function assertPanelFiles(companyId: string, urls: Iterable<string | null | undefined>, options: { strict?: boolean } = {}) {
  await assertFilesOwnedBy(urls, companyOwner(companyId), options);
}

/**
 * Smaže soubor z úložiště jen tehdy, když patří danému vlastníkovi (sdílené, vzorové a cizí soubory nikdy),
 * a v registru ho označí jako smazaný (záloha mimo server ho odstraní po 30 dnech).
 */
export async function removeOwnedFile(owner: FileOwner, url: string): Promise<boolean> {
  if (!isRegistrableUpload(url)) return false;
  const file = await prisma.storedFile.findUnique({ where: { url }, select: { ownerKind: true, companyId: true, deletedAt: true } });
  if (!file || file.ownerKind === "SHARED" || claimVerdict(owner, url, file) !== "ok") return false;
  const removed = await removeStoredFile(url);
  if (removed) await markFilesDeleted(prisma, [url]);
  return removed;
}
