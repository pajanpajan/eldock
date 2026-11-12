import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { canReadFile } from "@/lib/file-ownership";
import { handleContactGet, handleContactPatch, handleContactPost, notifyContactOwner } from "@/server/contact-intake";

import { contactCounts, listContactMessages, pruneContactMessages, updateContactMessage, type ContactMessageView } from "./contact";
import { createAiFeedback } from "./credits";
import { createTestDb } from "./test-db";

// Fáze 107 nad SQLite: POST /api/contact přijme zprávu ve všech 7 kategoriích s printscreenem a technickou diagnostikou,
// obrázek znovu zakóduje do WebP (max. 1600 px) do složky feedback a zapíše do registru jen pro velín; číslo tiketu
// #EL-1001…, notifikace majiteli, velín (GET / PATCH) a retence vyřízených zpráv.

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let uploads: string;
let root: string;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  uploads = mkdtempSync(path.join(os.tmpdir(), "eldock-uploads-"));
  root = path.join(uploads, "feedback");
});
afterEach(() => {
  db.cleanup();
  rmSync(uploads, { recursive: true, force: true, maxRetries: 3 });
});

const DIAG = { currentUrl: "https://eldock.cz/panel-builder/prj107/thermal", module: "panel-builder", wizardPhase: "3. Výpočet oteplení IEC 60890", projectId: "prj107", viewportSize: "1440×900", userAgent: "Mozilla/5.0 (Vitest)" };
const png = (width = 2400, height = 1200) => sharp({ create: { width, height, channels: 3, background: { r: 30, g: 120, b: 200 } } }).png().toBuffer();

async function post(payload: Record<string, unknown>, images: { data: Buffer; name: string; type: string }[] = [], headers: Record<string, string> = {}, deps: Partial<Parameters<typeof handleContactPost>[1]> = {}) {
  const form = new FormData();
  form.set("payload", JSON.stringify(payload));
  for (const image of images) form.append("images", new File([new Uint8Array(image.data)], image.name, { type: image.type }));
  const request = new Request("https://eldock.cz/api/contact", { method: "POST", body: form, headers });
  const notified: ContactMessageView[] = [];
  const response = await handleContactPost(request, { prisma, root, notify: async (message) => void notified.push(message), ...deps });
  return { status: response.status, body: (await response.json()) as { ok?: boolean; ticket?: number | null; ticketLabel?: string | null; error?: string }, notified };
}

