import { prisma } from "@/lib/prisma";
import { unsubscribe } from "@/server/services/newsletter";

/**
 * Fáze 56: odhlášení jedním kliknutím z poštovního klienta (RFC 8058, hlavička List-Unsubscribe-Post).
 * Jen POST – GET (náhled odkazu, skener pošty) nic neodhlásí a přesměruje na stránku s tlačítkem.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const result = await unsubscribe(prisma, token);
  return Response.json({ ok: result.ok }, { status: result.ok ? 200 : 404 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return Response.redirect(new URL(`/newsletter/odhlaseni?t=${encodeURIComponent(url.searchParams.get("t") ?? "")}`, url), 303);
}
