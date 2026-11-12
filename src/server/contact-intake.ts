import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp, { type OutputInfo } from "sharp";
import { z } from "zod";

import type { PrismaClient } from "@/generated/prisma/client";
import { brandEnv } from "@/lib/auth";
import { COMPANY_INFO } from "@/lib/company";
import { CONTACT_STATUSES, IMAGE_MAX_WIDTH, IMAGE_QUALITY, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, contactSchema, notificationSubject, notificationText, ticketLabel } from "@/lib/contact";
import { SITE_URL } from "@/lib/seo";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { smtpTransportFromEnv, type MailTransport } from "@/server/mailer";
import { CONTACT_UPLOAD_KIND, contactCounts, createContactMessage, listContactMessages, markAllContactRead, recordContactNotification, updateContactMessage, type ContactAttachment, type ContactMessageView } from "@/server/services/contact";

// Fáze 107: příjem zpráv kontaktního hubu (POST /api/contact) a správa ve velínu (GET / PATCH). Printscreeny se
// v prohlížeči zmenší (canvas, max. 1600 px, WebP / JPEG 0,82) a server je znovu zakóduje přes sharp do WebP bez
// metadat (GPS z fotek mobilem, nic jiného než obrázek do úložiště neprojde). Notifikace majiteli (SMTP / Resend /
// webhook) jdou až po odpovědi – zpráva se uloží vždy, i když notifikace selže.

/** Složka printscreenů v úložišti aplikace (storage/uploads/feedback – zálohuje se se soubory). */
const FEEDBACK_ROOT = path.join(process.cwd(), "storage", "uploads", CONTACT_UPLOAD_KIND);
/** Celý formulář s printscreeny (3 × max. 3 MB + text). */
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const INPUT_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"]);

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 200);

/** Zmenší a znovu zakóduje obrázek (WebP, max. 1600 px, bez metadat) a uloží ho do storage/uploads/feedback. */
export async function storeContactImage(input: { data: Buffer; name?: string | null }, root: string = FEEDBACK_ROOT): Promise<ContactAttachment> {
  if (!input.data.length || input.data.length > MAX_ATTACHMENT_BYTES) throw new WorkflowError("VALIDATION", `Obrázek může mít nejvýš ${Math.round(MAX_ATTACHMENT_BYTES / 1_000_000)} MB.`);
  let output: { data: Buffer; info: OutputInfo };
  try {
    const image = sharp(input.data, { limitInputPixels: 50_000_000, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.format || !INPUT_FORMATS.has(meta.format)) throw new WorkflowError("VALIDATION", "Přiložit lze jen obrázek (PNG, JPG, WebP, GIF).");
    output = await image
      .rotate()
      .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: Math.round(IMAGE_QUALITY * 100) })
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError("VALIDATION", "Přiložený soubor není čitelný obrázek.");
  }
  const storedName = `${randomUUID()}.webp`;
  await mkdir(root, { recursive: true });
  const target = path.join(/*turbopackIgnore: true*/ root, storedName);
  await writeFile(`${target}.tmp`, output.data);
  await rename(`${target}.tmp`, target);
  return {
    url: `/api/files/${CONTACT_UPLOAD_KIND}/${storedName}`,
    mimeType: "image/webp",
    bytes: output.data.byteLength,
    width: output.info.width,
    height: output.info.height,
    sha256: createHash("sha256").update(output.data).digest("hex"),
    originalName: input.name?.trim().slice(0, 120) || null,
  };
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export interface NotifyDeps {
  smtp?: MailTransport | null;
  fetchImpl?: typeof fetch;
  env?: (name: string) => string | undefined;
}

/**
 * Okamžitá notifikace majiteli o nové zprávě: SMTP (`ELDOCK_SMTP_URL`), Resend (`ELDOCK_RESEND_API_KEY`) a / nebo
 * webhook (`ELDOCK_CONTACT_WEBHOOK_URL` – Slack, Teams, Discord …). Příjemce `ELDOCK_CONTACT_NOTIFY_EMAIL`, jinak
 * kontaktní e-mail firmy. Výsledek se zapíše ke zprávě (velín ukáže, že notifikace nedošla).
 */
