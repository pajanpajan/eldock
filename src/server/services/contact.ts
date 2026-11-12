// Fáze 107: zprávy kontaktního a zpětnovazebního hubu nad databází – číslo tiketu „#EL-1042“, uložení zprávy
// s printscreeny (registr souborů jen pro velín), filtry, nepřečtené zprávy, stav Nové → V řešení → Vyřešeno a interní
// poznámka velínu. Čisté služby nad Prisma klientem (testy nad SQLite bez Next.js).

import { unlink } from "node:fs/promises";
import path from "node:path";

import type { PrismaClient } from "@/generated/prisma/client";
import { CONTACT_STATUSES, FIRST_TICKET, categoriesOf, type ContactDiagnostics, type ContactPayload, type ContactStatus } from "@/lib/contact";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { markFilesDeleted } from "./file-registry";

/** Uložený printscreen / fotka zprávy (`/api/files/feedback/<uuid>.webp`). */
export interface ContactAttachment {
  url: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  sha256: string;
  originalName?: string | null;
}

export interface ContactMessageView {
  id: string;
  ticket: number;
  category: string;
  subtype: string | null;
  status: ContactStatus;
  name: string | null;
  company: string | null;
  ico: string | null;
  email: string | null;
  phone: string | null;
  message: string;
  details: Record<string, string | number | string[]>;
  diagnostics: ContactDiagnostics;
  attachments: ContactAttachment[];
  internalNote: string | null;
  senderCompanyId: string | null;
  notifiedAt: Date | null;
  notifyError: string | null;
  readAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

/** Složka úložiště printscreenů (storage/uploads/feedback – zálohuje se se soubory aplikace). */
export const CONTACT_UPLOAD_KIND = "feedback";

function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    const value = JSON.parse(json) as unknown;
    return value && typeof value === "object" ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

type ContactRow = Awaited<ReturnType<PrismaClient["contactMessage"]["findFirstOrThrow"]>>;

export function contactView(row: ContactRow): ContactMessageView {
  const attachments = parseJson<unknown[]>(row.attachmentsJson, []);
  return {
    id: row.id,
    ticket: row.ticket,
    category: row.category,
    subtype: row.subtype,
    status: (CONTACT_STATUSES as string[]).includes(row.status) ? (row.status as ContactStatus) : "NEW",
    name: row.name,
    company: row.company,
    ico: row.ico,
    email: row.email,
    phone: row.phone,
    message: row.message,
    details: parseJson(row.detailsJson, {}),
    diagnostics: parseJson(row.diagnosticsJson, {}),
    attachments: Array.isArray(attachments) ? (attachments.filter((item) => item && typeof item === "object" && typeof (item as ContactAttachment).url === "string") as ContactAttachment[]) : [],
    internalNote: row.internalNote,
    senderCompanyId: row.senderCompanyId,
    notifiedAt: row.notifiedAt,
    notifyError: row.notifyError,
    readAt: row.readAt,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  };
}

const isUniqueViolation = (error: unknown) => error instanceof Error && /Unique constraint|UNIQUE constraint|P2002/.test(`${(error as { code?: string }).code ?? ""} ${error.message}`);

/**
 * Uloží zprávu s dalším číslem tiketu (od #EL-1001) a zapíše printscreeny do registru souborů jako soubory bez firmy
 * (`COMPANY` bez `companyId` → čte je jen velín). Souběžné odeslání se stejným číslem se zopakuje s dalším.
 */
export async function createContactMessage(
  prisma: PrismaClient,
  input: { payload: ContactPayload; attachments?: readonly ContactAttachment[]; senderCompanyId?: string | null; now?: Date },
): Promise<ContactMessageView> {
  const { payload } = input;
  const attachments = input.attachments ?? [];
  const now = input.now ?? new Date();
  const clean = (value: string | undefined) => (value && value.trim() ? value.trim() : null);
  for (let attempt = 0; ; attempt++) {
    try {
      const row = await prisma.$transaction(async (tx) => {
        const last = await tx.contactMessage.aggregate({ _max: { ticket: true } });
        const ticket = Math.max(FIRST_TICKET, (last._max.ticket ?? FIRST_TICKET - 1) + 1);
        const created = await tx.contactMessage.create({
          data: {
            ticket,
            category: payload.category,
            subtype: clean(payload.subtype),
            name: clean(payload.name),
            company: clean(payload.company),
            ico: clean(payload.ico),
            email: clean(payload.email)?.toLowerCase() ?? null,
            phone: clean(payload.phone),
            message: payload.message.trim(),
            detailsJson: JSON.stringify(payload.details ?? {}),
            diagnosticsJson: JSON.stringify(payload.diagnostics ?? {}),
            attachmentsJson: JSON.stringify(attachments),
            senderCompanyId: input.senderCompanyId ?? null,
            createdAt: now,
          },
        });
        for (const file of attachments) {
          await tx.storedFile.create({
            data: { url: file.url, kind: CONTACT_UPLOAD_KIND, ownerKind: "COMPANY", companyId: null, sizeBytes: file.bytes, sha256: file.sha256, mimeType: file.mimeType, originalName: file.originalName ?? null, source: "server", createdAt: now },
          });
        }
        return created;
      });
      return contactView(row);
    } catch (error) {
      if (attempt < 4 && isUniqueViolation(error) && !String((error as Error).message).includes("url")) continue;
      throw error;
    }
  }
}

/** Zprávy pro velín podle filtru (Vše / Chyby / Tipy / Schůzky & B2B / Spolupráce / QR štítky), nejnovější nahoře. */
export async function listContactMessages(prisma: PrismaClient, options: { filter?: string; status?: ContactStatus | null; take?: number } = {}): Promise<ContactMessageView[]> {
  const rows = await prisma.contactMessage.findMany({
    where: { category: { in: categoriesOf(options.filter ?? "all") }, ...(options.status ? { status: options.status } : {}) },
    orderBy: { createdAt: "desc" },
    take: options.take ?? 200,
  });
  return rows.map(contactView);
}

/** Počty zpráv a nepřečtených podle kategorie (odznaky filtrů a lišty velínu). */
export async function contactCounts(prisma: PrismaClient): Promise<{ total: number; unread: number; byCategory: Record<string, { total: number; unread: number }> }> {
  const [all, unread] = await Promise.all([
    prisma.contactMessage.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.contactMessage.groupBy({ by: ["category"], where: { readAt: null }, _count: { _all: true } }),
  ]);
  const byCategory: Record<string, { total: number; unread: number }> = {};
  for (const row of all) byCategory[row.category] = { total: row._count._all, unread: 0 };
  for (const row of unread) byCategory[row.category] = { total: byCategory[row.category]?.total ?? row._count._all, unread: row._count._all };
  const sum = (key: "total" | "unread") => Object.values(byCategory).reduce((acc, value) => acc + value[key], 0);
  return { total: sum("total"), unread: sum("unread"), byCategory };
}

export const contactUnreadCount = (prisma: PrismaClient) => prisma.contactMessage.count({ where: { readAt: null } });

/** Změna stavu, interní poznámky nebo přečtení zprávy ve velínu (změna stavu / poznámky zprávu zároveň přečte). */
export async function updateContactMessage(
  prisma: PrismaClient,
  id: string,
  patch: { status?: ContactStatus; internalNote?: string | null; read?: boolean },
  now: Date = new Date(),
): Promise<ContactMessageView> {
  const current = await prisma.contactMessage.findUnique({ where: { id } });
  if (!current) throw new WorkflowError("NOT_FOUND", "Zpráva nebyla nalezena.");
  if (patch.status && !CONTACT_STATUSES.includes(patch.status)) throw new WorkflowError("VALIDATION", "Neznámý stav zprávy.");
  const touched = patch.status !== undefined || patch.internalNote !== undefined;
  const readAt = patch.read === false ? null : patch.read === true || touched ? (current.readAt ?? now) : current.readAt;
  const row = await prisma.contactMessage.update({
    where: { id },
    data: {
      ...(patch.status ? { status: patch.status, resolvedAt: patch.status === "RESOLVED" ? (current.resolvedAt ?? now) : null } : {}),
      ...(patch.internalNote !== undefined ? { internalNote: patch.internalNote?.trim().slice(0, 4000) || null } : {}),
      readAt,
    },
  });
  return contactView(row);
}

/** Všechny zprávy označit jako přečtené (tlačítko ve velínu). */
export async function markAllContactRead(prisma: PrismaClient, now: Date = new Date()) {
  const result = await prisma.contactMessage.updateMany({ where: { readAt: null }, data: { readAt: now } });
  return result.count;
}

/** Retence (zásady ochrany osobních údajů 7c): vyřízená zpráva i s printscreeny 2 roky od vyřízení. */
export const CONTACT_RETENTION_DAYS = 730;

/** Smaže vyřízené zprávy starší než retence a jejich printscreeny (soubor i záznam v registru). Vrací počet zpráv. */
export async function pruneContactMessages(prisma: PrismaClient, now: Date = new Date(), uploadsRoot: string = path.join(process.cwd(), "storage", "uploads")): Promise<number> {
  const before = new Date(now.getTime() - CONTACT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const old = await prisma.contactMessage.findMany({ where: { status: "RESOLVED", resolvedAt: { lt: before } }, select: { id: true, attachmentsJson: true } });
  if (!old.length) return 0;
  const urls = old.flatMap((row) => parseJson<{ url?: unknown }[]>(row.attachmentsJson, []).map((file) => (typeof file?.url === "string" ? file.url : ""))).filter((url) => url.startsWith(`/api/files/${CONTACT_UPLOAD_KIND}/`));
  await prisma.contactMessage.deleteMany({ where: { id: { in: old.map((row) => row.id) } } });
  for (const url of urls) {
    const name = url.slice(`/api/files/${CONTACT_UPLOAD_KIND}/`.length);
    if (/^[\w-]+\.webp$/.test(name)) await unlink(path.join(/*turbopackIgnore: true*/ uploadsRoot, CONTACT_UPLOAD_KIND, name)).catch(() => undefined);
  }
  await markFilesDeleted(prisma, urls, now);
  return old.length;
}

/** Výsledek notifikace majiteli (SMTP / Resend / webhook) – kvůli kontrole ve velínu. */
export async function recordContactNotification(prisma: PrismaClient, id: string, result: { sent: string[]; errors: string[] }, now: Date = new Date()) {
  await prisma.contactMessage.update({
    where: { id },
    data: { notifiedAt: result.sent.length ? now : null, notifyError: result.errors.length ? result.errors.join(" · ").slice(0, 500) : null },
  });
}