describe("fáze 107 – POST /api/contact, printscreeny a velín", () => {
  it("přijme zprávu ve všech 7 kategoriích s printscreenem a metadaty, uloží ji s číslem tiketu #EL-1001… a obrázek jen pro velín", async () => {
    const screenshot = await png();
    const payloads = [
      { category: "BUG", message: "Po kliknutí na Vygenerovat se nic nestane", email: "jan@firma.example", diagnostics: DIAG },
      { category: "IDEA", subtype: "catalog", message: "Chybí řada Hager gallery", details: { mpn: "WXF001" }, diagnostics: DIAG },
      { category: "MEETING", subtype: "regional", name: "Jan Novák", company: "Elektro Novák", ico: "27074358", phone: "+420 777 123 456", message: "úterý dopoledne", diagnostics: DIAG },
      { category: "PARTNER", subtype: "manufacturer", name: "Petr Výrobce", company: "Rozváděče s.r.o.", email: "obchod@rozvadece.example", message: "Liberecký kraj, EPLAN", diagnostics: DIAG },
      { category: "B2B", name: "Ing. Svoboda", company: "Krajská nemocnice", email: "udrzba@nemocnice.example", details: { tags: ["hospital", "book"] }, diagnostics: DIAG },
      { category: "QR", subtype: "series", name: "Eva", company: "Elektro Plus", email: "info@elektro.example", details: { qrSizes: ["Rozváděče 50 × 25 mm"], quantity: "500", address: "Liberec 1" }, diagnostics: DIAG },
      { category: "ADVICE", message: "Potřebuje koupelna vlastní chránič 30 mA?", phone: "+420 600 000 000", diagnostics: DIAG },
    ];
    const tickets: number[] = [];
    for (const payload of payloads) {
      const result = await post(payload, [{ data: screenshot, name: "printscreen.png", type: "image/png" }]);
      expect(result.status, payload.category).toBe(201);
      expect(result.body.ticketLabel).toBe(`#EL-${result.body.ticket}`);
      expect(result.notified).toHaveLength(1);
      tickets.push(result.body.ticket!);
    }
    expect(tickets).toEqual([1001, 1002, 1003, 1004, 1005, 1006, 1007]);

    const messages = await listContactMessages(prisma);
    expect(messages.map((message) => message.category).sort()).toEqual(["ADVICE", "B2B", "BUG", "IDEA", "MEETING", "PARTNER", "QR"]);
    const bug = messages.find((message) => message.category === "BUG")!;
    expect(bug).toMatchObject({ ticket: 1001, status: "NEW", email: "jan@firma.example", readAt: null });
    expect(bug.diagnostics).toEqual(DIAG);
    expect(bug.attachments).toHaveLength(1);
    const [image] = bug.attachments;
    expect(image).toMatchObject({ mimeType: "image/webp", width: 1600, height: 800 });
    expect(image.url).toMatch(/^\/api\/files\/feedback\/[0-9a-f-]{36}\.webp$/);
    expect(existsSync(path.join(root, image.url.split("/").pop()!))).toBe(true);
    // Soubor přes buffer – sharp by na Windows držel otevřený soubor a dočasná složka by nešla smazat
    const meta = await sharp(readFileSync(path.join(root, image.url.split("/").pop()!))).metadata();
    expect(meta.format).toBe("webp");
    // Registr souborů: printscreen bez firmy → čte ho jen velín (firma ani demo ne)
    const stored = await prisma.storedFile.findUniqueOrThrow({ where: { url: image.url } });
    expect(stored).toMatchObject({ kind: "feedback", ownerKind: "COMPANY", companyId: null, mimeType: "image/webp", source: "server" });
    expect(canReadFile({ demo: false, companyIds: ["firma"], superadmin: false }, image.url, stored)).toBe(false);
    expect(canReadFile({ demo: true, companyIds: [], superadmin: false }, image.url, stored)).toBe(false);
    expect(canReadFile({ demo: false, companyIds: [], superadmin: true }, image.url, stored)).toBe(true);

    const qr = messages.find((message) => message.category === "QR")!;
    expect(qr.details).toEqual({ qrSizes: ["Rozváděče 50 × 25 mm"], quantity: "500", address: "Liberec 1" });
    expect((await contactCounts(prisma)).unread).toBe(7);
    expect((await listContactMessages(prisma, { filter: "meetings" })).map((message) => message.category).sort()).toEqual(["B2B", "MEETING"]);
  });

  it("odmítne neplatný formulář, víc než 3 obrázky, soubor, který není obrázek, a cizí web; past na roboty nic neuloží", async () => {
    const screenshot = await png(800, 600);
    expect((await post({ category: "BUG", message: "x" })).status).toBe(400);
    const four = Array.from({ length: 4 }, (_, index) => ({ data: screenshot, name: `s${index}.png`, type: "image/png" }));
    expect((await post({ category: "BUG", message: "Čtyři obrázky" }, four)).body.error).toContain("nejvýš 3");
    const fake = await post({ category: "BUG", message: "Podvržený soubor" }, [{ data: Buffer.from("<svg onload=alert(1)>"), name: "x.png", type: "image/png" }]);
    expect(fake).toMatchObject({ status: 400, body: { error: "Přiložený soubor není čitelný obrázek." } });
    expect((await post({ category: "BUG", message: "Z cizího webu" }, [], { origin: "https://zly-web.example" })).status).toBe(403);
    const bot = await post({ category: "BUG", message: "Koupte levné hodinky", website: "https://spam.example" });
    expect(bot).toMatchObject({ status: 202, body: { ok: true, ticket: null } });
    expect(await prisma.contactMessage.count()).toBe(0);
    // JSON bez obrázků (stejný web) projde
    const json = await handleContactPost(new Request("https://eldock.cz/api/contact", { method: "POST", headers: { "content-type": "application/json", origin: "https://eldock.cz", host: "eldock.cz" }, body: JSON.stringify({ category: "IDEA", message: "Hromadné přečíslování okruhů" }) }), { prisma, root, notify: async () => undefined });
    expect(json.status).toBe(201);
  });

  it("hlášení chyby z AI Panel Builderu k projektu přihlášené firmy → i do „Hlášení chyb AI a fotky“", async () => {
    await prisma.registeredCompany.create({ data: { id: "pb", ico: "27074358", companyName: "Elektro Tester", street: "Průmyslová 1", city: "Liberec", zip: "460 01", contactName: "Tester", email: "tester@firma.example", phone: "+420 600 000 000", passwordHash: "x", termsAcceptedAt: new Date(), productScope: "PANEL_BUILDER" } });
    await prisma.panelBoardProject.create({ data: { id: "prj107", code: "PB-107", name: "RH1", companyId: "pb", dominantManufacturer: "ABB", dinRailsCount: 3, modulesPerRail: 18 } });
    const result = await post({ category: "BUG", message: "Špatně rozpoznaný stykač na 2. liště", diagnostics: DIAG }, [], {}, { senderCompany: async () => ({ id: "pb" }), aiFeedback: (companyId, projectId, message) => createAiFeedback(prisma, companyId, projectId, message) });
    expect(result.status).toBe(201);
    const report = await prisma.aiFeedbackReport.findFirstOrThrow();
    expect(report).toMatchObject({ projectId: "prj107", companyId: "pb", message: "#EL-1001: Špatně rozpoznaný stykač na 2. liště" });
    expect((await prisma.contactMessage.findFirstOrThrow()).senderCompanyId).toBe("pb");
  });

  it("notifikace majiteli přes SMTP, Resend i webhook se zapíše ke zprávě; chyba notifikace zprávu neztratí", async () => {
    await post({ category: "MEETING", subtype: "online", name: "Jan", email: "jan@firma.example" });
    const [message] = await listContactMessages(prisma);
    const mails: { to: string[]; subject: string; text: string; replyTo?: string }[] = [];
    const calls: { url: string; body: string }[] = [];
    const env = (name: string) => ({ RESEND_API_KEY: "re_test", CONTACT_WEBHOOK_URL: "https://hooks.example/eldock", CONTACT_NOTIFY_EMAIL: "majitel@eldock.example" })[name];
    const result = await notifyContactOwner(prisma, message, {
      env,
      smtp: async (mail) => void mails.push(mail),
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, body: String(init.body) });
        return new Response("{}", { status: 200 });
      }) as unknown as typeof fetch,
    });
    expect(result).toEqual({ sent: ["smtp", "resend", "webhook"], errors: [] });
    expect(mails[0]).toMatchObject({ to: ["majitel@eldock.example"], subject: "#EL-1001 📅 Zájem o osobní schůzku / Živou ukázku – Jan", replyTo: "jan@firma.example" });
    expect(mails[0].text).toContain("💻 Rychlá online ukázka (Google Meet / Teams – 20 min)");
    expect(calls.map((call) => call.url)).toEqual(["https://api.resend.com/emails", "https://hooks.example/eldock"]);
    expect(JSON.parse(calls[1].body)).toMatchObject({ ticket: "#EL-1001", category: "MEETING" });
    expect((await prisma.contactMessage.findFirstOrThrow()).notifiedAt).not.toBeNull();

    const failed = await notifyContactOwner(prisma, message, { env: () => undefined, smtp: async () => Promise.reject(new Error("SMTP spojení odmítnuto")) });
    expect(failed).toEqual({ sent: [], errors: ["SMTP: SMTP spojení odmítnuto"] });
    expect(await prisma.contactMessage.findFirstOrThrow()).toMatchObject({ notifiedAt: null, notifyError: "SMTP: SMTP spojení odmítnuto" });
  });

  it("velín: GET a PATCH jen se superadminem – stav Nové → V řešení → Vyřešeno, poznámka, přečteno; retence po 2 letech", async () => {
    const screenshot = await png(1000, 500);
    await post({ category: "BUG", message: "Chyba s printscreenem", diagnostics: DIAG }, [{ data: screenshot, name: "a.png", type: "image/png" }]);
    await post({ category: "IDEA", message: "Tip na zlepšení" });
    const outsider = { prisma, isSuperadmin: async () => false };
    const admin = { prisma, isSuperadmin: async () => true };
    expect((await handleContactGet(new Request("https://eldock.cz/api/contact"), outsider)).status).toBe(401);
    const list = (await (await handleContactGet(new Request("https://eldock.cz/api/contact?filter=bugs"), admin)).json()) as { messages: ContactMessageView[]; counts: { unread: number } };
    expect(list.messages.map((message) => message.ticket)).toEqual([1001]);
    expect(list.counts.unread).toBe(2);
    const id = list.messages[0].id;

    const patch = (body: unknown, deps = admin) => handleContactPatch(new Request("https://eldock.cz/api/contact", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), deps);
    expect((await patch({ id, status: "IN_PROGRESS" }, outsider)).status).toBe(401);
    expect((await patch({ id, status: "HOTOVO" })).status).toBe(400);
    expect((await patch({ id: "neexistuje", status: "RESOLVED" })).status).toBe(404);
    const progress = (await (await patch({ id, status: "IN_PROGRESS", internalNote: "Opravuji v 107.1" })).json()) as { message: ContactMessageView };
    expect(progress.message).toMatchObject({ status: "IN_PROGRESS", internalNote: "Opravuji v 107.1", resolvedAt: null });
    expect(progress.message.readAt).not.toBeNull();
    expect((await (await patch({ id, read: false })).json()) as { message: ContactMessageView }).toMatchObject({ message: { readAt: null } });
    expect(((await (await patch({ allRead: true })).json()) as { count: number }).count).toBe(2);
    expect((await contactCounts(prisma)).unread).toBe(0);

    // Retence: vyřízená zpráva i s printscreenem zmizí 2 roky po vyřízení (soubor i registr), nevyřízená zůstane
    const resolved = await updateContactMessage(prisma, id, { status: "RESOLVED" }, new Date("2026-11-12T10:00:00Z"));
    const file = resolved.attachments[0];
    const onDisk = path.join(root, file.url.split("/").pop()!);
    expect(existsSync(onDisk)).toBe(true);
    expect(await pruneContactMessages(prisma, new Date("2028-11-01T10:00:00Z"), uploads)).toBe(0);
    expect(await pruneContactMessages(prisma, new Date("2028-11-13T10:00:00Z"), uploads)).toBe(1);
    expect(await prisma.contactMessage.count()).toBe(1);
    expect((await prisma.storedFile.findUniqueOrThrow({ where: { url: file.url } })).deletedAt).not.toBeNull();
    expect(existsSync(onDisk)).toBe(false);
  });
});