export async function notifyContactOwner(prisma: PrismaClient, message: ContactMessageView, deps: NotifyDeps = {}): Promise<{ sent: string[]; errors: string[] }> {
  const env = deps.env ?? brandEnv;
  const adminUrl = `${env("PUBLIC_URL") ?? SITE_URL}/superadmin?tab=zpravy#${ticketLabel(message.ticket).slice(1)}`;
  const subject = notificationSubject(message as Parameters<typeof notificationSubject>[0], message.ticket);
  const text = notificationText({ ...message, attachments: message.attachments.length }, adminUrl);
  const to = env("CONTACT_NOTIFY_EMAIL") ?? COMPANY_INFO.email;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sent: string[] = [];
  const errors: string[] = [];

  const smtp = deps.smtp === undefined ? smtpTransportFromEnv() : deps.smtp;
  if (smtp) {
    try {
      await smtp({ to: [to], subject, text, html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`, replyTo: message.email ?? undefined });
      sent.push("smtp");
    } catch (error) {
      errors.push(`SMTP: ${errorText(error)}`);
    }
  }
  const resendKey = env("RESEND_API_KEY");
  if (resendKey) {
    try {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env("MAIL_FROM") ?? "ELDOCK <noreply@eldock.cz>", to: [to], subject, text, ...(message.email ? { reply_to: message.email } : {}) }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      sent.push("resend");
    } catch (error) {
      errors.push(`Resend: ${errorText(error)}`);
    }
  }
  const webhook = env("CONTACT_WEBHOOK_URL");
  if (webhook) {
    try {
      const body = `${subject}\n\n${text}`;
      const response = await fetchImpl(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body, content: body.slice(0, 1900), ticket: ticketLabel(message.ticket), category: message.category, url: adminUrl }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      sent.push("webhook");
    } catch (error) {
      errors.push(`Webhook: ${errorText(error)}`);
    }
  }
  if (sent.length || errors.length) await recordContactNotification(prisma, message.id, { sent, errors });
  return { sent, errors };
}

/** Požadavek z jiného webu (hlavička Origin s cizím hostitelem) – velín ani zprávy z cizích stránek nepřijímá. */
export function isCrossSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    return new URL(origin).host !== host.split(",")[0].trim();
  } catch {
    return true;
  }
}

export interface ContactPostDeps {
  prisma: PrismaClient;
  /** Kořen úložiště printscreenů (testy dočasná složka). */
  root?: string;
  /** Přihlášená firma Panel Builderu (informativně ke zprávě, hlášení chyby AI k jejímu projektu). */
  senderCompany?: () => Promise<{ id: string } | null>;
  /** Hlášení chyby AI k projektu firmy (fáze 50 – fotka a rozpoznané lišty do velínu). */
  aiFeedback?: (companyId: string, projectId: string, message: string) => Promise<unknown>;
  /** Spuštění úlohy po odpovědi (Next.js `after`), jinak hned. */
  schedule?: (task: () => Promise<void>) => void;
  notify?: (message: ContactMessageView) => Promise<unknown>;
}

/** POST /api/contact – multipart (`payload` JSON + až 3 `images`) nebo JSON bez obrázků. */
export async function handleContactPost(request: Request, deps: ContactPostDeps): Promise<Response> {
  if (isCrossSite(request)) return json({ error: "Zprávu lze odeslat jen z webu ELDOCK." }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: "Zpráva s obrázky je příliš velká (max. 3 obrázky po 3 MB)." }, 413);
  let raw: unknown;
  let files: File[] = [];
  try {
    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await request.formData();
      raw = JSON.parse(String(form.get("payload") ?? "{}"));
      files = form.getAll("images").filter((item): item is File => typeof item === "object" && item !== null && typeof (item as File).arrayBuffer === "function");
    } else {
      raw = await request.json();
    }
  } catch {
    return json({ error: "Formulář se nepodařilo přečíst – zkuste to prosím znovu." }, 400);
  }
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return json({ error: issue?.message ?? "Zkontrolujte prosím formulář.", field: issue?.path.join(".") ?? null }, 400);
  }
  // Past na roboty: skryté pole vyplní jen robot – odpověď jako úspěch, nic se neuloží
  if (parsed.data.website) return json({ ok: true, ticket: null, ticketLabel: null }, 202);
  if (files.length > MAX_ATTACHMENTS) return json({ error: `Přiložit lze nejvýš ${MAX_ATTACHMENTS} obrázky.` }, 400);

  const attachments: ContactAttachment[] = [];
  try {
    for (const file of files) attachments.push(await storeContactImage({ data: Buffer.from(await file.arrayBuffer()), name: file.name }, deps.root));
  } catch (error) {
    return json({ error: error instanceof WorkflowError ? error.message : "Obrázek se nepodařilo uložit." }, 400);
  }
  const company = deps.senderCompany ? await deps.senderCompany().catch(() => null) : null;
  const message = await createContactMessage(deps.prisma, { payload: parsed.data, attachments, senderCompanyId: company?.id ?? null });

  // Hlášení chyby z AI Panel Builderu k vlastnímu projektu firmy → i do „Hlášení chyb AI a fotky“ (snímek lišt pro AI)
  const projectId = message.diagnostics.projectId;
  if (message.category === "BUG" && message.diagnostics.module === "panel-builder" && projectId && company && deps.aiFeedback) {
    await deps.aiFeedback(company.id, projectId, `${ticketLabel(message.ticket)}: ${message.message}`).catch(() => null);
  }

  const notify = deps.notify ?? ((created: ContactMessageView) => notifyContactOwner(deps.prisma, created));
  const task = async () => {
    try {
      await notify(message);
    } catch (error) {
      console.error(`[kontakt] notifikace ${ticketLabel(message.ticket)} selhala: ${errorText(error)}`);
    }
  };
  if (deps.schedule) deps.schedule(task);
  else await task();
  return json({ ok: true, ticket: message.ticket, ticketLabel: ticketLabel(message.ticket) }, 201);
}

export interface ContactAdminDeps {
  prisma: PrismaClient;
  isSuperadmin: () => Promise<boolean>;
}

/** GET /api/contact?filter=bugs – zprávy a počty nepřečtených pro velín. */
export async function handleContactGet(request: Request, deps: ContactAdminDeps): Promise<Response> {
  if (!(await deps.isSuperadmin())) return json({ error: "Jen pro velín ELDOCK." }, 401);
  const params = new URL(request.url).searchParams;
  const [messages, counts] = await Promise.all([listContactMessages(deps.prisma, { filter: params.get("filter") ?? "all", take: Math.min(500, Number(params.get("take")) || 200) }), contactCounts(deps.prisma)]);
  return json({ messages, counts });
}

const patchSchema = z.union([
  z.object({ allRead: z.literal(true) }),
  z.object({
    id: z.string().min(1).max(64),
    status: z.enum(CONTACT_STATUSES as [string, ...string[]]).optional(),
    internalNote: z.string().max(4000).nullable().optional(),
    read: z.boolean().optional(),
  }),
]);

/** PATCH /api/contact – stav zprávy (🔴 Nové → 🟡 V řešení → 🟢 Vyřešeno), interní poznámka, přečteno. */
export async function handleContactPatch(request: Request, deps: ContactAdminDeps): Promise<Response> {
  if (!(await deps.isSuperadmin())) return json({ error: "Jen pro velín ELDOCK." }, 401);
  if (isCrossSite(request)) return json({ error: "Požadavek z cizího webu." }, 403);
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Neplatná změna zprávy." }, 400);
  if ("allRead" in parsed.data) return json({ ok: true, count: await markAllContactRead(deps.prisma) });
  try {
    const { id, status, internalNote, read } = parsed.data;
    const message = await updateContactMessage(deps.prisma, id, { status: status as ContactMessageView["status"] | undefined, internalNote, read });
    return json({ ok: true, message });
  } catch (error) {
    if (error instanceof WorkflowError) return json({ error: error.message }, error.code === "NOT_FOUND" ? 404 : 400);
    throw error;
  }
}
